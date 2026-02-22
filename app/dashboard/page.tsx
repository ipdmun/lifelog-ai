"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Activity, Briefcase, Smile, BookOpen, TrendingUp, CloudOff, CloudSync } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { Button } from "@/components/ui/Button";
import { LogTimeline, LogItem } from "@/components/dashboard/LogTimeline";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, getDoc, collection, query, where, orderBy, limit } from "firebase/firestore";

// Initial Mock data 
const initialLifeBalanceData = [
    { nameKey: 'lblWork', value: 40, color: '#0ea5e9' },
    { nameKey: 'lblHealth', value: 20, color: '#22c55e' },
    { nameKey: 'lblFamily', value: 15, color: '#f59e0b' },
    { nameKey: 'lblSocial', value: 15, color: '#78716c' },
    { nameKey: 'lblLearning', value: 10, color: '#0284c7' },
];

const initialMoodTrendData = [
    { day: 'Mon', score: 60 },
    { day: 'Tue', score: 80 },
    { day: 'Wed', score: 45 },
    { day: 'Thu', score: 90 },
    { day: 'Fri', score: 75 },
    { day: 'Sat', score: 85 },
    { day: 'Sun', score: 95 },
];

const initialRecentLogs: any[] = [
    { id: '1', type: 'analog', titleKey: 'log1', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), eventCount: 1 },
    { id: '4', type: 'analog', titleKey: 'log4', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), eventCount: 1 },
];

const computeLifeBalance = (events: any[], t: any) => {
    let work = 0, health = 0, family = 0, social = 0, learning = 0;
    if (events.length === 0) return initialLifeBalanceData.map(item => ({ ...item, name: t(item.nameKey as any) }));

    events.forEach(e => {
        const title = (e.summary || '').toLowerCase();
        if (title.includes('work') || title.includes('meet') || title.includes('미팅') || title.includes('client') || title.includes('업무') || title.includes('meeting')) work++;
        else if (title.includes('gym') || title.includes('health') || title.includes('lunch') || title.includes('점심') || title.includes('식사') || title.includes('운동')) health++;
        else if (title.includes('family') || title.includes('mom') || title.includes('엄마') || title.includes('가족') || title.includes('친구') || title.includes('friend')) family++;
        else if (title.includes('study') || title.includes('read') || title.includes('공부') || title.includes('학습') || title.includes('강의') || title.includes('class')) learning++;
        else social++;
    });

    const total = work + health + family + social + learning;
    if (total === 0) return initialLifeBalanceData.map(item => ({ ...item, name: t(item.nameKey as any) }));

    return [
        { nameKey: 'lblWork', name: t('lblWork'), value: Math.round((work / total) * 100), color: '#0ea5e9' },
        { nameKey: 'lblHealth', name: t('lblHealth'), value: Math.round((health / total) * 100), color: '#22c55e' },
        { nameKey: 'lblFamily', name: t('lblFamily'), value: Math.round((family / total) * 100), color: '#f59e0b' },
        { nameKey: 'lblSocial', name: t('lblSocial'), value: Math.round((social / total) * 100), color: '#78716c' },
        { nameKey: 'lblLearning', name: t('lblLearning'), value: Math.round((learning / total) * 100), color: '#0284c7' }
    ].filter(item => item.value > 0);
};

const computeMoodTrend = (events: any[]) => {
    if (events.length === 0) return initialMoodTrendData;

    const days = [
        { day: 'Mon', score: 40, count: 0 },
        { day: 'Tue', score: 40, count: 0 },
        { day: 'Wed', score: 40, count: 0 },
        { day: 'Thu', score: 40, count: 0 },
        { day: 'Fri', score: 40, count: 0 },
        { day: 'Sat', score: 40, count: 0 },
        { day: 'Sun', score: 40, count: 0 }
    ];

    events.forEach(e => {
        const d = new Date(e.startDate);
        let dayIdx = d.getDay() - 1;
        if (dayIdx === -1) dayIdx = 6;
        if (dayIdx >= 0 && dayIdx < 7) {
            days[dayIdx].count++;
        }
    });

    return days.map(d => ({
        day: d.day,
        score: Math.min(100, d.score + d.count * 15)
    }));
};

