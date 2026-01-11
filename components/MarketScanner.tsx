import React from 'react';
import { UNIVERSE } from '../constants';
import { MarketPrices, StrategyState } from '../types';
import { Card } from './Card';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

interface MarketScannerProps {
    prices: MarketPrices;
    strategyState: StrategyState;
    onSelect: (symbol: string) => void;
    selectedSymbol: string;
}

export const MarketScanner: React.FC<MarketScannerProps> = ({ prices, strategyState, onSelect, selectedSymbol }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3 mb-6">
            {UNIVERSE.map(symbol => {
                const price = prices[symbol];
                const state = strategyState.symbols[symbol];
                const isSelected = selectedSymbol === symbol;
                
                // Track last price for pulse effect
                const lastPriceRef = React.useRef(price);
                const [pulse, setPulse] = React.useState(false);

                React.useEffect(() => {
                    if (price !== lastPriceRef.current) {
                        setPulse(true);
                        const timer = setTimeout(() => setPulse(false), 500);
                        lastPriceRef.current = price;
                        return () => clearTimeout(timer);
                    }
                }, [price]);
                
                // Calculate PnL if there's an active position
                let symbolPnL = 0;
                if (state && state.entries && state.entries.length > 0) {
                    state.entries.forEach(entry => {
                        if (entry.pnl !== undefined) symbolPnL += entry.pnl;
                        else if (entry.profit !== undefined) symbolPnL += entry.profit;
                    });
                }

                return (
                    <button 
                        key={symbol}
                        onClick={() => onSelect(symbol)}
                        className={`text-left transition-all duration-300 group ${isSelected ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-[#020617]' : ''}`}
                    >
                        <Card className={`p-3 transition-colors ${
                            isSelected ? '!border-emerald-500/50 !bg-slate-800' :
                            state?.trend_bias === 'LONG' ? '!bg-emerald-900/10 !border-emerald-900/40 hover:!bg-emerald-900/20' :
                            state?.trend_bias === 'SHORT' ? '!bg-rose-900/10 !border-rose-900/40 hover:!bg-rose-900/20' :
                            '!bg-slate-900/40 hover:!bg-slate-800/60'
                        } ${pulse ? (symbolPnL >= 0 ? 'ring-1 ring-emerald-500/50' : 'ring-1 ring-rose-500/50') : ''}`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-black text-slate-500 tracking-tighter uppercase">{symbol}</span>
                                {state?.trend_bias === 'LONG' ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : 
                                 state?.trend_bias === 'SHORT' ? <TrendingDown className="w-3 h-3 text-rose-500" /> : 
                                 <Minus className="w-3 h-3 text-slate-700" />}
                            </div>
                            
                            <div className="text-sm font-mono font-bold text-white mb-1">
                                {price ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '---'}
                            </div>

                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-800/50">
                                <div className={`text-[9px] font-bold ${symbolPnL > 0 ? 'text-emerald-400' : symbolPnL < 0 ? 'text-rose-400' : 'text-slate-600'}`}>
                                    {symbolPnL !== 0 ? `${symbolPnL > 0 ? '+' : ''}${symbolPnL.toFixed(1)}` : '0.0'}
                                </div>
                                <div className="flex gap-0.5">
                                    {Object.values(state?.hma_trends || {}).slice(-3).map((trend, i) => (
                                        <div 
                                            key={i} 
                                            className={`w-1 h-3 rounded-full ${
                                                trend === 'UP' ? 'bg-emerald-500' : 
                                                trend === 'DOWN' ? 'bg-rose-500' : 
                                                'bg-slate-800'
                                            }`} 
                                        />
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </button>
                );
            })}
        </div>
    );
};
