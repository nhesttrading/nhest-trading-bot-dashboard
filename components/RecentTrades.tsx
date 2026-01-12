import React from 'react';
import { History as HistoryIcon, ArrowRight, Monitor, FileText } from 'lucide-react';
import { Card } from './Card';
import { Badge } from './Badge';
import { ActivePosition, LogEntry } from '../types';

interface RecentTradesProps {
  activePositions: ActivePosition[];
  closedTrades?: ActivePosition[];
  logs: LogEntry[];
  onClearHistory?: () => void;
}

export const RecentTrades: React.FC<RecentTradesProps> = ({ activePositions, closedTrades = [], logs, onClearHistory }) => {
  // User Request: Only show CLOSED trades in history (including Cancelled)
  const allTrades = [
      ...closedTrades.map(p => ({
          ...p,
          statusDisplay: p.finalStatus === 'CANCELLED' ? 'CANCELLED' : 'CLOSED'
      }))
  ];

  // Filter logs for execution events to show a raw audit trail if needed
  const executionLogs = logs.filter(l => 
      ['MT5_EXEC', 'SIM_EXEC', 'MANUAL', 'API', 'HISTORY'].includes(l.trigger)
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <HistoryIcon className="w-6 h-6 text-emerald-400" />
            Trade History
            </h2>
            <p className="text-xs text-slate-500 mt-1">Closed Positions & Cancelled Orders</p>
        </div>
        <div className="flex gap-2">
            {onClearHistory && closedTrades.length > 0 && (
                <button 
                    onClick={onClearHistory}
                    className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-xs hover:bg-rose-500 hover:text-white transition-all"
                >
                    Clear History
                </button>
            )}
            <Badge type="info">LIVE SESSION</Badge>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
           <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-white text-sm">Historical Entries</h3>
           </div>
           <span className="text-xs text-slate-500">Displaying persistent trade history</span>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-400">
                <thead className="text-xs text-slate-500 uppercase bg-slate-900 border-b border-slate-800">
                    <tr>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Symbol</th>
                        <th className="px-6 py-4">Direction</th>
                        <th className="px-6 py-4">Vol</th>
                        <th className="px-6 py-4">Entry Price</th>
                        <th className="px-6 py-4">Reason / Logic</th>
                        <th className="px-6 py-4 text-right">Final PnL</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {allTrades.length === 0 ? (
                        <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500 italic">No history available.</td></tr>
                    ) : (
                        allTrades.map((pos, i) => (
                            <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                                <td className="px-6 py-4">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                        pos.statusDisplay === 'CANCELLED' 
                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    }`}>
                                        {pos.statusDisplay}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-bold text-white">{pos.symbol}</td>
                                <td className="px-6 py-4">
                                    <Badge type={['LONG', 'BULL', 'BUY'].includes(pos.type) ? 'success' : 'danger'}>{pos.type}</Badge>
                                </td>
                                <td className="px-6 py-4 font-mono text-slate-300">{pos.volume || '-'}</td>
                                <td className="px-6 py-4 font-mono text-slate-300">${pos.entryPrice.toFixed(2)}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-slate-500">
                                            <ArrowRight className="w-3 h-3" />
                                        </span>
                                        <span className="font-medium text-slate-200 bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50 text-xs">
                                            {pos.reason}
                                        </span>
                                    </div>
                                </td>
                                <td className={`px-6 py-4 font-bold font-mono text-right ${
                                    pos.statusDisplay === 'CANCELLED' ? 'text-slate-500' :
                                    pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}>
                                    {pos.statusDisplay === 'CANCELLED' ? '-' : (pos.pnl >= 0 ? '+' : '') + pos.pnl.toFixed(2)}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <h3 className="font-bold text-white text-sm">Raw Execution Log</h3>
            </div>
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm text-left text-slate-400">
                    <tbody className="divide-y divide-slate-800">
                        {executionLogs.length === 0 ? (
                            <tr><td className="px-6 py-8 text-center text-slate-600 text-xs">No execution events recorded.</td></tr>
                        ) : (
                            executionLogs.map((log, i) => (
                                <tr key={i} className="hover:bg-slate-800/10">
                                    <td className="px-6 py-3 font-mono text-xs text-slate-500 w-32">{log.time}</td>
                                    <td className="px-6 py-3">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{log.trigger}</span>
                                    </td>
                                    <td className="px-6 py-3 text-slate-300 text-xs font-mono">{log.msg}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
      </div>
    </div>
  );
};