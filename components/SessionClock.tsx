import React, { useEffect, useState } from 'react';
import { Clock, Globe } from 'lucide-react';

export const SessionClock: React.FC = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const utcHour = time.getUTCHours();
    const utcMin = time.getUTCMinutes();
    const currentMinutes = utcHour * 60 + utcMin;

    // Sessions in UTC Minutes (approximate for visualization)
    const sessions = [
        { name: 'SYDNEY', start: 22 * 60, end: 7 * 60, color: 'bg-amber-500' }, // 22:00 - 07:00
        { name: 'TOKYO',  start: 0, end: 9 * 60, color: 'bg-cyan-500' },          // 00:00 - 09:00
        { name: 'LONDON', start: 8 * 60, end: 16 * 60 + 30, color: 'bg-purple-500' }, // 08:00 - 16:30
        { name: 'NEW YORK', start: 13 * 60 + 30, end: 20 * 60, color: 'bg-emerald-500' } // 13:30 - 20:00
    ];

    const isSessionActive = (start: number, end: number) => {
        if (start < end) {
            return currentMinutes >= start && currentMinutes < end;
        } else {
            // Span midnight (e.g., Sydney)
            return currentMinutes >= start || currentMinutes < end;
        }
    };

    return (
        <div className="bg-[#020617] border border-slate-800 rounded-lg p-3 flex flex-col gap-2 shadow-lg mb-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-300">MARKET SESSIONS (UTC)</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-400">
                    <Clock className="w-3 h-3" />
                    {time.toLocaleTimeString('en-GB', { timeZone: 'UTC' })}
                </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
                {sessions.map(s => {
                    const active = isSessionActive(s.start, s.end);
                    return (
                        <div key={s.name} className={`flex flex-col items-center p-2 rounded border transition-all ${active ? `bg-opacity-20 ${s.color.replace('bg-', 'bg-')} border-${s.color.replace('bg-', '')}` : 'bg-slate-900 border-slate-800 opacity-50'}`}>
                            <div className={`w-2 h-2 rounded-full mb-1 ${active ? s.color : 'bg-slate-700'} ${active ? 'animate-pulse' : ''}`}></div>
                            <span className={`text-[10px] font-bold ${active ? 'text-white' : 'text-slate-500'}`}>{s.name}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
