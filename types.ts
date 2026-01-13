export type TrendBias = 'LONG' | 'SHORT' | 'HEDGED' | 'NONE' | 'BULL' | 'BEAR' | 'BUY' | 'SELL';
export type Status = 'SCANNING' | 'LOCKED' | 'SCALING' | 'INVALIDATED' | 'MONITOR' | 'IDLE';
export type TradeType = 'BUY' | 'SELL';

export interface TradeEntry {
  price: number;
  time: number;
  reason: string;
  type?: string; // Support for 'PENDING' or other status types from backend
  pnl?: number; // Optional: Allow backend to provide actual PnL
  profit?: number; // Alternate PnL field name (MT5 standard)
  ticket?: number; // MT5 Ticket ID
  volume?: number; // Lot Size
}

export interface SymbolState {
  trend_bias: TrendBias;
  status: Status;
  entry_count: number;
  entries: TradeEntry[];
  hma_values: Record<string, number>;
  hma_trends?: Record<number, 'UP' | 'DOWN' | 'FLAT'>;
  oscillators?: Record<string, number>;
  confluence?: Record<string, 'BULL' | 'BEAR' | 'NEUTRAL'>;
}

export interface StrategyState {
  symbols: Record<string, SymbolState>;
}

export interface ActivePosition {
  id?: string;
  symbol: string;
  type: TrendBias;
  entryPrice: number;
  pnl: number;
  layer: number;
  reason: string;
  time: string;
  status?: Status; // Added status to help filter pending/active
  ticket?: number; // MT5 Ticket ID
  finalStatus?: 'FILLED' | 'CANCELLED'; // For History tracking
  volume?: number; // Lot Size
}

export interface LogEntry {
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
  trigger: string;
  msg: string;
}

export interface MarketPrices {
  [symbol: string]: number;
}

export interface AccountState {
  balance: number;
  equity: number;
  realized_pnl: number;
  win_rate: number;
  total_trades: number;
  max_drawdown: number;
}

export interface WebhookEvent {
  id: string;
  time: string;
  source: string;
  symbol: string;
  action: string;
  payload: any;
  status: 'PROCESSED' | 'REJECTED' | 'PENDING';
}