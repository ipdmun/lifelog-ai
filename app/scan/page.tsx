"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, ArrowLeft, Check, Sparkles, X, Image as ImageIcon, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    logDate?: string;
    sentiment: string;
    events: Array<{
        time: string;
        title: string;
        date?: string;
    }>;
    tags: string[];
}

export default function ScanPage() {
    const { t, locale } = useLanguage();
    const { user } = useAuth();
    const router = useRouter();
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
    const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
    const [activeCameraId, setActiveCameraId] = useState<string | null>(null);

    // WebRTC Live camera states
    const videoRef = useRef<HTMLVideoElement>(null);
    const cameraStreamRef = useRef<MediaStream | null>(null);
    const requestRef = useRef<number | null>(null);
    const [livePoints, setLivePoints] = useState<{ x: number, y: number }[] | null>(null);
    const [focusPoint, setFocusPoint] = useState<{ x: number, y: number } | null>(null);

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
            cv.GaussianBlur(dst, dst, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
            cv.Canny(dst, dst, 40, 120, 3, false);

            const contours = new cv.MatVector();
            const hierarchy = new cv.Mat();
            cv.findContours(dst, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

            const centerX = srcCanvas.width / 2;
            const centerY = srcCanvas.height / 2;
            let bestScore = 0;
            let bestApprox = new cv.Mat();
            let found = false;

            for (let i = 0; i < contours.size(); ++i) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour, false);

                if (area > (srcCanvas.width * srcCanvas.height * 0.04)) {
                    const peri = cv.arcLength(contour, true);
                    const tmpApprox = new cv.Mat();
                    cv.approxPolyDP(contour, tmpApprox, 0.04 * peri, true);

                    if (tmpApprox.rows === 4 && cv.isContourConvex(tmpApprox)) {
                        let cx = 0, cy = 0;
                        for (let j = 0; j < 4; j++) {
                            cx += tmpApprox.data32S[j * 2];
                            cy += tmpApprox.data32S[j * 2 + 1];
                        }
                        cx /= 4;
                        cy /= 4;

                        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
                        const distFromCenter = Math.sqrt(Math.pow(cx - centerX, 2) + Math.pow(cy - centerY, 2)) / maxDist;
                        const areaRatio = area / (srcCanvas.width * srcCanvas.height);

                        let score = areaRatio;
                        if (distFromCenter < 0.2) {
                            score *= 3.0;
                        } else if (distFromCenter > 0.4) {
                            score *= 0.1;
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

        requestRef.current = window.setTimeout(() => requestAnimationFrame(liveDetectionLoop), 100);
    }, [cvReady, scanStage, detectDocument]);

    const startCamera = useCallback(async () => {
        if (scanStage !== 'idle') return;
        try {
            let stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });

            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            setAvailableCameras(videoDevices);

            let bestDeviceId = activeCameraId || null;

            if (!bestDeviceId) {
                let highestScore = -1;
                for (const device of videoDevices) {
                    const label = device.label.toLowerCase();
                    let score = 0;
                    if (label.includes('back') || label.includes('environment') || label.includes('후면')) {
                        score += 10;
                        if (label.includes('main') || label.includes('standard') || label.includes('기본')) score += 5;
                        if (label.includes('wide') || label.includes('초광각') || label.includes('0.5x')) score -= 15;
                        if (label.includes('ultra')) score -= 15;
                        if (label.includes('tele') || label.includes('망원') || label.includes('macro')) score -= 10;
                        if (score > highestScore) {
                            highestScore = score;
                            bestDeviceId = device.deviceId;
                        }
                    }
                }
                if (!bestDeviceId && videoDevices.length > 0) {
                    bestDeviceId = videoDevices[videoDevices.length - 1].deviceId;
                }
            }

            stream.getTracks().forEach(t => t.stop());

            if (bestDeviceId) {
                setActiveCameraId(bestDeviceId);
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: { exact: bestDeviceId },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                });
            } else {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                });
            }

            // Try enabling focus mode separately
            try {
                const track = stream.getVideoTracks()[0];
                const capabilities = track.getCapabilities() as any;
                if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
                    await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as any);
                }
            } catch (e) { }

            cameraStreamRef.current = stream;

            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities() as any;
            if (capabilities.zoom) {
                try {
                    const targetZoom = Math.max(capabilities.zoom.min || 1, 1);
                    await track.applyConstraints({
                        advanced: [{ zoom: targetZoom }]
                    } as any);
                } catch (e) { }
            }

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                requestRef.current = window.setTimeout(() => requestAnimationFrame(liveDetectionLoop), 100);
            }
        } catch (err) {
            console.error("Camera error:", err);
            announce("Could not start camera. Check permissions.", "polite");
        }
    }, [scanStage, liveDetectionLoop, announce, activeCameraId]);

    const handleTapToFocus = useCallback(async (e: React.MouseEvent<HTMLVideoElement> | React.TouchEvent<HTMLVideoElement>) => {
        if (!videoRef.current || !cameraStreamRef.current) return;
        const track = cameraStreamRef.current.getVideoTracks()[0];
        if (!track) return;

        const capabilities = track.getCapabilities && track.getCapabilities() as any;
        if (!capabilities) return;

        const rect = videoRef.current.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = (e as React.TouchEvent<HTMLVideoElement>).touches[0].clientX;
            clientY = (e as React.TouchEvent<HTMLVideoElement>).touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent<HTMLVideoElement>).clientX;
            clientY = (e as React.MouseEvent<HTMLVideoElement>).clientY;
        }

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        setFocusPoint({ x, y });
        setTimeout(() => setFocusPoint(null), 1500);

        try {
            const constraints: any = { advanced: [] };

            if (capabilities.focusMode && capabilities.focusMode.includes("manual")) {
                constraints.advanced.push({ focusMode: "manual" });
            } else if (capabilities.focusMode && capabilities.focusMode.includes("single-shot")) {
                constraints.advanced.push({ focusMode: "single-shot" });
            }

            if (capabilities.pointsOfInterest) {
                constraints.advanced.push({
                    pointsOfInterest: [{ x: x / rect.width, y: y / rect.height }]
                });
            }

            if (constraints.advanced.length > 0) {
                await track.applyConstraints(constraints);
            }

            setTimeout(async () => {
                try {
                    await track.applyConstraints({
                        advanced: [{ focusMode: "continuous" }]
                    } as any);
                } catch (e) { }
            }, 1500);
        } catch (err) {
            console.warn("Focus failed:", err);
            try {
                await track.applyConstraints({ advanced: [{ focusMode: "manual" }] } as any);
                await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] } as any);
            } catch (e) { }
        }
    }, []);

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
        announce('Photo captured.', 'polite');
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

            const dstCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, maxWidth - 1, 0, maxWidth - 1, maxHeight - 1, 0, maxHeight - 1]);
            const M = cv.getPerspectiveTransform(srcCoords, dstCoords);
            const warpedSrc = new cv.Mat();
            const dsize = new cv.Size(maxWidth, maxHeight);
            cv.warpPerspective(src, warpedSrc, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

            const canvas = canvasRef.current!;
            canvas.width = maxWidth;
            canvas.height = maxHeight;
            cv.imshow(canvas, warpedSrc);
            const finalImageUrl = canvas.toDataURL('image/jpeg', 0.9);
            setTransformedImage(finalImageUrl);
            setImageAspect(maxWidth / maxHeight);

            M.delete(); srcCoords.delete(); dstCoords.delete(); src.delete(); warpedSrc.delete();

            setScanStage('analyzing');
            const aiResult = await analyzeImageWithAI(finalImageUrl, locale);

            if (aiResult.success && aiResult.data) {
                const data = aiResult.data;
                if ((!data.logDate || isNaN(new Date(data.logDate).getTime())) && data.events) {
                    const dateEvent = data.events.find((e: any) => e.date && !isNaN(new Date(e.date).getTime()));
                    if (dateEvent) data.logDate = dateEvent.date;
                }
                setScanStage('complete');
                setViewMode('digital');
                setResult(data);
            } else {
                throw new Error("AI failed");
            }
        } catch (e) {
            console.error("Analysis Error", e);
            setScanStage('complete');
            setResult({ summary: "Error processing image", sentiment: "Unknown", events: [], tags: ["Error"] });
        }
    };

    const handleDiscard = () => {
        setImage(null);
        setTransformedImage(null);
        setResult(null);
        setScanStage('idle');
    };

    const handleSave = async () => {
        if (!result) return;
        const logDate = result.logDate ? new Date(result.logDate) : new Date();
        const finalDate = isNaN(logDate.getTime()) ? new Date() : logDate;

        const newLog: LogItem = {
            id: 'scan-' + Date.now(),
            type: 'analog',
            title: result.summary.length > 30 ? result.summary.substring(0, 30) + "..." : result.summary,
            timestamp: finalDate,
            eventCount: result.events.length || 1,
            summary: result.summary,
            tags: result.tags,
            events: result.events
        };

        try {
            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                await updateDoc(userDocRef, {
                    logs: arrayUnion({ ...newLog, timestamp: finalDate.toISOString() })
                });
            } else {
                const savedLogs = localStorage.getItem("dashboardLogs");
                const parsed = savedLogs ? JSON.parse(savedLogs) : [];
                parsed.push({ ...newLog, timestamp: finalDate.toISOString() });
                localStorage.setItem("dashboardLogs", JSON.stringify(parsed));
            }
            router.push('/dashboard');
        } catch (err) {
            console.error("Save error:", err);
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
                newPts[pt1] = { x: Math.max(0, Math.min(100, newPts[pt1].x + dx)), y: Math.max(0, Math.min(100, newPts[pt1].y + dy)) };
                newPts[pt2] = { x: Math.max(0, Math.min(100, newPts[pt2].x + dx)), y: Math.max(0, Math.min(100, newPts[pt2].y + dy)) };
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
                    const checkCv = setInterval(() => {
                        if ((window as any).cv && typeof (window as any).cv.Mat === 'function') {
                            clearInterval(checkCv);
                            setCvReady(true);
                        }
                    }, 100);
                }}
            />

            <header className="fixed top-0 left-0 right-0 px-4 py-4 flex items-center justify-between z-30 pointer-events-none">
                <Link href="/" className="p-2 rounded-full bg-black/20 backdrop-blur-md hover:bg-black/40 transition-colors pointer-events-auto">
                    <ArrowLeft size={24} />
                </Link>
                {scanStage !== 'idle' && (
                    <button onClick={handleDiscard} className="p-2 rounded-full bg-black/20 backdrop-blur-md text-[var(--color-neutral-400)] hover:text-white hover:bg-black/40 transition-colors pointer-events-auto">
                        <X size={24} />
                    </button>
                )}
            </header>

            <main className={cn("flex-1 flex flex-col items-center justify-center z-10 w-full relative", scanStage === 'idle' ? "px-0 pb-0" : "px-4 sm:px-6 pb-24")}>
                {scanStage === 'idle' && (
                    <div className="relative w-full h-[100dvh] bg-black flex flex-col items-center justify-center">
                        <video ref={videoRef} className="w-full h-full object-cover cursor-pointer" playsInline muted autoPlay onClick={handleTapToFocus} />
                        {focusPoint && (
                            <div className="absolute w-16 h-16 border-2 border-[var(--color-primary-400)] rounded-md pointer-events-none animate-pulse z-40" style={{ left: focusPoint.x, top: focusPoint.y, transform: 'translate(-50%, -50%)' }} />
                        )}
                        <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center px-8 z-20 gap-8">
                            <Link href="/" className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white">
                                <ArrowLeft size={24} />
                            </Link>
                            <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full border-[6px] border-[var(--color-primary-500)]/30 active:scale-95 transition-all shadow-2xl relative">
                                <div className="absolute inset-2 bg-[var(--color-primary-600)] rounded-full" />
                            </button>
                            <div className="flex flex-col gap-3">
                                <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white">
                                    <ImageIcon size={24} />
                                </button>
                                {availableCameras.length > 1 && (
                                    <button onClick={() => {
                                        const currentIndex = availableCameras.findIndex(c => c.deviceId === activeCameraId);
                                        const nextIndex = (currentIndex + 1) % availableCameras.length;
                                        setActiveCameraId(availableCameras[nextIndex].deviceId);
                                        stopCamera();
                                        setTimeout(startCamera, 100);
                                    }} className="p-4 bg-[var(--color-primary-600)]/80 backdrop-blur-md rounded-full text-white shadow-lg">
                                        <RefreshCcw size={24} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {scanStage !== 'idle' && (
                    <div className="w-full flex-1 flex flex-col items-center justify-center pt-8">
                        <div
                            ref={containerRef}
                            className={cn("relative w-full mx-auto rounded-3xl overflow-hidden shadow-2xl transition-all duration-1000", scanStage === 'transforming' ? "scale-95 bg-black" : "bg-[var(--color-neutral-800)] scale-100")}
                            style={{ aspectRatio: imageAspect ? imageAspect : (9 / 16), maxHeight: '65vh', maxWidth: imageAspect ? `calc(65vh * ${imageAspect})` : 'calc(65vh * (9/16))' }}
                            onPointerMove={pointerMoveHandler}
                        >
                            <img src={(scanStage === 'complete' && viewMode === 'digital' && transformedImage) ? transformedImage : (image || '')} alt="Scan" className="w-full h-full object-contain" />
                            {scanStage === 'cropping' && (
                                <div className="absolute inset-0 z-30">
                                    <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none">
                                        {cropPoints.map((p, i) => {
                                            const nextP = cropPoints[(i + 1) % 4];
                                            return (
                                                <g key={i}>
                                                    <line x1={`${p.x}%`} y1={`${p.y}%`} x2={`${nextP.x}%`} y2={`${nextP.y}%`} stroke="white" strokeWidth="2" />
                                                    <circle cx={`${p.x}%`} cy={`${p.y}%`} r="10" fill="white" className="pointer-events-auto cursor-move" onPointerDown={() => setActiveElement(i)} onPointerUp={pointerUpHandler} />
                                                </g>
                                            );
                                        })}
                                    </svg>
                                </div>
                            )}
                        </div>
                        {scanStage === 'cropping' && (
                            <div className="w-full max-w-sm mx-auto flex justify-between gap-4 mt-8">
                                <Button onClick={handleDiscard} variant="ghost" className="flex-1 bg-[var(--color-neutral-800)] text-white">Discard</Button>
                                <Button onClick={confirmCrop} variant="primary" className="flex-1 font-bold">Confirm</Button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {scanStage === 'complete' && result && (
                <div className="fixed bottom-0 left-0 right-0 p-6 bg-[var(--color-neutral-800)] rounded-t-3xl border-t border-[var(--color-neutral-700)] z-20 overflow-y-auto max-h-[80vh]">
                    <div className="space-y-4">
                        <div className="flex bg-[var(--color-neutral-900)] rounded-lg p-1 mb-4">
                            <button onClick={() => setViewMode('original')} className={cn("flex-1 py-1.5 text-sm rounded-md", viewMode === 'original' ? "bg-[var(--color-primary-600)] text-white" : "text-[var(--color-neutral-400)]")}>Original</button>
                            <button onClick={() => setViewMode('digital')} className={cn("flex-1 py-1.5 text-sm rounded-md", viewMode === 'digital' ? "bg-[var(--color-primary-600)] text-white" : "text-[var(--color-neutral-400)]")}>Digital</button>
                        </div>
                        {viewMode === 'digital' && (
                            <div className="bg-[var(--color-neutral-700)] p-6 rounded-xl space-y-4">
                                <input type="date" className="bg-transparent text-sm text-white border border-[var(--color-neutral-600)] rounded px-2 py-1" value={result.logDate || ''} onChange={(e) => setResult({ ...result!, logDate: e.target.value })} />
                                <textarea className="w-full bg-transparent text-white italic border-b border-[var(--color-neutral-600)] outline-none" value={result.summary} onChange={(e) => setResult({ ...result!, summary: e.target.value })} />
                                <div className="space-y-2">
                                    {result.events.map((ev, i) => (
                                        <div key={i} className="flex justify-between text-sm border-b border-[var(--color-neutral-600)] pb-1">
                                            <input className="bg-transparent text-[var(--color-neutral-400)] outline-none" value={ev.time} onChange={(e) => {
                                                const newEvs = [...result.events];
                                                newEvs[i] = { ...newEvs[i], time: e.target.value };
                                                setResult({ ...result!, events: newEvs });
                                            }} />
                                            <input className="bg-transparent text-white text-right outline-none" value={ev.title} onChange={(e) => {
                                                const newEvs = [...result.events];
                                                newEvs[i] = { ...newEvs[i], title: e.target.value };
                                                setResult({ ...result!, events: newEvs });
                                            }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex gap-3">
                            <Button variant="ghost" className="flex-1" onClick={handleDiscard}>Discard</Button>
                            <Button variant="primary" className="flex-1" onClick={handleSave}>Save</Button>
                        </div>
                    </div>
                </div>
            )}

            <input type="file" accept="image/*" className="sr-only" ref={fileInputRef} onChange={handleFileSelect} />
            <canvas ref={canvasRef} className="hidden" />
            <style jsx global>{`
                @keyframes scan { 0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
            `}</style>
        </div>
    );
}
