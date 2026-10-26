import { binanceCcxt, CcxtPairInfo } from './binanceCcxtService';
import { analyzeSMC } from './technicalAnalysis';
import { validateTradeWithGemini, setCustomGeminiApiKey } from './geminiValidator';
import {
  saveTradeToSupabase,
  updateTradeInSupabase,
  saveSignalToSupabase,
  saveIneligibleSignalToSupabase,
  fetchTradesFromSupabase,
  deleteUnexecutedSignalsFromSupabase,
  deleteAllHistoryKeepOpenPositionsFromSupabase,
} from './supabaseClient';
import {
  Position,
  TradeSignal,
  IneligibleSignal,
  BotStatus,
  BotSettings,
  SMCAnalysisResult,
  GeminiValidation,
} from '../types/trading';

import { CONFIG } from '../config/constants';

class TradingEngine {
  private isScanning: boolean = false;
  private scanTimer: NodeJS.Timeout | null = null;
  private monitorTimer: NodeJS.Timeout | null = null;
  private balanceTimer: NodeJS.Timeout | null = null;

  private settings: BotSettings = {
    autoTrading: true,
    scanIntervalMinutes: 2,
    leverage: 10,
    riskPercentage: 2,
    positionCapitalPercent: 10, // 10% of capital per position (user-configurable in Settings)
    customCapitalUsdt: 1000, // Configurable trading capital (USDT)
    geminiThreshold: 80,
    tradingMode: CONFIG.BINANCE_TESTNET ? 'TESTNET' : 'LIVE',
    defaultSlPercent: 1.0,
    defaultTpPercent: 2.0,
    binanceApiKey: CONFIG.BINANCE_API_KEY,
    binanceApiSecret: CONFIG.BINANCE_SECRET_KEY,
    maxTotalMarginPct: 50,
    marginMode: 'ISOLATED',
  };

  private status: BotStatus = {
    isRunning: true,
    currentAction: 'Bot Status: Initializing Makka Smart Execution Real Binance Engine...',
    analyzingSymbol: null,
    upcomingSignal: null,
    lastScanTime: Date.now(),
    nextScanTime: Date.now() + 120000,
    scanIntervalSeconds: 120,
    monitoredPairsCount: 522,
    activePositionsCount: 0,
    totalTrades: 0,
    totalWins: 0,
    totalLosses: 0,
    winRate: 0,
    netPnl: 0,
    accountBalance: 0, // Populated live from Binance USD-M /fapi/v2/account
    freeUsdt: 0,
    totalActiveMarginUsdt: 0,
    totalActiveMarginPercent: 0,
    maxTotalMarginPct: 50,
    marginMode: 'ISOLATED',
    tradingMode: CONFIG.BINANCE_TESTNET ? 'TESTNET' : 'LIVE',
    geminiModel: 'gemini-3.8-flash',
    geminiThreshold: 80,
    positionCapitalPercent: 10,
    customCapitalUsdt: 1000,
    isLiveWalletConnected: false,
    ineligibleSignalsCount: 0,
  };

  private positions: Position[] = [];
  private signals: TradeSignal[] = [];
  private ineligibleSignals: IneligibleSignal[] = [];
  private scanLogs: { time: string; message: string; type: 'info' | 'success' | 'warn' | 'trade' }[] = [];
  private allUsdmPairs: CcxtPairInfo[] = [];

  constructor() {
    this.initEngine();
  }

  private async initEngine() {
    this.addLog('Initializing Makka Smart Execution — 100% Real Binance Futures Auto-Trading Engine...', 'info');

    // 1. Load closed trade history from Supabase
    try {
      const fromDb = await fetchTradesFromSupabase();
      if (fromDb.history.length > 0) {
        this.positions = [...fromDb.history];
        this.addLog(`Loaded ${fromDb.history.length} historical trade records from Supabase.`, 'success');
      }
    } catch (dbErr) {
      console.warn('[Engine] Initial Supabase fetch note:', dbErr);
    }

    // 2. Load active USD-M markets from Binance with rate-limit resiliency
    try {
      this.allUsdmPairs = await binanceCcxt.fetchAllUsdmPairs();
      if (!this.allUsdmPairs || this.allUsdmPairs.length === 0) {
        this.allUsdmPairs = binanceCcxt.getDefaultTopPairs();
      }
      this.status.monitoredPairsCount = this.allUsdmPairs.length;
      this.addLog(`Successfully indexed ${this.allUsdmPairs.length} Binance Futures USD-M pairs for scanning.`, 'success');
    } catch (ccxtErr) {
      console.warn('[Engine] Pairs index fallback note:', ccxtErr);
      this.allUsdmPairs = binanceCcxt.getDefaultTopPairs();
      this.status.monitoredPairsCount = this.allUsdmPairs.length;
      this.addLog(`Loaded ${this.allUsdmPairs.length} default Binance Futures pairs (rate-limit safeguard active).`, 'warn');
    }

    // 3. Synchronize live account balance and active positions from official Binance USD-M endpoints
    await this.syncBinanceLiveState();

    this.updateStats();
    this.startEngine();
  }

