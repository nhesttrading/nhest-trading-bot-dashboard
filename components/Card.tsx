import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = "" }) => (
  <div className={`bg-slate-900/60 backdrop-blur-md border border-slate-800/50 rounded-xl p-5 shadow-xl relative transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-emerald-500/5 group ${className}`}>
    {/* Interactive Border Highlight */}
    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
    
    <div className="relative z-10">
      {children}
    </div>
  </div>
);