import React from 'react';
import { TrendBias, Status } from '../types';

interface LifecycleMonitorProps {
    status: Status;
    trendBias: TrendBias;
    entryCount: number;
}

export const LifecycleMonitor: React.FC<LifecycleMonitorProps> = ({ status, trendBias, entryCount }) => {
    let currentStep = 0;
    
    // Step 1: Warm Up (Scanning)
    if (status === 'SCANNING') currentStep = 1;
    
    // Step 2: Locked (Signal Found, Waiting for Entry)
    if (status === 'LOCKED' && entryCount === 0) currentStep = 2;
    
    // Step 3: Monitor (1 Active Position)
    // We treat 'LOCKED' with 1 entry as Monitoring the trade.
    if (status === 'LOCKED' && entryCount === 1) currentStep = 3;
    
    // Step 4: Scaling (Multiple Positions)
    // If we are actively scaling OR have >1 entry in Locked state
    if (status === 'SCALING' || (status === 'LOCKED' && entryCount > 1)) currentStep = 4;
    
    // Step 5: Invalid
    if (status === 'INVALIDATED') currentStep = 5;

    const steps = [
        { label: 'WARM UP', step: 1 },
        { label: 'LOCKED', step: 2 },
        { label: 'MONITOR', step: 3 },
        { label: 'SCALING', step: 4 },
        { label: 'INVALID', step: 5 }
    ];

    return (
        <div className="flex items-center justify-between w-full relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -z-10 transform -translate-y-1/2"></div>
            {steps.map((s) => {
                let colorClass = "bg-slate-800 text-slate-500 border-slate-700";
                if (currentStep === s.step) {
                    if (s.label === 'INVALID') colorClass = "bg-rose-500 text-white border-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.5)]";
                    else if (s.label === 'LOCKED' || s.label === 'MONITOR' || s.label === 'SCALING') {
                        colorClass = ['LONG', 'BULL', 'BUY'].includes(trendBias) 
                            ? "bg-emerald-500 text-slate-900 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]" 
                            : "bg-rose-500 text-white border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.5)]";
                    } else {
                        colorClass = "bg-blue-500 text-white border-blue-400";
                    }
                } else if (currentStep > s.step && s.label !== 'INVALID') {
                     colorClass = "bg-slate-700 text-slate-300 border-slate-600";
                }
                return (
                    <div key={s.step} className="flex flex-col items-center gap-2 bg-slate-950 px-2 z-10">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-300 ${colorClass}`}>
                            {s.step}
                        </div>
                        <span className={`text-[9px] font-bold tracking-wider ${currentStep === s.step ? 'text-white' : 'text-slate-600'}`}>
                            {s.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};