export const UNIVERSE = [
  "BTCUSD", "ETHUSD", "NAS100", "SP500", "TSLA", 
  "USOIL", "XAGUSD", "XPTUSD", "XAUUSD"
];

export const ACCESS_CODE = import.meta.env.VITE_ACCESS_CODE || "Nhesttradingbot2025!";

export const YAHOO_SYMBOL_MAP: Record<string, string> = {
  "BTCUSD": "BTC-USD",
  "ETHUSD": "ETH-USD",
  "NAS100": "NQ=F",
  "SP500": "ES=F",
  "TSLA": "TSLA",
  "USOIL": "CL=F",
  "XAGUSD": "SI=F",
  "XPTUSD": "PL=F",
  "XAUUSD": "GC=F"
};

export const BINANCE_SYMBOL_MAP: Record<string, string> = {
  "BTCUSD": "BTCUSDT",
  "ETHUSD": "ETHUSDT"
};