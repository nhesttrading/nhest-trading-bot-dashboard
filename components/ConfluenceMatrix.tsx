import React from 'react';
import { Badge } from './Badge';

interface ConfluenceMatrixProps {
    confluence?: Record<string, 'BULL' | 'BEAR' | 'NEUTRAL'>;
}

export const ConfluenceMatrix: React.FC<ConfluenceMatrixProps> = ({ confluence }) => {
    if (!confluence) return null;

    const layers = [
        { id: 'ZLMA', label: 'ZLMA Trend' },
        { id: 'PA',   label: 'Price Action' },
        { id: 'MHMA', label: 'Multi-HMA' },
        { id: 'SEQ',  label: 'Sequential' },
        { id: 'SMA',  label: 'SMA Filter' },
        { id: 'ULT',  label: 'Ultimate' },
        { id: 'LIQ',  label: 'Liquidity' },
        { id: 'CVD',  label: 'Whale Flow' },
        { id: 'PCTB', label: '%B Adapt' }
    ];

    return (
        <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-black/20 rounded-lg border border-slate-800">
            {layers.map(layer => {
                const status = confluence[layer.id] || 'NEUTRAL';
                return (
                    <div key={layer.id} className="flex flex-col gap-1">
                        <span className="text-[8px] font-bold text-slate-500 uppercase truncate">{layer.label}</span>
                        <div className={`h-1.5 w-full rounded-full transition-all duration-500 ${
                            status === 'BULL' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                            status === 'BEAR' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' :
                            'bg-slate-700'
                        }`} />
                    </div>
                );
            })}
        </div>
    );
};
