"use client";

import { useState, useCallback } from "react";
import { FileText, Check, Calendar as CalendarIcon, ArrowRight } from "lucide-react";
import ICAL from "ical.js";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FileUpload } from "@/components/ui/FileUpload";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { useAnnounce } from "@/lib/hooks";
import { formatFileSize } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";

interface ParsedEvent {
    summary: string;
    startDate: Date;
    endDate: Date;
    description: string;
}

export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [events, setEvents] = useState<ParsedEvent[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const announce = useAnnounce();
    const { t, locale } = useLanguage();
    const { user } = useAuth();

    const parseICS = useCallback(async (file: File) => {
        setIsParsing(true);
        setError(null);
        announce('Parsing calendar file...', 'polite');

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const jcalData = ICAL.parse(content);
                const comp = new ICAL.Component(jcalData);
                const vevents = comp.getAllSubcomponents("vevent");

                const parsedEvents = vevents.map(vevent => {
                    const event = new ICAL.Event(vevent);
                    return {
                        summary: event.summary,
                        startDate: event.startDate.toJSDate(),
                        endDate: event.endDate.toJSDate(),
                        description: event.description
                    };
                });

                setEvents(parsedEvents);
                setFile(file);
                announce(`Successfully parsed ${parsedEvents.length} events`, 'polite');
            } catch (err) {
                console.error("Parse error", err);
                const errorMsg = "Failed to parse the calendar file. Please ensure it is a valid .ics file.";
                setError(errorMsg);
                announce(errorMsg, 'assertive');
            } finally {
                setIsParsing(false);
            }
        };

        reader.onerror = () => {
            const errorMsg = "Failed to read the file.";
            setError(errorMsg);
            announce(errorMsg, 'assertive');
            setIsParsing(false);
        };

        reader.readAsText(file);
    }, [announce]);

    const handleFileSelect = useCallback((selectedFile: File) => {
        parseICS(selectedFile);
    }, [parseICS]);

    const handleFileRemove = useCallback(() => {
        setFile(null);
        setEvents([]);
        setError(null);
        announce('File removed', 'polite');
    }, [announce]);

    const handleGeneratePDF = async () => {
        localStorage.setItem("calEvents", JSON.stringify(events));

        if (user) {
            try {
                // Also save to Firestore for cloud history
                const userDocRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userDocRef);
                const existingEvents = userSnap.exists() ? userSnap.data().events || [] : [];

                await setDoc(userDocRef, {
                    events: [...existingEvents, ...events],
                    lastUpdate: new Date().toISOString()
                }, { merge: true });
            } catch (err) {
                console.error("Firestore Upload Sync Error:", err);
            }
        }

        window.location.href = "/preview";
    };

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <Header />

            {/* Main Content */}
            <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8 bg-[var(--color-neutral-50)]">
                <div className="max-w-3xl mx-auto">
                    {/* Page Header */}
                    <div className="mb-10 text-center">
                        <Link
                            href="/"
                            className="inline-flex items-center text-sm text-[var(--color-neutral-600)] hover:text-[var(--color-neutral-900)] mb-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] rounded-md px-2 py-1"
                        >
                            ← Back to Home
                        </Link>
                        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-neutral-900)] mb-3">
                            {t('uploadTitle')}
                        </h1>
                        <p className="text-lg text-[var(--color-neutral-600)] max-w-2xl mx-auto">
                            {t('uploadDesc')}
                        </p>
                    </div>

                    {/* Upload Area - Show when no file */}
                    {!file && !isParsing && (
                        <FileUpload
                            accept=".ics"
                            maxSize={10 * 1024 * 1024} // 10MB
                            onFileSelect={handleFileSelect}
                            onFileRemove={handleFileRemove}
                        />
                    )}

                    {/* Parsing State */}
                    {isParsing && (
                        <Card variant="elevated" padding="lg">
                            <LoadingState
                                size="lg"
                                text={t('parsing')}
                            />
                        </Card>
                    )}

                    {/* Success State - Show parsed events */}
                    {file && !isParsing && events.length > 0 && (
                        <Card variant="elevated" padding="none">
                            <CardContent padding="lg">
                                {/* Success Header */}
                                <div className="flex items-start gap-4 mb-8 pb-8 border-b border-[var(--color-neutral-200)]">
                                    <div className="flex-shrink-0 w-16 h-16 bg-[var(--color-success-100)] rounded-2xl flex items-center justify-center text-[var(--color-success-600)]">
                                        <Check size={32} strokeWidth={3} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-neutral-900)] mb-2">
                                            {t('successParsed')}
                                        </h2>
                                        <div className="flex items-center gap-2 text-[var(--color-neutral-600)]">
                                            <FileText size={16} />
                                            <p className="text-sm truncate">{file.name}</p>
                                            <span className="text-xs text-[var(--color-neutral-500)]">
                                                ({formatFileSize(file.size)})
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleFileRemove}
                                        className="flex-shrink-0 text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-error-600)] underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] rounded-md px-2 py-1"
                                        aria-label="Remove file and start over"
                                    >
                                        {t('removeFile')}
                                    </button>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                                    <div className="p-6 bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] rounded-xl">
                                        <div className="flex items-center gap-2 text-[var(--color-primary-700)] mb-2">
                                            <CalendarIcon size={18} />
                                            <p className="text-sm font-semibold">{t('totalEvents')}</p>
                                        </div>
                                        <p className="text-3xl sm:text-4xl font-bold text-[var(--color-primary-900)]">
                                            {events.length}
                                        </p>
                                    </div>
                                    <div className="p-6 bg-[var(--color-neutral-100)] border border-[var(--color-neutral-200)] rounded-xl">
                                        <p className="text-sm font-semibold text-[var(--color-neutral-700)] mb-2">
                                            {t('dateRange')}
                                        </p>
                                        <p className="text-base sm:text-lg font-semibold text-[var(--color-neutral-900)]">
                                            {events.length > 0 ? (
                                                <>
                                                    {events[0].startDate.toLocaleDateString(locale === 'ko' ? 'ko-KR' : locale === 'jp' ? 'ja-JP' : 'en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                    <br />
                                                    <span className="text-[var(--color-neutral-600)]">~</span>
                                                    <br />
                                                    {events[events.length - 1].startDate.toLocaleDateString(locale === 'ko' ? 'ko-KR' : locale === 'jp' ? 'ja-JP' : 'en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </>
                                            ) : "N/A"}
                                        </p>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
                                    <Link href="/dashboard" className="flex-1 w-full" onClick={async () => {
                                        localStorage.setItem("calEvents", JSON.stringify(events));
                                        announce('Changes saved to dashboard', 'polite');
                                    }}>
                                        <Button
                                            variant="outline"
                                            size="lg"
                                            fullWidth
                                        >
                                            {t('btnSaveToApp')}
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="primary"
                                        size="lg"
                                        onClick={handleGeneratePDF}
                                        rightIcon={<ArrowRight size={20} />}
                                        fullWidth
                                        className="flex-1"
                                    >
                                        {t('btnGeneratePdf')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Help Text */}
                    <div className="mt-8 text-center">
                        <p className="text-sm text-[var(--color-neutral-600)] mb-2">
                            {t('helpText')}
                        </p>
                        <div className="flex flex-wrap justify-center gap-4 text-sm">
                            <a
                                href="https://support.google.com/calendar/answer/37111"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] underline transition-colors"
                            >
                                {t('googleGuide')}
                            </a>
                            <span className="text-[var(--color-neutral-400)]">•</span>
                            <a
                                href="https://support.apple.com/guide/calendar/export-calendars-icl1023/mac"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] underline transition-colors"
                            >
                                {t('appleGuide')}
                            </a>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <Footer />
        </div>
    );
}
