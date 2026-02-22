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
    const [viewMode, setViewMode] = useState<'original' | 'digital'>('digital');
    const [result, setResult] = useState<ScanResult | null>(null);
    const [transformedImage, setTransformedImage] = useState<string | null>(null);
    const [cvReady, setCvReady] = useState(false);

    // Live Camera state
    const videoRef = useRef<HTMLVideoElement>(null);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState(false);
    const [livePoints, setLivePoints] = useState<{ x: number, y: number }[] | null>(null);
    const detectionInterval = useRef<any>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const announce = useAnnounce();

    // Start camera
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setCameraStream(stream);
            setCameraError(false);
            announce('Camera started', 'polite');
        } catch (err) {
            console.error("Camera error:", err);
            setCameraError(true);
            announce('Camera failed to start. Please use upload button.', 'polite');
        }
    }, [announce]);

    const stopCamera = useCallback(() => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(t => t.stop());
            setCameraStream(null);
        }
        if (detectionInterval.current) {
            clearInterval(detectionInterval.current);
            detectionInterval.current = null;
        }
    }, [cameraStream]);

    useEffect(() => {
        if (scanStage === 'idle') {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [scanStage, startCamera, stopCamera]);

    // Live OpenCV detection loop
    useEffect(() => {
        if (scanStage !== 'idle' || !cvReady || !cameraStream || cameraError) return;

        detectionInterval.current = setInterval(() => {
            const video = videoRef.current;
            if (!video || video.videoWidth === 0) return;
            const cv = (window as any).cv;
            try {
                const canvas = canvasRef.current!;
                const ctx = canvas.getContext('2d')!;
                // scale down heavily for live speed
                const scale = 0.25;
                canvas.width = video.videoWidth * scale;
                canvas.height = video.videoHeight * scale;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                const src = cv.imread(canvas);
                const dst = new cv.Mat();
                cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
                cv.GaussianBlur(dst, dst, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
                cv.Canny(dst, dst, 75, 200, 3, false);

                const contours = new cv.MatVector();
                const hierarchy = new cv.Mat();
                cv.findContours(dst, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

                let maxArea = 0;
                let maxContourIndex = -1;
                let approx = new cv.Mat();

                let found = false;
                for (let i = 0; i < contours.size(); ++i) {
                    const contour = contours.get(i);
                    const area = cv.contourArea(contour, false);
                    if (area > 500 && area > maxArea) { // 500 is ok given 0.25 scale
                        const peri = cv.arcLength(contour, true);
                        const tmpApprox = new cv.Mat();
                        cv.approxPolyDP(contour, tmpApprox, 0.02 * peri, true);
                        if (tmpApprox.rows === 4) {
                            maxArea = area;
                            maxContourIndex = i;
                            tmpApprox.copyTo(approx);
                            found = true;
                        }
                        tmpApprox.delete();
                    }
                    contour.delete();
                }

                if (found) {
                    const pts = [];
                    for (let i = 0; i < 4; i++) {
                        pts.push({ x: (approx.data32S[i * 2] / canvas.width) * 100, y: (approx.data32S[i * 2 + 1] / canvas.height) * 100 });
                    }
                    pts.sort((a, b) => a.y - b.y);
                    const top = pts.slice(0, 2).sort((a, b) => a.x - b.x);
                    const bottom = pts.slice(2, 4).sort((a, b) => a.x - b.x);
                    setLivePoints([top[0], top[1], bottom[1], bottom[0]]);
                } else {
                    setLivePoints(null);
                }
                src.delete(); dst.delete(); contours.delete(); hierarchy.delete(); approx.delete();
            } catch (e) { }
        }, 200);

        return () => clearInterval(detectionInterval.current);
    }, [cvReady, scanStage, cameraStream, cameraError]);

    const capturePhoto = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current!;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setImage(dataUrl);
        stopCamera();

        if (livePoints) {
            setCropPoints(livePoints);
        } else {
            setCropPoints([
                { x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }
            ]);
        }

        setScanStage('cropping');
    };

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
                stopCamera();
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
        setLivePoints(null);
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
        const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

        const newPts = [...cropPoints];

        if (typeof activeElement === 'number') {
            newPts[activeElement] = { x, y };
        } else if (typeof activeElement === 'string' && activeElement.startsWith('e')) {
            // Dragging an edge
            const eIndex = parseInt(activeElement.charAt(1));
            // Calculate delta based on movement
            const mx = Math.max(0, Math.min(100, ((e.movementX) / rect.width) * 100));
            const my = Math.max(0, Math.min(100, ((e.movementY) / rect.height) * 100));

            // Simpler and safer way: we just adjust the relevant axis of the two points of the edge.
            if (eIndex === 0) { // Top edge -> adjust Y of 0 and 1
                newPts[0].y = y; newPts[1].y = y;
            } else if (eIndex === 1) { // Right edge -> adjust X of 1 and 2
                newPts[1].x = x; newPts[2].x = x;
            } else if (eIndex === 2) { // Bottom edge -> adjust Y of 2 and 3
                newPts[2].y = y; newPts[3].y = y;
            } else if (eIndex === 3) { // Left edge -> adjust X of 3 and 0
                newPts[3].x = x; newPts[0].x = x;
            }
        }

        setCropPoints(newPts);
    };

    const pointerUpHandler = (e: React.PointerEvent) => {
        setActiveElement(null);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    return (
        <div className="min-h-[100dvh] bg-[var(--color-neutral-900)] text-[var(--color-neutral-50)] flex flex-col">
            <Script
                src="https://docs.opencv.org/4.8.0/opencv.js"
                strategy="lazyOnload"
                onLoad={() => setCvReady(true)}
            />

            {/* Header */}
            <header className="px-4 py-4 flex items-center justify-between z-20 sticky top-0 bg-[var(--color-neutral-900)]/80 backdrop-blur-md">
                <Link href="/" className="p-2 rounded-full hover:bg-[var(--color-neutral-800)] transition-colors">
                    <ArrowLeft size={24} />
                    <span className="sr-only">Go back</span>
                </Link>
                {scanStage !== 'idle' && (
                    <button
                        onClick={handleDiscard}
                        className="p-2 rounded-full text-[var(--color-neutral-400)] hover:text-white hover:bg-[var(--color-neutral-800)] transition-colors"
                        aria-label="Discard scan"
                    >
                        <X size={24} />
                    </button>
                )}
            </header>

            {/* Main Stage */}
            <main className="flex-1 px-4 sm:px-6 flex flex-col items-center justify-center -mt-16 pb-24 z-10 w-full relative">

                {/* IDLE = Camera View */}
                <div
                    className={cn(
                        "relative w-full max-w-2xl h-[65vh] min-h-[400px] rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 ease-in-out bg-black flex flex-col items-center justify-center",
                        scanStage === 'idle' ? "opacity-100" : "opacity-0 absolute pointer-events-none"
                    )}
                >
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                    />

                    {/* Live Document Overlay */}
                    {livePoints && !cameraError && (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                            <polygon
                                points={livePoints.map(p => `${p.x}%,${p.y}%`).join(' ')}
                                fill="rgba(245, 158, 11, 0.2)"
                                stroke="#f59e0b"
                                strokeWidth="4"
                            />
                        </svg>
                    )}

                    {cameraError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--color-neutral-400)] text-center p-6 bg-[var(--color-neutral-800)]">
                            <Camera size={48} className="mb-4 opacity-50" />
                            <p className="text-lg text-white mb-2">Live Camera Blocked</p>
                            <p className="text-sm opacity-70 mb-6">Browsers require HTTPS to access camera. Use the gallery upload instead.</p>
                            <Button onClick={() => fileInputRef.current?.click()} variant="primary">
                                Upload Photo
                            </Button>
                        </div>
                    )}

                    {/* Camera Controls */}
                    {!cameraError && (
                        <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-8">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm pointer-events-auto active:scale-95 transition-transform"
                                aria-label="Upload from gallery"
                            >
                                <ImageIcon size={20} className="text-white" />
                            </button>

                            <button
                                onClick={capturePhoto}
                                className="w-20 h-20 bg-white rounded-full border-[6px] border-[var(--color-neutral-400)] flex items-center justify-center shadow-lg active:scale-95 transition-transform pointer-events-auto"
                                aria-label="Take photo"
                            >
                                <div className="w-[85%] h-[85%] bg-white rounded-full border-2 border-[var(--color-neutral-900)]"></div>
                            </button>

                            <div className="w-12 h-12" /> {/* Spacer */}
                        </div>
                    )}
                </div>

                {/* CROPPING & RESULT STAGES */}
                {scanStage !== 'idle' && (
                    <div
                        ref={containerRef}
                        className={cn(
                            "relative w-full max-w-2xl h-[65vh] min-h-[400px] rounded-3xl overflow-hidden shadow-2xl transition-all duration-1000 ease-in-out touch-none",
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
                                className="w-full h-full object-contain pointer-events-none"
                            />
                        </div>

                        {/* Interactive Cropping Overlay */}
                        {scanStage === 'cropping' && (
                            <div className="absolute inset-0 z-30">
                                <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none">
                                    <polygon
                                        points={cropPoints.map(p => `${p.x}%,${p.y}%`).join(' ')}
                                        fill="rgba(255, 255, 255, 0.1)"
                                        stroke="white"
                                        strokeWidth="2"
                                    />

                                    {/* Draw lines that can be grabbed (thicker transparent overlays) / mid-point handles */}
                                    {cropPoints.map((p, i) => {
                                        const nextP = cropPoints[(i + 1) % 4];
                                        const midX = (p.x + nextP.x) / 2;
                                        const midY = (p.y + nextP.y) / 2;
                                        return (
                                            <g key={`edge-${i}`}>
                                                {/* Thick invisible line for easy grab */}
                                                <line
                                                    x1={`${p.x}%`} y1={`${p.y}%`} x2={`${nextP.x}%`} y2={`${nextP.y}%`}
                                                    stroke="transparent" strokeWidth="30"
                                                    className="cursor-move pointer-events-auto touch-none"
                                                    onPointerDown={(e) => { e.preventDefault(); setActiveElement(`e${i}`); e.currentTarget.setPointerCapture(e.pointerId); }}
                                                    onPointerUp={pointerUpHandler} onPointerCancel={pointerUpHandler}
                                                />
                                                {/* Visual handle at midpoint */}
                                                <rect
                                                    x={`${midX}%`} y={`${midY}%`} width="24" height="6" rx="3"
                                                    fill="white"
                                                    stroke="black" strokeWidth="1"
                                                    className="pointer-events-none"
                                                    style={{
                                                        transform: `translate(-12px, -3px) rotate(${Math.atan2(nextP.y - p.y, nextP.x - p.x) * 180 / Math.PI}deg)`,
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
                                            r="24"
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
                                            r="8"
                                            fill="white"
                                            stroke="var(--color-primary-500)"
                                            strokeWidth="3"
                                            className="pointer-events-none"
                                        />
                                    ))}
                                </svg>

                                {/* Magnifier View */}
                                {activeElement !== null && (
                                    <div
                                        className={cn(
                                            "absolute w-28 h-28 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-none z-50 bg-black transition-opacity duration-200 border-4 border-white",
                                            activeElement !== null ? "opacity-100" : "opacity-0"
                                        )}
                                        style={{
                                            left: `${Math.min(Math.max(typeof activeElement === 'number' ? cropPoints[activeElement].x : (cropPoints[parseInt(activeElement.charAt(1))].x + cropPoints[(parseInt(activeElement.charAt(1)) + 1) % 4].x) / 2, 18), 82)}%`,
                                            top: `${Math.max((typeof activeElement === 'number' ? cropPoints[activeElement].y : (cropPoints[parseInt(activeElement.charAt(1))].y + cropPoints[(parseInt(activeElement.charAt(1)) + 1) % 4].y) / 2) - 18, 10)}%`,
                                            transform: 'translate(-50%, -100%)'
                                        }}
                                    >
                                        <img
                                            src={image as string}
                                            className="absolute max-w-none object-fill"
                                            style={{
                                                width: '400%',
                                                height: '400%',
                                                left: `-${(typeof activeElement === 'number' ? cropPoints[activeElement].x : (cropPoints[parseInt(activeElement.charAt(1))].x + cropPoints[(parseInt(activeElement.charAt(1)) + 1) % 4].x) / 2) * 4 - 50}%`,
                                                top: `-${(typeof activeElement === 'number' ? cropPoints[activeElement].y : (cropPoints[parseInt(activeElement.charAt(1))].y + cropPoints[(parseInt(activeElement.charAt(1)) + 1) % 4].y) / 2) * 4 - 50}%`,
                                            }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-[2px] h-4 bg-[var(--color-primary-500)]" />
                                            <div className="absolute w-4 h-[2px] bg-[var(--color-primary-500)]" />
                                        </div>
                                    </div>
                                )}

                                <div className="absolute bottom-6 left-0 w-full flex justify-between px-4 sm:px-8 pointer-events-auto">
                                    <Button onClick={handleDiscard} variant="ghost" className="bg-black/60 text-white hover:bg-black/80 backdrop-blur-md border border-white/20">
                                        Retake
                                    </Button>
                                    <Button onClick={confirmCrop} variant="primary" className="shadow-[0_4px_20px_var(--color-primary-500)]">
                                        {t('btnConfirmCrop')}
                                    </Button>
                                </div>
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

                <input type="file" accept="image/*" capture="environment" className="sr-only" ref={fileInputRef} onChange={handleFileSelect} />
                <canvas ref={canvasRef} className="hidden" />
            </main>

            {/* Result Panel */}
            {scanStage === 'complete' && result && (
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
            )}

            <style jsx global>{`
                @keyframes scan {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
            `}</style>
        </div>
    );
}
