import React, { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  type?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'purple';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, type = 'neutral', className = "" }) => {
  const styles = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]',
    neutral: 'bg-slate-800/50 text-slate-400 border-slate-700/50',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]'
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border transition-all duration-300 ${styles[type]} ${className}`}>
      {children}
    </span>
  );
};