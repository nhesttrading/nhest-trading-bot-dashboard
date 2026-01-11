import React from 'react';
import { 
  LayoutDashboard, Layers, ShieldAlert, Activity, LineChart, 
  Workflow, PieChart, ScrollText, Bot, Settings, LogOut, History,
  Briefcase, MousePointerClick, Radio
} from 'lucide-react';
import { Logo } from './Logo';

interface SidebarProps {
  activeView: string;
  onSelect: (view: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onSelect, onLogout }) => {
  const sections = [
    {
      title: 'Terminal',
      items: [
        { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
        { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
      ]
    },
    {
      title: 'Execution',
      items: [
        { id: 'manual', label: 'Direct Entry', icon: MousePointerClick },
        { id: 'strategy', label: 'Strategy', icon: Layers },
        { id: 'automation', label: 'Auto Rules', icon: Workflow },
      ]
    },
    {
      title: 'Intelligence',
      items: [
        { id: 'market', label: 'Market View', icon: LineChart },
        { id: 'signals', label: 'Signal Wire', icon: Radio },
        { id: 'trades', label: 'Live Trades', icon: Activity },
        { id: 'history', label: 'Ledger', icon: History },
        { id: 'analytics', label: 'Performance', icon: PieChart },
        { id: 'ai', label: 'Gemini AI', icon: Bot },
      ]
    },
    {
      title: 'Core',
      items: [
        { id: 'logs', label: 'Telemetry', icon: ScrollText },
        { id: 'risk', label: 'Risk Hub', icon: ShieldAlert },
        { id: 'settings', label: 'Config', icon: Settings },
      ]
    }
  ];

  return (
    <div className="w-64 bg-slate-950/40 backdrop-blur-xl border-r border-slate-800/50 flex flex-col h-full font-sans relative">
      <div className="p-6 border-b border-slate-800/50 flex items-center gap-3 bg-slate-900/20">
        <Logo className="w-7 h-7 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
        <div>
          <h1 className="text-sm font-black text-white tracking-tighter leading-none uppercase">NHEST <span className="text-emerald-500">TRADING</span></h1>
          <p className="text-[7px] text-emerald-500/80 font-black uppercase tracking-[0.1em] mt-1">Next Horizon of Equity Strategy & Trading</p>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Terminal v2.1.0</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 custom-scrollbar">
        {sections.map((section, idx) => (
          <div key={idx} className="mb-8 last:mb-0">
            <div className="px-6 py-1 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-3">
              {section.title}
            </div>
            <div className="space-y-1 px-3">
              {section.items.map((item) => {
                const isActive = activeView === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 group ${
                      isActive 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 transition-transform ${isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-110'}`} />
                    {item.label}
                    {isActive && (
                        <div className="ml-auto w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)]"></div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-6 border-t border-slate-800/50 bg-slate-900/20">
        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-black text-rose-400 hover:text-white hover:bg-rose-500 rounded-xl transition-all border border-rose-500/20 group"
        >
          <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          DISCONNECT
        </button>
      </div>
    </div>
  );
};