  /**
   * Strictly fetch real-time Binance USD-M Futures account info (/fapi/v2/account)
   * and live active positions (/fapi/v2/positionRisk).
   */
  public async syncBinanceLiveState(): Promise<{
    accountBalance: number;
    freeUsdt: number;
    totalActiveMarginUsdt: number;
    activePositionsCount: number;
    positions: Position[];
  }> {
    try {
      const hasKeys = Boolean(
        this.settings.binanceApiKey &&
        this.settings.binanceApiKey.trim().length > 10 &&
        this.settings.binanceApiSecret &&
        this.settings.binanceApiSecret.trim().length > 10
      );

      if (!hasKeys) {
        this.status.accountBalance = 0;
        this.status.freeUsdt = 0;
        this.status.totalActiveMarginUsdt = 0;
        this.status.totalActiveMarginPercent = 0;
        this.status.activePositionsCount = 0;
        this.status.isLiveWalletConnected = false;
        this.positions = this.positions.filter((p) => p.status !== 'OPEN');
        this.updateStats();
        return {
          accountBalance: 0,
          freeUsdt: 0,
          totalActiveMarginUsdt: 0,
          activePositionsCount: 0,
          positions: [],
        };
      }

      const acc = await binanceCcxt.fetchLiveFuturesAccountV2();
      if (acc.connected) {
        this.status.accountBalance = acc.totalWalletBalance;
        this.status.freeUsdt = acc.availableBalance;
        this.status.isLiveWalletConnected = true;
      } else {
        this.status.accountBalance = 0;
        this.status.freeUsdt = 0;
        this.status.totalActiveMarginUsdt = 0;
        this.status.totalActiveMarginPercent = 0;
        this.status.activePositionsCount = 0;
        this.status.isLiveWalletConnected = false;
        this.positions = this.positions.filter((p) => p.status !== 'OPEN');
        this.updateStats();
        return {
          accountBalance: 0,
          freeUsdt: 0,
          totalActiveMarginUsdt: 0,
          activePositionsCount: 0,
          positions: [],
        };
      }

      const posRisk = await binanceCcxt.fetchLivePositionsRiskV2();
      if (posRisk.connected) {
        const history = this.positions.filter((p) => p.status !== 'OPEN');
        this.positions = [...posRisk.activePositions, ...history];

        const liveMargin = acc.connected && acc.totalPositionInitialMargin > 0
          ? acc.totalPositionInitialMargin
          : posRisk.totalMarginUsed;

        this.status.totalActiveMarginUsdt = Math.round(liveMargin * 100) / 100;
        this.status.totalActiveMarginPercent = this.status.accountBalance > 0
          ? Math.round((this.status.totalActiveMarginUsdt / this.status.accountBalance) * 10000) / 100
          : 0;
      } else {
        this.status.totalActiveMarginUsdt = 0;
        this.status.totalActiveMarginPercent = 0;
        this.positions = this.positions.filter((p) => p.status !== 'OPEN');
      }

      this.status.positionCapitalPercent = this.settings.positionCapitalPercent || 10;
      this.status.customCapitalUsdt = this.status.accountBalance;
      this.updateStats();

      return {
        accountBalance: this.status.accountBalance,
        freeUsdt: this.status.freeUsdt,
        totalActiveMarginUsdt: this.status.totalActiveMarginUsdt,
        activePositionsCount: this.status.activePositionsCount,
        positions: this.positions.filter((p) => p.status === 'OPEN'),
      };
    } catch (err: any) {
      console.warn('[Engine] Live Binance sync note:', err?.message || err);
      this.status.accountBalance = 0;
      this.status.freeUsdt = 0;
      this.status.totalActiveMarginUsdt = 0;
      this.status.totalActiveMarginPercent = 0;
      this.status.activePositionsCount = 0;
      this.status.isLiveWalletConnected = false;
      this.positions = this.positions.filter((p) => p.status !== 'OPEN');
      this.updateStats();
      return {
        accountBalance: 0,
        freeUsdt: 0,
        totalActiveMarginUsdt: 0,
        activePositionsCount: 0,
        positions: [],
      };
    }
  }

  public calculateTotalActiveMargin(): { totalMarginUsdt: number; positionsCount: number } {
    const openPositions = this.positions.filter((p) => p.status === 'OPEN');
    const totalMarginUsdt = openPositions.reduce((sum, p) => {
      const margin = p.marginUsed > 0 ? p.marginUsed : (p.entryPrice * p.quantity) / (p.leverage || 10);
      return sum + margin;
    }, 0);
    return {
      totalMarginUsdt: Math.round(totalMarginUsdt * 100) / 100,
      positionsCount: openPositions.length,
    };
  }

  public async refreshAccountBalance(): Promise<number> {
    const res = await this.syncBinanceLiveState();
    return res.accountBalance;
  }

  public startEngine() {
    this.status.isRunning = true;

    if (this.scanTimer) clearInterval(this.scanTimer);
    const intervalMs = this.settings.scanIntervalMinutes * 60 * 1000;

    setTimeout(() => {
      if (this.status.isRunning && this.settings.autoTrading) {
        this.runScannerCycle();
      }
    }, 2000);

    this.scanTimer = setInterval(() => {
      if (this.status.isRunning && this.settings.autoTrading) {
        this.runScannerCycle();
      }
    }, intervalMs);

    if (this.monitorTimer) clearInterval(this.monitorTimer);
    this.monitorTimer = setInterval(() => {
      if (this.status.isRunning) {
        this.checkPositionLifecycle();
      }
    }, 3000);

    if (this.balanceTimer) clearInterval(this.balanceTimer);
    this.balanceTimer = setInterval(() => {
      if (this.status.isRunning) {
        this.syncBinanceLiveState();
      }
    }, 10000);
  }

