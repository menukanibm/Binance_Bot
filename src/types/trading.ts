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

export interface ElliottWaveAnalysis {
  pattern: 'IMPULSE_1_5' | 'CORRECTIVE_ABC' | 'COMPLEX_RANGE' | 'EXPANDING_DIAGONAL';
  currentWave: 'WAVE_1' | 'WAVE_2' | 'WAVE_3' | 'WAVE_4' | 'WAVE_5' | 'WAVE_A' | 'WAVE_B' | 'WAVE_C' | 'UNDEFINED';
  trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  fibRetracement: number; // e.g. 0.382, 0.5, 0.618
  description: string;
  confluenceWithSmc: boolean;
  waveStrength: number; // 0-100
}

export interface SMCAnalysisResult {
  symbol: string;
  currentPrice: number;
  orderBlocks: OrderBlock[];
  fvgZones: FairValueGap[];
  liquiditySweeps: LiquiditySweep[];
  divergence: DivergenceData;
  elliottWave: ElliottWaveAnalysis;
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

export type SignalStatus =
  | 'PENDING_VALIDATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTED'
  | 'SKIPPED_INSUFFICIENT_CAPITAL'
  | 'SKIPPED_LOW_AI_SCORE'
  | 'SKIPPED_RISK_LIMIT';

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
  elliottWavePattern?: string; // e.g. "Impulse Wave 3 Expansion (Fib 0.618 Retrace)"
  geminiConfidence: number;
  geminiReasoning: string;
  confluenceScore: number;
  timestamp: number;
  status: SignalStatus;
  skipReason?: string;
  source: 'SCANNER' | 'WEBHOOK';
}

export interface IneligibleSignal {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  timestamp: number;
  reasonCategory: 'INSUFFICIENT_CAPITAL' | 'LOW_AI_SCORE' | 'RISK_CAP_EXCEEDED' | 'OPPOSITE_EXPOSURE';
  detailedReason: string;
  requiredCapitalUsdt?: number;
  availableCapitalUsdt?: number;
  confidence: number;
  elliottWaveSummary?: string;
  smcSummary?: string;
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
  marginMode?: 'ISOLATED';
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
  currentAction: string;
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
  freeUsdt: number;
  totalActiveMarginUsdt: number;
  totalActiveMarginPercent: number;
  maxTotalMarginPct: number;
  marginMode: 'ISOLATED';
  tradingMode: 'PAPER' | 'TESTNET' | 'LIVE';
  geminiModel: string;
  geminiThreshold: number;
  positionCapitalPercent?: number;
  customCapitalUsdt?: number;
  isLiveWalletConnected?: boolean;
  ineligibleSignalsCount?: number;
}

export interface BotSettings {
  autoTrading: boolean;
  scanIntervalMinutes: number;
  leverage: number;
  riskPercentage: number;
  positionCapitalPercent: number; // e.g. 10% of capital per position (configurable)
  customCapitalUsdt?: number; // Configurable account capital if Binance live wallet balance is unavailable
  geminiThreshold: number;
  tradingMode: 'PAPER' | 'TESTNET' | 'LIVE';
  defaultSlPercent: number;
  defaultTpPercent: number;
  binanceApiKey: string;
  binanceApiSecret: string;
  geminiApiKey?: string;
  maxTotalMarginPct: number;
  marginMode: 'ISOLATED';
}
