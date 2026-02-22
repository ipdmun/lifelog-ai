"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LogTimeline, LogItem } from "@/components/dashboard/LogTimeline";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DiaryPage() {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [allLogs, setAllLogs] = useState<LogItem[]>([]);

    // Modal state
    const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);
    const [isEditingLog, setIsEditingLog] = useState(false);
    const [editLogData, setEditLogData] = useState<LogItem | null>(null);

    const handleSaveLogEdit = async () => {
        if (!selectedLog || !editLogData) return;

        const updatedLogs = allLogs.map(l => l.id === editLogData.id ? editLogData : l);
        setAllLogs(updatedLogs);

        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            await setDoc(userDocRef, { logs: updatedLogs.filter(l => l.type === 'analog') }, { merge: true });
        } else {
            const savedLogs = localStorage.getItem("dashboardLogs");
            if (savedLogs) {
                const parsed = JSON.parse(savedLogs);
                const newParsed = parsed.map((l: any) => l.id === editLogData.id ? editLogData : l);
                localStorage.setItem("dashboardLogs", JSON.stringify(newParsed));
            }
        }

        setSelectedLog(editLogData);
        setIsEditingLog(false);
    };

    useEffect(() => {
        if (user) {
            const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const logs = data.logs || [];
                    const events = data.events || [];

                    const restoredLogs = logs.map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }));
                    const restoredEvents = events.map((e: any) => ({
                        id: 'cal-' + e.id,
                        type: 'digital',
                        title: e.summary,
                        timestamp: new Date(e.startDate),
                        eventCount: 1
                    }));

                    const combined = [...restoredLogs, ...restoredEvents];
                    combined.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                    setAllLogs(combined);
                } else {
                    setAllLogs([]);
                }
            });
            return () => unsub();
        } else {
            // LocalStorage loading
            try {
                let loadedLogs: any[] = [];
                const savedLogs = localStorage.getItem("dashboardLogs");
                if (savedLogs) {
                    loadedLogs = JSON.parse(savedLogs).map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }));
                }

                const allEventsRaw = localStorage.getItem("allEvents");
                if (allEventsRaw) {
                    const parsedEvents = JSON.parse(allEventsRaw).map((e: any) => ({
                        id: 'cal-' + e.id,
                        type: 'digital',
                        title: e.summary,
                        timestamp: new Date(e.startDate),
                        eventCount: 1
                    }));
                    loadedLogs = [...loadedLogs, ...parsedEvents];
                }

                loadedLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                setAllLogs(loadedLogs);
            } catch (e) {
                console.error("Local data load error:", e);
                setAllLogs([]);
            }
        }
    }, [user]);

    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8 bg-[var(--color-neutral-50)]">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--color-neutral-200)] pb-6">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-neutral-900)] mb-2 flex items-center gap-3">
                                <BookOpen size={32} className="text-[var(--color-primary-600)]" />
                                My Diary
                            </h1>
                            <p className="text-lg text-[var(--color-neutral-600)]">
                                A combined view of all your digital meetings and analog notes.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-[var(--color-neutral-200)] shadow-sm min-h-[500px]">
                        {allLogs.length > 0 ? (
                            <LogTimeline logs={allLogs} onLogClick={(log) => setSelectedLog(log)} />
                        ) : (
                            <div className="flex items-center justify-center h-[400px] text-[var(--color-neutral-500)] italic">
                                No diary entries found yet. Upload calendar or scan notes to get started!
                            </div>
                        )}
                    </div>
                </div>
            </main>
            <Footer />

            {/* Log Details Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <Card variant="elevated" className="w-full max-w-lg bg-white overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <CardHeader className="border-b border-[var(--color-neutral-100)] flex justify-between items-center bg-[var(--color-neutral-50)]/50 shrink-0">
                            <div className="flex-1 mr-4 overflow-hidden">
                                <Badge variant={selectedLog.type === 'digital' ? 'primary' : 'outline'} className="mb-2">
                                    {selectedLog.type === 'digital' ? 'Digital Appt' : 'Analog Scan'}
                                </Badge>
                                {isEditingLog ? (
                                    <input
                                        type="text"
                                        className="w-full text-lg font-bold text-[var(--color-neutral-900)] bg-white border border-[var(--color-neutral-300)] rounded-md px-2 py-1"
                                        value={editLogData?.summary || editLogData?.title || ''}
                                        onChange={(e) => setEditLogData(prev => ({ ...prev!, summary: e.target.value, title: e.target.value }))}
                                    />
                                ) : (
                                    <h3 className="text-lg font-bold text-[var(--color-neutral-900)] block truncate">
                                        {selectedLog.summary || selectedLog.title}
                                    </h3>
                                )}
                            </div>
                            {!isEditingLog && selectedLog.type === 'analog' && (
                                <Button variant="outline" size="sm" onClick={() => { setIsEditingLog(true); setEditLogData(selectedLog); }}>
                                    Edit
                                </Button>
                            )}
                        </CardHeader>

                        <CardContent className="overflow-y-auto p-6 space-y-4 flex-1">
                            {selectedLog.tags && selectedLog.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {selectedLog.tags.map(t => (
                                        <Badge key={t} variant="success" className="bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border border-[var(--color-primary-100)]">
                                            #{t}
                                        </Badge>
                                    ))}
                                </div>
                            )}

                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-[var(--color-neutral-500)] tracking-wider">DETECTED EVENTS</h4>
                                {isEditingLog ? (
                                    <ul className="space-y-3">
                                        {(editLogData?.events || []).map((evt, idx) => (
                                            <li key={idx} className="flex flex-col gap-2 p-3 rounded-lg bg-[var(--color-neutral-50)] border border-[var(--color-primary-200)]">
                                                <input
                                                    type="text"
                                                    className="text-sm text-[var(--color-neutral-600)] font-medium bg-white border border-[var(--color-neutral-300)] rounded-md px-2 py-1 w-full"
                                                    value={evt.time}
                                                    onChange={(e) => {
                                                        const newEvts = [...(editLogData?.events || [])];
                                                        newEvts[idx].time = e.target.value;
                                                        setEditLogData(prev => ({ ...prev!, events: newEvts }));
                                                    }}
                                                />
                                                <textarea
                                                    className="text-sm font-bold text-[var(--color-neutral-900)] bg-white border border-[var(--color-neutral-300)] rounded-md px-2 py-1 w-full resize-none min-h-[60px]"
                                                    value={evt.title}
                                                    onChange={(e) => {
                                                        const newEvts = [...(editLogData?.events || [])];
                                                        newEvts[idx].title = e.target.value;
                                                        setEditLogData(prev => ({ ...prev!, events: newEvts }));
                                                    }}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    selectedLog.events && selectedLog.events.length > 0 ? (
                                        <ul className="space-y-2">
                                            {selectedLog.events.map((evt, idx) => (
                                                <li key={idx} className="flex justify-between items-start gap-4 p-3 rounded-lg bg-[var(--color-neutral-50)] border border-[var(--color-neutral-100)]">
                                                    <span className="text-sm text-[var(--color-neutral-600)] font-medium leading-relaxed max-w-[40%] flex-shrink-0">
                                                        {evt.time}
                                                    </span>
                                                    <span className="text-sm font-bold text-[var(--color-neutral-900)] text-right break-words leading-relaxed flex-1">
                                                        {evt.title}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="py-6 text-center text-[var(--color-neutral-500)] italic border border-dashed border-[var(--color-neutral-200)] rounded-xl">
                                            No detailed events captured.
                                        </div>
                                    )
                                )}
                            </div>
                        </CardContent>

                        <div className="p-4 border-t border-[var(--color-neutral-100)] bg-[var(--color-neutral-50)]/50 flex gap-3 shrink-0">
                            {isEditingLog ? (
                                <>
                                    <Button fullWidth onClick={() => setIsEditingLog(false)} variant="outline">
                                        Cancel
                                    </Button>
                                    <Button fullWidth onClick={handleSaveLogEdit} variant="primary">
                                        Save Changes
                                    </Button>
                                </>
                            ) : (
                                <Button fullWidth onClick={() => setSelectedLog(null)} variant="primary">
                                    Close
                                </Button>
                            )}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

// Internal Badge helper
function Badge({ children, variant = 'primary', size = 'md', className }: { children: React.ReactNode, variant?: string, size?: string, className?: string }) {
    const variants: Record<string, string> = {
        primary: 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)]',
        success: 'bg-[var(--color-success-100)] text-[var(--color-success-700)]',
        outline: 'border border-[var(--color-neutral-200)] text-[var(--color-neutral-600)]',
    };
    return (
        <span className={cn('inline-flex items-center justify-center rounded-full font-semibold text-xs px-2 py-1 transition-colors', variants[variant], className)}>
            {children}
        </span>
    );
}
