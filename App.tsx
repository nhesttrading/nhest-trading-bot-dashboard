import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Play, Pause, Wifi, WifiOff, Monitor, AlertTriangle, 
  CheckCircle2, XCircle, BrainCircuit, RefreshCw, Save,
  Plus, Trash2, Search, Filter, ShieldCheck, Zap,
  Workflow, History, ArrowRight, Code, Database, Server,
  Sliders, Cpu, Upload, FileJson, Share2, Copy, MousePointerClick,
  TrendingUp, TrendingDown, Activity, Radio, Menu,
  Target, BarChart3, PieChart, Clock, Calendar, Gauge, Award, ShieldAlert, ZapOff, Fingerprint
} from 'lucide-react';
import { 
  StrategyState, LogEntry, MarketPrices, ActivePosition, 
  SymbolState, AccountState, WebhookEvent
} from './types';
import { UNIVERSE } from './constants';
import { analyzeMarket, analyzePortfolioRisk } from './services/geminiService';
import { Card } from './components/Card';
import { Badge } from './components/Badge';
import { LockScreen } from './components/LockScreen';
import { LiveChart } from './components/LiveChart';
import { Sidebar } from './components/Sidebar';
import { HMAStack } from './components/HMAStack';
import { RecentTrades } from './components/RecentTrades';
import { LifecycleMonitor } from './components/LifecycleMonitor';
import { Tape } from './components/Tape';
import { ConfluenceMatrix } from './components/ConfluenceMatrix';
import { MarketScanner } from './components/MarketScanner';

const DEFAULT_SYMBOL_STATE: SymbolState = {
  trend_bias: 'NONE',
  status: 'SCANNING',
  entry_count: 0,
  entries: [],
  hma_values: {},
  hma_trends: { 15: 'FLAT', 30: 'FLAT', 60: 'FLAT', 120: 'FLAT', 240: 'FLAT' }
};

// CONNECTIVITY CONFIGURATION
// Production: Set VITE_API_URL in Vercel to your Paid Ngrok Static Domain.
// Development: Fallback to localhost.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'; 

