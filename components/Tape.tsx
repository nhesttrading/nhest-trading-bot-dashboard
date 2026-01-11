import React, { useEffect, useState, useRef } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface TapeProps {
  symbol: string;
  price: number;
}

interface TapeRow {
  id: number;
  time: string;
  price: number;
  size: number;
  side: 'BUY' | 'SELL';
}

export const Tape: React.FC<TapeProps> = ({ symbol, price }) => {
  const [rows, setRows] = useState<TapeRow[]>([]);
  const lastPriceRef = useRef<number>(price);
  const idCounter = useRef(0);

  useEffect(() => {
    if (!price || price === lastPriceRef.current) return;

    const isUp = price > lastPriceRef.current;
    lastPriceRef.current = price;
    
    // Simulate institutional volume (random weighted distribution)
    let size = Math.random() * 2;
    if (Math.random() > 0.9) size += Math.random() * 10; // Occasional block trade
    
    const newRow: TapeRow = {
      id: idCounter.current++,
      time: new Date().toLocaleTimeString('en-GB', { hour12: false }), // 24h format
      price,
      size: parseFloat(size.toFixed(2)),
      side: isUp ? 'BUY' : 'SELL'
    };

    setRows(prev => [newRow, ...prev].slice(0, 50));
  }, [price, symbol]);

  return (
    <div className="h-full flex flex-col bg-[#020617] border border-slate-800 rounded-lg overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800">
          <span className="font-bold text-slate-400">TAPE</span>
          <span className="text-[10px] text-slate-600">LIVE FEED</span>
      </div>
      <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-900/90 backdrop-blur z-10 text-[10px] text-slate-500 uppercase">
                      <tr>
                          <th className="px-2 py-1 font-normal">Time</th>
                          <th className="px-2 py-1 font-normal">Price</th>
                          <th className="px-2 py-1 font-normal text-right">Size</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                      {rows.map(row => (
                          <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="px-2 py-0.5 text-slate-500">{row.time}</td>
                              <td className={`px-2 py-0.5 font-bold ${row.side === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {row.price.toFixed(2)}
                              </td>
                              <td className="px-2 py-0.5 text-right text-slate-300">
                                  {row.size.toFixed(2)}
                              </td>
                          </tr>
                      ))}
                      {rows.length === 0 && (
                          <tr><td colSpan={3} className="text-center py-10 text-slate-600 italic">Waiting for ticks...</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};