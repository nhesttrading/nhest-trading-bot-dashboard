import React from 'react';
import { Monitor, X, TrendingUp, TrendingDown } from 'lucide-react';
import { ActivePosition } from '../types';

interface TradeReasonDrawerProps {
    trade: ActivePosition | null;
    onClose: () => void;
}

export const TradeReasonDrawer: React.FC<TradeReasonDrawerProps> = ({ trade, onClose }) => {
    if (!trade) return null;
    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-700 shadow-2xl z-50 transform transition-transform duration-300 overflow-y-auto">
            <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-blue-400" />
                        Execution Intelligence
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="space-y-6">
                    <div className={`p-4 rounded-xl border ${['LONG', 'BULL', 'BUY'].includes(trade.type) ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-white">{trade.symbol}</h2>
                                <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded mt-1 ${['LONG', 'BULL', 'BUY'].includes(trade.type) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                    {['LONG', 'BULL', 'BUY'].includes(trade.type) ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {trade.type}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-slate-400 uppercase">PnL</div>
                                <div className={`text-xl font-mono font-bold ${(trade.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {(trade.pnl || 0) >= 0 ? '+' : ''}{(trade.pnl || 0).toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Why This Trade?</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg border border-slate-700">
                                <span className="text-slate-400 text-sm">Pullback Trigger</span>
                                <span className="text-white font-mono text-sm">{trade.reason || 'HMA30 Touch'}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg border border-slate-700">
                                <span className="text-slate-400 text-sm">Confirmation</span>
                                <span className="text-purple-400 font-mono text-sm">HMA15 Reversed {['LONG', 'BULL', 'BUY'].includes(trade.type) ? 'UP' : 'DOWN'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-slate-800 pt-4">
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>Entry Price</span>
                            <span className="text-slate-300 font-mono">${(trade.entryPrice || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};