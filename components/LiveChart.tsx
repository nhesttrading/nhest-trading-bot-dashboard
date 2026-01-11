import React, { useEffect, useRef, useState } from 'react';
import { TrendBias, SymbolState } from '../types';

interface LiveChartProps {
    isActive: boolean;
    trendBias: TrendBias;
    symbol: string;
    currentPrice?: number;
    symbolState?: SymbolState;
}

export const LiveChart: React.FC<LiveChartProps> = ({ isActive, trendBias, symbol, currentPrice, symbolState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // History tracks: { price, hmas, sr, time }
  const historyRef = useRef<{price: number, hmas: Record<string, number>, time: number}[]>([]);

  // Update history on tick
  useEffect(() => {
    if (currentPrice !== undefined && currentPrice !== null) {
        const now = Date.now();
        const hmas = symbolState?.hma_values || {};
        const entry = { price: currentPrice, hmas, time: now };
        
        historyRef.current.push(entry);
        if (historyRef.current.length > 300) historyRef.current.shift(); // Keep 300 points
    }
  }, [currentPrice, symbol, symbolState]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    
    const resize = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = offsetWidth * dpr;
        canvas.height = offsetHeight * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${offsetWidth}px`;
        canvas.style.height = `${offsetHeight}px`;
      }
    };
    window.addEventListener('resize', resize);
    resize();

    const render = () => {
      // Clear
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, width, height);
      
      const data = historyRef.current;
      
      // GRID
      ctx.strokeStyle = '#1e293b'; // Slate 800
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      // Verticals
      const timeStep = width / 10;
      for(let i=0; i<width; i+=timeStep) { ctx.moveTo(i,0); ctx.lineTo(i, height); }
      // Horizontals
      const priceStep = height / 8;
      for(let i=0; i<height; i+=priceStep) { ctx.moveTo(0,i); ctx.lineTo(width, i); }
      ctx.stroke();

      if (data.length < 2) {
          ctx.fillStyle = '#64748b';
          ctx.font = '12px "JetBrains Mono", monospace';
          ctx.fillText("WAITING FOR STREAM...", width/2 - 60, height/2);
          requestAnimationFrame(render); 
          return;
      }

      // SCALE CALCULATION
      let minVal = Infinity;
      let maxVal = -Infinity;
      
      data.forEach(d => {
          if (d.price < minVal) minVal = d.price;
          if (d.price > maxVal) maxVal = d.price;
          Object.values(d.hmas).forEach(v => {
              if (v > 0) { // Filter out 0 or NaN
                  if (v < minVal) minVal = v;
                  if (v > maxVal) maxVal = v;
              }
          });
      });

      const range = maxVal - minVal || 1; 
      const padding = range * 0.15;
      const effectiveMin = minVal - padding;
      const effectiveRange = range + (padding * 2);

      const getX = (i: number) => (i / (data.length - 1)) * (width - 60); 
      const getY = (val: number) => height - ((val - effectiveMin) / effectiveRange) * height;

      // DRAW FUNCTIONS
      const drawLine = (values: number[], color: string, widthPx: number = 1, dash: number[] = []) => {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = widthPx;
          ctx.setLineDash(dash);
          let firstPoint = true;
          values.forEach((v, i) => {
              if (v <= 0) return; // Skip invalid points
              const x = getX(i);
              const y = getY(v);
              if (firstPoint) { ctx.moveTo(x, y); firstPoint = false; }
              else ctx.lineTo(x, y);
          });
          ctx.stroke();
          ctx.setLineDash([]);
      };

      // 1. Draw ZLMA Engines
      const zKeys = Object.keys(data[data.length-1]?.hmas || {});
      
      // MAPPING NEW KEYS
      const lineColors: Record<string, string> = {
          'ZLMA_Scalp': '#22d3ee', // Cyan
          'ZLMA_Swing': '#4ade80', // Green
          'ZLMA_Trend': '#facc15', // Yellow
          'ZLMA_Base':  '#f87171', // Red
          'SR_Res':     '#ef4444', // Red (Resistance)
          'SR_Sup':     '#10b981', // Green (Support)
          // Legacy Fallback
          '15': '#22d3ee', '30': '#4ade80', '60': '#facc15', '120': '#f87171'
      };

      const lineStyles: Record<string, number[]> = {
          'SR_Res': [5, 5],
          'SR_Sup': [5, 5]
      };
      
      zKeys.forEach(key => {
          const vals = data.map(d => d.hmas[key] || 0);
          drawLine(vals, lineColors[key] || '#94a3b8', key.includes('SR') ? 1 : 1.5, lineStyles[key] || []);
      });

      // 2. Draw Price (Primary)
      const priceVals = data.map(d => d.price);
      const trendColor = trendBias === 'SHORT' ? '#f43f5e' : trendBias === 'LONG' ? '#10b981' : '#f8fafc';
      drawLine(priceVals, trendColor, 2);

      // 3. Fill Area (Gradient)
      ctx.save();
      ctx.beginPath();
      priceVals.forEach((v, i) => {
          const x = getX(i);
          const y = getY(v);
          if (i===0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
      });
      ctx.lineTo(getX(priceVals.length-1), height);
      ctx.lineTo(0, height);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, trendBias === 'SHORT' ? 'rgba(244, 63, 94, 0.15)' : trendBias === 'LONG' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      // 4. Draw Current Price Line & Label
      const lastPrice = priceVals[priceVals.length - 1];
      const lastY = getY(lastPrice);
      const lastX = getX(priceVals.length - 1);
      
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#475569';
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(width, lastY);
      ctx.stroke();
      ctx.setLineDash([]);

      const time = Date.now() / 500;
      const radius = 4 + Math.sin(time) * 1.5;
      ctx.beginPath();
      ctx.arc(lastX, lastY, radius, 0, Math.PI * 2);
      ctx.fillStyle = trendColor;
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      for(let i=0; i<=5; i++) {
          const val = effectiveMin + (effectiveRange * (i/5));
          const y = height - (height * (i/5));
          ctx.fillText(val.toFixed(2), width - 50, y - 5);
          ctx.beginPath();
          ctx.strokeStyle = '#334155';
          ctx.moveTo(width - 55, y);
          ctx.lineTo(width, y);
          ctx.stroke();
      }
      
      ctx.fillStyle = trendColor;
      ctx.fillRect(width - 55, lastY - 10, 55, 20);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText(lastPrice.toFixed(2), width - 50, lastY + 4);

      animationFrameId = requestAnimationFrame(render);
    };
    render();
    
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [trendBias, currentPrice, symbol, symbolState]); 

  return (
    <div ref={containerRef} className="relative w-full h-64 md:h-[450px] bg-[#020617] rounded-lg overflow-hidden border border-slate-800 shadow-inner shadow-black/50 group cursor-crosshair">
      <div className="absolute top-4 left-4 z-10 flex flex-col pointer-events-none">
        <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs font-bold bg-slate-900/80 px-2 py-1 rounded border border-slate-800">{symbol}</span>
            <span className="text-[10px] text-slate-500 uppercase">M1 • LIVE</span>
        </div>
        {currentPrice && (
            <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-3xl font-mono font-bold tracking-tight ${trendBias === 'SHORT' ? 'text-rose-500' : trendBias === 'LONG' ? 'text-emerald-500' : 'text-slate-200'}`}>
                {currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
                <span className="text-xs text-slate-500">USD</span>
            </div>
        )}
      </div>
      
      {/* Updated Legend for ZLMA & SR */}
      <div className="absolute top-4 right-16 z-10 flex flex-col items-end gap-1 pointer-events-none bg-slate-900/80 p-2 rounded border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
              <span className="text-[10px] text-slate-300">SCALP</span>
          </div>
          <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span className="text-[10px] text-slate-300">SWING</span>
          </div>
          <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
              <span className="text-[10px] text-slate-300">TREND</span>
          </div>
          <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-400"></div>
              <span className="text-[10px] text-slate-300">BASE</span>
          </div>
      </div>

      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
