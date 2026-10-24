export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type OrderBlockType = 'BULLISH' | 'BEARISH';
export type FVGType = 'BULLISH' | 'BEARISH';
export type SweepType = 'HIGH_SWEEP' | 'LOW_SWEEP';
export type DivergenceType = 'BULLISH_RSI' | 'BEARISH_RSI' | 'BULLISH_MACD' | 'BEARISH_MACD' | 'NONE';

export interface OrderBlock {
  type: OrderBlockType;
  high: number;
  low: number;
  candleIndex: number;
  timestamp: number;
  mitigated: boolean;
  strength: number; // 1-100
}

export interface FairValueGap {
  type: FVGType;
  top: number;
  bottom: number;
  candleIndex: number;
  timestamp: number;
  mitigated: boolean;
}

export interface LiquiditySweep {
  type: SweepType;
  level: number;
  candleIndex: number;
  timestamp: number;
  wickSizePercent: number;
}

export interface DivergenceData {
  type: DivergenceType;
  rsiValue: number;
  macdHist: number;
  description: string;
  strength: number; // 1-100
}

export interface SMCAnalysisResult {
  symbol: string;
  currentPrice: number;
  orderBlocks: OrderBlock[];
  fvgZones: FairValueGap[];
  liquiditySweeps: LiquiditySweep[];
  divergence: DivergenceData;
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  confluenceScore: number; // 0-100
  entryZone: {
    min: number;
    max: number;
    mid: number;
  };
  keyReasoning: string;
}

export interface GeminiValidation {
  approved: boolean;
  confidence: number; // 0-100
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  reasoning: string;
  confluenceFactors: string[];
  evaluatedAt: number;
}

export interface TradeSignal {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  timeframe: string;
  price: number;
  entryZoneMin: number;
  entryZoneMax: number;
  stopLoss: number;
  takeProfit: number;
  smcPattern: string; // e.g. "Bullish OB + FVG Imbalance"
  divergencePattern: string; // e.g. "Bullish RSI Divergence"
  geminiConfidence: number;
  geminiReasoning: string;
  confluenceScore: number;
  timestamp: number;
  status: 'PENDING_VALIDATION' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
  source: 'SCANNER' | 'WEBHOOK';
}

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  leverage: number;
  marginUsed: number;
  openedAt: number;
  closedAt?: number;
  status: 'OPEN' | 'WIN' | 'LOSS' | 'CLOSED_OPPOSITE_SIGNAL';
  closePrice?: number;
  realizedPnl?: number;
  realizedPnlPercent?: number;
  closeReason?: string;
  signalId?: string;
  source: 'SCANNER' | 'WEBHOOK';
}

export interface BotStatus {
  isRunning: boolean;
  currentAction: string; // "Bot Status: Scanning Binance Pairs..." | "Analyzing [PAIR] - SMC & Divergence Scan..."
  analyzingSymbol: string | null;
  upcomingSignal: {
    symbol: string;
    pattern: string;
    bias: 'LONG' | 'SHORT';
    confidence: number;
    entryEst: number;
  } | null;
  lastScanTime: number;
  nextScanTime: number;
  scanIntervalSeconds: number;
  monitoredPairsCount: number;
  activePositionsCount: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  netPnl: number;
  accountBalance: number;
  tradingMode: 'PAPER' | 'TESTNET' | 'LIVE';
  geminiModel: string;
  geminiThreshold: number;
}

export interface BotSettings {
  autoTrading: boolean;
  scanIntervalMinutes: number;
  leverage: number;
  riskPercentage: number;
  geminiThreshold: number;
  tradingMode: 'PAPER' | 'TESTNET' | 'LIVE';
  defaultSlPercent: number;
  defaultTpPercent: number;
  binanceApiKey: string;
  binanceApiSecret: string;
}
