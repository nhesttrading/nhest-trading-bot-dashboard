import React, { useState } from 'react';
import { Key } from 'lucide-react';
import { Card } from './Card';
import { Logo } from './Logo';
import { ACCESS_CODE } from '../constants';

interface LockScreenProps {
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [inputCode, setInputCode] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode === ACCESS_CODE) {
      onUnlock();
    } else {
      setError(true);
      setInputCode("");
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-6">
            <Logo className="w-32 h-32" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">NHEST <span className="text-[#D4AF37]">TRADING</span></h1>
          <p className="text-slate-400 text-sm mt-2 tracking-widest">INSTITUTIONAL LOGIC ENGINE</p>
        </div>

        <Card className="border-t-4 border-t-emerald-500">
          <h2 className="text-white font-bold mb-4 flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-400" />
            Security Clearance Required
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Enter Access Code"
                className={`w-full bg-slate-800 border ${error ? 'border-rose-500 shake' : 'border-slate-700'} text-white text-sm rounded-lg p-3 focus:outline-none focus:border-emerald-500 transition-all`}
                autoFocus
              />
              {error && <p className="text-rose-500 text-xs mt-2 animate-pulse">Access Denied: Invalid Code</p>}
            </div>
            <button 
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
            >
              AUTHENTICATE
            </button>
          </form>
        </Card>
        
        <p className="text-center text-slate-600 text-xs mt-8">
          Restricted Access System • v6.0 Institutional
        </p>
      </div>
    </div>
  );
};