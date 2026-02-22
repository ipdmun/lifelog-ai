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
import { BookOpen, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DiaryPage() {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [allLogs, setAllLogs] = useState<LogItem[]>([]);

    // Modal state
    const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);
    const [editLogData, setEditLogData] = useState<LogItem | null>(null);

    // Manual Event Add State
    const [isAddingEvent, setIsAddingEvent] = useState(false);
    const [newEventTitle, setNewEventTitle] = useState("");
    const [newEventTime, setNewEventTime] = useState("");

    const handleSaveNewEvent = async () => {
        if (!newEventTitle.trim() || !newEventTime.trim()) return;

        const [hours, minutes] = newEventTime.split(':').map(Number);
        const eventDate = new Date(selectedDate);
        eventDate.setHours(hours, minutes, 0, 0);

        const newEvent = {
            id: Date.now().toString(),
            summary: newEventTitle,
            startDate: eventDate.toISOString(),
            endDate: eventDate.toISOString()
        };

        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(userDocRef);
            let existingEvents = [];
            if (docSnap.exists()) {
                existingEvents = docSnap.data().events || [];
            }
            await setDoc(userDocRef, { events: [...existingEvents, newEvent] }, { merge: true });
        } else {
            const oldEventsStr = localStorage.getItem("allEvents");
            const existingEvents = oldEventsStr ? JSON.parse(oldEventsStr) : [];
            localStorage.setItem("allEvents", JSON.stringify([...existingEvents, newEvent]));
            // Predict optimistic update for local user
            setAllLogs(prev => {
                const added: LogItem = {
                    id: 'cal-' + newEvent.id,
                    type: 'digital',
                    title: newEvent.summary,
                    timestamp: new Date(newEvent.startDate),
                    eventCount: 1
                };
                const newArr = [...prev, added];
                newArr.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                return newArr;
            });
        }

        setIsAddingEvent(false);
        setNewEventTitle("");
        setNewEventTime("09:00");
    };

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
    };

    const hasChanges = selectedLog && editLogData && JSON.stringify(selectedLog) !== JSON.stringify(editLogData);

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

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    // Calendar Calculations
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarDays = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDays.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        calendarDays.push(new Date(year, month, i));
    }

    const filteredLogs = allLogs.filter(log => {
        if (log.type === 'analog' && log.events) {
            const hasEventOnDate = log.events.some(e => {
                if (e.date) {
                    try {
                        const ed = new Date(e.date);
                        if (!isNaN(ed.getTime())) {
                            return ed.getFullYear() === selectedDate.getFullYear() &&
                                ed.getMonth() === selectedDate.getMonth() &&
                                ed.getDate() === selectedDate.getDate();
                        }
                    } catch (err) { }
                }
                return false;
            });
            if (hasEventOnDate) return true;
        }
        return log.timestamp.getFullYear() === selectedDate.getFullYear() &&
            log.timestamp.getMonth() === selectedDate.getMonth() &&
            log.timestamp.getDate() === selectedDate.getDate();
    });

    const checkHasLogs = (date: Date) => {
        return allLogs.some(log => {
            if (log.type === 'analog' && log.events) {
                const hasEventOnDate = log.events.some(e => {
                    if (e.date) {
                        try {
                            const ed = new Date(e.date);
                            if (!isNaN(ed.getTime())) {
                                return ed.getFullYear() === date.getFullYear() &&
                                    ed.getMonth() === date.getMonth() &&
                                    ed.getDate() === date.getDate();
                            }
                        } catch (err) { }
                    }
                    return false;
                });
                if (hasEventOnDate) return true;
            }
            return log.timestamp.getFullYear() === date.getFullYear() &&
                log.timestamp.getMonth() === date.getMonth() &&
                log.timestamp.getDate() === date.getDate();
        });
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8 bg-[var(--color-neutral-50)]">
                <div className="max-w-6xl mx-auto space-y-8">
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

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Calendar Panel */}
                        <div className="lg:col-span-1">
                            <Card className="p-4 sm:p-6 bg-white shadow-sm border-[var(--color-neutral-200)]">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-[var(--color-neutral-900)]">
                                        {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <button onClick={handlePrevMonth} className="p-2 hover:bg-[var(--color-neutral-100)] rounded-full transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                        </button>
                                        <button onClick={handleNextMonth} className="p-2 hover:bg-[var(--color-neutral-100)] rounded-full transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-semibold text-[var(--color-neutral-500)]">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                        <div key={day} className="py-2">{day}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {calendarDays.map((date, idx) => {
                                        if (!date) return <div key={`empty-${idx}`} className="h-10 sm:h-12"></div>;

                                        const isSelected = date.toDateString() === selectedDate.toDateString();
                                        const isToday = date.toDateString() === new Date().toDateString();
                                        const hasActivity = checkHasLogs(date);

                                        return (
                                            <button
                                                key={date.toISOString()}
                                                onClick={() => setSelectedDate(date)}
                                                className={cn(
                                                    "relative h-10 sm:h-12 w-full flex items-center justify-center rounded-lg text-sm transition-all font-medium",
                                                    isSelected ? "bg-[var(--color-primary-600)] text-white font-bold shadow-md" :
                                                        isToday ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)]" :
                                                            "text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)]"
                                                )}
                                            >
                                                {date.getDate()}
                                                {hasActivity && (
                                                    <span className={cn(
                                                        "absolute bottom-1 w-1.5 h-1.5 rounded-full",
                                                        isSelected ? "bg-white" : "bg-[var(--color-primary-500)]"
                                                    )}></span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Card>
                        </div>

                        {/* Timeline Panel */}
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-2xl p-6 border border-[var(--color-neutral-200)] shadow-sm min-h-[500px]">
                                <div className="mb-6 pb-2 border-b border-[var(--color-neutral-100)] flex items-center justify-between gap-4 flex-wrap">
                                    <h3 className="text-lg font-bold text-[var(--color-neutral-900)] flex items-center gap-2">
                                        Logs for {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                                    </h3>
                                    <Button onClick={() => setIsAddingEvent(true)} size="sm" variant="outline" className="text-[var(--color-primary-600)] border-[var(--color-primary-200)] hover:bg-[var(--color-primary-50)]">
                                        <Plus size={16} className="mr-1" />
                                        Add Event
                                    </Button>
                                </div>

                                {isAddingEvent && (
                                    <div className="mb-6 p-4 rounded-xl border border-[var(--color-primary-200)] bg-[var(--color-primary-50)]/30 space-y-3 animate-in fade-in slide-in-from-top-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-bold text-[var(--color-primary-800)]">New Event</h4>
                                            <button onClick={() => setIsAddingEvent(false)} className="text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)]">
                                                <X size={16} />
                                            </button>
                                        </div>
                                        <div className="flex gap-2 text-sm">
                                            <input
                                                type="time"
                                                className="px-3 py-2 border border-[var(--color-neutral-200)] rounded-md outline-none focus:border-[var(--color-primary-400)] bg-white"
                                                value={newEventTime}
                                                onChange={e => setNewEventTime(e.target.value)}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Event Title..."
                                                className="flex-1 px-3 py-2 border border-[var(--color-neutral-200)] rounded-md outline-none focus:border-[var(--color-primary-400)] bg-white"
                                                value={newEventTitle}
                                                onChange={e => setNewEventTitle(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleSaveNewEvent()}
                                            />
                                            <Button onClick={handleSaveNewEvent} size="sm" variant="primary">
                                                Save
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {filteredLogs.length > 0 ? (
                                    <LogTimeline logs={filteredLogs} onLogClick={(log) => { setSelectedLog(log); setEditLogData(JSON.parse(JSON.stringify(log))); }} />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-[300px] text-[var(--color-neutral-500)] italic space-y-4">
                                        <div className="w-16 h-16 bg-[var(--color-neutral-100)] rounded-full flex items-center justify-center text-[var(--color-neutral-400)]">
                                            <BookOpen size={24} />
                                        </div>
                                        <p>No diary entries for this date.</p>
                                    </div>
                                )}
                            </div>
                        </div>
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
                                <div className="flex items-center gap-3 mb-2">
                                    <Badge variant={selectedLog.type === 'digital' ? 'primary' : 'outline'}>
                                        {selectedLog.type === 'digital' ? 'Digital Appt' : 'Analog Scan'}
                                    </Badge>
                                    {selectedLog.type === 'analog' && (
                                        <input
                                            type="date"
                                            className="text-sm font-medium text-[var(--color-neutral-600)] bg-transparent border border-transparent hover:border-[var(--color-neutral-200)] focus:bg-white focus:border-[var(--color-neutral-300)] rounded-md px-1 py-0.5 outline-none cursor-text"
                                            value={editLogData?.timestamp ? new Date(new Date(editLogData.timestamp).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0] : ''}
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    // Maintain the same time, just change the date
                                                    const newDate = new Date(e.target.value);
                                                    const oldDate = new Date(editLogData?.timestamp || new Date());
                                                    newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds());
                                                    setEditLogData(prev => ({ ...prev!, timestamp: newDate }));
                                                }
                                            }}
                                            title="Scan Date"
                                        />
                                    )}
                                </div>
                                {selectedLog.type === 'analog' ? (
                                    <input
                                        type="text"
                                        className="w-full text-lg font-bold text-[var(--color-neutral-900)] bg-transparent border border-transparent hover:border-[var(--color-neutral-200)] focus:bg-white focus:border-[var(--color-neutral-300)] rounded-md px-1 py-1 transition-colors outline-none cursor-text"
                                        value={editLogData?.summary || editLogData?.title || ''}
                                        onChange={(e) => setEditLogData(prev => ({ ...prev!, summary: e.target.value, title: e.target.value }))}
                                        placeholder="Enter Title..."
                                    />
                                ) : (
                                    <h3 className="text-lg font-bold text-[var(--color-neutral-900)] block truncate">
                                        {selectedLog.summary || selectedLog.title}
                                    </h3>
                                )}
                            </div>
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
                                {selectedLog.type === 'analog' ? (
                                    <ul className="space-y-3">
                                        {(editLogData?.events || []).map((evt, idx) => (
                                            <li key={idx} className="flex flex-col gap-2 p-3 rounded-lg bg-[var(--color-neutral-50)] border border-transparent hover:border-[var(--color-neutral-200)] focus-within:border-[var(--color-neutral-300)] focus-within:bg-white transition-colors">
                                                <div className="flex gap-2">
                                                    <input
                                                        type="date"
                                                        className="text-sm text-[var(--color-neutral-600)] font-medium bg-transparent border border-transparent hover:border-[var(--color-neutral-200)] focus:bg-white focus:border-[var(--color-neutral-300)] rounded-md px-1 py-0.5 w-[130px] outline-none cursor-text"
                                                        value={evt.date || ''}
                                                        onChange={(e) => {
                                                            const newEvts = [...(editLogData?.events || [])];
                                                            newEvts[idx] = { ...newEvts[idx], date: e.target.value };
                                                            setEditLogData(prev => ({ ...prev!, events: newEvts }));
                                                        }}
                                                    />
                                                    <input
                                                        type="text"
                                                        className="text-sm text-[var(--color-neutral-600)] font-medium bg-transparent border border-transparent hover:border-[var(--color-neutral-200)] focus:bg-white focus:border-[var(--color-neutral-300)] rounded-md px-1 py-0.5 flex-1 outline-none cursor-text"
                                                        value={evt.time}
                                                        onChange={(e) => {
                                                            const newEvts = [...(editLogData?.events || [])];
                                                            newEvts[idx] = { ...newEvts[idx], time: e.target.value };
                                                            setEditLogData(prev => ({ ...prev!, events: newEvts }));
                                                        }}
                                                        placeholder="Time/Field"
                                                    />
                                                </div>
                                                <textarea
                                                    className="text-sm font-bold text-[var(--color-neutral-900)] bg-transparent border border-transparent hover:border-[var(--color-neutral-200)] focus:bg-white focus:border-[var(--color-neutral-300)] rounded-md px-1 py-0.5 w-full resize-none min-h-[40px] outline-none cursor-text"
                                                    value={evt.title}
                                                    onChange={(e) => {
                                                        const newEvts = [...(editLogData?.events || [])];
                                                        newEvts[idx] = { ...newEvts[idx], title: e.target.value };
                                                        setEditLogData(prev => ({ ...prev!, events: newEvts }));
                                                    }}
                                                    placeholder="Extracted Text..."
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    selectedLog.events && selectedLog.events.length > 0 ? (
                                        <ul className="space-y-2">
                                            {selectedLog.events.map((evt, idx) => (
                                                <li key={idx} className="flex flex-col gap-1 p-3 rounded-lg bg-[var(--color-neutral-50)] border border-[var(--color-neutral-100)]">
                                                    {evt.date && (
                                                        <span className="text-xs font-semibold text-[var(--color-primary-600)]">
                                                            {evt.date}
                                                        </span>
                                                    )}
                                                    <div className="flex justify-between items-start gap-4">
                                                        <span className="text-sm text-[var(--color-neutral-600)] font-medium leading-relaxed max-w-[40%] flex-shrink-0">
                                                            {evt.time}
                                                        </span>
                                                        <span className="text-sm font-bold text-[var(--color-neutral-900)] text-right break-words leading-relaxed flex-1">
                                                            {evt.title}
                                                        </span>
                                                    </div>
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
                            {hasChanges ? (
                                <>
                                    <Button fullWidth onClick={() => setEditLogData(JSON.parse(JSON.stringify(selectedLog)))} variant="outline">
                                        Undo Changes
                                    </Button>
                                    <Button fullWidth onClick={handleSaveLogEdit} variant="primary">
                                        Save Changes
                                    </Button>
                                </>
                            ) : (
                                <Button fullWidth onClick={() => { setSelectedLog(null); setEditLogData(null); }} variant="primary">
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
