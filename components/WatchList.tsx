import React from 'react';
import { UNIVERSE } from '../constants';
import { MarketPrices, StrategyState } from '../types';
import { TrendingUp, TrendingDown, Minus, MoreHorizontal, ListFilter } from 'lucide-react';

interface WatchListProps {
  prices: MarketPrices;
  strategyState: StrategyState;
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
}

export const WatchList: React.FC<WatchListProps> = ({ prices, strategyState, selectedSymbol, onSelect }) => {
  // Dynamically aggregate all available symbols from Config, State, and Market Data
  const allSymbols = Array.from(new Set([
      ...UNIVERSE, 
      ...Object.keys(strategyState.symbols), 
      ...Object.keys(prices)
  ])).sort();

  return (
    <div className="w-full bg-[#020617] border-l border-slate-800 flex flex-col h-full flex-none">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/20">
        <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Watchlist</span>
            <span className="bg-slate-800 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-mono">{allSymbols.length}</span>
        </div>
        <div className="flex gap-1">
            <button className="p-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded"><ListFilter className="w-3.5 h-3.5" /></button>
            <button className="p-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded"><MoreHorizontal className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      
      {/* Column Headers */}
      <div className="px-4 py-2 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/10">
          <span className="text-[9px] font-bold text-slate-600 uppercase">Symbol</span>
          <span className="text-[9px] font-bold text-slate-600 uppercase">Last / Trend</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {allSymbols.map(symbol => {
           const price = prices[symbol];
           const state = strategyState.symbols[symbol];
           const trend = state?.trend_bias || 'NONE';
           const isSelected = selectedSymbol === symbol;
           
           const isBullish = ['LONG', 'BULL', 'BUY', 'UP'].includes(trend);
           const isBearish = ['SHORT', 'BEAR', 'SELL', 'DOWN'].includes(trend);
           const isClosed = state?.market_open === false;
           
           return (
             <div 
               key={symbol}
               onClick={() => onSelect(symbol)}
               className={`px-4 py-2.5 border-b border-slate-800/30 cursor-pointer hover:bg-slate-800/40 transition-all flex justify-between items-center group ${isSelected ? 'bg-slate-800/60 border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent'} ${isClosed ? 'grayscale opacity-60 bg-slate-900/40' : ''}`}
             >
               <div className="flex flex-col">
                 <div className="flex items-center gap-2">
                     <span className={`text-xs font-bold ${isClosed ? 'text-slate-500' : (isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white')}`}>{symbol}</span>
                     {state?.status === 'LOCKED' && !isClosed && (
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></div>
                     )}
                     {isClosed && (
                         <span className="text-[7px] font-black bg-slate-800 text-slate-600 px-1 rounded border border-slate-700 uppercase">Offline</span>
                     )}
                 </div>
                 <div className="text-[9px] text-slate-600 font-mono mt-0.5 uppercase tracking-tight">{isClosed ? 'MARKET CLOSED' : (state?.status || 'SCANNING')}</div>
               </div>
               
               <div className="text-right">
                 <div className={`text-xs font-mono font-bold transition-colors ${isClosed ? 'text-slate-600' : (price ? (isBullish ? 'text-emerald-400' : isBearish ? 'text-rose-400' : 'text-slate-200') : 'text-slate-500')}`}>
                    {price ? price.toLocaleString(undefined, {minimumFractionDigits: 2}) : '---'}
                 </div>
                 <div className="flex justify-end items-center gap-1.5 mt-0.5">
                    <span className={`text-[9px] font-bold uppercase ${isClosed ? 'text-slate-700' : (isBullish ? 'text-emerald-500' : isBearish ? 'text-rose-500' : 'text-slate-600')}`}>
                        {isClosed ? 'IDLE' : (trend === 'NONE' ? '-' : trend)}
                    </span>
                    {!isClosed && (isBullish ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : 
                     isBearish ? <TrendingDown className="w-3 h-3 text-rose-500" /> : 
                     <Minus className="w-3 h-3 text-slate-700" />)}
                    {isClosed && <Minus className="w-3 h-3 text-slate-800" />}
                 </div>
               </div>
             </div>
           );
        })}
      </div>
      
      {/* Footer / Summary */}
       <div className="p-3 border-t border-slate-800 text-[9px] text-center text-slate-600 bg-slate-900/20 uppercase font-bold tracking-widest">
           Market Data Stream
       </div>
    </div>
  );
};