export default function NhestTradingBot() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('nhest_auth') === 'true';
  });
  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('nhest_view') || 'dashboard';
  });
  
  const handleViewChange = (view: string) => {
    setActiveView(view);
    localStorage.setItem('nhest_view', view);
  };
  
  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // System State
  const [botActive, setBotActive] = useState(false);
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [latency, setLatency] = useState(0);
  const [activeStrategyName, setActiveStrategyName] = useState("Initialising...");
  const [marketPrices, setMarketPrices] = useState<MarketPrices>({});
  // Load logs from storage
  const [logs, setLogs] = useState<LogEntry[]>(() => {
      try {
          const saved = localStorage.getItem('nhest_logs');
          return saved ? JSON.parse(saved) : [];
      } catch (e) { return []; }
  });
  // Persistent Trade History
  const [closedTrades, setClosedTrades] = useState<ActivePosition[]>(() => {
      try {
          const saved = localStorage.getItem('nhest_history');
          return saved ? JSON.parse(saved) : [];
      } catch (e) { return []; }
  });

  // --- CLOUD SYNC ---
  const syncLockRef = useRef(false);
  
  useEffect(() => {
      const fetchData = async () => {
          if (syncLockRef.current) return;
          syncLockRef.current = true;
          
          try {
              addLog('info', 'SYS', 'Attempting Cloud Sync...');
              const hRes = await fetch(`${API_URL}/api/history`, { 
                  headers: { "ngrok-skip-browser-warning": "69420" },
                  mode: 'cors'
              });
              
              if (hRes.ok) {
                  const data = await hRes.json();
                  if (Array.isArray(data)) {
                      setClosedTrades(data);
                      localStorage.setItem('nhest_history', JSON.stringify(data));
                      addLog('success', 'SYS', 'History Synced');
                  }
              } else {
                  throw new Error(`HTTP ${hRes.status}`);
              }
              
              const lRes = await fetch(`${API_URL}/api/logs`, { 
                  headers: { "ngrok-skip-browser-warning": "69420" },
                  mode: 'cors'
              });
              
              if (lRes.ok) {
                  const data = await lRes.json();
                  if (Array.isArray(data)) {
                      setLogs(data);
                      localStorage.setItem('nhest_logs', JSON.stringify(data));
                      addLog('success', 'SYS', 'Telemetry Synced');
                  }
              }
          } catch (e: any) { 
              console.warn("Cloud Sync Failed:", e); 
              addLog('warning', 'SYS', `Bridge Unreachable: ${e.message === 'Failed to fetch' ? 'CORS or Network Block' : e.message}`);
          } finally {
              syncLockRef.current = false;
          }
      };
      if (isAuthenticated) fetchData();
  }, [isAuthenticated]);

  // Save history to Backend on change
  const updateHistory = (newHistory: ActivePosition[]) => {
      setClosedTrades(newHistory);
      localStorage.setItem('nhest_history', JSON.stringify(newHistory));
      
      // Fire and forget upload
      fetch(`${API_URL}/api/history`, {
          method: 'POST',
          headers: { 
              "Content-Type": "application/json",
              "ngrok-skip-browser-warning": "true"
          },
          body: JSON.stringify(newHistory)
      }).catch(e => console.warn("Cloud Sync Failed (Save)"));
  };

  const [accountState, setAccountState] = useState<AccountState | null>(null);

  // --- HISTORY TRACKING ---
  const prevPositionsRef = useRef<ActivePosition[]>([]);
  const prevPendingRef = useRef<any[]>([]); // Track Pending Orders
  
  const [sessionEquity, setSessionEquity] = useState<number[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookEvent[]>([]);
  // Automation State
  interface AutoRule {
      id: number;
      name: string;
      symbol: string;
      trigger: string;
      operator: string;
      threshold: number;
      actionType: string;
      actionValue: number;
      active: boolean;
  }
  const [automationRules, setAutomationRules] = useState<AutoRule[]>(() => {
      try {
          const saved = localStorage.getItem('nhest_rules');
          return saved ? JSON.parse(saved) : [];
      } catch (e) { return []; }
  });

  useEffect(() => {
      localStorage.setItem('nhest_rules', JSON.stringify(automationRules));
  }, [automationRules]);

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [newRule, setNewRule] = useState<Omit<AutoRule, 'id' | 'active'>>({
      name: '',
      symbol: 'BTCUSD',
      trigger: 'RSI',
      operator: '<',
      threshold: 30,
      actionType: 'BUY',
      actionValue: 0.01
  });
  
  // Strategy Builder State
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
      return localStorage.getItem('nhest_selected_symbol') || "BTCUSD";
  });

  const handleSymbolChange = (symbol: string) => {
      setSelectedSymbol(symbol);
      localStorage.setItem('nhest_selected_symbol', symbol);
  };

  const [strategyType, setStrategyType] = useState(() => {
      return localStorage.getItem('nhest_strategy_type') || "HMA Trend Follower";
  });

  useEffect(() => {
      localStorage.setItem('nhest_strategy_type', strategyType);
  }, [strategyType]);

  const [timeframe, setTimeframe] = useState(() => {
      return localStorage.getItem('nhest_timeframe') || "5M";
  });

  useEffect(() => {
      localStorage.setItem('nhest_timeframe', timeframe);
  }, [timeframe]);
  
  // Manual Trading State
  const [manualVolume, setManualVolume] = useState(0.01);
  const [manualReason, setManualReason] = useState("");

  // Strategy Parameters (Editable)
  const [fastPeriod, setFastPeriod] = useState(() => {
      return Number(localStorage.getItem('nhest_fast_period')) || 15;
  });
  const [slowPeriod, setSlowPeriod] = useState(() => {
      return Number(localStorage.getItem('nhest_slow_period')) || 30;
  });
  const [rsiThreshold, setRsiThreshold] = useState(() => {
      return Number(localStorage.getItem('nhest_rsi_threshold')) || 50;
  });

  useEffect(() => {
      localStorage.setItem('nhest_fast_period', fastPeriod.toString());
      localStorage.setItem('nhest_slow_period', slowPeriod.toString());
      localStorage.setItem('nhest_rsi_threshold', rsiThreshold.toString());
  }, [fastPeriod, slowPeriod, rsiThreshold]);
  
  // Risk State
  const [riskPerStack, setRiskPerStack] = useState(() => {
      return Number(localStorage.getItem('nhest_risk_per_stack')) || 2.0;
  });
  const [dailyMaxLoss, setDailyMaxLoss] = useState(() => {
      return Number(localStorage.getItem('nhest_daily_max_loss')) || 3.0;
  });
  const [maxDrawdown, setMaxDrawdown] = useState(() => {
      return Number(localStorage.getItem('nhest_max_drawdown')) || 5.0;
  });
  const [autoPause, setAutoPause] = useState(() => {
      return localStorage.getItem('nhest_auto_pause') !== 'false';
  });

  useEffect(() => {
      localStorage.setItem('nhest_risk_per_stack', riskPerStack.toString());
      localStorage.setItem('nhest_daily_max_loss', dailyMaxLoss.toString());
      localStorage.setItem('nhest_max_drawdown', maxDrawdown.toString());
      localStorage.setItem('nhest_auto_pause', autoPause.toString());
  }, [riskPerStack, dailyMaxLoss, maxDrawdown, autoPause]);

  // AI State
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiScore, setAiScore] = useState(0);
  const [aiBias, setAiBias] = useState("NEUTRAL");
  const [riskReport, setRiskReport] = useState("");
  const [riskAuditLoading, setRiskAuditLoading] = useState(false);
  
  // UI State
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTradesTab, setActiveTradesTab] = useState<'active' | 'pending'>('active');

  const handleLogout = () => {
      localStorage.removeItem('nhest_auth');
      setIsAuthenticated(false);
  };

  // Initialize Data
  const initialSymbols: Record<string, SymbolState> = {};
  UNIVERSE.forEach(sym => { initialSymbols[sym] = { ...DEFAULT_SYMBOL_STATE }; });
  const [strategyState, setStrategyState] = useState<StrategyState>({ symbols: initialSymbols });

  const currentSymbolState = strategyState.symbols[selectedSymbol] || DEFAULT_SYMBOL_STATE;

  const socketRef = useRef<Socket | null>(null);

  // --- AUDIO ENGINE ---
  const playSound = (type: 'success' | 'error' | 'info' | 'neutral') => {
      try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          const now = ctx.currentTime;
          
          if (type === 'success') {
              // High-pitched "fill" blip
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, now);
              osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);
              gain.gain.setValueAtTime(0.1, now);
              gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
              osc.start(now);
              osc.stop(now + 0.1);
          } else if (type === 'error') {
              // Low "alert" buzz
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(110, now);
              gain.gain.setValueAtTime(0.05, now);
              gain.gain.linearRampToValueAtTime(0, now + 0.3);
              osc.start(now);
              osc.stop(now + 0.3);
          } else if (type === 'info') {
              // Soft "link" sonar
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(440, now);
              osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
              gain.gain.setValueAtTime(0.05, now);
              gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
              osc.start(now);
              osc.stop(now + 0.2);
          }
      } catch (e) { /* Audio blocked by browser policy */ }
  };

  // --- SOCKET CONNECTION ---
  const [reconnectCounter, setReconnectCounter] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    const initSocket = setTimeout(() => {
        const timestamp = Date.now();
        addLog('info', 'SYS', `Initializing Socket (STABLE STREAM): ${API_URL}`);
        
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
        }

        const socket: Socket = io(API_URL, {
            path: '/socket.io/',
            extraHeaders: { "ngrok-skip-browser-warning": "69420" },
            transports: ['polling', 'websocket'], // Polling first is better for large packets over Ngrok
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            timeout: 30000,
            forceNew: true,
            withCredentials: false
        });
        socketRef.current = socket;

        // Unified Packet Inspector with Size Tracking
        let eventCount = 0;
        socket.onAny((eventName, data) => {
            resetDataTimeout();
            if (eventCount < 10) {
                const raw = JSON.stringify(data);
                const size = (raw.length / 1024).toFixed(1);
                addLog('info', 'DEBUG', `Packet: ${eventName} (${size}KB) | Data: ${raw.substring(0, 40)}...`);
                eventCount++;
            }
        });

        socket.on('connect', () => {
          setBridgeConnected(true);
          playSound('info');
          addLog('success', 'NET', 'Bridge Stabilized (Live)');
          resetDataTimeout();
          
          socket.emit('request_full_state');
          socket.emit('subscribe_all');
        });

        const handleStrategyUpdate = (data: any) => {
            resetDataTimeout();
            
            // Handle Array of Symbols (Common in Python engines)
            let symbols = data.symbols || data.data?.symbols || data;
            if (Array.isArray(symbols)) {
                const symbolObj: Record<string, SymbolState> = {};
                symbols.forEach((s: any) => {
                    if (s.symbol) symbolObj[s.symbol] = s;
                });
                symbols = symbolObj;
            }

            if (symbols && typeof symbols === 'object' && !Array.isArray(symbols)) {
                setStrategyState(prev => ({
                    ...prev,
                    symbols: { ...prev.symbols, ...symbols }
                }));
            }
            
            if (data.active !== undefined) setBotActive(data.active);
            if (data.activeStrategy) setActiveStrategyName(data.activeStrategy);
        };

        const handleMarketUpdate = (data: any) => {
            resetDataTimeout();
            const prices = data.prices || data.data || data;
            if (prices && typeof prices === 'object' && Object.keys(prices).length > 0) {
                setMarketPrices(prev => ({ ...prev, ...prices }));
            }
        };

        socket.on('strategy_state', (data: any) => {
            handleStrategyUpdate(data);
            addLog('info', 'SYS', 'Received Strategy Sync');
        });
        socket.on('strategy_update', handleStrategyUpdate);
        socket.on('heartbeat', (data: any) => {
            handleStrategyUpdate(data);
            // If data is just a list of symbols, it might be the heartbeat
            if (Array.isArray(data)) {
                 addLog('info', 'SYS', `Heartbeat: ${data.length} symbols`);
            }
        });
        
        socket.on('market_data', handleMarketUpdate);
        socket.on('market_update', handleMarketUpdate);

        socket.on('account_update', (data: any) => {
            resetDataTimeout();
            if (data.status === 'ONLINE' || data.status === 'CONNECTED') {
                if (!bridgeConnected) setBridgeConnected(true);
            }
            
            setAccountState(data);
            if (data.equity && data.balance) {
                // FALLBACK: If totalUnrealizedPnL isn't calculated yet
                const openPnL = data.equity - data.balance;
            }

            setSessionEquity(prev => {
                const equity = data.equity || data.balance || 0;
                const updated = [...prev, equity];
                return updated.slice(-50);
            });
        });

        socket.on('disconnect', (reason) => {
          // Debounce disconnect to survive tiny Ngrok flaps
          setTimeout(() => {
              if (!socket.connected) {
                  setBridgeConnected(false);
                  addLog('error', 'NET', `Disconnected: ${reason}`);
              }
          }, 3000);
        });
    }, 1000); // 1 second delay

    return () => { 
        clearTimeout(initSocket);
        if (socketRef.current) socketRef.current.disconnect(); 
    };
  }, [isAuthenticated, reconnectCounter]);

  // --- CALCULATIONS ---
  const activePositions: ActivePosition[] = [];
  const pendingOrders: any[] = [];
  let totalUnrealizedPnL = 0;
  
  Object.entries(strategyState.symbols).forEach(([sym, state]: [string, SymbolState]) => {
      // 1. Generic Watchlist (LOCKED status, no entries)
      if (state.status === 'LOCKED' && (!state.entries || state.entries.length === 0)) {
           pendingOrders.push({
               symbol: sym,
               bias: state.trend_bias,
               status: state.status,
               currentPrice: marketPrices[sym] || 0
           });
           return;
      }

      // 2. Process Entries
      if (state.entries && state.entries.length > 0) {
          state.entries.forEach((entry, idx) => {
            // DETECT PENDING ORDERS
            // Explicit type check from backend
            let isPending = entry.type === 'PENDING';

            // Fallback checks
            if (!isPending) {
                const reasonStr = (entry.reason || "").toLowerCase();
                isPending = reasonStr.includes('pending');
                
                // Backend PnL always confirms Active (Safety Net)
                if (entry.pnl !== undefined || entry.profit !== undefined) {
                    isPending = false;
                }
            }

            if (isPending) {
                pendingOrders.push({
                      symbol: sym,
                      bias: state.trend_bias,
                      status: state.status,
                      currentPrice: marketPrices[sym] || 0,
                      limitPrice: entry.price,
                      ticket: entry.ticket,
                      volume: entry.volume
                });
            } else {
                // ACTIVE POSITION
                // Includes LOCKED status trades that are filled
                const currentP = marketPrices[sym];
                let pnl = 0;
                
                // Use Backend PnL if available, otherwise calculate fallback
                if (entry.pnl !== undefined) {
                    pnl = entry.pnl;
                } else if (entry.profit !== undefined) {
                    pnl = entry.profit;
                } else if (currentP) {
                    let rawDiff = (currentP - entry.price) / entry.price;
                    if (state.trend_bias === 'SHORT') rawDiff = -rawDiff;
                    pnl = rawDiff * 10000; 
                }
                
                totalUnrealizedPnL += pnl;
                
                activePositions.push({
                    symbol: sym,
                    type: state.trend_bias,
                    entryPrice: entry.price,
                    pnl: pnl,
                    layer: idx + 1,
                    reason: entry.reason || "Auto HMA",
                    time: new Date(entry.time).toLocaleTimeString(),
                    status: state.status, 
                    ticket: entry.ticket,
                    volume: entry.volume
                });
            }
          });
      }
  });

  const activeLongs = activePositions.filter(p => p.type === 'LONG').length;
  const activeShorts = activePositions.filter(p => p.type === 'SHORT').length;
  const realOpenPnL = accountState ? accountState.equity - accountState.balance : 0;

  // Update History when trades close OR pending orders cancel
  useEffect(() => {
      if (!bridgeConnected) return;

      // 1. Detect Closed Active Trades
      const currentIds = new Set(activePositions.map(p => p.ticket || p.symbol));
      const newlyClosed = prevPositionsRef.current.filter(p => 
          !currentIds.has(p.ticket || p.symbol)
      );

      // 2. Detect Cancelled Pending Orders
      const currentPendingIds = new Set(pendingOrders.map(p => p.ticket || p.symbol));
      const newlyCancelled = prevPendingRef.current.filter(p => 
          !currentPendingIds.has(p.ticket || p.symbol) &&
          !currentIds.has(p.ticket || p.symbol) // Ensure it didn't just move to Active (Fill)
      );

      if (newlyClosed.length > 0 || newlyCancelled.length > 0) {
          const closed = newlyClosed.map(p => ({ ...p, finalStatus: 'FILLED' as const }));
          
          const cancelled = newlyCancelled.map(p => ({ 
              symbol: p.symbol,
              type: p.bias || 'NONE',
              entryPrice: p.limitPrice || p.currentPrice,
              pnl: 0, 
              layer: 0,
              reason: 'Cancelled / Expired',
              time: new Date().toLocaleTimeString(),
              finalStatus: 'CANCELLED' as const
          }));

          const updated = [...closed, ...cancelled, ...closedTrades].slice(0, 1000);
          updateHistory(updated);
      }

      prevPositionsRef.current = activePositions;
      prevPendingRef.current = pendingOrders;
  }, [JSON.stringify(activePositions), JSON.stringify(pendingOrders), bridgeConnected]);

  const addLog = (type: 'info' | 'success' | 'warning' | 'error', trigger: string, msg: string) => {
      const logEntry: LogEntry = { time: new Date().toLocaleTimeString(), type, trigger, msg };
      
      // Audible Feedback
      if (type === 'error') playSound('error');
      if (type === 'success') playSound('success');
      
      setLogs(prev => {
          const updated = [logEntry, ...prev].slice(0, 2000);
          localStorage.setItem('nhest_logs', JSON.stringify(updated));
          return updated;
      });
      if (socketRef.current?.connected) {
          socketRef.current.emit('new_log_client', logEntry);
      }
  };

  // --- HANDLERS ---
  const handleToggleEngine = () => {
      if (!socketRef.current) return addLog('error', 'NET', 'Socket not connected');
      
      const action = botActive ? 'stop' : 'start';
      addLog('info', 'SYS', `Sending ${action.toUpperCase()} command...`);
      
      const socket = socketRef.current;
      
      if (action === 'start') {
          socket.emit('start_engine');
      } else {
          socket.emit('stop_engine');
      }
  };

  const handleClosePositions = async () => {
      addLog('warning', 'MANUAL', 'INITIATING PANIC CLOSE (ALL POSITIONS)...');
      
      // STRATEGY 1: Frontend Iteration (The "Nuclear" Option)
      // Since backend global kill seems unreliable, we manually fire close commands for every active trade.
      if (activePositions.length > 0) {
          activePositions.forEach(pos => {
              handleCloseSymbol(pos.symbol, pos.ticket, pos.volume);
          });
          addLog('info', 'MANUAL', `Sent close commands for ${activePositions.length} positions.`);
      }

      // STRATEGY 2: Global Socket Events (Backup)
      if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('panic_close');
          socketRef.current.emit('kill_all');
      }

      // STRATEGY 3: HTTP Global Endpoint (Backup)
      try {
        await fetch(`${API_URL}/api/kill`, { method: 'POST', headers: { "ngrok-skip-browser-warning": "true" } });
      } catch (e) { console.error(e); }
  };

  const handleCloseSymbol = async (symbol: string, ticket?: number, volume?: number) => {
    if (!confirm(`Close ${symbol} position ${ticket ? `(Ticket: ${ticket})` : ''}?`)) return;
    // DEBUG: Show exact payload to user
    addLog('info', 'DEBUG', `Payload: ${JSON.stringify({ s: symbol, t: ticket, v: volume })}`);
    
    addLog('info', 'MANUAL', `Sending CLOSE command for ${symbol} (Ticket: ${ticket || 'ALL'})...`);
    
    // HTTP API is primary for close/kill to ensure ACID execution on broker
    try {
        const res = await fetch(`${API_URL}/api/close`, { 
            method: 'POST', 
            headers: { 
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true" 
            },
            body: JSON.stringify({ 
                symbol: ticket ? undefined : symbol, 
                ticket: ticket || undefined
            })
        });
        
        if (res.ok) {
            addLog('success', 'MANUAL', `Close Order Processed: ${symbol}`);
        } else {
            addLog('error', 'API', `Failed to close: ${res.status}`);
        }
    } catch (e: any) {
        addLog('error', 'API', `Network Error: ${e.message || 'Unknown'}`);
    }
  };

  const handleManualTrade = async (action: 'BUY' | 'SELL') => {
    if (!confirm(`Execute Market ${action} for ${selectedSymbol} (${manualVolume} lots)?`)) return;
    try {
        addLog('info', 'MANUAL', `Sending ${action} order for ${selectedSymbol}...`);
        const res = await fetch(`${API_URL}/api/trade`, { 
            method: 'POST', 
            headers: { 
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true" 
            },
            body: JSON.stringify({ 
                symbol: selectedSymbol, 
                action, 
                volume: manualVolume, 
                reason: manualReason || 'Manual UI Execution' 
            })
        });
        
        if (res.ok) {
            addLog('success', 'MANUAL', `Order Sent: ${action} ${selectedSymbol} (${manualVolume} lots)`);
            setManualReason(""); // Reset reason field
        } else {
            addLog('error', 'MANUAL', 'Order Rejected by Engine');
        }
    } catch (e) {
        addLog('error', 'API', 'Network error during manual execution');
    }
  };

  const sendStrategyToBackend = async (strat: string, params: any) => {
      try {
          const payload = { strategy: strat, params: params };
          addLog('info', 'CONFIG', `Uploading Strategy: ${strat}...`);
          
          const res = await fetch(`${API_URL}/api/strategy`, { 
              method: 'POST', 
              headers: { 
                  "Content-Type": "application/json",
                  "ngrok-skip-browser-warning": "true" 
              },
              body: JSON.stringify(payload)
          });
          
          if (res.ok) {
              addLog('success', 'CONFIG', `Engine Re-configured: ${strat}`);
          } else {
              addLog('error', 'CONFIG', 'Failed to update strategy on server');
          }
      } catch (e) {
          addLog('error', 'API', 'Network error saving strategy');
      }
  };

  const handleApplyConfig = () => {
      sendStrategyToBackend(strategyType, { fastPeriod, slowPeriod, rsiThreshold });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const content = e.target?.result as string;
              const config = JSON.parse(content);
              
              // Validate minimal structure
              if (!config.strategyName && !config.strategy) {
                  addLog('error', 'FILE', 'Invalid Strategy File: Missing strategy name');
                  return;
              }

              const newStrategy = config.strategyName || config.strategy;
              const newParams = config.parameters || config.params || {};

              // Update Local UI State
              setStrategyType(newStrategy);
              if (newParams.fastPeriod) setFastPeriod(newParams.fastPeriod);
              if (newParams.slowPeriod) setSlowPeriod(newParams.slowPeriod);
              if (newParams.rsiThreshold) setRsiThreshold(newParams.rsiThreshold);

              // Send to Backend
              await sendStrategyToBackend(newStrategy, newParams);
              addLog('success', 'FILE', `Loaded from ${file.name}`);

          } catch (err) {
              addLog('error', 'FILE', 'Failed to parse JSON configuration file');
          }
      };
      reader.readAsText(file);
      // Reset input so same file can be selected again
      event.target.value = '';
  };

  const handleAIAnalysis = async () => {
      const price = marketPrices[selectedSymbol];
      if (!price) return addLog('warning', 'AI', 'No Price Data Available');
      setAiLoading(true);
      // Simulate processing time
      setTimeout(async () => {
        const result = await analyzeMarket(selectedSymbol, price, currentSymbolState.trend_bias, currentSymbolState.status);
        setAiAnalysis(result);
        
        // Dynamic Simulation
        const score = Math.floor(Math.random() * 40) + 60; // 60-99
        setAiScore(score);
        setAiBias(score > 80 ? "STRONG BUY" : score > 65 ? "ACCUMULATE" : "NEUTRAL");
        
        setAiLoading(false);
      }, 1500);
  };

  const handleRiskAudit = async () => {
      setRiskAuditLoading(true);
      const result = await analyzePortfolioRisk(activePositions, { dailyMaxLoss, riskPerStack, maxAssetsActive: 5 });
      setRiskReport(result);
      setRiskAuditLoading(false);
  };

  const handleSaveRisk = () => {
      if (!confirm("Update risk parameters on engine? This will immediately affect live protection logic.")) return;
      if (!socketRef.current?.connected) return addLog('error', 'NET', 'Socket not connected');
      
      const config = {
          riskPerStack,
          dailyMaxLoss,
          maxDrawdown,
          autoPause
      };
      
      socketRef.current.emit('update_risk', config);
      addLog('success', 'RISK', 'Risk configuration sent to engine');
  };

  if (!isAuthenticated) return <LockScreen onUnlock={() => {
    localStorage.setItem('nhest_auth', 'true');
    setIsAuthenticated(true);
  }} />;

  // --- VIEWS ---
  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in">
        {/* Global Market Scanner */}
        <MarketScanner 
            prices={marketPrices} 
            strategyState={strategyState} 
            selectedSymbol={selectedSymbol}
            onSelect={handleSymbolChange}
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-slate-900/60 to-slate-800/60">
                <div className="text-slate-500 text-[10px] uppercase font-black mb-1 tracking-wider">Unrealized PnL</div>
                <div className={`text-2xl font-mono font-bold ${totalUnrealizedPnL > 0 ? 'text-emerald-400' : totalUnrealizedPnL < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                    {totalUnrealizedPnL >= 0 ? '+' : ''}{totalUnrealizedPnL.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </div>
                <div className="text-[10px] text-slate-600 font-bold mt-1">
                   Aggregate floating delta
                </div>
            </Card>
            <Card>
                <div className="text-slate-500 text-[10px] uppercase font-black mb-1 tracking-wider">Active Positions</div>
                <div className="text-2xl font-mono font-bold text-white">{activePositions.length}</div>
                <div className="text-[10px] text-slate-600 flex gap-2 font-bold mt-1">
                    <span className="text-emerald-500">{activeLongs} L</span>
                    <span className="text-rose-500">{activeShorts} S</span>
                </div>
            </Card>
             <Card>
                <div className="text-slate-500 text-[10px] uppercase font-black mb-1 tracking-wider">Active Logic</div>
                <div className="text-lg font-mono font-bold text-purple-400 truncate" title={activeStrategyName}>
                    {activeStrategyName}
                </div>
                <div className="text-[10px] text-slate-600 font-bold mt-1 uppercase">Engine Sequence</div>
            </Card>
            <Card className={`flex flex-col justify-center items-center ${botActive ? 'bg-emerald-900/10 border-emerald-900/30' : 'bg-slate-900/40'}`}>
                <div className="flex items-center justify-between w-full mb-3 px-1">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${bridgeConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500'}`}></div>
                        <span className="text-[10px] font-black uppercase text-slate-400">{bridgeConnected ? 'Engine' : 'Offline'}</span>
                    </div>
                    {!bridgeConnected && (
                        <button 
                            onClick={() => {
                                addLog('warning', 'SYS', 'Forcing Bridge Reset...');
                                setReconnectCounter(prev => prev + 1);
                            }}
                            className="text-[9px] font-bold text-blue-400 hover:text-blue-300 underline uppercase"
                        >
                            Hard Reconnect
                        </button>
                    )}
                    {bridgeConnected && (
                        <div className="text-[10px] font-mono font-bold text-slate-500">
                            {latency}ms
                        </div>
                    )}
                </div>
                <button 
                  onClick={handleToggleEngine}
                  className={`w-full py-2.5 rounded-xl font-black text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all ${
                    botActive ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-900/20' : 'bg-emerald-500 hover:bg-emerald-600 text-slate-900'
                  }`}
                >
                  {botActive ? <><Pause className="w-3 h-3" /> STOP SEQUENCE</> : <><Play className="w-3 h-3" /> START SEQUENCE</>}
                </button>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 min-h-[400px]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-white flex items-center gap-2"><Monitor className="w-4 h-4 text-slate-400" /> Active Market</h3>
                    <select 
                        value={selectedSymbol} 
                        onChange={(e) => handleSymbolChange(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1 text-white focus:outline-none focus:border-emerald-500"
                    >
                        {UNIVERSE.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <LiveChart symbol={selectedSymbol} isActive={botActive} trendBias={currentSymbolState.trend_bias} currentPrice={marketPrices[selectedSymbol]} symbolState={currentSymbolState} />
                <div className="mt-4 pt-4 border-t border-slate-800">
                    <div className="mb-2 text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                        <Workflow className="w-3 h-3" />
                        Strategy Lifecycle
                    </div>
                    <LifecycleMonitor 
                        status={
                            activePositions.filter(p => p.symbol === selectedSymbol).length > 1 ? 'SCALING' :
                            activePositions.filter(p => p.symbol === selectedSymbol).length > 0 ? 'LOCKED' :
                            (currentSymbolState.status === 'LOCKED' || currentSymbolState.status === 'INVALIDATED' ? currentSymbolState.status : 'SCANNING')
                        } 
                        trendBias={currentSymbolState.trend_bias} 
                        entryCount={activePositions.filter(p => p.symbol === selectedSymbol).length} 
                    />
                </div>
            </Card>
            <div className="space-y-6">
                 <Card>
                    <h3 className="font-bold text-white text-sm mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                         <button onClick={handleClosePositions} className="w-full py-3 bg-rose-900/20 border border-rose-800 text-rose-400 hover:bg-rose-900/30 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2">
                            <XCircle className="w-4 h-4" /> PANIC CLOSE ALL
                        </button>
                        <button className="w-full py-3 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4" /> RESET SYSTEM
                        </button>
                    </div>
                </Card>
                <Card className="flex-1">
                    <h3 className="font-bold text-white text-sm mb-4">Active Positions</h3>
                    {activePositions.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-xs">No active trades</div>
                    ) : (
                        <div className="space-y-2">
                            {activePositions.slice(0,3).map((p, i) => (
                                <div key={i} className="flex justify-between items-center p-2 bg-slate-800/50 rounded border border-slate-800">
                                    <span className="text-xs font-bold text-white">{p.symbol}</span>
                                    <span className={`text-xs font-mono font-bold ${p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {p.pnl >= 0 ? '+' : ''}{p.pnl.toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    </div>
  );

  const renderManual = () => (
      <div className="space-y-6 animate-in fade-in h-full flex flex-col">
          <div className="flex justify-between items-center">
             <div>
                 <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <MousePointerClick className="w-6 h-6 text-emerald-400" />
                    Manual Execution
                 </h2>
                 <p className="text-xs text-slate-500 mt-1">Direct Market Access • Override Automated Logic</p>
             </div>
             {bridgeConnected ? <Badge type="success">GATEWAY READY</Badge> : <Badge type="danger">GATEWAY OFFLINE</Badge>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
               {/* Asset Selection Grid */}
               <Card className="lg:col-span-2 flex flex-col overflow-hidden">
                   <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm">
                        <Monitor className="w-4 h-4 text-slate-400" /> Asset Universe
                   </h3>
                   <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto custom-scrollbar flex-1 p-1">
                       {UNIVERSE.map(symbol => {
                           const price = marketPrices[symbol];
                           const isSelected = selectedSymbol === symbol;
                           const state = strategyState.symbols[symbol];
                           const trend = state?.trend_bias;
                           
                           return (
                               <button 
                                  key={symbol}
                                  onClick={() => handleSymbolChange(symbol)}
                                  className={`p-4 rounded-xl border flex flex-col items-start transition-all duration-200 group relative overflow-hidden ${
                                      isSelected 
                                      ? 'bg-emerald-900/20 border-emerald-500 shadow-lg shadow-emerald-900/10' 
                                      : trend === 'LONG' 
                                        ? 'bg-emerald-900/10 border-emerald-900/40 hover:bg-emerald-900/20'
                                        : trend === 'SHORT'
                                          ? 'bg-rose-900/10 border-rose-900/40 hover:bg-rose-900/20'
                                          : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                                  }`}
                               >
                                  <span className={`text-xs font-bold mb-1 ${isSelected ? 'text-emerald-400' : 'text-slate-400 group-hover:text-white'}`}>
                                      {symbol}
                                  </span>
                                  <span className={`text-lg font-mono font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                                      {price ? `$${price.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '---'}
                                  </span>
                                  {isSelected && <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>}
                               </button>
                           )
                       })}
                   </div>
               </Card>

               {/* Order Execution Panel */}
               <Card className="flex flex-col bg-slate-900 border-l-4 border-l-blue-500">
                    <div className="mb-6">
                        <div className="text-xs text-slate-500 uppercase font-bold mb-1">Selected Asset</div>
                        <div className="text-3xl font-bold text-white">{selectedSymbol}</div>
                        <div className="flex items-center gap-2 mt-2">
                             <div className="text-xl font-mono text-emerald-400">
                                 {marketPrices[selectedSymbol] ? `$${marketPrices[selectedSymbol]}` : <span className="animate-pulse">Loading...</span>}
                             </div>
                             <Badge type="neutral">SPOT</Badge>
                        </div>
                    </div>

                    <div className="space-y-6 flex-1">
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Volume (Lots)</label>
                                <span className="text-[10px] text-slate-500">MAX: 50.0</span>
                            </div>
                            <div className="flex gap-2 mb-3">
                                {[0.01, 0.05, 0.1, 0.5, 1.0].map(v => (
                                    <button 
                                        key={v}
                                        onClick={() => setManualVolume(v)}
                                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${manualVolume === v ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    step="0.01"
                                    min="0.01"
                                    value={manualVolume}
                                    onChange={(e) => setManualVolume(parseFloat(e.target.value))}
                                    className="w-full bg-[#020617] border border-slate-700 text-white text-2xl font-mono font-bold rounded-lg p-4 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all text-right pr-12"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">LOTS</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Slippage</label>
                                <select className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded p-2 focus:border-blue-500 outline-none">
                                    <option>0.1% (Strict)</option>
                                    <option>0.5% (Standard)</option>
                                    <option>1.0% (Loose)</option>
                                </select>
                            </div>
                             <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Time in Force</label>
                                <select className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded p-2 focus:border-blue-500 outline-none">
                                    <option>GTC (Good Till Cancel)</option>
                                    <option>IOC (Immediate or Cancel)</option>
                                    <option>FOK (Fill or Kill)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-400 mb-2 block">Reason / Comment</label>
                            <input 
                                type="text" 
                                placeholder="e.g. News Breakout"
                                value={manualReason}
                                onChange={(e) => setManualReason(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg p-3 focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-auto">
                             <button 
                                onClick={() => handleManualTrade('BUY')}
                                className="flex flex-col items-center justify-center p-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-900/30 group"
                             >
                                 <TrendingUp className="w-6 h-6 text-emerald-100 mb-1 group-hover:scale-110 transition-transform" />
                                 <span className="text-lg font-bold text-white">BUY</span>
                             </button>
                             <button 
                                onClick={() => handleManualTrade('SELL')}
                                className="flex flex-col items-center justify-center p-4 bg-rose-600 hover:bg-rose-500 rounded-xl transition-all active:scale-95 shadow-lg shadow-rose-900/30 group"
                             >
                                 <TrendingDown className="w-6 h-6 text-rose-100 mb-1 group-hover:scale-110 transition-transform" />
                                 <span className="text-lg font-bold text-white">SELL</span>
                             </button>
                        </div>
                    </div>
               </Card>
          </div>
      </div>
  );

  const renderPortfolio = () => {
    // Determine JSON formatting colors
    const syntaxHighlight = (json: string) => {
        return (
            <pre className="text-[10px] font-mono leading-relaxed whitespace-pre-wrap text-slate-300">
                {json}
            </pre>
        );
    };

    const openPnL = accountState ? accountState.equity - accountState.balance : 0;
    const exposure = activePositions.reduce((acc, p) => acc + p.entryPrice, 0);

    return (
        <div className="space-y-6 animate-in fade-in h-full flex flex-col">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Live Portfolio</h2>
                    <p className="text-xs text-slate-500">Real-time Account Financials & Exposure</p>
                </div>
                <div className="flex gap-2">
                    {bridgeConnected 
                        ? <Badge type="success">SOCKET CONNECTED</Badge> 
                        : <Badge type="danger">SOCKET DISCONNECTED</Badge>
                    }
                </div>
            </div>

            {/* Financials Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="border-l-4 border-l-blue-500">
                     <div className="text-slate-400 text-[10px] uppercase font-bold mb-2">Balance</div>
                     {accountState ? (
                        <div className="text-2xl font-mono font-bold text-white">
                            {accountState.balance.toLocaleString(undefined, {style: 'currency', currency: 'USD'})}
                        </div>
                     ) : <div className="text-2xl font-mono text-slate-500 animate-pulse">---</div>}
                     <div className="text-[10px] text-slate-500 mt-1">Settled Cash</div>
                </Card>
                <Card className="border-l-4 border-l-purple-500">
                     <div className="text-slate-400 text-[10px] uppercase font-bold mb-2">Equity</div>
                     {accountState ? (
                        <div className="text-2xl font-mono font-bold text-white">
                            {accountState.equity.toLocaleString(undefined, {style: 'currency', currency: 'USD'})}
                        </div>
                     ) : <div className="text-2xl font-mono text-slate-500 animate-pulse">---</div>}
                     <div className="text-[10px] text-slate-500 mt-1">Floating Value</div>
                </Card>
                <Card className={totalUnrealizedPnL >= 0 ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-rose-500"}>
                     <div className="text-slate-400 text-[10px] uppercase font-bold mb-2">Floating PnL</div>
                     {accountState ? (
                        <div className={`text-2xl font-mono font-bold ${totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {totalUnrealizedPnL >= 0 ? '+' : ''}{totalUnrealizedPnL.toLocaleString(undefined, {style: 'currency', currency: 'USD'})}
                        </div>
                     ) : <div className="text-2xl font-mono text-slate-500 animate-pulse">---</div>}
                     <div className="text-[10px] text-slate-500 mt-1">Est. Open PnL</div>
                </Card>
                <Card className="border-l-4 border-l-amber-500">
                     <div className="text-slate-400 text-[10px] uppercase font-bold mb-2">Total Exposure</div>
                     <div className="text-2xl font-mono font-bold text-white">
                        {exposure.toLocaleString(undefined, {style: 'currency', currency: 'USD'})}
                     </div>
                     <div className="text-[10px] text-slate-500 mt-1">Gross Notional Value</div>
                </Card>
            </div>

            {/* Account Health / Visuals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <h3 className="font-bold text-white text-sm mb-4">Account Health</h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-400">Equity Usage</span>
                                <span className="text-white font-mono">
                                    {accountState ? ((exposure / accountState.equity) * 100).toFixed(1) : 0}%
                                </span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-blue-500 transition-all duration-500"
                                    style={{ width: `${accountState ? Math.min((exposure / accountState.equity) * 100, 100) : 0}%` }}
                                ></div>
                            </div>
                        </div>
                        <div>
                             <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-400">Drawdown Buffer</span>
                                <span className="text-emerald-400 font-mono">SAFE</span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-[95%]"></div>
                            </div>
                        </div>
                    </div>
                </Card>
                <Card className="flex flex-col justify-center">
                     <div className="flex items-center gap-4">
                         <div className="p-3 rounded-full bg-slate-800 text-slate-400">
                             <Database className="w-6 h-6" />
                         </div>
                         <div>
                             <div className="text-sm font-bold text-white">Data Stream Status</div>
                             <div className="text-xs text-slate-500">Latency: <span className="text-emerald-400 font-mono">~24ms</span> • Packets: <span className="text-blue-400 font-mono">OK</span></div>
                         </div>
                     </div>
                </Card>
            </div>

            {/* Raw Streams */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                <div className="flex flex-col gap-4 h-full">
                    <div className="bg-slate-900 rounded-xl border border-slate-800 flex flex-col flex-1 overflow-hidden">
                        <div className="p-3 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-2">
                                <Database className="w-3 h-3" /> MARKET_DATA
                            </span>
                        </div>
                        <div className="p-4 overflow-auto flex-1 bg-black/40 custom-scrollbar">
                            {Object.keys(marketPrices).length > 0 ? (
                                syntaxHighlight(JSON.stringify(marketPrices, null, 2))
                            ) : (
                                <div className="text-slate-600 text-xs italic">Waiting for tick data...</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4 h-full">
                     <div className="bg-slate-900 rounded-xl border border-slate-800 flex flex-col flex-1 overflow-hidden">
                        <div className="p-3 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-blue-400 flex items-center gap-2">
                                <Server className="w-3 h-3" /> STRATEGY_STATE
                            </span>
                        </div>
                        <div className="p-4 overflow-auto flex-1 bg-black/40 custom-scrollbar">
                             {syntaxHighlight(JSON.stringify(strategyState, null, 2))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const renderStrategy = () => (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
          {/* Hidden File Input */}
          <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept=".json"
          />

          <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Sliders className="w-6 h-6 text-emerald-400" />
                    Strategy Builder
                </h2>
                <p className="text-xs text-slate-500 mt-1">Active Engine: <span className="text-emerald-400 font-bold">{activeStrategyName}</span></p>
              </div>
              <div className="flex gap-2">
                  <button 
                    onClick={handleApplyConfig}
                    className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 hover:bg-slate-700 hover:text-white flex items-center gap-2 transition-all"
                  >
                      <Save className="w-3 h-3" /> APPLY CONFIGURATION
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all"
                  >
                      <Upload className="w-3 h-3" /> LOAD STRATEGY FROM FILE
                  </button>
              </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Cpu className="w-4 h-4 text-slate-400" /> Core Logic</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs text-slate-400 mb-1 block">Strategy Algorithm</label>
                          <select value={strategyType} onChange={(e) => setStrategyType(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded p-2.5 outline-none focus:border-emerald-500">
                              <option>Institutional 9-Layer</option>
                              <option>Multi-Timeframe Trend</option>
                              <option>Liquidity Sweep Scalper</option>
                              <option>HFT Scalper (1M)</option>
                          </select>
                      </div>
                       <div>
                          <label className="text-xs text-slate-400 mb-1 block">Execution Timeframe</label>
                          <div className="flex gap-2">
                              {['5M', '15M', '1H', '6H', '1D'].map(t => (
                                  <button key={t} onClick={() => setTimeframe(t)} className={`flex-1 py-2 rounded text-xs font-bold border ${timeframe === t ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>{t}</button>
                              ))}
                          </div>
                      </div>
                  </div>
              </Card>
              <Card>
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2"><FileJson className="w-4 h-4 text-slate-400" /> Live Logic Preview</h3>
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 leading-relaxed min-h-[150px] relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 bg-slate-900/50 text-[10px] text-slate-500">9-LAYER STACK</div>
                      {strategyType === 'Institutional 9-Layer' && (
                          <>
                           // LAYER 1-4: ZLMA Golden Consensus<br/>
                           IF (Scalp &amp; Swing &amp; Trend &amp; Base == DIR) THEN VALID<br/>
                           // LAYER 5-7: Structure &amp; PA<br/>
                           CONFIRM WITH (OrderBlocks + FVG + SRMTF Break)<br/>
                           // LAYER 8-9: Flow &amp; Reversal<br/>
                           VALIDATE (Whale Delta + CVD Div + %B Adapt)<br/>
                           STRENGTH: GOLDEN | DIAMOND | GOD_TIER
                          </>
                      )}
                      {strategyType === 'Multi-Timeframe Trend' && (
                          <>
                           // ANCHOR: 1D Trend Detection<br/>
                           CHECK (ZLMA_E4 &gt; Price) -&gt; BULLISH BIAS<br/>
                           // MONITOR: 1H Execution<br/>
                           WAIT (Consensus + MHMA Align with Anchor)<br/>
                           EXECUTE ON (1H Trigger)
                          </>
                      )}
                      {strategyType === 'Liquidity Sweep Scalper' && (
                          <>
                           // LIQUIDITY ENGINE<br/>
                           IF (Price Sweeps LVL) AND (Wick &gt; 50%) THEN<br/>
                              CHECK (Institutional RVOL &gt; 1.1)<br/>
                              IF (Grab Detected) THEN ENTER REVERSAL<br/>
                           END IF
                          </>
                      )}
                  </div>
              </Card>
          </div>
          <Card>
              <h3 className="font-bold text-white mb-4">Parameter Optimization</h3>
               <div className="grid grid-cols-3 gap-6">
                   <div>
                       <label className="text-xs text-slate-400 mb-1 block">Fast MA Period</label>
                       <input 
                           type="number" 
                           value={fastPeriod}
                           onChange={(e) => setFastPeriod(parseInt(e.target.value))}
                           className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded p-2 focus:border-emerald-500 outline-none" 
                        />
                   </div>
                   <div>
                       <label className="text-xs text-slate-400 mb-1 block">Slow MA Period</label>
                       <input 
                            type="number" 
                            value={slowPeriod}
                            onChange={(e) => setSlowPeriod(parseInt(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded p-2 focus:border-emerald-500 outline-none" 
                        />
                   </div>
                   <div>
                       <label className="text-xs text-slate-400 mb-1 block">RSI Threshold</label>
                       <input 
                            type="number" 
                            value={rsiThreshold}
                            onChange={(e) => setRsiThreshold(parseInt(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded p-2 focus:border-emerald-500 outline-none" 
                        />
                   </div>
               </div>
          </Card>
      </div>
  );

  const renderRisk = () => (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in">
           <h2 className="text-2xl font-bold text-white">Risk Management</h2>
           <Card className="border-t-4 border-t-rose-500">
               <div className="flex items-center justify-between mb-6">
                   <div>
                        <h3 className="font-bold text-white text-lg">Capital Protection</h3>
                        <p className="text-xs text-slate-400">Hard limits enforced by the engine.</p>
                   </div>
                   <div className="flex items-center gap-2">
                       <span className="text-xs font-bold text-slate-400">Auto-Pause</span>
                       <button onClick={() => setAutoPause(!autoPause)} className={`w-12 h-6 rounded-full transition-colors relative ${autoPause ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                           <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoPause ? 'left-7' : 'left-1'}`}></div>
                       </button>
                   </div>
               </div>
               <div className="space-y-6">
                   <div>
                       <div className="flex justify-between mb-2">
                           <label className="text-sm text-slate-300">Max Risk Per Trade (%)</label>
                           <span className="font-bold text-white">{riskPerStack}%</span>
                       </div>
                       <input type="range" min="0.1" max="5.0" step="0.1" value={riskPerStack} onChange={(e) => setRiskPerStack(parseFloat(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                   </div>
                   <div>
                       <div className="flex justify-between mb-2">
                           <label className="text-sm text-slate-300">Daily Max Loss Limit (%)</label>
                           <span className="font-bold text-rose-400">{dailyMaxLoss}%</span>
                       </div>
                       <input type="range" min="1.0" max="10.0" step="0.5" value={dailyMaxLoss} onChange={(e) => setDailyMaxLoss(parseFloat(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500" />
                   </div>
                   <div>
                       <div className="flex justify-between mb-2">
                           <label className="text-sm text-slate-300">Max Account Drawdown Halt (%)</label>
                           <span className="font-bold text-rose-500">{maxDrawdown}%</span>
                       </div>
                       <input type="range" min="5.0" max="20.0" step="1.0" value={maxDrawdown} onChange={(e) => setMaxDrawdown(parseFloat(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-600" />
                   </div>
                   
                   <div className="pt-4">
                       <button 
                         onClick={handleSaveRisk}
                         className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"
                       >
                           <ShieldCheck className="w-4 h-4" /> SAVE RISK CONFIGURATION
                       </button>
                   </div>
               </div>
           </Card>
      </div>
  );

  const renderTrades = () => (
      <div className="space-y-6 animate-in fade-in">
          <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Live Positions</h2>
              <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <button 
                    onClick={() => setActiveTradesTab('active')}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${activeTradesTab === 'active' ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Active ({activePositions.length})
                  </button>
                  <button 
                    onClick={() => setActiveTradesTab('pending')}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${activeTradesTab === 'pending' ? 'bg-blue-500/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Pending ({pendingOrders.length})
                  </button>
              </div>
          </div>
          <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                {activeTradesTab === 'active' ? (
                  <table className="w-full text-sm text-left text-slate-400">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-900 border-b border-slate-800">
                          <tr>
                              <th className="px-6 py-4">Symbol</th>
                              <th className="px-6 py-4">Type</th>
                              <th className="px-6 py-4">Vol</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4">Reason</th>
                              <th className="px-6 py-4">Entry</th>
                              <th className="px-6 py-4">Current</th>
                              <th className="px-6 py-4">PnL</th>
                              <th className="px-6 py-4">Time</th>
                              <th className="px-6 py-4 text-right">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                          {activePositions.length === 0 ? (
                              <tr><td colSpan={10} className="px-6 py-12 text-center text-slate-600 italic">No active positions. Scanning markets...</td></tr>
                          ) : (
                              activePositions.map((pos, i) => (
                                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                      <td className="px-6 py-4 font-bold text-white">{pos.symbol}</td>
                                      <td className="px-6 py-4"><Badge type={pos.type === 'LONG' ? 'success' : 'danger'}>{pos.type}</Badge></td>
                                      <td className="px-6 py-4 font-mono text-slate-300">{pos.volume}</td>
                                      <td className="px-6 py-4">
                                          <Badge type="success">FILLED</Badge>
                                      </td>
                                      <td className="px-6 py-4 text-xs font-mono text-slate-400">{pos.reason}</td>
                                      <td className="px-6 py-4 font-mono">${pos.entryPrice.toFixed(2)}</td>
                                      <td className="px-6 py-4 font-mono">${(marketPrices[pos.symbol] || 0).toFixed(2)}</td>
                                      <td className={`px-6 py-4 font-bold font-mono ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                          {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}
                                      </td>
                                      <td className="px-6 py-4 text-xs">{pos.time}</td>
                                      <td className="px-6 py-4 text-right">
                                          <button 
                                            onClick={() => handleCloseSymbol(pos.symbol, pos.ticket, pos.volume)}
                                            className="text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                                          >
                                            Close
                                          </button>
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
                ) : (
                  <table className="w-full text-sm text-left text-slate-400">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-900 border-b border-slate-800">
                          <tr>
                              <th className="px-6 py-4">Ticket</th>
                              <th className="px-6 py-4">Symbol</th>
                              <th className="px-6 py-4">Bias</th>
                              <th className="px-6 py-4">Vol</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4">Current Price</th>
                              <th className="px-6 py-4">Limit Price</th>
                              <th className="px-6 py-4 text-right">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                          {pendingOrders.length === 0 ? (
                              <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-600 italic">No pending orders. All systems locked.</td></tr>
                          ) : (
                              pendingOrders.map((ord, i) => (
                                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{ord.ticket || '-'}</td>
                                      <td className="px-6 py-4 font-bold text-white">{ord.symbol}</td>
                                      <td className="px-6 py-4"><Badge type={ord.bias === 'LONG' ? 'success' : 'danger'}>{ord.bias}</Badge></td>
                                      <td className="px-6 py-4 font-mono text-slate-300">{ord.volume || '-'}</td>
                                      <td className="px-6 py-4">
                                          <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 animate-pulse flex items-center gap-2 w-fit">
                                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
                                              {ord.status}
                                          </span>
                                      </td>
                                      <td className="px-6 py-4 font-mono text-slate-300">${(ord.currentPrice || 0).toFixed(2)}</td>
                                      <td className="px-6 py-4 font-mono text-slate-400 italic">
                                          {ord.limitPrice ? `$${ord.limitPrice.toFixed(2)}` : '-'}
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                          <button 
                                            onClick={() => handleCloseSymbol(ord.symbol, ord.ticket, ord.volume)}
                                            className="text-xs bg-slate-700 text-slate-300 border border-slate-600 px-3 py-1.5 rounded hover:bg-slate-600 hover:text-white transition-all"
                                          >
                                            Cancel
                                          </button>
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
                )}
              </div>
          </Card>
      </div>
  );

  const renderMarket = () => (
      <div className="h-full flex flex-col space-y-4 animate-in fade-in">
          <div className="flex justify-between items-center">
             <div className="flex gap-4 items-center">
                 <h2 className="text-2xl font-bold text-white">Market View</h2>
                 <div className="flex gap-2">
                     {UNIVERSE.map(s => (
                         <button 
                            key={s} 
                            onClick={() => handleSymbolChange(s)} 
                            className={`px-3 py-1 rounded text-xs font-bold border transition-all ${selectedSymbol === s ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}
                         >
                             {s}
                         </button>
                     ))}
                 </div>
             </div>
             <div className="flex gap-2">
                 <Badge type="purple">Vol: LOW</Badge>
                 <Badge type="warning">Regime: RANGING</Badge>
             </div>
          </div>
          <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden relative">
              <LiveChart symbol={selectedSymbol} isActive={true} trendBias={currentSymbolState.trend_bias} currentPrice={marketPrices[selectedSymbol]} symbolState={currentSymbolState} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="h-96 p-0 overflow-hidden bg-transparent border-0 shadow-none col-span-1 md:col-span-1">
                  <Tape symbol={selectedSymbol} price={marketPrices[selectedSymbol]} />
              </Card>
              <Card className="col-span-1 md:col-span-2">
                  <h3 className="font-bold text-white text-sm mb-4">Strategy Lifecycle</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-900 p-3 rounded border border-slate-800">
                          <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">CVD (Whale Flow)</div>
                          <div className={`text-lg font-mono font-bold ${
                              ((currentSymbolState.oscillators?.CVD || currentSymbolState.oscillators?.cvd || 0) > 0) ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                              {(currentSymbolState.oscillators?.CVD || currentSymbolState.oscillators?.cvd || 0).toFixed(2)}
                          </div>
                      </div>
                      <div className="bg-slate-900 p-3 rounded border border-slate-800">
                          <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">%B (Adaptive)</div>
                          <div className="text-lg font-mono font-bold text-blue-400">
                              {(currentSymbolState.oscillators?.PctB || currentSymbolState.oscillators?.pct_b || currentSymbolState.oscillators?.percent_b || 0).toFixed(2)}
                          </div>
                      </div>
                  </div>
                  <LifecycleMonitor 
                        status={
                            activePositions.filter(p => p.symbol === selectedSymbol).length > 1 ? 'SCALING' :
                            activePositions.filter(p => p.symbol === selectedSymbol).length > 0 ? 'LOCKED' :
                            (currentSymbolState.status === 'LOCKED' || currentSymbolState.status === 'INVALIDATED' ? currentSymbolState.status : 'SCANNING')
                        } 
                        trendBias={currentSymbolState.trend_bias} 
                        entryCount={activePositions.filter(p => p.symbol === selectedSymbol).length} 
                    />
                  <ConfluenceMatrix confluence={currentSymbolState.confluence} />
                  <HMAStack 
                      bias={currentSymbolState.trend_bias} 
                      trends={currentSymbolState.hma_trends} 
                  />
                  <div className="mt-4 text-xs text-slate-500 leading-relaxed border-t border-slate-800/50 pt-2">
                      <span className="font-bold text-slate-400">Current Phase:</span> <span className={`font-bold ${currentSymbolState.status === 'LOCKED' ? 'text-emerald-400' : 'text-slate-300'}`}>{currentSymbolState.status}</span>
                  </div>
              </Card>
          </div>
      </div>
  );

  const renderAutomation = () => {
      const handleSaveRule = () => {
          if (!newRule.name) return addLog('warning', 'AUTO', 'Please name your rule');
          
          const rule: AutoRule = {
              id: Date.now(),
              ...newRule,
              active: true
          };
          
          setAutomationRules([...automationRules, rule]);
          setIsRuleModalOpen(false);
          addLog('success', 'AUTO', `Rule Created: ${rule.name}`);
      };

      return (
      <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
           <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Workflow className="w-6 h-6 text-blue-400" />
                  Automation Rules
              </h2>
              {!isRuleModalOpen && (
                  <button 
                    onClick={() => setIsRuleModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20"
                  >
                      <Plus className="w-4 h-4" /> NEW RULE
                  </button>
              )}
           </div>
           
           {isRuleModalOpen ? (
               <Card className="border-t-4 border-t-emerald-500">
                   <h3 className="font-bold text-white mb-6">Configure Logic Criteria</h3>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                       {/* Name */}
                       <div className="md:col-span-2">
                           <label className="text-xs font-bold text-slate-400 mb-2 block">Rule Name</label>
                           <input 
                                type="text" 
                                placeholder="e.g. Buy BTC Dip"
                                value={newRule.name}
                                onChange={(e) => setNewRule({...newRule, name: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg p-3 focus:border-emerald-500 outline-none"
                           />
                       </div>

                       {/* IF Section */}
                       <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 space-y-4">
                           <div className="text-xs font-bold text-emerald-400 uppercase border-b border-slate-800 pb-2 mb-2">IF Condition</div>
                           
                           <div>
                               <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Asset</label>
                               <select 
                                    value={newRule.symbol}
                                    onChange={(e) => setNewRule({...newRule, symbol: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded p-2"
                               >
                                   {UNIVERSE.map(s => <option key={s} value={s}>{s}</option>)}
                               </select>
                           </div>

                           <div className="flex gap-2">
                               <div className="flex-1">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Trigger</label>
                                    <select 
                                        value={newRule.trigger}
                                        onChange={(e) => setNewRule({...newRule, trigger: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded p-2"
                                    >
                                        <option value="PRICE">Price</option>
                                        <option value="RSI">RSI (14)</option>
                                        <option value="HMA">HMA Trend</option>
                                    </select>
                               </div>
                               <div className="w-20">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Op</label>
                                    <select 
                                        value={newRule.operator}
                                        onChange={(e) => setNewRule({...newRule, operator: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded p-2 text-center"
                                    >
                                        <option value="<">&lt;</option>
                                        <option value=">">&gt;</option>
                                        <option value="=">=</option>
                                    </select>
                               </div>
                           </div>

                           <div>
                               <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Threshold Value</label>
                               <input 
                                    type="number" 
                                    value={newRule.threshold}
                                    onChange={(e) => setNewRule({...newRule, threshold: parseFloat(e.target.value)})}
                                    className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded p-2"
                               />
                           </div>
                       </div>

                       {/* THEN Section */}
                       <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 space-y-4">
                           <div className="text-xs font-bold text-blue-400 uppercase border-b border-slate-800 pb-2 mb-2">THEN Action</div>
                           
                           <div>
                               <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Execute</label>
                               <select 
                                    value={newRule.actionType}
                                    onChange={(e) => setNewRule({...newRule, actionType: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded p-2"
                               >
                                   <option value="BUY">BUY (Long)</option>
                                   <option value="SELL">SELL (Short)</option>
                                   <option value="CLOSE">CLOSE POSITION</option>
                                   <option value="ALERT">SEND ALERT</option>
                               </select>
                           </div>

                           {newRule.actionType !== 'CLOSE' && newRule.actionType !== 'ALERT' && (
                               <div>
                                   <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Volume (Lots)</label>
                                   <input 
                                        type="number"
                                        step="0.01"
                                        value={newRule.actionValue}
                                        onChange={(e) => setNewRule({...newRule, actionValue: parseFloat(e.target.value)})}
                                        className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded p-2"
                                   />
                               </div>
                           )}
                       </div>
                   </div>

                   <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                       <button 
                            onClick={() => setIsRuleModalOpen(false)}
                            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                       >
                           CANCEL
                       </button>
                       <button 
                            onClick={handleSaveRule}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all"
                       >
                           SAVE AUTOMATION RULE
                       </button>
                   </div>
               </Card>
           ) : (
               <>
               {automationRules.length === 0 ? (
                   <div className="text-center py-20 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed flex flex-col items-center gap-4">
                       <Workflow className="w-12 h-12 opacity-20" />
                       <p>No automation rules defined.</p>
                       <button onClick={() => setIsRuleModalOpen(true)} className="text-emerald-400 text-xs font-bold hover:underline">Create your first rule</button>
                   </div>
               ) : (
                   <div className="space-y-4">
                       {automationRules.map((rule) => (
                           <Card key={rule.id} className={`flex justify-between items-center transition-all cursor-pointer group border-l-4 ${rule.active ? 'border-l-emerald-500' : 'border-l-slate-700 opacity-75'}`}>
                               <div className="flex items-center gap-4">
                                   <div className={`p-3 rounded-lg ${rule.active ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                                       <Workflow className="w-6 h-6" />
                                   </div>
                                   <div>
                                       <div className="font-bold text-white text-sm">{rule.name}</div>
                                       <div className="text-xs text-slate-500 font-mono mt-1">
                                           <span className="text-emerald-400">IF</span> {rule.symbol} {rule.trigger} {rule.operator} {rule.threshold} <span className="text-blue-400">THEN</span> {rule.actionType} {rule.actionValue > 0 ? `${rule.actionValue} lots` : ''}
                                       </div>
                                   </div>
                               </div>
                               <div className="flex items-center gap-4">
                                   <button 
                                      onClick={() => {
                                          const updated = automationRules.map(r => r.id === rule.id ? {...r, active: !r.active} : r);
                                          setAutomationRules(updated);
                                      }}
                                      className={`px-3 py-1 rounded text-[10px] font-bold border transition-all ${rule.active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}
                                   >
                                       {rule.active ? 'ACTIVE' : 'PAUSED'}
                                   </button>
                                   <button 
                                    onClick={() => setAutomationRules(automationRules.filter(r => r.id !== rule.id))}
                                    className="p-2 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                   >
                                       <Trash2 className="w-4 h-4" />
                                   </button>
                               </div>
                           </Card>
                       ))}
                   </div>
               )}
               </>
           )}
      </div>
      );
  };

  const renderLogs = () => (
      <div className="h-full flex flex-col animate-in fade-in">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">System Logs</h2>
              <div className="flex gap-2">
                  <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input type="text" placeholder="Search logs..." className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-emerald-500" />
                  </div>
                  <button className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-white"><Filter className="w-4 h-4" /></button>
              </div>
          </div>
          <div className="flex-1 bg-black/40 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
               <div className="bg-slate-900/50 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                   <div className="flex flex-1 text-xs font-bold text-slate-500 uppercase">
                       <div className="w-24">Time</div>
                       <div className="w-24">Type</div>
                       <div className="w-32">Source</div>
                       <div className="flex-1">Message</div>
                   </div>
                   <button 
                       onClick={() => {
                           if(confirm('Clear all stored logs?')) {
                               localStorage.removeItem('nhest_logs');
                               setLogs([]);
                           }
                       }}
                       className="ml-4 text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-1 rounded hover:bg-rose-500 hover:text-white transition-all"
                   >
                       CLEAR
                   </button>
               </div>
               <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs custom-scrollbar">
                   {logs.map((log, i) => (
                       <div key={i} className="flex px-2 py-1.5 hover:bg-slate-800/30 rounded transition-colors border-b border-slate-800/30 last:border-0">
                           <div className="w-24 text-slate-500">{log.time}</div>
                           <div className="w-24">
                               <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                                   log.type === 'error' ? 'bg-rose-900/30 text-rose-400 border-rose-800' :
                                   log.type === 'success' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' :
                                   log.type === 'warning' ? 'bg-amber-900/30 text-amber-400 border-amber-800' :
                                   'bg-slate-800 text-slate-400 border-slate-700'
                               }`}>{log.type}</span>
                           </div>
                           <div className="w-32 text-slate-400 font-bold">{log.trigger}</div>
                           <div className="flex-1 text-slate-300">{log.msg}</div>
                       </div>
                   ))}
               </div>
          </div>
      </div>
  );

  const renderAI = () => (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <BrainCircuit className="w-8 h-8 text-purple-500" /> 
              Gemini AI Analyst
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-t-4 border-t-purple-500">
                  <h3 className="font-bold text-white mb-4">Market Context Analysis</h3>
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 min-h-[200px] mb-4 text-sm text-slate-300 leading-relaxed">
                      {aiLoading ? (
                          <div className="flex items-center justify-center h-full text-purple-400 animate-pulse gap-2">
                              <RefreshCw className="w-4 h-4 animate-spin" /> Analyzing Market Structure...
                          </div>
                      ) : aiAnalysis ? aiAnalysis : (
                          <div className="flex items-center justify-center h-full text-slate-500">
                              Ready to analyze {selectedSymbol}
                          </div>
                      )}
                  </div>
                  <button 
                      onClick={handleAIAnalysis}
                      disabled={aiLoading}
                      className="w-full py-3 bg-purple-600/20 text-purple-400 border border-purple-500/50 rounded-lg text-sm font-bold hover:bg-purple-600/30 transition-all flex items-center justify-center gap-2"
                  >
                      <Zap className="w-4 h-4" /> GENERATE INSIGHTS
                  </button>
              </Card>
              <div className="space-y-6">
                   <Card>
                       <h3 className="font-bold text-white mb-2">Trade Confidence Score</h3>
                       {aiScore > 0 ? (
                           <>
                            <div className="flex items-end gap-2 mb-2">
                                <span className={`text-4xl font-bold ${aiScore >= 80 ? 'text-emerald-400' : aiScore >= 60 ? 'text-blue-400' : 'text-slate-400'}`}>{aiScore}</span>
                                <span className="text-sm text-slate-400 mb-1">/ 100</span>
                            </div>
                            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-1000 ${aiScore >= 80 ? 'bg-emerald-500' : aiScore >= 60 ? 'bg-blue-500' : 'bg-slate-500'}`} 
                                    style={{width: `${aiScore}%`}}
                                ></div>
                            </div>
                           </>
                       ) : (
                           <div className="text-slate-500 text-xs italic py-4">Run analysis to calculate score</div>
                       )}
                   </Card>
                   <Card>
                       <h3 className="font-bold text-white mb-2">Bias Detection</h3>
                       {aiScore > 0 ? (
                           <div className="flex gap-2">
                               <Badge type={aiBias.includes('BUY') ? 'success' : aiBias.includes('SELL') ? 'danger' : 'neutral'}>{aiBias}</Badge>
                               <Badge type="neutral">INSTITUTIONAL FLOW</Badge>
                           </div>
                       ) : (
                           <div className="text-slate-500 text-xs italic py-4">Waiting for inputs...</div>
                       )}
                   </Card>
              </div>
          </div>
      </div>
  );

  const renderAnalytics = () => {
      // --- ADVANCED CALCULATIONS ---
      const trades = closedTrades.filter(t => t.finalStatus === 'FILLED');
      const wins = trades.filter(t => (t.pnl || 0) > 0);
      const losses = trades.filter(t => (t.pnl || 0) <= 0);
      
      const totalProfit = wins.reduce((acc, t) => acc + (t.pnl || 0), 0);
      const totalLoss = Math.abs(losses.reduce((acc, t) => acc + (t.pnl || 0), 0));
      
      const profitFactor = totalLoss > 0 ? (totalProfit / totalLoss) : totalProfit > 0 ? 100 : 0;
      const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
      
      const avgWin = wins.length > 0 ? totalProfit / wins.length : 0;
      const avgLoss = losses.length > 0 ? totalLoss / losses.length : 0;
      const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
      
      // Expectancy: (WinRate * AvgWin) - (LossRate * AvgLoss)
      const expectancy = trades.length > 0 ? ((winRate/100) * avgWin) - ((1 - winRate/100) * avgLoss) : 0;
      
      const bestTrade = Math.max(...trades.map(t => t.pnl || 0), 0);
      const worstTrade = Math.min(...trades.map(t => t.pnl || 0), 0);

      // Group by Symbol
      const symPerformance: Record<string, number> = {};
      trades.forEach(t => {
          symPerformance[t.symbol] = (symPerformance[t.symbol] || 0) + (t.pnl || 0);
      });

      return (
      <div className="space-y-6 animate-in fade-in pb-20">
           <div className="flex justify-between items-end">
               <div>
                   <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                       <BarChart3 className="w-8 h-8 text-emerald-400" />
                       Intelligence Suite
                   </h2>
                   <p className="text-slate-500 text-sm mt-1">Institutional performance auditing & risk metrics</p>
               </div>
               <div className="flex gap-3">
                   <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-col items-end">
                       <span className="text-[10px] font-bold text-emerald-500 uppercase">System Health</span>
                       <span className="text-sm font-mono font-bold text-emerald-400">{profitFactor > 1.5 ? 'OPTIMAL' : 'STABLE'}</span>
                   </div>
                   <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl flex flex-col items-end">
                       <span className="text-[10px] font-bold text-blue-500 uppercase">Edge Quality</span>
                       <span className="text-sm font-mono font-bold text-blue-400">{expectancy > 0 ? 'POSITIVE' : 'NEGATIVE'}</span>
                   </div>
               </div>
           </div>
           
           {/* Tier 1: Primary KPIs */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <Card className="relative overflow-hidden group">
                   <div className="absolute -right-2 -top-2 opacity-10 group-hover:scale-110 transition-transform">
                       <Target className="w-16 h-16" />
                   </div>
                   <div className="text-slate-500 text-[10px] font-bold uppercase mb-1">Profit Factor</div>
                   <div className={`text-3xl font-mono font-bold ${profitFactor >= 2 ? 'text-emerald-400' : profitFactor >= 1 ? 'text-blue-400' : 'text-rose-400'}`}>
                       {profitFactor.toFixed(2)}
                   </div>
                   <div className="mt-2 flex items-center gap-1">
                       <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                           <div className="h-full bg-emerald-500" style={{width: `${Math.min(profitFactor * 30, 100)}%`}}></div>
                       </div>
                   </div>
               </Card>

               <Card className="relative overflow-hidden group">
                   <div className="absolute -right-2 -top-2 opacity-10 group-hover:scale-110 transition-transform">
                       <Award className="w-16 h-16" />
                   </div>
                   <div className="text-slate-500 text-[10px] font-bold uppercase mb-1">Win Rate</div>
                   <div className="text-3xl font-mono font-bold text-white">{winRate.toFixed(1)}%</div>
                   <div className="text-xs text-slate-500 mt-2">{wins.length}W / {losses.length}L</div>
               </Card>

               <Card className="relative overflow-hidden group">
                   <div className="absolute -right-2 -top-2 opacity-10 group-hover:scale-110 transition-transform">
                       <Gauge className="w-16 h-16" />
                   </div>
                   <div className="text-slate-500 text-[10px] font-bold uppercase mb-1">Expectancy</div>
                   <div className={`text-3xl font-mono font-bold ${expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                       {expectancy >= 0 ? '+' : ''}${expectancy.toFixed(2)}
                   </div>
                   <div className="text-[10px] text-slate-500 mt-2">Avg. Value Per Trade</div>
               </Card>

               <Card className="relative overflow-hidden group">
                   <div className="absolute -right-2 -top-2 opacity-10 group-hover:scale-110 transition-transform">
                       <ShieldAlert className="w-16 h-16" />
                   </div>
                   <div className="text-slate-500 text-[10px] font-bold uppercase mb-1">Max Drawdown</div>
                   <div className="text-3xl font-mono font-bold text-rose-500">
                       {accountState?.max_drawdown?.toFixed(2) || '0.00'}%
                   </div>
                   <div className="text-[10px] text-slate-500 mt-2">Peak-to-Trough</div>
               </Card>
           </div>

           {/* Tier 2: Distribution & Equity */}
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <Card className="lg:col-span-2 h-[400px] flex flex-col">
                   <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-white text-sm flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-400" /> 
                            Cumulative Performance Curve
                        </h3>
                        <div className="flex gap-2">
                            <button className="px-2 py-1 bg-slate-800 text-[10px] font-bold text-white rounded">EQUITY</button>
                            <button className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-white transition-colors">DRAWDOWN</button>
                        </div>
                   </div>
                   
                   <div className="flex-1 w-full relative">
                       {sessionEquity.length > 2 ? (
                           <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                               <defs>
                                   <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="0%" stopColor="#10b981" stopOpacity="0.2"/>
                                       <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
                                   </linearGradient>
                               </defs>
                               {/* Grid */}
                               {[0, 25, 50, 75, 100].map(y => (
                                   <line key={y} x1="0" y1={`${y}%`} x2="100%" y2={`${y}%`} stroke="#1e293b" strokeWidth="1" />
                               ))}
                               {(() => {
                                   const max = Math.max(...sessionEquity);
                                   const min = Math.min(...sessionEquity);
                                   const range = max - min || 1;
                                   const points = sessionEquity.map((val, i) => {
                                       const x = (i / (sessionEquity.length - 1)) * 100;
                                       const y = 100 - ((val - min) / range) * 80 - 10;
                                       return `${x}%,${y}%`;
                                   }).join(' ');
                                   return (
                                       <>
                                        <polyline fill="none" stroke="#10b981" strokeWidth="3" points={points} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                                        <polygon points={`${points} 100%,100% 0%,100%`} fill="url(#curveGradient)" />
                                       </>
                                   );
                               })()}
                           </svg>
                       ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-2 bg-slate-900/20 rounded-xl border border-slate-800 border-dashed">
                                <Activity className="w-8 h-8 opacity-50 animate-pulse" />
                                <span className="text-xs font-mono">INSFFICIENT DATA FOR CURVE RENDERING</span>
                            </div>
                       )}
                   </div>
               </Card>

               <Card className="h-[400px] flex flex-col">
                   <h3 className="font-bold text-white text-sm mb-6 flex items-center gap-2">
                       <PieChart className="w-4 h-4 text-blue-400" />
                       Asset Alpha Distribution
                   </h3>
                   <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                       {Object.entries(symPerformance).sort((a,b) => b[1] - a[1]).map(([sym, pnl]) => (
                           <div key={sym}>
                               <div className="flex justify-between items-center text-xs mb-1.5">
                                   <span className="font-bold text-slate-300">{sym}</span>
                                   <span className={`font-mono font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                       {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                                   </span>
                               </div>
                               <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                   <div 
                                       className={`h-full transition-all duration-1000 ${pnl >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                                       style={{width: `${Math.min(Math.abs(pnl) / (totalProfit || 1) * 100, 100)}%`}}
                                   ></div>
                               </div>
                           </div>
                       ))}
                       {Object.keys(symPerformance).length === 0 && (
                           <div className="flex flex-col items-center justify-center h-full text-slate-600 italic text-xs">
                               No historical data found.
                           </div>
                       )}
                   </div>
               </Card>
           </div>

           {/* Tier 3: Efficiency & Timing */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card>
                   <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
                       <Fingerprint className="w-4 h-4 text-purple-400" />
                       Efficiency Signature
                   </h3>
                   <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                           <div className="text-slate-500 text-[10px] font-bold uppercase">Avg Win</div>
                           <div className="text-xl font-mono font-bold text-emerald-400 mt-1">${avgWin.toFixed(2)}</div>
                       </div>
                       <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                           <div className="text-slate-500 text-[10px] font-bold uppercase">Avg Loss</div>
                           <div className="text-xl font-mono font-bold text-rose-400 mt-1">${avgLoss.toFixed(2)}</div>
                       </div>
                       <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                           <div className="text-slate-500 text-[10px] font-bold uppercase">Best Trade</div>
                           <div className="text-xl font-mono font-bold text-white mt-1">${bestTrade.toFixed(2)}</div>
                       </div>
                       <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                           <div className="text-slate-500 text-[10px] font-bold uppercase">Worst Trade</div>
                           <div className="text-xl font-mono font-bold text-white mt-1">${worstTrade.toFixed(2)}</div>
                       </div>
                   </div>
               </Card>

               <Card>
                   <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
                       <Clock className="w-4 h-4 text-amber-400" />
                       Risk/Reward Dynamics
                   </h3>
                   <div className="space-y-6">
                       <div>
                           <div className="flex justify-between text-xs mb-2">
                               <span className="text-slate-400 uppercase font-bold">R:R Efficiency Ratio</span>
                               <span className="text-white font-mono font-bold">{riskRewardRatio.toFixed(2)}</span>
                           </div>
                           <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
                               <div className="h-full bg-emerald-500" style={{width: `${(riskRewardRatio / (riskRewardRatio + 1)) * 100}%`}}></div>
                               <div className="h-full bg-rose-500" style={{width: `${(1 / (riskRewardRatio + 1)) * 100}%`}}></div>
                           </div>
                           <div className="flex justify-between text-[10px] mt-1 text-slate-500 font-bold">
                               <span>REWARD</span>
                               <span>RISK</span>
                           </div>
                       </div>
                       
                       <div className="pt-4 border-t border-slate-800">
                           <div className="flex items-center gap-3">
                               <div className={`p-2 rounded-lg ${expectancy > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                   {expectancy > 0 ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
                               </div>
                               <div>
                                   <div className="text-xs font-bold text-white">Mathematical Edge</div>
                                   <div className="text-[10px] text-slate-500">System is currently yielding <span className="text-emerald-400 font-bold">${expectancy.toFixed(2)}</span> theoretical profit per deployment.</div>
                               </div>
                           </div>
                       </div>
                   </div>
               </Card>
           </div>
      </div>
  );
  };

  const renderSignals = () => (
      <div className="space-y-6 animate-in fade-in h-full flex flex-col">
          <div className="flex justify-between items-center">
              <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <Radio className="w-6 h-6 text-blue-400" />
                      Signal Wire
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">TradingView Webhook Ledger • Raw Payload Inspector</p>
              </div>
              <div className="flex gap-2">
                  <Badge type="neutral">{webhookLogs.length} SIGNALS</Badge>
                  <button 
                    onClick={() => setWebhookLogs([])}
                    className="px-3 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded hover:bg-slate-700 hover:text-white"
                  >
                      CLEAR LOG
                  </button>
              </div>
          </div>

          <Card className="flex-1 p-0 overflow-hidden flex flex-col">
              <div className="bg-slate-900 px-6 py-3 border-b border-slate-800 grid grid-cols-12 gap-4 text-xs font-bold text-slate-500 uppercase">
                  <div className="col-span-2">Time</div>
                  <div className="col-span-1">Source</div>
                  <div className="col-span-2">Symbol</div>
                  <div className="col-span-1">Action</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-5">Payload Data</div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {webhookLogs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                          <Radio className="w-8 h-8 opacity-20" />
                          <span className="text-xs font-mono">WAITING FOR SIGNALS...</span>
                      </div>
                  ) : (
                      webhookLogs.map((hook, i) => (
                          <div key={i} className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors text-xs items-center font-mono">
                              <div className="col-span-2 text-slate-400">{hook.time}</div>
                              <div className="col-span-1 text-blue-400 font-bold">{hook.source || 'TV'}</div>
                              <div className="col-span-2 font-bold text-white">{hook.symbol}</div>
                              <div className="col-span-1">
                                  <span className={`font-bold ${
                                      hook.action.toUpperCase().includes('BUY') ? 'text-emerald-400' : 
                                      hook.action.toUpperCase().includes('SELL') ? 'text-rose-400' : 'text-slate-300'
                                  }`}>
                                      {hook.action.toUpperCase()}
                                  </span>
                              </div>
                              <div className="col-span-1">
                                  <Badge type={hook.status === 'PROCESSED' ? 'success' : hook.status === 'REJECTED' ? 'danger' : 'warning'}>
                                      {hook.status}
                                  </Badge>
                              </div>
                              <div className="col-span-5">
                                  <code className="text-[10px] text-slate-500 break-all">{JSON.stringify(hook.payload)}</code>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </Card>
      </div>
  );

  const renderSettings = () => (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in">
           <h2 className="text-2xl font-bold text-white">Settings & Security</h2>
           
           <Card>
               <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                   <Share2 className="w-5 h-5 text-blue-400" /> 
                   TradingView Webhook Integration
               </h3>
               <div className="space-y-4">
                   <div className="bg-slate-950/50 p-4 rounded border border-slate-800">
                       <p className="text-xs text-slate-400 mb-2">
                           Configure your TradingView Alerts to send JSON data to the following URL. 
                           This will trigger the bot and forward execution to your MT5 connector.
                       </p>
                       <div className="flex items-center gap-2 mb-4">
                           <div className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-slate-300">
                               {API_URL}/webhook
                           </div>
                           <button className="p-2 bg-slate-800 border border-slate-700 rounded hover:text-white text-slate-400">
                               <Copy className="w-4 h-4" />
                           </button>
                       </div>
                       
                       <label className="text-xs font-bold text-white block mb-2">Payload Template (JSON)</label>
                       <pre className="bg-black/50 p-3 rounded border border-slate-800 text-[10px] font-mono text-emerald-300 leading-relaxed overflow-x-auto">
{`{
  "secret": "nhest_secret",
  "symbol": "BTCUSD",
  "action": "buy",
  "volume": 0.01
}`}
                       </pre>
                       <div className="mt-2 text-[10px] text-slate-500">
                           * Supported Actions: buy, sell, close, unlock
                       </div>
                   </div>
               </div>
           </Card>

           <Card>
               <h3 className="font-bold text-white mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" /> Security</h3>
               <div className="space-y-4">
                   <div>
                       <label className="text-xs text-slate-400 mb-1 block">API Key (Gemini)</label>
                       <input type="password" value="************************" disabled className="w-full bg-slate-900 border border-slate-700 text-slate-500 text-sm rounded p-2" />
                   </div>
                   <div className="flex items-center justify-between p-3 bg-slate-900 rounded border border-slate-700">
                       <span className="text-sm text-white">Two-Factor Authentication</span>
                       <Badge type="success">ENABLED</Badge>
                   </div>
                   <div className="flex items-center justify-between p-3 bg-slate-900 rounded border border-slate-700">
                       <span className="text-sm text-white">IP Whitelist</span>
                       <Badge type="neutral">192.168.1.1</Badge>
                   </div>
               </div>
           </Card>
      </div>
  );

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/30 overflow-hidden relative">
      {/* Interactive Background Layers */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Subtle Dynamic Grid */}
          <div 
              className="absolute inset-0 opacity-[0.02]" 
              style={{ 
                  backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
                  backgroundSize: '50px 50px'
              }}
          ></div>
          
          {/* Pulse Glows */}
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 blur-[120px] rounded-full animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full relative z-20">
        <Sidebar activeView={activeView} onSelect={handleViewChange} onLogout={handleLogout} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden animate-in fade-in duration-200" onClick={() => setIsMobileMenuOpen(false)}>
            <div 
                className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 shadow-2xl animate-in slide-in-from-left duration-300 border-r border-slate-800"
                onClick={e => e.stopPropagation()}
            >
                <Sidebar 
                    activeView={activeView} 
                    onSelect={(view) => {
                        handleViewChange(view);
                        setIsMobileMenuOpen(false);
                    }} 
                    onLogout={handleLogout} 
                />
            </div>
            {/* Close Button */}
            <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-white md:hidden"
            >
                <XCircle className="w-6 h-6" />
            </button>
        </div>
      )}
      
      <main className="flex-1 overflow-hidden flex flex-col relative w-full">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center justify-between px-4 md:px-6 flex-none z-10">
             <div className="flex items-center gap-3 text-sm text-slate-400">
                 {/* Mobile Menu Button */}
                 <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                 >
                     <Menu className="w-6 h-6" />
                 </button>
                 
                 <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                    <span className="capitalize font-bold text-white md:font-normal md:text-slate-400">{activeView.replace('-', ' ')}</span>
                    <div className="flex items-center gap-2 mt-1 md:mt-0">
                        {bridgeConnected ? (
                            Object.keys(marketPrices).length > 0 ? (
                                <Badge type="success">LIVE STREAMING</Badge>
                            ) : (
                                <Badge type="warning">SYNCING ENGINE...</Badge>
                            )
                        ) : (
                            <Badge type="danger">OFFLINE</Badge>
                        )}
                    </div>
                 </div>
             </div>
             <div className="flex items-center gap-4">
                 <div className="text-right hidden sm:block">
                     <div className="text-xs text-slate-400">Est. Unrealized PnL</div>
                     <div className={`text-sm font-bold font-mono ${totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {totalUnrealizedPnL >= 0 ? '+' : ''}{totalUnrealizedPnL.toLocaleString(undefined, {minimumFractionDigits: 2})}
                     </div>
                 </div>
                 {/* Profile Menu */}
                 <div className="relative">
                     <button 
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-slate-800 shadow-lg hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                     >
                         AD
                     </button>
                     
                     {isProfileOpen && (
                         <>
                             <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)}></div>
                             <div className="absolute right-0 top-10 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                 <div className="px-4 py-3 border-b border-slate-800">
                                     <p className="text-xs font-bold text-white">Admin User</p>
                                     <p className="text-[10px] text-emerald-400 font-mono">ACCESS: LEVEL 1</p>
                                 </div>
                                 <div className="py-1">
                                     <button onClick={() => { handleViewChange('settings'); setIsProfileOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2">
                                         <Sliders className="w-3 h-3" /> Preferences
                                     </button>
                                     <button onClick={() => { handleViewChange('logs'); setIsProfileOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2">
                                         <ShieldCheck className="w-3 h-3" /> Security Log
                                     </button>
                                 </div>
                                 <div className="border-t border-slate-800 py-1">
                                     <button 
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                                     >
                                         <XCircle className="w-3 h-3" /> Sign Out
                                     </button>
                                 </div>
                             </div>
                         </>
                     )}
                 </div>
             </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative">
             {activeView === 'dashboard' && renderDashboard()}
             {activeView === 'portfolio' && renderPortfolio()}
             {activeView === 'manual' && renderManual()}
             {activeView === 'strategy' && renderStrategy()}
             {activeView === 'risk' && renderRisk()}
             {activeView === 'trades' && renderTrades()}
             {activeView === 'history' && <RecentTrades 
                 activePositions={activePositions} 
                 closedTrades={closedTrades} 
                 logs={logs} 
                 onClearHistory={() => {
                     if(confirm('Clear persistent trade history?')) {
                         updateHistory([]);
                     }
                 }}
             />}
             {activeView === 'market' && renderMarket()}
             {activeView === 'signals' && renderSignals()}
             {activeView === 'automation' && renderAutomation()}
             {activeView === 'logs' && renderLogs()}
             {activeView === 'ai' && renderAI()}
             {activeView === 'analytics' && renderAnalytics()}
             {activeView === 'settings' && renderSettings()}
        </div>
      </main>
    </div>
  );
}