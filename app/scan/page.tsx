"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, ArrowLeft, Check, Sparkles, X, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAnnounce, useKeyPress } from "@/lib/hooks";
import { useLanguage } from "@/contexts/LanguageContext";
import Script from "next/script";
import Tesseract from "tesseract.js";
import { useAuth } from "@/contexts/AuthContext";
import { useScanConfig } from "@/contexts/ScanContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { LogItem } from "@/components/dashboard/LogTimeline";

interface ScanResult {
    summary: string;
    sentiment: string;
    events: Array<{
        time: string;
        title: string;
    }>;
    tags: string[];
}

export default function ScanPage() {
    const { t, locale } = useLanguage();
    const { user } = useAuth();
    const [image, setImage] = useState<string | null>(null);
    const [scanStage, setScanStage] = useState<'idle' | 'cropping' | 'transforming' | 'analyzing' | 'complete'>('idle');
    const [cropPoints, setCropPoints] = useState<{ x: number, y: number }[]>([
        { x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 80 }, { x: 20, y: 80 }
    ]);
    const [activeElement, setActiveElement] = useState<number | string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastPointerPos = useRef<{ x: number, y: number } | null>(null);
    const [viewMode, setViewMode] = useState<'original' | 'digital'>('digital');
    const [result, setResult] = useState<ScanResult | null>(null);
    const [transformedImage, setTransformedImage] = useState<string | null>(null);
    const [cvReady, setCvReady] = useState(false);

    const { capturedImage, triggerNativeCamera } = useScanConfig();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const announce = useAnnounce();

    useEffect(() => {
        if (scanStage === 'idle' && capturedImage) {
            setImage(capturedImage);
            setCropPoints([
                { x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }
            ]);
            setScanStage('cropping');
        }
    }, [scanStage, capturedImage]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                setImage(e.target?.result as string);
                setCropPoints([
                    { x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }
                ]);
                setScanStage('cropping');
            };
            reader.readAsDataURL(file);
        }
    };

    const confirmCrop = async () => {
        if (!image) return;
        setScanStage('transforming');
        announce('Applying perspective transform...', 'polite');
        const cv = (window as any).cv;

        try {
            const img = new Image();
            img.src = image;
            await new Promise((resolve) => { img.onload = resolve; });

            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = img.width;
            offscreenCanvas.height = img.height;
            const ctx = offscreenCanvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);

            const src = cv.imread(offscreenCanvas);
            const imgW = offscreenCanvas.width;
            const imgH = offscreenCanvas.height;

            const orderedPts = cropPoints.map(p => ({
                x: (p.x / 100) * imgW,
                y: (p.y / 100) * imgH
            }));

            const srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
                orderedPts[0].x, orderedPts[0].y,
                orderedPts[1].x, orderedPts[1].y,
                orderedPts[2].x, orderedPts[2].y,
                orderedPts[3].x, orderedPts[3].y
            ]);

            const w1 = Math.hypot(orderedPts[2].x - orderedPts[3].x, orderedPts[2].y - orderedPts[3].y);
            const w2 = Math.hypot(orderedPts[1].x - orderedPts[0].x, orderedPts[1].y - orderedPts[0].y);
            const maxWidth = Math.max(w1, w2);

            const h1 = Math.hypot(orderedPts[1].x - orderedPts[2].x, orderedPts[1].y - orderedPts[2].y);
            const h2 = Math.hypot(orderedPts[0].x - orderedPts[3].x, orderedPts[0].y - orderedPts[3].y);
            const maxHeight = Math.max(h1, h2);

            const dstCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
                0, 0,
                maxWidth - 1, 0,
                maxWidth - 1, maxHeight - 1,
                0, maxHeight - 1
            ]);

            const M = cv.getPerspectiveTransform(srcCoords, dstCoords);
            const warpedSrc = new cv.Mat();
            const dsize = new cv.Size(maxWidth, maxHeight);

            cv.warpPerspective(src, warpedSrc, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

            // Draw warped to original canvas to get dataURL
            const canvas = canvasRef.current!;
            canvas.width = maxWidth;
            canvas.height = maxHeight;
            cv.imshow(canvas, warpedSrc);
            const finalImageUrl = canvas.toDataURL('image/jpeg', 0.9);
            setTransformedImage(finalImageUrl);

            // Cleanup CV vars
            M.delete(); srcCoords.delete(); dstCoords.delete();
            src.delete(); warpedSrc.delete();

            setScanStage('analyzing');
            announce('AI (Tesseract) analyzing handwriting...', 'polite');

            // Phase 3: OCR
            Tesseract.recognize(
                finalImageUrl,
                locale === 'ko' ? 'kor' : locale === 'jp' ? 'jpn' : 'eng',
                { logger: m => console.log(m) }
            ).then(({ data: { text } }) => {
                setScanStage('complete');
                setViewMode('digital');

                const lines = text.split('\n').filter(l => l.trim().length > 3);

                setResult({
                    summary: lines.length > 0 ? "Detected Text: " + lines.slice(0, 3).join(' ') + "..." : "No significant text detected.",
                    sentiment: "Neutral",
                    events: lines.length > 1 ? [
                        { time: "Found", title: lines[0] },
                        { time: "Matched", title: lines[1] || "More content" }
                    ] : [],
                    tags: ["OCR", locale]
                });

                announce('Analysis complete', 'polite');
            }).catch(err => {
                console.error(err);
                setScanStage('complete');
                setResult({
                    summary: "OCR Extracted failed. Displaying fallback analysis.",
                    sentiment: "Unknown",
                    events: [],
                    tags: ["Error"]
                });
            });

        } catch (e) {
            console.error("CV/OCR Error", e);
            setScanStage('complete');
        }
    };

    const handleDiscard = () => {
        setImage(null);
        setTransformedImage(null);
        setResult(null);
        setScanStage('idle');
        announce('Image discarded', 'polite');
    };

    const handleSave = async () => {
        if (!result) return;

        announce('Saving to log...', 'polite');

        const newLog: LogItem = {
            id: 'scan-' + Date.now(),
            type: 'analog',
            title: result.summary.length > 30 ? result.summary.substring(0, 30) + "..." : result.summary,
            timestamp: new Date(),
            eventCount: result.events.length || 1,
            // Additional scan data can be stored here
        };

        if (user) {
            try {
                const userDocRef = doc(db, "users", user.uid);
                await updateDoc(userDocRef, {
                    logs: arrayUnion(newLog)
                });
            } catch (err) {
                console.error("Firestore save error:", err);
            }
        } else {
            // LocalStorage fallback
            const savedLogs = localStorage.getItem("dashboardLogs");
            const parsed = savedLogs ? JSON.parse(savedLogs) : [];
            parsed.push(newLog);
            localStorage.setItem("dashboardLogs", JSON.stringify(parsed));
        }
    };

    const pointerMoveHandler = (e: React.PointerEvent) => {
        if (activeElement === null || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        const currentX = ((e.clientX - rect.left) / rect.width) * 100;
        const currentY = ((e.clientY - rect.top) / rect.height) * 100;

        const newPts = [...cropPoints];

        if (typeof activeElement === 'number') {
            newPts[activeElement] = { x: Math.max(0, Math.min(100, currentX)), y: Math.max(0, Math.min(100, currentY)) };
        } else if (typeof activeElement === 'string' && activeElement.startsWith('e')) {
            const eIndex = parseInt(activeElement.charAt(1));

            if (lastPointerPos.current) {
                const dx = currentX - lastPointerPos.current.x;
                const dy = currentY - lastPointerPos.current.y;

                const pt1 = eIndex;
                const pt2 = (eIndex + 1) % 4;

                newPts[pt1] = {
                    x: Math.max(0, Math.min(100, newPts[pt1].x + dx)),
                    y: Math.max(0, Math.min(100, newPts[pt1].y + dy))
                };
                newPts[pt2] = {
                    x: Math.max(0, Math.min(100, newPts[pt2].x + dx)),
                    y: Math.max(0, Math.min(100, newPts[pt2].y + dy))
                };
            }

            lastPointerPos.current = { x: currentX, y: currentY };
        }

        setCropPoints(newPts);
    };

    const pointerUpHandler = (e: React.PointerEvent) => {
        setActiveElement(null);
        lastPointerPos.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    return (
        <div className="min-h-[100dvh] bg-[var(--color-neutral-900)] text-[var(--color-neutral-50)] flex flex-col">
            <Script
                src="https://docs.opencv.org/4.8.0/opencv.js"
                strategy="lazyOnload"
                onLoad={() => setCvReady(true)}
            />

            {/* Overlay Header */}
            <header className="fixed top-0 left-0 right-0 px-4 py-4 flex items-center justify-between z-30 pointer-events-none">
                <Link href="/" className="p-2 rounded-full bg-black/20 backdrop-blur-md hover:bg-black/40 transition-colors pointer-events-auto">
                    <ArrowLeft size={24} />
                </Link>
                {scanStage !== 'idle' && (
                    <button
                        onClick={handleDiscard}
                        className="p-2 rounded-full bg-black/20 backdrop-blur-md text-[var(--color-neutral-400)] hover:text-white hover:bg-black/40 transition-colors pointer-events-auto"
                    >
                        <X size={24} />
                    </button>
                )}
            </header>

            {/* Main Stage - Full Screen on IDLE */}
            <main className={cn(
                "flex-1 flex flex-col items-center justify-center z-10 w-full relative",
                scanStage === 'idle' ? "px-0 pb-0" : "px-4 sm:px-6 pb-24"
            )}>

                {/* IDLE = Camera View */}
                <div
                    className={cn(
                        "relative w-full shadow-2xl transition-all duration-500 ease-in-out bg-black flex flex-col items-center justify-center",
                        scanStage === 'idle' ? "h-[100dvh] w-full rounded-0" : "max-w-2xl min-h-[500px] aspect-[9/16] sm:aspect-[3/4] rounded-3xl"
                    )}
                    style={scanStage === 'idle' ? { opacity: 1 } : { opacity: 0, position: 'absolute', pointerEvents: 'none' }}
                >
                    {scanStage === 'idle' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--color-neutral-400)] text-center p-6 bg-[var(--color-neutral-800)]">
                            <Camera size={64} className="mb-6 opacity-30 animate-pulse text-[var(--color-primary-500)]" />
                            <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                                <Sparkles size={24} className="text-amber-400" />
                                {t('heroTitle')}
                            </h2>
                            <p className="text-[var(--color-neutral-300)] mb-10 max-w-sm leading-relaxed text-lg lg:text-xl">
                                {t('demoDesc')}
                            </p>
                            <Button onClick={triggerNativeCamera} variant="primary" size="lg" className="px-10 py-6 text-xl rounded-full shadow-[0_8px_32px_rgba(245,158,11,0.4)]">
                                <Camera size={24} className="mr-3" />
                                {t('btnScan')}
                            </Button>
                        </div>
                    )}
                </div>

                {/* CROPPING & RESULT STAGES */}
                {scanStage !== 'idle' && (
                    <div
                        ref={containerRef}
                        className={cn(
                            "relative w-full max-w-2xl aspect-[9/16] sm:aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl transition-all duration-1000 ease-in-out touch-none",
                            scanStage === 'transforming' ? "scale-95 bg-black" : "bg-[var(--color-neutral-800)] scale-100"
                        )}
                        onPointerMove={pointerMoveHandler}
                    >
                        <div className={cn(
                            "absolute inset-0 transition-transform duration-1000 ease-out",
                            (scanStage === 'transforming' || scanStage === 'analyzing' || (scanStage === 'complete' && viewMode === 'digital'))
                                ? "scale-100 rotate-0 brightness-105 contrast-110"
                                : ""
                        )}>
                            <img
                                src={(scanStage === 'transforming' || scanStage === 'analyzing' || (scanStage === 'complete' && viewMode === 'digital')) && transformedImage ? transformedImage : (image || undefined)}
                                alt="Scanned diary page"
                                className="w-full h-full object-fill pointer-events-none"
                            />
                        </div>

                        {/* Interactive Cropping Overlay */}
                        {scanStage === 'cropping' && (
                            <div className="absolute inset-0 z-30">
                                <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none">
                                    {/* Thin continuous line connecting the 4 points */}
                                    <polygon
                                        points={cropPoints.map(p => `${p.x}%,${p.y}%`).join(' ')}
                                        fill="transparent"
                                        stroke="rgba(255, 255, 255, 0.9)"
                                        strokeWidth="2"
                                    />
                                    <polygon
                                        points={cropPoints.map(p => `${p.x}%,${p.y}%`).join(' ')}
                                        fill="rgba(255, 255, 255, 0.1)"
                                        stroke="transparent"
                                    />

                                    {/* Edges with Handles */}
                                    {cropPoints.map((p, i) => {
                                        const nextP = cropPoints[(i + 1) % 4];
                                        const midX = (p.x + nextP.x) / 2;
                                        const midY = (p.y + nextP.y) / 2;
                                        return (
                                            <g key={`edge-${i}`}>
                                                {/* Thick invisible interaction line */}
                                                <line
                                                    x1={`${p.x}%`} y1={`${p.y}%`} x2={`${nextP.x}%`} y2={`${nextP.y}%`}
                                                    stroke="transparent" strokeWidth="40"
                                                    className="cursor-move pointer-events-auto touch-none"
                                                    onPointerDown={(e) => {
                                                        e.preventDefault();
                                                        setActiveElement(`e${i}`);
                                                        if (containerRef.current) {
                                                            const r = containerRef.current.getBoundingClientRect();
                                                            lastPointerPos.current = {
                                                                x: ((e.clientX - r.left) / r.width) * 100,
                                                                y: ((e.clientY - r.top) / r.height) * 100
                                                            };
                                                        }
                                                        e.currentTarget.setPointerCapture(e.pointerId);
                                                    }}
                                                    onPointerUp={pointerUpHandler} onPointerCancel={pointerUpHandler}
                                                />
                                                {/* Visual Handle - The White Bar */}
                                                <rect
                                                    x={`${midX}%`} y={`${midY}%`} width="36" height="6" rx="3"
                                                    fill="white"
                                                    stroke="rgba(0,0,0,0.3)" strokeWidth="1"
                                                    className="pointer-events-none drop-shadow-md"
                                                    style={{
                                                        transform: `translate(-18px, -3px) rotate(${Math.atan2(nextP.y - p.y, nextP.x - p.x) * 180 / Math.PI}deg)`,
                                                        transformOrigin: `${midX}% ${midY}%`
                                                    }}
                                                />
                                            </g>
                                        );
                                    })}

                                    {/* Corners */}
                                    {cropPoints.map((p, i) => (
                                        <circle
                                            key={i}
                                            cx={`${p.x}%`}
                                            cy={`${p.y}%`}
                                            r="32"
                                            fill="transparent"
                                            className="cursor-pointer pointer-events-auto touch-none"
                                            onPointerDown={(e) => {
                                                e.preventDefault();
                                                setActiveElement(i);
                                                e.currentTarget.setPointerCapture(e.pointerId);
                                            }}
                                            onPointerUp={pointerUpHandler}
                                            onPointerCancel={pointerUpHandler}
                                        />
                                    ))}
                                    {/* Visual inner dot */}
                                    {cropPoints.map((p, i) => (
                                        <circle
                                            key={`vis-${i}`}
                                            cx={`${p.x}%`}
                                            cy={`${p.y}%`}
                                            r="10"
                                            fill="white"
                                            stroke="rgba(0,0,0,0.3)"
                                            strokeWidth="1"
                                            className="pointer-events-none drop-shadow-md"
                                        />
                                    ))}
                                </svg>

                                {activeElement !== null && (
                                    <div
                                        className={cn(
                                            "absolute w-36 h-36 rounded-2xl shadow-[0_12px_48px_rgba(0,0,0,0.7)] overflow-hidden pointer-events-none z-50 bg-black transition-opacity duration-200 border-2 border-white/50",
                                            activeElement !== null ? "opacity-100" : "opacity-0"
                                        )}
                                        style={{
                                            left: `${Math.min(Math.max(typeof activeElement === 'number' ? cropPoints[activeElement].x : (cropPoints[parseInt(activeElement.charAt(1))].x + cropPoints[(parseInt(activeElement.charAt(1)) + 1) % 4].x) / 2, 25), 75)}%`,
                                            top: `${Math.max((typeof activeElement === 'number' ? cropPoints[activeElement].y : (cropPoints[parseInt(activeElement.charAt(1))].y + cropPoints[(parseInt(activeElement.charAt(1)) + 1) % 4].y) / 2) - 30, 20)}%`,
                                            transform: 'translate(-50%, -100%)'
                                        }}
                                    >
                                        <div className="w-full h-full relative">
                                            <img
                                                src={image as string}
                                                className="absolute max-w-none w-[800%] h-[800%] object-fill"
                                                style={{
                                                    left: `-${(typeof activeElement === 'number' ? cropPoints[activeElement].x : (cropPoints[parseInt(activeElement.charAt(1))].x + cropPoints[(parseInt(activeElement.charAt(1)) + 1) % 4].x) / 2) * 8 - 50}%`,
                                                    top: `-${(typeof activeElement === 'number' ? cropPoints[activeElement].y : (cropPoints[parseInt(activeElement.charAt(1))].y + cropPoints[(parseInt(activeElement.charAt(1)) + 1) % 4].y) / 2) * 8 - 50}%`,
                                                }}
                                                alt=""
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="w-[1px] h-full bg-white/30" />
                                                <div className="absolute w-full h-[1px] bg-white/30" />
                                                <div className="w-2 h-2 rounded-full border border-white/50 bg-[var(--color-primary-500)]" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>
                        )}

                        {/* Processing Overlay */}
                        {scanStage === 'analyzing' && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                                <div className="w-20 h-20 relative mb-6">
                                    <div className="absolute inset-0 border-4 border-[var(--color-primary-500)] rounded-full animate-ping opacity-30"></div>
                                    <div className="absolute inset-0 border-4 border-t-[var(--color-primary-500)] rounded-full animate-spin"></div>
                                </div>
                                <p className="font-semibold text-lg flex items-center gap-2 animate-pulse text-white drop-shadow-md">
                                    <Sparkles size={20} className="text-[var(--color-primary-400)]" />
                                    {t('statusAnalyzing')}
                                </p>
                            </div>
                        )}
                        {scanStage === 'analyzing' && (
                            <div
                                className="absolute top-0 left-0 w-full h-1 bg-[var(--color-primary-500)] z-20"
                                style={{ boxShadow: '0 0 15px var(--color-primary-500)', animation: 'scan 2s ease-in-out infinite' }}
                            />
                        )}
                    </div>
                )}

                {/* External Control Bar moved outside containerRef to prevent overlap with the image scaling */}
                {scanStage === 'cropping' && (
                    <div className="w-full max-w-2xl mx-auto flex justify-between gap-4 mt-8 px-4 sm:px-0 pointer-events-auto z-50">
                        <Button onClick={handleDiscard} variant="ghost" className="flex-1 bg-black/70 text-white hover:bg-black/90 backdrop-blur-md border border-white/20 py-6 text-lg rounded-2xl shadow-xl font-semibold">
                            {t('btnDiscard')}
                        </Button>
                        <Button onClick={confirmCrop} variant="primary" className="flex-1 py-6 shadow-[0_8px_32px_rgba(245,158,11,0.4)] text-lg rounded-2xl font-bold border border-white/10 mt-0">
                            {t('btnConfirmCrop')}
                        </Button>
                    </div>
                )}

                <input type="file" accept="image/*" className="sr-only" ref={fileInputRef} onChange={handleFileSelect} />
                <canvas ref={canvasRef} className="hidden" />
            </main>

            {/* Result Panel */}
            {
                scanStage === 'complete' && result && (
                    <div className="p-4 sm:p-6 bg-[var(--color-neutral-800)] rounded-t-3xl min-h-[200px] border-t border-[var(--color-neutral-700)] z-10 relative mt-[-2rem]">
                        <div className="space-y-4 animate-fade-in-up">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-[var(--color-success-500)]">
                                    <Check size={20} strokeWidth={3} />
                                    <span className="font-bold text-lg">{t('statusComplete')}</span>
                                </div>

                                <div className="flex bg-[var(--color-neutral-900)] rounded-lg p-1 border border-[var(--color-neutral-700)]">
                                    <button
                                        onClick={() => setViewMode('original')}
                                        className={cn(
                                            "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                                            viewMode === 'original' ? "bg-[var(--color-primary-600)] text-white shadow-sm" : "text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-200)]"
                                        )}
                                    >
                                        {t('viewOriginal')}
                                    </button>
                                    <button
                                        onClick={() => setViewMode('digital')}
                                        className={cn(
                                            "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                                            viewMode === 'digital' ? "bg-[var(--color-primary-600)] text-white shadow-sm" : "text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-200)]"
                                        )}
                                    >
                                        {t('viewDigital')}
                                    </button>
                                </div>
                            </div>

                            {viewMode === 'digital' && (
                                <div className="bg-[var(--color-neutral-700)] p-6 rounded-xl border border-[var(--color-neutral-600)] animate-fade-in">
                                    <p className="text-base text-[var(--color-neutral-200)] italic mb-4 leading-relaxed">
                                        "{result.summary}"
                                    </p>
                                    <div className="flex gap-2 mb-6 flex-wrap">
                                        {result.tags.map((tag) => <Badge key={tag} variant="info" size="md">#{tag}</Badge>)}
                                    </div>
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold text-[var(--color-neutral-400)] uppercase tracking-wider">Detected Events</h3>
                                        {result.events.map((event, index) => (
                                            <div key={index} className="flex justify-between items-center text-sm pb-3 border-b border-[var(--color-neutral-600)] last:border-0 last:pb-0">
                                                <span className="text-[var(--color-neutral-400)]">{event.time}</span>
                                                <span className="font-medium text-[var(--color-neutral-50)]">{event.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button variant="ghost" size="lg" onClick={handleDiscard} className="flex-1 text-[var(--color-neutral-300)] hover:text-[var(--color-neutral-50)]">
                                    {t('btnDiscard')}
                                </Button>
                                <Link href="/dashboard" className="flex-1">
                                    <Button variant="primary" size="lg" onClick={handleSave} fullWidth>
                                        {t('btnSaveLog')}
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                )
            }

            <style jsx global>{`
                @keyframes scan {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
            `}</style>
        </div >
    );
}
