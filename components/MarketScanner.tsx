import React from 'react';
import { UNIVERSE } from '../constants';
import { MarketPrices, StrategyState } from '../types';
import { Card } from './Card';
import { TrendingUp, TrendingDown, Minus, Activity, ChevronUp, ChevronDown } from 'lucide-react';

interface MarketScannerProps {
    prices: MarketPrices;
    strategyState: StrategyState;
    onSelect: (symbol: string) => void;
    selectedSymbol: string;
}

const MarketItem: React.FC<{
    symbol: string;
    price: number | undefined;
    state: any;
    isSelected: boolean;
    onSelect: (symbol: string) => void;
}> = ({ symbol, price, state, isSelected, onSelect }) => {
    // Track last price for pulse and color fluctuation
    const lastPriceRef = React.useRef(price);
    const [pulse, setPulse] = React.useState(false);
    const [direction, setDirection] = React.useState<'up' | 'down' | null>(null);

    React.useEffect(() => {
        if (price !== undefined && lastPriceRef.current !== undefined && price !== lastPriceRef.current) {
            setPulse(true);
            setDirection(price > lastPriceRef.current ? 'up' : 'down');
            
            const timer = setTimeout(() => {
                setPulse(false);
                setDirection(null);
            }, 800);
            
            lastPriceRef.current = price;
            return () => clearTimeout(timer);
        }
        if (price !== undefined) lastPriceRef.current = price;
    }, [price]);
    
    // Calculate PnL if there's an active position
    let symbolPnL = 0;
    if (state && state.entries && state.entries.length > 0) {
        state.entries.forEach((entry: any) => {
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
                ['LONG', 'BULL', 'BUY'].includes(state?.trend_bias || '') ? '!bg-emerald-900/10 !border-emerald-900/40 hover:!bg-emerald-900/20' :
                ['SHORT', 'BEAR', 'SELL'].includes(state?.trend_bias || '') ? '!bg-rose-900/10 !border-rose-900/40 hover:!bg-rose-900/20' :
                '!bg-slate-900/40 hover:!bg-slate-800/60'
            } ${pulse ? (direction === 'up' ? 'ring-1 ring-emerald-500/50' : 'ring-1 ring-rose-500/50') : ''}`}>
                <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-slate-500 tracking-tighter uppercase">{symbol}</span>
                    {['LONG', 'BULL', 'BUY'].includes(state?.trend_bias || '') ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : 
                     ['SHORT', 'BEAR', 'SELL'].includes(state?.trend_bias || '') ? <TrendingDown className="w-3 h-3 text-rose-500" /> : 
                     <Minus className="w-3 h-3 text-slate-700" />}
                </div>
                
                <div className={`text-sm font-mono font-bold mb-1 transition-colors duration-300 flex items-center gap-1 ${
                    direction === 'up' ? 'text-emerald-400' : 
                    direction === 'down' ? 'text-rose-400' : 
                    'text-white'
                }`}>
                    {price ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '---'}
                    
                    {direction === 'up' && <ChevronUp className="w-3 h-3 text-emerald-500" strokeWidth={3} />}
                    {direction === 'down' && <ChevronDown className="w-3 h-3 text-rose-500" strokeWidth={3} />}
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
                                    ['UP', 'BULL', 'LONG', 'BUY'].includes(trend as string) ? 'bg-emerald-500' : 
                                    ['DOWN', 'BEAR', 'SHORT', 'SELL'].includes(trend as string) ? 'bg-rose-500' : 
                                    'bg-slate-800'
                                }`} 
                            />
                        ))}
                    </div>
                </div>
            </Card>
        </button>
    );
};

export const MarketScanner: React.FC<MarketScannerProps> = ({ prices, strategyState, onSelect, selectedSymbol }) => {
    // Merge UNIVERSE with any dynamic symbols from strategyState
    const allSymbols = Array.from(new Set([...UNIVERSE, ...Object.keys(strategyState.symbols)]));

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3 mb-6">
            {allSymbols.map(symbol => (
                <MarketItem 
                    key={symbol}
                    symbol={symbol}
                    price={prices[symbol]}
                    state={strategyState.symbols[symbol]}
                    isSelected={selectedSymbol === symbol}
                    onSelect={onSelect}
                />
            ))}
        </div>
    );
};