export default function DashboardPage() {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [recentLogs, setRecentLogs] = useState<LogItem[]>([]);
    const [lifeBalanceData, setLifeBalanceData] = useState<any[]>([]);
    const [moodTrendData, setMoodTrendData] = useState<any[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);
    const [editLogData, setEditLogData] = useState<LogItem | null>(null);

    const handleSaveLogEdit = async () => {
        if (!selectedLog || !editLogData) return;
        const updatedLogs = recentLogs.map(l => l.id === editLogData.id ? editLogData : l);
        setRecentLogs(updatedLogs);
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const analogLogsToSave = updatedLogs.filter(l => l.type === 'analog').map(l => ({
                ...l,
                timestamp: l.timestamp instanceof Date ? l.timestamp.toISOString() : l.timestamp
            }));
            setDoc(userDocRef, { logs: analogLogsToSave }, { merge: true }).catch(err => console.error("Firestore merge error:", err));
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

    // Sync localStorage to Firestore when user logs in
    useEffect(() => {
        if (!user) return;

        async function syncLocalToFirestore() {
            try {
                const localLogs = localStorage.getItem("dashboardLogs");
                const localEvents = localStorage.getItem("allEvents");

                if (localLogs || localEvents) {
                    setIsSyncing(true);

                    const userDocRef = doc(db, "users", user!.uid);
                    const userSnap = await getDoc(userDocRef);

                    let mergedLogs = localLogs ? JSON.parse(localLogs) : [];
                    let mergedEvents = localEvents ? JSON.parse(localEvents) : [];

                    if (userSnap.exists()) {
                        const cloudData = userSnap.data();
                        // Simply append or smarter merge? Let's just append for MVP
                        mergedLogs = [...(cloudData.logs || []), ...mergedLogs];
                        mergedEvents = [...(cloudData.events || []), ...mergedEvents];

                        // Deduplicate logs by ID
                        const logMap = new Map();
                        mergedLogs.forEach((l: any) => logMap.set(l.id, l));
                        mergedLogs = Array.from(logMap.values());
                    }

                    await setDoc(userDocRef, {
                        logs: mergedLogs,
                        events: mergedEvents,
                        lastSync: new Date().toISOString()
                    }, { merge: true });

                    localStorage.removeItem("dashboardLogs");
                    localStorage.removeItem("allEvents");
                    setIsSyncing(false);
                }
            } catch (error) {
                console.error("Sync error:", error);
                setIsSyncing(false);
            }
        }

        syncLocalToFirestore();
    }, [user]);

    // Main Data Loading Effect
    useEffect(() => {
        if (user) {
            // FIREBASE MODE
            const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const logs = data.logs || [];
                    const events = data.events || [];

                    const restoredLogs = logs.map((l: any) => {
                        let d = l.timestamp?.seconds ? new Date(l.timestamp.seconds * 1000) : new Date(l.timestamp);
                        if (isNaN(d.getTime())) d = new Date();
                        return { ...l, timestamp: d };
                    });
                    const restoredEvents = events.map((e: any) => {
                        let d = e.startDate?.seconds ? new Date(e.startDate.seconds * 1000) : new Date(e.startDate);
                        if (isNaN(d.getTime())) d = new Date();
                        return { ...e, startDate: d };
                    });

                    updateState(restoredLogs, restoredEvents);
                } else {
                    updateState([], []);
                }
            });
            return () => unsub();
        } else {
            // LOCALSTORAGE GUEST MODE
            loadLocalData();
        }
    }, [user, t]);

    const loadLocalData = () => {
        let loadedLogs = initialRecentLogs.map(log => ({ ...log, title: t(log.titleKey as any) }));
        let loadedEvents: any[] = [];

        try {
            const savedLogs = localStorage.getItem("dashboardLogs");
            if (savedLogs) {
                const parsed = JSON.parse(savedLogs);
                parsed.forEach((l: any) => l.timestamp = new Date(l.timestamp));
                loadedLogs = [...parsed, ...loadedLogs];
            }

            const calData = localStorage.getItem("calEvents");
            if (calData) {
                const parsedEvents = JSON.parse(calData);
                if (Array.isArray(parsedEvents) && parsedEvents.length > 0) {
                    processNewEvents(parsedEvents, loadedLogs);
                    return; // Early return because processNewEvents will trigger state update
                }
            }

            const allEventsRaw = localStorage.getItem("allEvents");
            if (allEventsRaw) {
                loadedEvents = JSON.parse(allEventsRaw).map((e: any) => ({ ...e, startDate: new Date(e.startDate) }));
            }
            updateState(loadedLogs, loadedEvents);

        } catch (e) {
            console.error("Local data load error:", e);
            updateState(loadedLogs, []);
        }
    };

    const processNewEvents = (parsedEvents: any[], currentLogs: any[]) => {
        const validEvents = parsedEvents.map((e: any) => ({
            ...e,
            startDate: new Date(e.startDate),
            endDate: new Date(e.endDate)
        }));

        const now = new Date();
        const pastEvents = [...validEvents].filter(e => e.startDate <= now);
        pastEvents.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

        const newLogs = pastEvents.slice(0, 15).map((e: any) => ({
            id: 'cal-ev-' + Date.now() + '-' + Math.random(),
            type: 'digital' as const,
            title: e.summary || "Calendar Event",
            timestamp: e.startDate,
            eventCount: 1
        }));

        const combinedLogs = [...newLogs, ...currentLogs];
        const uniqueLogsMap = new Map();
        combinedLogs.forEach(l => uniqueLogsMap.set(l.id, l));
        const finalLogs = Array.from(uniqueLogsMap.values());

        const existingRaw = localStorage.getItem("allEvents");
        const allExisting = existingRaw ? JSON.parse(existingRaw) : [];
        const combinedEvents = [...allExisting, ...validEvents];

        if (user) {
            // Write to Firestore immediately
            const userDocRef = doc(db, "users", user.uid);
            setDoc(userDocRef, {
                logs: finalLogs,
                events: combinedEvents,
                lastUpdate: new Date().toISOString()
            }, { merge: true }).catch(err => console.error("Firestore write error:", err));
        } else {
            // Save to localStorage
            localStorage.setItem("dashboardLogs", JSON.stringify(finalLogs.filter(l => !initialRecentLogs.find(i => i.id === l.id))));
            localStorage.setItem("allEvents", JSON.stringify(combinedEvents));
        }

        localStorage.removeItem("calEvents");
        updateState(finalLogs, combinedEvents.map((e: any) => ({ ...e, startDate: new Date(e.startDate) })));
    };

    const updateState = (logs: any[], events: any[]) => {
        const finalLogs = logs.map(log => ({
            ...log,
            title: log.titleKey ? t(log.titleKey as any) : log.title
        })).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 20);

        setRecentLogs(finalLogs);
        setLifeBalanceData(computeLifeBalance(events, t));
        setMoodTrendData(computeMoodTrend(events));
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8 bg-[var(--color-neutral-50)]">
                <div className="max-w-6xl mx-auto space-y-8">
                    {/* Page Title */}
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-neutral-900)] mb-2">
                                {t('dashTitle')}
                            </h1>
                            <p className="text-lg text-[var(--color-neutral-600)]">
                                {t('dashDesc')}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {user ? (
                                <Badge variant="success" size="md" className="gap-1.5 py-1.5 px-3">
                                    <CloudSync size={14} /> Cloud Active
                                </Badge>
                            ) : (
                                <Badge variant="outline" size="md" className="gap-1.5 py-1.5 px-3 text-[var(--color-neutral-500)]">
                                    <CloudOff size={14} /> Guest Mode
                                </Badge>
                            )}
                        </div>
                    </div>

                    {isSyncing && (
                        <div className="bg-[var(--color-primary-50)] text-[var(--color-primary-700)] p-4 rounded-xl border border-[var(--color-primary-100)] flex items-center gap-3 animate-pulse">
                            <CloudSync size={20} className="animate-spin" />
                            <span className="font-medium">Syncing your offline diaries to the cloud...</span>
                        </div>
                    )}

                    {/* Weekly Insight Banner */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card variant="filled" padding="lg" className="lg:col-span-2 bg-gradient-to-br from-[var(--color-primary-600)] to-[var(--color-primary-700)] border-none relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10 text-white">
                                <Activity size={128} />
                            </div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    <TrendingUp size={24} className="text-[var(--color-primary-100)]" />
                                    <h2 className="text-2xl font-bold text-white">{t('dashInsight')}</h2>
                                </div>
                                <p className="text-[var(--color-primary-50)] max-w-2xl leading-relaxed text-lg">
                                    {t('dashInsightMsg1')}
                                    <span className="text-white font-bold">{t('dashInsightMsg2')}</span>
                                    {t('dashInsightMsg3')}
                                </p>
                            </div>
                        </Card>

                        <Card variant="elevated" padding="lg" className="bg-white border-2 border-[var(--color-primary-100)] flex flex-col justify-between">
                            <div>
                                <Badge variant="primary" className="mb-4">PRO PLAN</Badge>
                                <h3 className="text-xl font-bold text-[var(--color-neutral-900)] mb-2">Upgrade to LifeLog Pro</h3>
                                <ul className="text-sm text-[var(--color-neutral-600)] space-y-2 mb-6">
                                    <li className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-500)]" />
                                        Unlimited Cloud Storage
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-500)]" />
                                        Detailed AI Mood Reports
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-500)]" />
                                        Export to High-Res PDF
                                    </li>
                                </ul>
                            </div>
                            <Button fullWidth variant="primary" size="lg" className="shadow-lg shadow-primary-200">
                                Upgrade Now for $9.99
                            </Button>
                        </Card>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                        <StatsCard label={t('statFocus')} value="84" icon={Activity} change={{ value: 12, trend: 'up' }} />
                        <StatsCard label={t('statWork')} value="32h" icon={Briefcase} change={{ value: 5, trend: 'up' }} />
                        <StatsCard label={t('statMood')} value={t('statMoodVal')} icon={Smile} change={{ value: 0, trend: 'neutral' }} />
                        <StatsCard label={t('statJournal')} value="12" icon={BookOpen} change={{ value: 3, trend: 'down' }} />
                    </div>

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Life Balance Pie Chart */}
                        <ChartCard title={t('chartBalance')} description={t('chartBalanceDesc')}>
                            <div className="h-64 sm:h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={lifeBalanceData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                                            {lifeBalanceData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value) => `${value}%`}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap gap-3 justify-center mt-6">
                                {lifeBalanceData.map((item, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                                        <span className="text-sm text-[var(--color-neutral-700)]">
                                            {item.name} ({item.value}%)
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </ChartCard>

                        {/* Mood Trend Bar Chart */}
                        <ChartCard title={t('chartMood')} description={t('chartMoodDesc')}>
                            <div className="h-64 sm:h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={moodTrendData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-neutral-500)' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-neutral-500)' }} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
                                        <Tooltip
                                            cursor={{ fill: 'var(--color-neutral-100)' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value) => [`${value} Score`, 'Mood Score']}
                                        />
                                        <Bar dataKey="score" fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>
                    </div>

                    {/* Timeline Section */}
                    <div className="pt-4">
                        <h2 className="text-xl font-bold text-[var(--color-neutral-900)] mb-6 flex items-center gap-2">
                            <Activity size={20} className="text-[var(--color-primary-600)]" />
                            {t('recentActivity')}
                        </h2>
                        <div className="bg-white rounded-2xl p-6 border border-[var(--color-neutral-200)] shadow-sm">
                            <LogTimeline logs={recentLogs} onLogClick={(log) => { setSelectedLog(log); setEditLogData(JSON.parse(JSON.stringify(log))); }} />
                        </div>
                    </div>
                </div>
            </main>
            <Footer />

            {/* Log Details Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <Card variant="elevated" className="w-full max-w-lg bg-white overflow-hidden shadow-2xl">
                        <CardHeader className="border-b border-[var(--color-neutral-100)] flex justify-between items-center bg-[var(--color-neutral-50)]/50">
                            <div className="flex-1 mr-4">
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
                                    <h3 className="text-lg font-bold text-[var(--color-neutral-900)] max-w-full truncate">
                                        {selectedLog.summary || selectedLog.title}
                                    </h3>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
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
                        <div className="p-4 border-t border-[var(--color-neutral-100)] bg-[var(--color-neutral-50)]/50 flex gap-3">
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
        <span className={cn('inline-flex items-center justify-center rounded-full font-semibold text-xs transition-colors', variants[variant], className)}>
            {children}
        </span>
    );
}
