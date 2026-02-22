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
import { useAuth } from "@/contexts/AuthContext";
import { analyzeImageWithAI } from "@/app/actions/analyzeImage";
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
    const [imageAspect, setImageAspect] = useState<number | null>(null);

    const { capturedImage } = useScanConfig();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const announce = useAnnounce();

    // WebRTC Live camera states
    const videoRef = useRef<HTMLVideoElement>(null);
    const cameraStreamRef = useRef<MediaStream | null>(null);
    const requestRef = useRef<number | null>(null);
    const [livePoints, setLivePoints] = useState<{ x: number, y: number }[] | null>(null);

    const stopCamera = useCallback(() => {
        if (cameraStreamRef.current) {
            cameraStreamRef.current.getTracks().forEach(track => track.stop());
            cameraStreamRef.current = null;
        }
        if (requestRef.current) clearTimeout(requestRef.current);
    }, []);

    const detectDocument = useCallback((cv: any, srcCanvas: HTMLCanvasElement): { x: number, y: number }[] | null => {
        try {
            const src = cv.imread(srcCanvas);
            const dst = new cv.Mat();
            cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
            // Stronger blur to remove noise like keyboard keys
            cv.GaussianBlur(dst, dst, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
            // Canny edge detection
            cv.Canny(dst, dst, 40, 120, 3, false);

            const contours = new cv.MatVector();
            const hierarchy = new cv.Mat();
            cv.findContours(dst, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

            // Calculate center of the screen to prioritize central objects
            const centerX = srcCanvas.width / 2;
            const centerY = srcCanvas.height / 2;
            let bestScore = 0;
            let bestApprox = new cv.Mat();
            let found = false;

            for (let i = 0; i < contours.size(); ++i) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour, false);

                // Area must be at least 4% of the image. Passports are usually 20-40%. 
                // This eliminates small keyboard keys instantly.
                if (area > (srcCanvas.width * srcCanvas.height * 0.04)) {
                    const peri = cv.arcLength(contour, true);
                    const tmpApprox = new cv.Mat();
                    // Loosen approxPolyDP slightly to handle rounded corners of passports
                    cv.approxPolyDP(contour, tmpApprox, 0.04 * peri, true);

                    if (tmpApprox.rows === 4 && cv.isContourConvex(tmpApprox)) {
                        // Calculate the center of the contour bounding box
                        let cx = 0, cy = 0;
                        for (let j = 0; j < 4; j++) {
                            cx += tmpApprox.data32S[j * 2];
                            cy += tmpApprox.data32S[j * 2 + 1];
                        }
                        cx /= 4;
                        cy /= 4;

                        // Calculate distance from center (normalized to 0-1)
                        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
                        const distFromCenter = Math.sqrt(Math.pow(cx - centerX, 2) + Math.pow(cy - centerY, 2)) / maxDist;

                        // Extremely strict penalty for off-center objects. 
                        // Center objects get a huge boost.
                        const areaRatio = area / (srcCanvas.width * srcCanvas.height);

                        // If it's more than 30% off center, we aggressively discount its area
                        let score = areaRatio;
                        if (distFromCenter < 0.2) {
                            score *= 3.0; // Huge boost if exactly in the center
                        } else if (distFromCenter > 0.4) {
                            score *= 0.1; // Huge penalty if far from center
                        }

                        if (score > bestScore) {
                            bestScore = score;
                            tmpApprox.copyTo(bestApprox);
                            found = true;
                        }
                    }
                    tmpApprox.delete();
                }
                contour.delete();
            }

            let pts = null;
            if (found) {
                const rawPts = [];
                for (let i = 0; i < 4; i++) {
                    rawPts.push({ x: (bestApprox.data32S[i * 2] / srcCanvas.width) * 100, y: (bestApprox.data32S[i * 2 + 1] / srcCanvas.height) * 100 });
                }
                rawPts.sort((a: any, b: any) => a.y - b.y);
                const top = rawPts.slice(0, 2).sort((a: any, b: any) => a.x - b.x);
                const bottom = rawPts.slice(2, 4).sort((a: any, b: any) => a.x - b.x);
                pts = [top[0], top[1], bottom[1], bottom[0]];
            }

            src.delete(); dst.delete(); contours.delete(); hierarchy.delete(); bestApprox.delete();
            return pts;
        } catch (e) {
            console.error(e);
            return null;
        }
    }, []);

    const liveDetectionLoop = useCallback(() => {
        if (!cvReady || scanStage !== 'idle' || !videoRef.current || videoRef.current.readyState < 2) {
            requestRef.current = window.setTimeout(() => requestAnimationFrame(liveDetectionLoop), 100);
            return;
        }

        const video = videoRef.current;
        const cv = (window as any).cv;

        try {
            const canvas = canvasRef.current!;
            // Dramatically lower resolution to 320 for lightning fast, stable edge tracking
            const scale = Math.min(320 / Math.max(video.videoWidth, video.videoHeight), 1);
            canvas.width = video.videoWidth * scale;
            canvas.height = video.videoHeight * scale;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const pts = detectDocument(cv, canvas);
            if (pts) setLivePoints(pts);
        } catch (e) {
            console.error("Live detection error", e);
        }

        // Run at ~10 FPS to save battery and avoid UI freeze
        requestRef.current = window.setTimeout(() => requestAnimationFrame(liveDetectionLoop), 100);
    }, [cvReady, scanStage, detectDocument]);

    const startCamera = useCallback(async () => {
        if (scanStage !== 'idle') return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });
            cameraStreamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                requestRef.current = window.setTimeout(() => requestAnimationFrame(liveDetectionLoop), 100);
            }
        } catch (err) {
            console.error("Camera error:", err);
            announce("Could not start camera. Check permissions.", "polite");
        }
    }, [scanStage, liveDetectionLoop, announce]);
    useEffect(() => {
        if (scanStage === 'idle') {
            if (capturedImage) {
                const processPreCaptured = async () => {
                    const img = new Image();
                    img.src = capturedImage;
                    await new Promise((resolve) => { img.onload = resolve; });
                    setImageAspect(img.width / img.height);
                    setImage(capturedImage);

                    if (cvReady) {
                        const canvas = document.createElement('canvas');
                        const scale = Math.min(1000 / Math.max(img.width, img.height), 1);
                        canvas.width = img.width * scale;
                        canvas.height = img.height * scale;
                        const ctx = canvas.getContext('2d')!;
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                        const cv = (window as any).cv;
                        const pts = detectDocument(cv, canvas);
                        if (pts) setCropPoints(pts);
                        else setCropPoints([{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }]);
                    } else {
                        setCropPoints([{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }]);
                    }
                    setScanStage('cropping');
                };
                processPreCaptured();
            } else {
                startCamera();
            }
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [scanStage, capturedImage, cvReady, startCamera, stopCamera, detectDocument]);

    const capturePhoto = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setImageAspect(video.videoWidth / video.videoHeight);
        setImage(dataUrl);

        if (livePoints) {
            setCropPoints(livePoints);
        } else {
            setCropPoints([
                { x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }
            ]);
        }

        stopCamera();
        announce('Photo captured with smart crop layout.', 'polite');
        setScanStage('cropping');
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgSource = e.target?.result as string;
                setImage(imgSource);
                const img = new Image();
                img.src = imgSource;
                img.onload = () => {
                    setImageAspect(img.width / img.height);

                    if (cvReady) {
                        const canvas = document.createElement('canvas');
                        const scale = Math.min(1000 / Math.max(img.width, img.height), 1);
                        canvas.width = img.width * scale;
                        canvas.height = img.height * scale;
                        const ctx = canvas.getContext('2d')!;
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                        const cv = (window as any).cv;
                        const pts = detectDocument(cv, canvas);
                        if (pts) setCropPoints(pts);
                        else setCropPoints([{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }]);
                    } else {
                        setCropPoints([{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }]);
                    }
                    setScanStage('cropping');
                }
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
            let maxWidth = Math.max(w1, w2);

            const h1 = Math.hypot(orderedPts[1].x - orderedPts[2].x, orderedPts[1].y - orderedPts[2].y);
            const h2 = Math.hypot(orderedPts[0].x - orderedPts[3].x, orderedPts[0].y - orderedPts[3].y);
            let maxHeight = Math.max(h1, h2);

            // Pro-level feature: Automatically correct the aspect ratio by snapping to real-world document standard proportions
            // This prevents the "squashed/stretched" look when taking photos from an angle!
            const ratio = maxWidth / maxHeight;
            if (ratio > 0.60 && ratio < 0.82) {
                // B7 Passport / ID Card Portrait (88x125mm -> ratio: ~0.704)
                maxHeight = maxWidth / 0.704;
            } else if (ratio > 1.25 && ratio < 1.65) {
                // ID Card Landscape (e.g. Driver's License)
                maxWidth = maxHeight * 1.42;
            } else if (ratio > 0.85 && ratio < 1.15) {
                // Perfect Square (e.g. Polaroid, QR code)
                maxHeight = maxWidth;
            } else if (ratio > 0.40 && ratio < 0.60) {
                // Tall Receipts (no strict fix needed, but slight regularization helps)
                // maxHeight = maxWidth / 0.5;
            }

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
            setImageAspect(maxWidth / maxHeight);

            // Cleanup CV vars
            M.delete(); srcCoords.delete(); dstCoords.delete();
            src.delete(); warpedSrc.delete();

            setScanStage('analyzing');
            announce('AI is analyzing the document...', 'polite');

            // Phase 3: Advanced AI Analysis (Gemini)
            const aiResult = await analyzeImageWithAI(finalImageUrl, locale);

            if (aiResult.success && aiResult.data) {
                setScanStage('complete');
                setViewMode('digital');
                setResult(aiResult.data);
                announce('Analysis complete', 'polite');
            } else {
                throw new Error(aiResult.error || "AI failed to process the image");
            }
        } catch (e) {
            console.error("Analysis Error", e);
            setScanStage('complete');
            setResult({
                summary: "AI analysis failed over OCR. Please check API keys or try again.",
                sentiment: "Unknown",
                events: [],
                tags: ["Error"]
            });
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
                strategy="afterInteractive"
                onLoad={() => {
                    // OpenCV.js uses WASM, which initializes asynchronously after script load.
                    const checkCv = setInterval(() => {
                        if ((window as any).cv && typeof (window as any).cv.Mat === 'function') {
                            clearInterval(checkCv);
                            setCvReady(true);
                        }
                    }, 100);
                }}
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
                        <div className="absolute inset-0 bg-black">
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover"
                                playsInline
                                muted
                                autoPlay
                            />

                            {/* Live Detection Overlay */}
                            {livePoints && (
                                <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none z-10 transition-all duration-75">
                                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
                                        <polygon
                                            points={livePoints.map((p: any) => `${p.x},${p.y}`).join(' ')}
                                            fill="rgba(59, 130, 246, 0.2)"
                                        />
                                    </svg>
                                    {livePoints.map((p: any, i: number) => {
                                        const nextP = livePoints[(i + 1) % 4];
                                        return (
                                            <line
                                                key={`l-${i}`}
                                                x1={`${p.x}%`} y1={`${p.y}%`}
                                                x2={`${nextP.x}%`} y2={`${nextP.y}%`}
                                                stroke="rgba(255, 255, 255, 0.9)"
                                                strokeWidth="2.5"
                                            />
                                        );
                                    })}
                                    {livePoints.map((p: any, i: number) => (
                                        <circle key={`c-${i}`} cx={`${p.x}%`} cy={`${p.y}%`} r="6" fill="white" />
                                    ))}
                                </svg>
                            )}

                            <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center px-8 z-20 gap-8">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-4 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/20 hover:bg-black/60 transition"
                                >
                                    <ImageIcon size={28} />
                                </button>
                                <button
                                    onClick={capturePhoto}
                                    className="w-20 h-20 rounded-full border-[6px] border-white bg-white/20 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 transition-transform flex items-center justify-center p-0"
                                >
                                    <div className="w-[85%] h-[85%] rounded-full bg-white opacity-90"></div>
                                    <span className="sr-only">Take photo</span>
                                </button>
                                <div className="w-[60px]" /> {/* Spacer for symmetry */}
                            </div>
                        </div>
                    )}
                </div>

                {/* CROPPING & RESULT STAGES */}
                {scanStage !== 'idle' && (
                    <div className="w-full flex-1 flex flex-col items-center justify-center pt-8">
                        <div
                            ref={containerRef}
                            className={cn(
                                "relative w-full mx-auto rounded-3xl overflow-hidden shadow-2xl transition-all duration-1000 ease-in-out touch-none",
                                scanStage === 'transforming' ? "scale-95 bg-black" : "bg-[var(--color-neutral-800)] scale-100"
                            )}
                            style={{
                                aspectRatio: imageAspect ? imageAspect : (9 / 16),
                                maxHeight: '65vh',
                                maxWidth: imageAspect ? `calc(65vh * ${imageAspect})` : 'calc(65vh * (9/16))'
                            }}
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
                                    className={cn(
                                        "w-full h-full pointer-events-none transition-all",
                                        (transformedImage && scanStage !== 'cropping') ? "object-contain bg-black" : "object-fill"
                                    )}
                                />
                            </div>

                            {/* Interactive Cropping Overlay */}
                            {scanStage === 'cropping' && (
                                <div className="absolute inset-0 z-30">
                                    <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none">
                                        {/* Edges with Handles */}
                                        {cropPoints.map((p, i) => {
                                            const nextP = cropPoints[(i + 1) % 4];
                                            const midX = (p.x + nextP.x) / 2;
                                            const midY = (p.y + nextP.y) / 2;

                                            // Calculate the start/end points of the handle so it's perfectly in line
                                            const dx = nextP.x - p.x;
                                            const dy = nextP.y - p.y;
                                            const hLen = 0.08; // 8% of the edge length each way (16% total length)
                                            const hX1 = midX - dx * hLen;
                                            const hY1 = midY - dy * hLen;
                                            const hX2 = midX + dx * hLen;
                                            const hY2 = midY + dy * hLen;

                                            return (
                                                <g key={`edge-${i}`}>
                                                    {/* The thin solid connecting line */}
                                                    <line
                                                        x1={`${p.x}%`} y1={`${p.y}%`} x2={`${nextP.x}%`} y2={`${nextP.y}%`}
                                                        stroke="rgba(255, 255, 255, 0.9)" strokeWidth="2.5"
                                                        className="pointer-events-none drop-shadow-md"
                                                    />
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
                                                    {/* Visual Handle - The White Bar perfectly sloped */}
                                                    <line
                                                        x1={`${hX1}%`} y1={`${hY1}%`} x2={`${hX2}%`} y2={`${hY2}%`}
                                                        stroke="white" strokeWidth="6" strokeLinecap="round"
                                                        className="pointer-events-none drop-shadow-md"
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

                        {/* External Control Bar */}
                        {scanStage === 'cropping' && (
                            <div className="w-full max-w-sm mx-auto flex justify-between gap-4 mt-8 pointer-events-auto">
                                <Button onClick={handleDiscard} variant="ghost" className="flex-1 bg-[var(--color-neutral-800)] text-white hover:bg-[var(--color-neutral-700)] backdrop-blur-md border border-white/20 py-6 text-lg rounded-2xl shadow-xl font-semibold">
                                    {t('btnDiscard')}
                                </Button>
                                <Button onClick={confirmCrop} variant="primary" className="flex-1 py-6 shadow-[0_8px_32px_rgba(245,158,11,0.4)] text-lg rounded-2xl font-bold border border-white/10 mt-0">
                                    {t('btnConfirmCrop')}
                                </Button>
                            </div>
                        )}
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
