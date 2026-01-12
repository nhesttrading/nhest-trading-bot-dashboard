import React, { useState } from 'react';
import { LiveChart } from './LiveChart';
import { SymbolState } from '../types';

interface MosaicGridProps {
    prices: Record<string, number>;
    strategyState: { symbols: Record<string, SymbolState> };
    botActive: boolean;
}

export const MosaicGrid: React.FC<MosaicGridProps> = ({ prices, strategyState, botActive }) => {
    // Default institutional watchlist
    const [slots, setSlots] = useState(['BTCUSD', 'ETHUSD', 'NAS100', 'XAUUSD']);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[600px] animate-in fade-in">
            {slots.map((sym, i) => {
                // Defensive checks
                const state = strategyState?.symbols ? strategyState.symbols[sym] : undefined;
                const price = prices ? prices[sym] : undefined;
                
                return (
                    <div key={`${sym}-${i}`} className="relative bg-slate-900 rounded-xl border border-slate-800 overflow-hidden group">
                        <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                             <select 
                                value={sym}
                                onChange={(e) => {
                                    const newSlots = [...slots];
                                    newSlots[i] = e.target.value;
                                    setSlots(newSlots);
                                }}
                                className="bg-slate-950 text-[10px] text-white border border-slate-700 rounded px-2 py-1 outline-none cursor-pointer hover:border-slate-500"
                             >
                                 <option value="BTCUSD">BTCUSD</option>
                                 <option value="ETHUSD">ETHUSD</option>
                                 <option value="NAS100">NAS100</option>
                                 <option value="SP500">SP500</option>
                                 <option value="XAUUSD">GOLD</option>
                                 <option value="USOIL">OIL</option>
                             </select>
                        </div>
                        {/* Render LiveChart only if we have a symbol slot */}
                        <LiveChart 
                            symbol={sym} 
                            isActive={botActive} 
                            trendBias={state?.trend_bias || 'NONE'} 
                            currentPrice={price} 
                            symbolState={state} 
                        />
                    </div>
                );
            })}
        </div>
    );
};
