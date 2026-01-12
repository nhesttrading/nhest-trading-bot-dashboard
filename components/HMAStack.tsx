import React from 'react';
import { TrendBias } from '../types';
import { TrendingUp, TrendingDown, Minus, Activity, ChevronUp, ChevronDown } from 'lucide-react';

interface HMAStackProps {
  bias: TrendBias;
  trends?: Record<string, string | number>;
}

export const HMAStack: React.FC<HMAStackProps> = ({ bias, trends }) => {
  // New Institutional Keys
  const engines = [
      { key: 'Scalp', label: 'SCALP', height: 'h-full' },
      { key: 'Swing', label: 'SWING', height: 'h-[90%]' },
      { key: 'Trend', label: 'TREND', height: 'h-[80%]' },
      { key: 'Base',  label: 'BASE',  height: 'h-[70%]' }
  ];

  const getVisualData = (key: string) => {
      let rawSlope = trends ? trends[key] : 'FLAT';
      
      // Fallback for ZLMA or Legacy Keys
      if ((!rawSlope || rawSlope === 'FLAT') && trends) {
          if (key === 'Scalp') rawSlope = trends['ZLMA_Scalp'] || trends['HMA_Scalp'] || trends['15'] || 'FLAT';
          if (key === 'Swing') rawSlope = trends['ZLMA_Swing'] || trends['HMA_Swing'] || trends['30'] || 'FLAT';
          if (key === 'Trend') rawSlope = trends['ZLMA_Trend'] || trends['HMA_Trend'] || trends['60'] || 'FLAT';
          if (key === 'Base')  rawSlope = trends['ZLMA_Base']  || trends['HMA_Base']  || trends['120'] || trends['240'] || 'FLAT';
      }
      
      let slope = 'FLAT';
      if (typeof rawSlope === 'string') {
          const upper = rawSlope.toUpperCase();
          if (upper === 'UP' || upper === 'BULL') slope = 'UP';
          if (upper === 'DOWN' || upper === 'BEAR') slope = 'DOWN';
      } else if (typeof rawSlope === 'number') {
          if (rawSlope > 0) slope = 'UP';
          if (rawSlope < 0) slope = 'DOWN';
      }
      
      if (slope === 'UP') {
           if (key === 'Scalp') return { 
               color: 'bg-emerald-500 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]', 
               text: 'FAST', 
               textColor: 'text-slate-900',
               icon: <ChevronUp className="w-3 h-3 text-slate-900" strokeWidth={3} />
           };
           return { 
               color: 'bg-emerald-600/80 border-emerald-500/50', 
               text: 'BULL', 
               textColor: 'text-emerald-100',
               icon: <TrendingUp className="w-3 h-3 text-emerald-100" />
           };
      }

      if (slope === 'DOWN') {
          if (key === 'Scalp') return { 
              color: 'bg-rose-500 border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.5)]', 
              text: 'FAST', 
              textColor: 'text-white',
              icon: <ChevronDown className="w-3 h-3 text-white" strokeWidth={3} />
          };
          return { 
              color: 'bg-rose-600/80 border-rose-500/50', 
              text: 'BEAR', 
              textColor: 'text-rose-100',
              icon: <TrendingDown className="w-3 h-3 text-rose-100" />
           };
      }

      return { 
          color: 'bg-slate-800 border-slate-700', 
          text: 'FLAT', 
          textColor: 'text-slate-500', 
          icon: <Minus className="w-3 h-3 text-slate-500" /> 
      };
  };

  return (
    <div className="w-full mt-6 pt-4 border-t border-slate-800/50">
        <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2">
                <Activity className="w-3 h-3" />
                Institutional Trend Matrix
            </span>
             <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded border ${['LONG', 'BULL', 'BUY'].includes(bias) ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ['SHORT', 'BEAR', 'SELL'].includes(bias) ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {['LONG', 'BULL', 'BUY'].includes(bias) && <TrendingUp className="w-3 h-3" />}
                {['SHORT', 'BEAR', 'SELL'].includes(bias) && <TrendingDown className="w-3 h-3" />}
                {['NONE', 'FLAT'].includes(bias) && <Minus className="w-3 h-3" />}
                {bias} CONSENSUS
             </div>
        </div>
        <div className="flex items-end justify-between gap-2 h-24 bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
        {engines.map((eng) => {
            const { color, text, textColor, icon } = getVisualData(eng.key);
            
            return (
            <div key={eng.key} className="flex flex-col items-center gap-2 flex-1 h-full justify-end group">
                <div className={`w-full ${eng.height} rounded-md ${color} border flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden backdrop-blur-sm shadow-sm`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                    <div className="z-10 flex flex-col items-center gap-1">
                        {icon}
                        <span className={`text-[8px] font-bold tracking-wider ${textColor}`}>{text}</span>
                    </div>
                </div>
                <span className="text-[9px] text-slate-500 font-mono font-bold uppercase">{eng.label}</span>
            </div>
            );
        })}
        </div>
    </div>
  );
};