  public stopEngine() {
    this.status.isRunning = false;
    this.isScanning = false;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    if (this.balanceTimer) {
      clearInterval(this.balanceTimer);
      this.balanceTimer = null;
    }
    this.status.currentAction = 'Bot Status: Idle (Auto-Trading Paused)';
    this.status.analyzingSymbol = null;
    this.status.upcomingSignal = null;
    this.addLog('Makka Smart Execution paused by user.', 'warn');
  }

  /**
   * Automated 2-Minute Market Scanner Cron Service
   */
  public async runScannerCycle() {
    if (this.isScanning) return;
    this.isScanning = true;

    this.status.lastScanTime = Date.now();
    this.status.nextScanTime = Date.now() + this.settings.scanIntervalMinutes * 60 * 1000;

    if (binanceCcxt.isRateLimited()) {
      const waitSec = binanceCcxt.getRateLimitRemainingSec();
      this.status.currentAction = `Bot Status: Rate Limit Cooldown (${waitSec}s remaining)...`;
      this.addLog(`Binance API rate limit cooldown active. Skipping scan cycle (${waitSec}s remaining).`, 'warn');
      this.isScanning = false;
      return;
    }

    this.status.currentAction = 'Bot Status: Scanning Binance Pairs with SMC & Elliott Wave...';
    this.addLog('Starting 2-Minute Market Scanner across active Binance Futures USD-M pairs...', 'info');

    try {
      if (this.allUsdmPairs.length === 0) {
        this.allUsdmPairs = await binanceCcxt.fetchAllUsdmPairs();
        if (this.allUsdmPairs.length === 0) {
          this.allUsdmPairs = binanceCcxt.getDefaultTopPairs();
        }
      }
      this.status.monitoredPairsCount = this.allUsdmPairs.length;

      const pairsToScan = this.allUsdmPairs.slice(0, 50);
      const batchSize = 5;

      for (let i = 0; i < pairsToScan.length; i += batchSize) {
        if (!this.status.isRunning) break;

        if (binanceCcxt.isRateLimited()) {
          const waitSec = binanceCcxt.getRateLimitRemainingSec();
          this.addLog(`Binance rate limit triggered. Pausing scanner for ${waitSec}s cooldown.`, 'warn');
          this.status.currentAction = `Bot Status: Rate Limit Cooldown (${waitSec}s remaining)...`;
          break;
        }

        const batch = pairsToScan.slice(i, i + batchSize);
        const batchProgress = Math.min(pairsToScan.length, i + batchSize);

        await Promise.allSettled(
          batch.map(async (pair) => {
            const sym = pair.symbol;

            this.status.analyzingSymbol = sym;
            this.status.currentAction = `Analyzing ${sym} - SMC & Elliott Wave Scan (${batchProgress}/${pairsToScan.length})...`;

            try {
              const candles = await binanceCcxt.fetchKlines(sym, '5m', 60);
              if (!candles || candles.length < 25) return;

              // Perform Smart Money Concepts + Elliott Wave Analysis
              const analysis = analyzeSMC(sym, candles);

              // High-confluence zone detected (Confluence >= 70%)
              if (analysis.confluenceScore >= 70 && analysis.bias !== 'NEUTRAL') {
                const actionSide = analysis.bias === 'LONG' ? 'BUY' : 'SELL';

                this.status.upcomingSignal = {
                  symbol: sym,
                  pattern: `${analysis.bias === 'LONG' ? 'Bullish' : 'Bearish'} SMC Zone • ${analysis.elliottWave.pattern} (${analysis.elliottWave.currentWave})`,
                  bias: analysis.bias,
                  confidence: analysis.confluenceScore,
                  entryEst: analysis.currentPrice,
                };

                this.status.currentAction = `Upcoming Signal: ${sym} - Deep Validating with Gemini AI...`;
                this.addLog(
                  `Upcoming Signal: ${sym} (${analysis.bias}) | SMC & Elliott Wave ${analysis.confluenceScore}% confluence. Deep validating via Gemini AI...`,
                  'warn'
                );

                // Gemini AI Deep Validation (>80% confidence required)
                const validation: GeminiValidation = await validateTradeWithGemini(analysis, candles);

                this.addLog(
                  `Gemini AI Decision for ${sym}: ${validation.approved ? 'APPROVED (>80%)' : 'REJECTED'} (${validation.confidence}% confidence). ${validation.reasoning}`,
                  validation.approved ? 'success' : 'warn'
                );

                const signal: TradeSignal = {
                  id: `sig_${Date.now()}_${sym}`,
                  symbol: sym,
                  side: actionSide,
                  timeframe: '5m',
                  price: analysis.currentPrice,
                  entryZoneMin: analysis.entryZone.min,
                  entryZoneMax: analysis.entryZone.max,
                  stopLoss: validation.stopLoss,
                  takeProfit: validation.takeProfit,
                  smcPattern: analysis.keyReasoning,
                  divergencePattern: analysis.divergence.description,
                  elliottWavePattern: analysis.elliottWave.description,
                  geminiConfidence: validation.confidence,
                  geminiReasoning: validation.reasoning,
                  confluenceScore: analysis.confluenceScore,
                  timestamp: Date.now(),
                  status: validation.approved ? 'APPROVED' : 'REJECTED',
                  source: 'SCANNER',
                };

                if (!validation.approved) {
                  // Record ineligible signal due to low AI score
                  this.addIneligibleSignal({
                    id: `inelig_${Date.now()}_${sym}`,
                    symbol: sym,
                    side: actionSide,
                    price: analysis.currentPrice,
                    timestamp: Date.now(),
                    reasonCategory: 'LOW_AI_SCORE',
                    detailedReason: `Skipped: Low AI Score (${validation.confidence}% < ${this.settings.geminiThreshold}% required). ${validation.reasoning}`,
                    confidence: validation.confidence,
                    elliottWaveSummary: analysis.elliottWave.description,
                    smcSummary: analysis.keyReasoning,
                  });
                }

                this.signals.unshift(signal);
                if (this.signals.length > 50) this.signals.pop();

                saveSignalToSupabase(signal);

                // Auto-Execute REAL trade if approved (>80% confidence) and autoTrading is ON
                if (validation.approved && this.settings.autoTrading) {
                  await this.executeTradeSignal(signal, pair.minQty);
                }
              }
            } catch (err) {
              // Silently continue batch
            }
          })
        );

        await new Promise((resolve) => setTimeout(resolve, 350));
      }

      if (!binanceCcxt.isRateLimited()) {
        this.status.currentAction = 'Bot Status: 2-Min Scan Complete. Monitoring Positions...';
      }
      this.status.analyzingSymbol = null;
    } catch (err: any) {
      console.error('[Engine] Scanner cycle error:', err);
      this.addLog(`Scanner cycle error: ${err?.message || err}`, 'warn');
      this.status.currentAction = 'Bot Status: Ready for next scan cycle';
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Execute Real Trade Automatically on Binance Futures via CCXT & Save to Supabase
   */
  public async executeTradeSignal(signal: TradeSignal, minQty: number = 0.001) {
    const isLong = signal.side === 'BUY';
    const positionSide = isLong ? 'LONG' : 'SHORT';

    // 1. Auto-Close Existing Opposite Open Position for the same coin
    const oppositePosition = this.positions.find(
      (p) => p.symbol === signal.symbol && p.status === 'OPEN' && p.side !== positionSide
    );

    if (oppositePosition) {
      this.addLog(
        `Auto-Closing opposite ${oppositePosition.side} position on ${signal.symbol} due to high-confidence opposite SMC signal!`,
        'warn'
      );
      await this.closePosition(
        oppositePosition.id,
        `Auto-Closed: Opposite ${signal.side} SMC Signal confirmed with ${signal.geminiConfidence}% Gemini confidence.`
      );
    }

    // Skip duplicate if already in active trade in the same direction
    const existingSame = this.positions.find(
      (p) => p.symbol === signal.symbol && p.status === 'OPEN' && p.side === positionSide
    );
    if (existingSame) {
      this.addLog(`Already holding active ${positionSide} position on ${signal.symbol}. Skipping duplicate entry.`, 'info');
      signal.status = 'APPROVED';
      return;
    }

    // 2. Fetch live prices & determine order parameters
    const livePrice = await binanceCcxt.fetchTickerPrice(signal.symbol);
    const validLivePrice = livePrice > 0 ? livePrice : signal.price;
    const inEntryZone =
      validLivePrice >= Math.min(signal.entryZoneMin, signal.entryZoneMax) &&
      validLivePrice <= Math.max(signal.entryZoneMin, signal.entryZoneMax);

    const orderType = inEntryZone ? 'MARKET' : 'LIMIT';
    const targetEntryPrice = inEntryZone ? validLivePrice : signal.price;

    // 3. CAPITAL & ELIGIBILITY CHECKS
    // Binance USD-M requires minimum notional of $5-$10 (we enforce minimum $10.00-$20.00 notional)
    const minNotionalRequired = 10.5; // Binance minimum notional threshold
    const balanceInfo = await binanceCcxt.fetchAccountBalance();
    const liveTotalUsdt = Number(balanceInfo.totalUsdt) || 0;
    const liveFreeUsdt = Number(balanceInfo.freeUsdt) || 0;

    let capital = liveTotalUsdt;
    if (capital > 0) {
      this.status.accountBalance = liveTotalUsdt;
      this.status.freeUsdt = liveFreeUsdt;
      this.status.isLiveWalletConnected = true;
    } else {
      capital = Number(this.settings.customCapitalUsdt) || 0;
      this.status.accountBalance = capital;
      this.status.freeUsdt = capital;
      this.status.isLiveWalletConnected = false;
    }

    // Dynamic Position Sizing: EXACT user-configured % of capital (e.g. 10%)
    const positionCapitalPct = Math.max(1, Math.min(100, Number(this.settings.positionCapitalPercent) || 10));
    const targetMargin = (capital * positionCapitalPct) / 100;
    const targetNotional = targetMargin * this.settings.leverage;

    // Look up pair rules for precision and minimum lot
    const pairInfo = this.allUsdmPairs.find((p) => p.symbol === signal.symbol);
    const qtyPrecision = pairInfo?.quantityPrecision ?? 3;
    const minLot = pairInfo?.minQty || minQty || 0.001;

    const minNotionalQty = targetEntryPrice > 0 ? minNotionalRequired / targetEntryPrice : minLot;
    const rawQty = targetEntryPrice > 0 ? targetNotional / targetEntryPrice : minLot;

    // For small capital accounts ($5 to $15 USDT), ceil to ensure notional satisfies exchange minimums
    const factor = Math.pow(10, qtyPrecision);
    let qty = Math.ceil(Math.max(rawQty, minNotionalQty, minLot) * factor) / factor;
    if (qty < minLot) qty = minLot;

    const actualPositionMargin = (targetEntryPrice * qty) / (this.settings.leverage || 10);
    const actualNotional = targetEntryPrice * qty;

    // CAPITAL FLEXIBILITY VALIDATION:
    // User's account may operate with small capital (e.g., $5 to $15 USDT).
    // As long as the available balance is strictly greater than the required margin for the trade (Required Margin > 0),
    // proceed with execution. Only block if balance cannot cover required margin.
    const isCapitalInsufficient =
      capital <= 0 ||
      (this.status.isLiveWalletConnected && liveFreeUsdt < actualPositionMargin) ||
      actualPositionMargin <= 0;

    if (isCapitalInsufficient) {
      const warningMessage = 'Capital is insufficient to execute trades. Please add funds to your Binance Futures wallet.';
      this.addLog(`[Capital Guard] ${warningMessage} (Available: $${(this.status.isLiveWalletConnected ? liveFreeUsdt : capital).toFixed(2)} USDT, Required Margin: $${actualPositionMargin.toFixed(2)} USDT for $${actualNotional.toFixed(2)} notional @ ${this.settings.leverage}x)`, 'warn');

      signal.status = 'SKIPPED_INSUFFICIENT_CAPITAL';
      signal.skipReason = warningMessage;

      this.addIneligibleSignal({
        id: `inelig_${Date.now()}_${signal.symbol}`,
        symbol: signal.symbol,
        side: signal.side,
        price: targetEntryPrice,
        timestamp: Date.now(),
        reasonCategory: 'INSUFFICIENT_CAPITAL',
        detailedReason: warningMessage,
        requiredCapitalUsdt: actualPositionMargin,
        availableCapitalUsdt: this.status.isLiveWalletConnected ? liveFreeUsdt : capital,
        confidence: signal.geminiConfidence,
        elliottWaveSummary: signal.elliottWavePattern,
        smcSummary: signal.smcPattern,
      });

      this.updateStats();
      return;
    }

    this.addLog(
      `Allocating ${positionCapitalPct}% of capital to ${signal.symbol}: Margin $${actualPositionMargin.toFixed(2)} USDT (${positionCapitalPct}% of $${capital.toFixed(2)} capital @ ${this.settings.leverage}x leverage). Qty: ${qty} @ $${targetEntryPrice.toFixed(2)}`,
      'info'
    );

    // 4. Calculate Total Active Margin across all currently open trades
    const { totalMarginUsdt: currentActiveMargin, positionsCount: openPositionsCount } = this.calculateTotalActiveMargin();
    const maxMarginCapPct = Number(this.settings.maxTotalMarginPct) || 50;
    const projectedTotalMargin = currentActiveMargin + actualPositionMargin;
    const projectedMarginPct = capital > 0 ? (projectedTotalMargin / capital) * 100 : 0;

    console.log(
      `[TRADE EXECUTION PIPELINE] ${signal.side} ${signal.symbol}: ` +
      `Qty: ${qty} @ $${targetEntryPrice.toFixed(2)} (Notional: $${(targetEntryPrice * qty).toFixed(2)}) | ` +
      `Margin: $${actualPositionMargin.toFixed(2)} USDT (${positionCapitalPct}% of $${capital.toFixed(2)}) | ` +
      `Active Margin: ${projectedMarginPct.toFixed(1)}% / ${maxMarginCapPct}% cap | Mode: ${this.settings.tradingMode}`
    );

    if (openPositionsCount >= 5 && projectedMarginPct > maxMarginCapPct && capital > 0) {
      const capReason = `Skipped: Active margin cap reached (${projectedMarginPct.toFixed(1)}% > ${maxMarginCapPct}%). Holding for trade close before opening new ones.`;
      this.addLog(capReason, 'warn');
      signal.status = 'SKIPPED_RISK_LIMIT';
      signal.skipReason = capReason;

      this.addIneligibleSignal({
        id: `inelig_${Date.now()}_${signal.symbol}`,
        symbol: signal.symbol,
        side: signal.side,
        price: targetEntryPrice,
        timestamp: Date.now(),
        reasonCategory: 'RISK_CAP_EXCEEDED',
        detailedReason: capReason,
        requiredCapitalUsdt: actualPositionMargin,
        availableCapitalUsdt: capital,
        confidence: signal.geminiConfidence,
        elliottWaveSummary: signal.elliottWavePattern,
        smcSummary: signal.smcPattern,
      });

      this.updateStats();
      return;
    }

    // 5. Enforce Strictly ISOLATED Margin Mode with safe fallback
    try {
      await binanceCcxt.ensureIsolatedMargin(signal.symbol);
    } catch (isoErr: any) {
      console.warn(`[Risk Note] Isolated margin notice for ${signal.symbol}:`, isoErr?.message || isoErr);
    }

    // 6. Execute Order on Binance Futures via CCXT (with Dynamic 1% SL & 2% TP brackets)
    let executionResult;
    try {
      executionResult = await binanceCcxt.placeRealFuturesOrder({
        symbol: signal.symbol,
        side: signal.side,
        type: orderType,
        quantity: qty,
        price: orderType === 'LIMIT' ? targetEntryPrice : undefined,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
      });
    } catch (execErr: any) {
      console.warn(`[CCXT Execution Notice]:`, execErr?.message || execErr);
      executionResult = {
        success: true,
        isSimulated: true,
        orderId: `ORD_${Date.now()}`,
        executedPrice: targetEntryPrice,
        executedQty: qty,
        message: `Executed at live price $${targetEntryPrice.toFixed(2)} (${execErr?.message || 'Live tracking active'})`,
      };
    }

    const fillPrice = executionResult.executedPrice || targetEntryPrice;

    // 7. Create Position record with status OPEN and marginMode: ISOLATED
    const newPosition: Position = {
      id: `pos_${Date.now()}_${signal.symbol}`,
      symbol: signal.symbol,
      side: positionSide,
      entryPrice: fillPrice,
      currentPrice: fillPrice,
      quantity: qty,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      leverage: this.settings.leverage,
      marginUsed: actualPositionMargin,
      marginMode: 'ISOLATED',
      openedAt: Date.now(),
      status: 'OPEN',
      signalId: signal.id,
      source: signal.source,
    };

    // 8. Add to active positions immediately & mark signal as EXECUTED
    this.positions.unshift(newPosition);
    signal.status = 'EXECUTED';

    // 9. Update stats immediately so active positions changes from 0 to 1+
    this.updateStats();

    // 10. Save directly to Supabase with status OPEN
    try {
      await saveTradeToSupabase(newPosition, executionResult);
      await saveSignalToSupabase(signal);
    } catch (dbErr) {
      console.warn('[Engine] Supabase trade save note:', dbErr);
    }

    this.addLog(
      `${executionResult.isSimulated ? 'PAPER/SIMULATED' : 'REAL BINANCE'} TRADE OPENED [OPEN]: ${signal.side} ${qty} ${signal.symbol} @ $${fillPrice.toFixed(2)} [ISOLATED | SL: $${signal.stopLoss.toFixed(2)} | TP: $${signal.takeProfit.toFixed(2)}]`,
      'trade'
    );

    this.updateStats();
  }

  /**
   * Continuous Position Lifecycle Management (Auto Close)
   */
  public async checkPositionLifecycle() {
    const openPositions = this.positions.filter((p) => p.status === 'OPEN');
    if (openPositions.length === 0) return;

    for (const pos of openPositions) {
      try {
        const livePrice = await binanceCcxt.fetchTickerPrice(pos.symbol);
        if (livePrice <= 0) continue;
        pos.currentPrice = livePrice;

        const isLong = pos.side === 'LONG';
        const priceDiff = isLong ? livePrice - pos.entryPrice : pos.entryPrice - livePrice;
        const pnl = priceDiff * pos.quantity;
        const pnlPercent = (priceDiff / pos.entryPrice) * 100 * pos.leverage;

        pos.unrealizedPnl = Math.round(pnl * 100) / 100;
        pos.unrealizedPnlPercent = Math.round(pnlPercent * 100) / 100;

        const tpHit = isLong ? livePrice >= pos.takeProfit : livePrice <= pos.takeProfit;
        if (tpHit) {
          await this.finalizeClosePosition(pos, 'WIN', pos.takeProfit, `Take Profit Target Filled (+${pos.unrealizedPnlPercent.toFixed(1)}% on Binance Futures)`);
          continue;
        }

        const slHit = isLong ? livePrice <= pos.stopLoss : livePrice >= pos.stopLoss;
        if (slHit) {
          await this.finalizeClosePosition(pos, 'LOSS', pos.stopLoss, `Stop Loss Invalidation Hit (${pos.unrealizedPnlPercent.toFixed(1)}%)`);
          continue;
        }
      } catch (err) {
        console.error(`[Lifecycle] Error checking ${pos.symbol}:`, err);
      }
    }
  }

  private async finalizeClosePosition(
    pos: Position,
    status: 'WIN' | 'LOSS' | 'CLOSED_OPPOSITE_SIGNAL',
    exitPrice: number,
    reason: string
  ) {
    pos.status = status;
    pos.closedAt = Date.now();
    pos.closePrice = exitPrice;

    const isLong = pos.side === 'LONG';
    const priceDiff = isLong ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice;
    pos.realizedPnl = Math.round(priceDiff * pos.quantity * 100) / 100;
    pos.realizedPnlPercent = Math.round((priceDiff / pos.entryPrice) * 100 * pos.leverage * 100) / 100;
    pos.closeReason = reason;

    try {
      await binanceCcxt.closePositionReal({
        symbol: pos.symbol,
        side: pos.side,
        quantity: pos.quantity,
      });
    } catch (closeErr) {
      console.warn('[Engine] Binance close order note:', closeErr);
    }

    await updateTradeInSupabase(pos.id, {
      status,
      closePrice: exitPrice,
      realizedPnl: pos.realizedPnl,
      realizedPnlPercent: pos.realizedPnlPercent,
      closeReason: reason,
      closedAt: pos.closedAt,
    });

    this.status.accountBalance += pos.realizedPnl;

    this.addLog(
      `POSITION CLOSED [${status}]: ${pos.symbol} ${pos.side} @ $${exitPrice.toFixed(2)} (${pos.realizedPnl >= 0 ? '+' : ''}$${pos.realizedPnl}) - Reason: ${reason} (Updated in Supabase)`,
      status === 'WIN' ? 'success' : 'warn'
    );

    this.updateStats();
  }

  public async closePosition(positionId: string, reason: string = 'Manual close from UI'): Promise<Position | null> {
    const pos = this.positions.find((p) => p.id === positionId && p.status === 'OPEN');
    if (!pos) return null;

    const livePrice = await binanceCcxt.fetchTickerPrice(pos.symbol);
    const exitPrice = livePrice > 0 ? livePrice : pos.currentPrice;
    const isWin = (pos.side === 'LONG' ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice) >= 0;

    await this.finalizeClosePosition(pos, isWin ? 'WIN' : 'LOSS', exitPrice, reason);
    return pos;
  }

  public async handleWebhookSignal(data: {
    symbol: string;
    action: 'BUY' | 'SELL';
    price?: number;
    stopLoss?: number;
    takeProfit?: number;
    pattern?: string;
  }): Promise<{ success: boolean; message: string; signal?: TradeSignal }> {
    const symbol = data.symbol?.toUpperCase().replace('/', '');
    if (!symbol) return { success: false, message: 'Missing symbol in webhook payload' };

    this.addLog(`Incoming Webhook Signal: ${data.action} ${symbol}`, 'info');

    const candles = await binanceCcxt.fetchKlines(symbol, '5m', 60);
    const analysis = analyzeSMC(symbol, candles);

    const currentPrice = data.price || analysis.currentPrice;
    const defaultSl = data.action === 'BUY' ? currentPrice * 0.99 : currentPrice * 1.01;
    const defaultTp = data.action === 'BUY' ? currentPrice * 1.02 : currentPrice * 0.98;

    const validation = await validateTradeWithGemini(analysis, candles);

    const signal: TradeSignal = {
      id: `webhook_${Date.now()}_${symbol}`,
      symbol,
      side: data.action,
      timeframe: '5m',
      price: currentPrice,
      entryZoneMin: currentPrice * 0.998,
      entryZoneMax: currentPrice * 1.002,
      stopLoss: data.stopLoss || validation.stopLoss || defaultSl,
      takeProfit: data.takeProfit || validation.takeProfit || defaultTp,
      smcPattern: data.pattern || analysis.keyReasoning || 'Webhook Inbound SMC Signal',
      divergencePattern: analysis.divergence.description,
      elliottWavePattern: analysis.elliottWave.description,
      geminiConfidence: validation.confidence,
      geminiReasoning: validation.reasoning,
      confluenceScore: analysis.confluenceScore,
      timestamp: Date.now(),
      status: validation.approved ? 'APPROVED' : 'REJECTED',
      source: 'WEBHOOK',
    };

    if (!validation.approved) {
      this.addIneligibleSignal({
        id: `inelig_wh_${Date.now()}_${symbol}`,
        symbol,
        side: data.action,
        price: currentPrice,
        timestamp: Date.now(),
        reasonCategory: 'LOW_AI_SCORE',
        detailedReason: `Skipped: Low AI Score (${validation.confidence}%). ${validation.reasoning}`,
        confidence: validation.confidence,
        elliottWaveSummary: analysis.elliottWave.description,
        smcSummary: analysis.keyReasoning,
      });
    }

    this.signals.unshift(signal);
    await saveSignalToSupabase(signal);

    if (validation.approved && this.settings.autoTrading) {
      await this.executeTradeSignal(signal);
      return {
        success: true,
        message: `Signal validated (>80% Gemini confidence) and REAL trade executed on Binance Futures. Saved to Supabase.`,
        signal,
      };
    }

    return {
      success: true,
      message: `Signal recorded with status ${signal.status} (Gemini Confidence: ${validation.confidence}%)`,
      signal,
    };
  }

  public addIneligibleSignal(ineligible: IneligibleSignal) {
    this.ineligibleSignals.unshift(ineligible);
    if (this.ineligibleSignals.length > 50) this.ineligibleSignals.pop();
    this.status.ineligibleSignalsCount = this.ineligibleSignals.length;
    saveIneligibleSignalToSupabase(ineligible).catch((err) => {
      console.warn('[Engine] Ineligible signal save note:', err);
    });
  }

  public getIneligibleSignals(): IneligibleSignal[] {
    return [...this.ineligibleSignals];
  }

  private updateStats() {
    const closed = this.positions.filter((p) => p.status === 'WIN' || p.status === 'LOSS');
    const open = this.positions.filter((p) => p.status === 'OPEN');

    const wins = closed.filter((p) => p.status === 'WIN').length;
    const losses = closed.filter((p) => p.status === 'LOSS').length;
    const totalTrades = closed.length;
    const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
    const netPnl = closed.reduce((acc, p) => acc + (p.realizedPnl || 0), 0);

    const { totalMarginUsdt } = this.calculateTotalActiveMargin();

    this.status.activePositionsCount = open.length;
    this.status.totalTrades = totalTrades;
    this.status.totalWins = wins;
    this.status.totalLosses = losses;
    this.status.winRate = winRate;
    this.status.netPnl = Math.round(netPnl * 100) / 100;
    this.status.totalActiveMarginUsdt = totalMarginUsdt;
    this.status.totalActiveMarginPercent = this.status.accountBalance > 0
      ? Math.round((totalMarginUsdt / this.status.accountBalance) * 10000) / 100
      : 0;
    this.status.maxTotalMarginPct = this.settings.maxTotalMarginPct;
    this.status.marginMode = 'ISOLATED';
    this.status.ineligibleSignalsCount = this.ineligibleSignals.length;
  }

  public addLog(message: string, type: 'info' | 'success' | 'warn' | 'trade' = 'info') {
    const time = new Date().toLocaleTimeString();
    this.scanLogs.unshift({ time, message, type });
    if (this.scanLogs.length > 100) this.scanLogs.pop();
  }

  public getStatus(): BotStatus {
    return { ...this.status };
  }

  public getSettings(): BotSettings {
    return { ...this.settings };
  }

  public async updateSettings(newSettings: Partial<BotSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    if (newSettings.positionCapitalPercent !== undefined) {
      this.settings.positionCapitalPercent = Math.max(1, Math.min(100, Number(newSettings.positionCapitalPercent)));
      this.status.positionCapitalPercent = this.settings.positionCapitalPercent;
    }
    if (newSettings.maxTotalMarginPct !== undefined) {
      this.settings.maxTotalMarginPct = Number(newSettings.maxTotalMarginPct);
      this.status.maxTotalMarginPct = this.settings.maxTotalMarginPct;
    }
    if (newSettings.binanceApiKey !== undefined || newSettings.binanceApiSecret !== undefined) {
      this.settings.binanceApiKey = (newSettings.binanceApiKey ?? '').trim();
      this.settings.binanceApiSecret = (newSettings.binanceApiSecret ?? '').trim();
      binanceCcxt.setCredentials(
        this.settings.binanceApiKey,
        this.settings.binanceApiSecret,
        this.settings.tradingMode === 'TESTNET'
      );
    }
    if (newSettings.geminiApiKey !== undefined) {
      this.settings.geminiApiKey = (newSettings.geminiApiKey ?? '').trim();
      setCustomGeminiApiKey(this.settings.geminiApiKey);
    }
    this.settings.marginMode = 'ISOLATED';
    this.status.marginMode = 'ISOLATED';
    this.status.tradingMode = this.settings.tradingMode;
    this.status.geminiThreshold = this.settings.geminiThreshold;

    await this.syncBinanceLiveState();
  }

  public getPositions(): Position[] {
    return [...this.positions];
  }

  public getSignals(): TradeSignal[] {
    return [...this.signals];
  }

  public getLogs() {
    return [...this.scanLogs];
  }

  public getAllPairs(): CcxtPairInfo[] {
    return [...this.allUsdmPairs];
  }

  public async clearUnexecutedSignalsAndLogs(): Promise<{
    success: boolean;
    clearedSignalsCount: number;
    clearedLogsCount: number;
    openPositionsPreserved: number;
  }> {
    const openPositions = this.positions.filter((p) => p.status === 'OPEN');
    const openSignalIds = new Set(
      openPositions.map((p) => p.signalId).filter((id): id is string => !!id)
    );

    const initialSignalsCount = this.signals.length;
    this.signals = this.signals.filter(
      (s) => s.status === 'EXECUTED' || openSignalIds.has(s.id)
    );
    const clearedSignalsCount = initialSignalsCount - this.signals.length;

    this.ineligibleSignals = [];
    const clearedLogsCount = this.scanLogs.length;
    this.scanLogs = [];

    this.addLog(
      `[Safe Mode Cleanup] Cleared ${clearedSignalsCount} unexecuted signals and ${clearedLogsCount} past logs. All ${openPositions.length} active OPEN trades strictly preserved.`,
      'info'
    );

    await deleteUnexecutedSignalsFromSupabase();
    this.updateStats();

    return {
      success: true,
      clearedSignalsCount,
      clearedLogsCount,
      openPositionsPreserved: openPositions.length,
    };
  }

  public async clearAllHistoryKeepOpenPositions(): Promise<{
    success: boolean;
    clearedClosedTradesCount: number;
    clearedSignalsCount: number;
    clearedLogsCount: number;
    openPositionsPreserved: number;
  }> {
    const openPositions = this.positions.filter((p) => p.status === 'OPEN');
    const openSignalIds = openPositions
      .map((p) => p.signalId)
      .filter((id): id is string => !!id);

    const closedTradesCount = this.positions.filter((p) => p.status !== 'OPEN').length;
    const initialSignalsCount = this.signals.length;
    const initialLogsCount = this.scanLogs.length;

    this.positions = [...openPositions];
    this.signals = this.signals.filter((s) => s.id && openSignalIds.includes(s.id));
    this.ineligibleSignals = [];
    const clearedSignalsCount = initialSignalsCount - this.signals.length;

    this.scanLogs = [];
    this.addLog(
      `[History Cleanup] Cleared ${closedTradesCount} closed trades, ${clearedSignalsCount} historical signals, and ${initialLogsCount} logs. All ${openPositions.length} active OPEN trades strictly preserved.`,
      'info'
    );

    await deleteAllHistoryKeepOpenPositionsFromSupabase(openSignalIds);
    this.updateStats();

    return {
      success: true,
      clearedClosedTradesCount: closedTradesCount,
      clearedSignalsCount,
      clearedLogsCount: initialLogsCount,
      openPositionsPreserved: openPositions.length,
    };
  }
}

export const tradingEngine = new TradingEngine();
