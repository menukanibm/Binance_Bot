import { binanceCcxt, CcxtPairInfo } from './binanceCcxtService';
import { analyzeSMC } from './technicalAnalysis';
import { validateTradeWithGemini } from './geminiValidator';
import {
  saveTradeToSupabase,
  updateTradeInSupabase,
  saveSignalToSupabase,
  fetchTradesFromSupabase,
  deleteUnexecutedSignalsFromSupabase,
  deleteAllHistoryKeepOpenPositionsFromSupabase,
} from './supabaseClient';
import {
  Position,
  TradeSignal,
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

  private settings: BotSettings = {
    autoTrading: true,
    scanIntervalMinutes: 2,
    leverage: 10,
    riskPercentage: 2,
    geminiThreshold: 80,
    tradingMode: CONFIG.BINANCE_TESTNET ? 'TESTNET' : 'LIVE',
    defaultSlPercent: 1.0,
    defaultTpPercent: 2.0,
    binanceApiKey: CONFIG.BINANCE_API_KEY,
    binanceApiSecret: CONFIG.BINANCE_SECRET_KEY,
    maxTotalMarginPct: CONFIG.MAX_TOTAL_MARGIN_PCT || 10,
    marginMode: 'ISOLATED',
  };

  private status: BotStatus = {
    isRunning: true,
    currentAction: 'Bot Status: Initializing 100% Real Binance Futures Engine...',
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
    accountBalance: 0, // Real balance strictly initialized to 0.00 (no mock fallback)
    freeUsdt: 0,
    totalActiveMarginUsdt: 0,
    totalActiveMarginPercent: 0,
    maxTotalMarginPct: CONFIG.MAX_TOTAL_MARGIN_PCT || 10,
    marginMode: 'ISOLATED',
    tradingMode: CONFIG.BINANCE_TESTNET ? 'TESTNET' : 'LIVE',
    geminiModel: 'gemini-3.8-flash',
    geminiThreshold: 80,
  };

  private positions: Position[] = [];
  private signals: TradeSignal[] = [];
  private scanLogs: { time: string; message: string; type: 'info' | 'success' | 'warn' | 'trade' }[] = [];
  private allUsdmPairs: CcxtPairInfo[] = [];

  constructor() {
    this.initEngine();
  }

  private async initEngine() {
    this.addLog('Initializing 100% Real Binance Futures Auto-Trading Engine via CCXT...', 'info');

    // 1. Load active trades directly from Supabase
    try {
      const fromDb = await fetchTradesFromSupabase();
      if (fromDb.open.length > 0 || fromDb.history.length > 0) {
        this.positions = [...fromDb.open, ...fromDb.history];
        this.addLog(`Loaded ${fromDb.open.length} active positions and ${fromDb.history.length} trade logs from Supabase.`, 'success');
      }
    } catch (dbErr) {
      console.warn('[Engine] Initial Supabase fetch note:', dbErr);
    }

    // 2. Load all 522+ USD-M active markets from Binance
    try {
      this.allUsdmPairs = await binanceCcxt.fetchAllUsdmPairs();
      this.status.monitoredPairsCount = this.allUsdmPairs.length;
      this.addLog(`Successfully indexed all ${this.allUsdmPairs.length} Binance Futures USD-M pairs for scanning.`, 'success');
    } catch (ccxtErr) {
      console.warn('[Engine] Pairs index fallback note:', ccxtErr);
    }

    // 3. Query real live account balance
    await this.refreshAccountBalance();

    this.updateStats();
    this.startEngine();
  }

  /**
   * Calculate Total Active Margin across all currently open trades
   */
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
    try {
      const balance = await binanceCcxt.fetchAccountBalance();
      this.status.accountBalance = Number(balance.totalUsdt) || 0;
      this.status.freeUsdt = Number(balance.freeUsdt) || 0;

      const { totalMarginUsdt } = this.calculateTotalActiveMargin();
      this.status.totalActiveMarginUsdt = totalMarginUsdt;
      this.status.totalActiveMarginPercent = this.status.accountBalance > 0
        ? Math.round((totalMarginUsdt / this.status.accountBalance) * 10000) / 100
        : 0;

      if (this.status.accountBalance > 0) {
        this.addLog(
          `Live Binance USD-M Wallet: $${this.status.accountBalance.toFixed(2)} USDT (Free: $${this.status.freeUsdt.toFixed(2)}, Active Margin: $${totalMarginUsdt.toFixed(2)} [${this.status.totalActiveMarginPercent.toFixed(1)}%])`,
          'success'
        );
      } else {
        this.addLog(`Live Binance USD-M Wallet: $0.00 USDT (Connected via CCXT)`, 'info');
      }
      return this.status.accountBalance;
    } catch (err: any) {
      this.status.accountBalance = 0;
      this.status.freeUsdt = 0;
      return 0;
    }
  }

  public startEngine() {
    this.status.isRunning = true;

    // Start 2-Minute Automated Scanner loop
    if (this.scanTimer) clearInterval(this.scanTimer);
    const intervalMs = this.settings.scanIntervalMinutes * 60 * 1000;

    // Run first scan 2 seconds after boot
    setTimeout(() => {
      this.runScannerCycle();
    }, 2000);

    this.scanTimer = setInterval(() => {
      if (this.status.isRunning && this.settings.autoTrading) {
        this.runScannerCycle();
      }
    }, intervalMs);

    // Continuous Position Lifecycle Management (checks SL / TP every 3 seconds)
    if (this.monitorTimer) clearInterval(this.monitorTimer);
    this.monitorTimer = setInterval(() => {
      this.checkPositionLifecycle();
    }, 3000);

    // Periodic live balance sync every 25 seconds
    setInterval(() => {
      if (this.status.isRunning) {
        this.refreshAccountBalance();
      }
    }, 25000);
  }

  public stopEngine() {
    this.status.isRunning = false;
    this.status.currentAction = 'Bot Status: Idle (Auto-Trading Paused)';
    this.status.analyzingSymbol = null;
    this.status.upcomingSignal = null;
    this.addLog('Auto-trading bot paused by user.', 'warn');
  }

  /**
   * Automated 2-Minute Market Scanner Cron Service
   * Scans all 522+ Binance Futures USD-M pairs in high-speed parallel batches via CCXT.
   */
  public async runScannerCycle() {
    if (this.isScanning) return;
    this.isScanning = true;

    this.status.lastScanTime = Date.now();
    this.status.nextScanTime = Date.now() + this.settings.scanIntervalMinutes * 60 * 1000;
    this.status.currentAction = 'Bot Status: Scanning Binance Pairs...';

    this.addLog('Starting 2-Minute Market Scanner across ALL active Binance Futures USD-M pairs...', 'info');

    try {
      // Refresh markets if needed
      if (this.allUsdmPairs.length === 0) {
        this.allUsdmPairs = await binanceCcxt.fetchAllUsdmPairs();
      }
      this.status.monitoredPairsCount = this.allUsdmPairs.length;

      const pairsToScan = this.allUsdmPairs;
      const batchSize = 12; // Parallel batch size to balance throughput and Binance rate limits

      for (let i = 0; i < pairsToScan.length; i += batchSize) {
        if (!this.status.isRunning) break;

        const batch = pairsToScan.slice(i, i + batchSize);
        const batchProgress = Math.min(pairsToScan.length, i + batchSize);

        // Process batch in parallel
        await Promise.allSettled(
          batch.map(async (pair) => {
            const sym = pair.symbol;

            // Broadcast current analyzing symbol to UI
            this.status.analyzingSymbol = sym;
            this.status.currentAction = `Analyzing ${sym} - SMC & Divergence Scan (${batchProgress}/${pairsToScan.length})...`;

            try {
              // Real live OHLCV candle data via CCXT
              const candles = await binanceCcxt.fetchKlines(sym, '5m', 60);
              if (candles.length < 25) return;

              // Perform Smart Money Concepts & Divergence Analysis
              const analysis = analyzeSMC(sym, candles);

              // High-confluence zone detected (Confluence >= 70%)
              if (analysis.confluenceScore >= 70 && analysis.bias !== 'NEUTRAL') {
                const actionSide = analysis.bias === 'LONG' ? 'BUY' : 'SELL';

                // Broadcast upcoming signal to UI
                this.status.upcomingSignal = {
                  symbol: sym,
                  pattern: `${analysis.bias === 'LONG' ? 'Bullish' : 'Bearish'} SMC Zone • ${analysis.divergence.description}`,
                  bias: analysis.bias,
                  confidence: analysis.confluenceScore,
                  entryEst: analysis.currentPrice,
                };

                this.status.currentAction = `Upcoming Signal: ${sym} - Validating with Gemini AI...`;
                this.addLog(
                  `Upcoming Signal: ${sym} (${analysis.bias}) with ${analysis.confluenceScore}% confluence. Deep validating via Gemini AI...`,
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
                  geminiConfidence: validation.confidence,
                  geminiReasoning: validation.reasoning,
                  confluenceScore: analysis.confluenceScore,
                  timestamp: Date.now(),
                  status: validation.approved ? 'APPROVED' : 'REJECTED',
                  source: 'SCANNER',
                };

                this.signals.unshift(signal);
                if (this.signals.length > 50) this.signals.pop();

                // Save signal to Supabase
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

        // Small throttle between batches to maintain sub-second rate compliance
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      this.status.currentAction = 'Bot Status: 2-Min Scan Complete. Monitoring Positions...';
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

    // 2. Order Type: Market Order if at entry zone, Limit Order if price is slightly off
    const livePrice = await binanceCcxt.fetchTickerPrice(signal.symbol);
    const inEntryZone =
      livePrice >= Math.min(signal.entryZoneMin, signal.entryZoneMax) &&
      livePrice <= Math.max(signal.entryZoneMin, signal.entryZoneMax);

    const orderType = inEntryZone ? 'MARKET' : 'LIMIT';
    const targetEntryPrice = inEntryZone ? livePrice : signal.price;

    // 3. Dynamic Position Sizing based on risk % and leverage
    const balanceInfo = await binanceCcxt.fetchAccountBalance();
    const totalUsdt = balanceInfo.totalUsdt > 0 ? balanceInfo.totalUsdt : this.status.accountBalance;
    const freeUsdt = balanceInfo.freeUsdt;
    this.status.accountBalance = totalUsdt;
    this.status.freeUsdt = freeUsdt;

    const riskPct = this.settings.riskPercentage || 2;
    const baseEquity = totalUsdt > 0 ? totalUsdt : 100;
    const riskAmount = (baseEquity * riskPct) / 100;
    const slDiff = Math.abs(targetEntryPrice - signal.stopLoss) || targetEntryPrice * 0.01;
    let qty = (riskAmount / slDiff) * (this.settings.leverage / 10);
    qty = Math.max(minQty, Math.round(qty * 1000) / 1000);

    const newPositionMargin = (targetEntryPrice * qty) / this.settings.leverage;

    // 4. Calculate Total Active Margin across all currently open trades
    const { totalMarginUsdt: currentActiveMargin, positionsCount: openPositionsCount } = this.calculateTotalActiveMargin();
    const currentActiveMarginPct = totalUsdt > 0 ? (currentActiveMargin / totalUsdt) * 100 : 0;
    const maxMarginCapPct = Number(this.settings.maxTotalMarginPct) || CONFIG.MAX_TOTAL_MARGIN_PCT || 10;
    const projectedTotalMargin = currentActiveMargin + newPositionMargin;
    const projectedMarginPct = totalUsdt > 0 ? (projectedTotalMargin / totalUsdt) * 100 : 100;

    console.log(
      `[RISK EVALUATION] Signal ${signal.side} ${signal.symbol}: ` +
      `Total Balance: $${totalUsdt.toFixed(2)} USDT, Available Free USDT: $${freeUsdt.toFixed(2)} USDT | ` +
      `Active Margin: $${currentActiveMargin.toFixed(2)} USDT (${currentActiveMarginPct.toFixed(2)}% in ${openPositionsCount} positions) | ` +
      `New Position Margin: $${newPositionMargin.toFixed(2)} USDT | ` +
      `Projected Total Margin: $${projectedTotalMargin.toFixed(2)} USDT (${projectedMarginPct.toFixed(2)}%) | ` +
      `Configured Cap: ${maxMarginCapPct}% | Margin Mode: ISOLATED`
    );

    // 5. Insufficient Balance Handling: Check available USDT balance before placing order
    if (freeUsdt < newPositionMargin || totalUsdt <= 0) {
      console.warn(
        `Insufficient USDT balance to open trade. Available USDT: $${freeUsdt.toFixed(2)}, Required Margin: $${newPositionMargin.toFixed(2)}, Total Active Margin: ${currentActiveMarginPct.toFixed(2)}% ($${currentActiveMargin.toFixed(2)} USDT). Trade rejected for ${signal.symbol}.`
      );
      this.addLog(
        `Insufficient USDT balance to open trade. Available: $${freeUsdt.toFixed(2)} USDT, Required Margin: $${newPositionMargin.toFixed(2)} USDT. Active Margin: ${currentActiveMarginPct.toFixed(2)}%`,
        'warn'
      );
      signal.status = 'REJECTED';
      return;
    }

    // 6. Enforce Max Margin Cap (Configurable, default 10%)
    if (projectedMarginPct > maxMarginCapPct) {
      console.warn(
        `[RISK REJECTED] Total active margin (${projectedMarginPct.toFixed(2)}%) exceeds configured cap of ${maxMarginCapPct}%. ` +
        `Available USDT: $${freeUsdt.toFixed(2)}, Active Margin: $${currentActiveMargin.toFixed(2)} USDT (${currentActiveMarginPct.toFixed(2)}%), ` +
        `New Position Margin: $${newPositionMargin.toFixed(2)} USDT, Total Balance: $${totalUsdt.toFixed(2)} USDT. Trade rejected for ${signal.symbol}.`
      );
      this.addLog(
        `[RISK REJECTED] Total active margin (${projectedMarginPct.toFixed(2)}%) exceeds configured cap of ${maxMarginCapPct}%. Available USDT: $${freeUsdt.toFixed(2)}, Active Margin: $${currentActiveMargin.toFixed(2)} USDT. Trade rejected for ${signal.symbol}.`,
        'warn'
      );
      signal.status = 'REJECTED';
      return;
    }

    // 7. Enforce Strictly ISOLATED Margin Mode Only (Reject Cross Margin)
    const isolatedCheck = await binanceCcxt.ensureIsolatedMargin(signal.symbol);
    if (!isolatedCheck.success) {
      console.error(
        `[RISK REJECTED] Failed to enforce ISOLATED margin mode for ${signal.symbol}: ${isolatedCheck.message}. Cross margin is strictly prohibited to avoid account liquidation risks.`
      );
      this.addLog(
        `[RISK REJECTED] Failed to enforce ISOLATED margin mode for ${signal.symbol}. Cross margin mode is strictly prohibited.`,
        'warn'
      );
      signal.status = 'REJECTED';
      return;
    }

    // 8. Execute Real Order on Binance Futures via CCXT (with Dynamic 1% SL & 2% TP brackets)
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
      this.addLog(`Binance Futures order error: ${execErr.message}`, 'warn');
      return;
    }

    const fillPrice = executionResult.executedPrice || targetEntryPrice;

    // 9. Create Position record with status OPEN and marginMode: ISOLATED
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
      marginUsed: newPositionMargin,
      marginMode: 'ISOLATED',
      openedAt: Date.now(),
      status: 'OPEN',
      signalId: signal.id,
      source: signal.source,
    };

    this.positions.unshift(newPosition);
    signal.status = 'EXECUTED';

    // 10. Save directly to Supabase with status OPEN
    await saveTradeToSupabase(newPosition, executionResult);

    console.log(
      `[TRADE EXECUTED] ${signal.side} ${qty} ${signal.symbol} @ $${fillPrice.toFixed(2)} [ISOLATED]. ` +
      `Allocated Margin: $${newPositionMargin.toFixed(2)} USDT. ` +
      `Total Active Margin: $${(currentActiveMargin + newPositionMargin).toFixed(2)} USDT (${projectedMarginPct.toFixed(2)}% / ${maxMarginCapPct}% cap). ` +
      `Available USDT remaining: $${Math.max(0, freeUsdt - newPositionMargin).toFixed(2)} USDT.`
    );

    this.addLog(
      `${executionResult.isSimulated ? 'PAPER/SIMULATED' : 'REAL BINANCE'} TRADE EXECUTED: ${signal.side} ${qty} ${signal.symbol} @ $${fillPrice.toFixed(2)} [ISOLATED | SL: $${signal.stopLoss.toFixed(2)} | TP: $${signal.takeProfit.toFixed(2)}] (Active Margin: ${projectedMarginPct.toFixed(1)}% / ${maxMarginCapPct}% cap)`,
      'trade'
    );

    this.updateStats();
  }

  /**
   * Continuous Position Lifecycle Management (Auto Close):
   * Monitors open positions and triggers close when SL or TP targets are filled on Binance Futures,
   * updating status in Supabase to WIN or LOSS.
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

        // Check Take Profit Target Filled (+2%) -> Close on Binance & Update Supabase to WIN
        const tpHit = isLong ? livePrice >= pos.takeProfit : livePrice <= pos.takeProfit;
        if (tpHit) {
          await this.finalizeClosePosition(pos, 'WIN', pos.takeProfit, `Take Profit Target Filled (+${pos.unrealizedPnlPercent.toFixed(1)}% on Binance Futures)`);
          continue;
        }

        // Check Stop Loss Target Hit (-1%) -> Close on Binance & Update Supabase to LOSS
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

  /**
   * Finalize position close, close on Binance Futures, and persist to Supabase
   */
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

    // Execute real close on Binance Futures
    try {
      await binanceCcxt.closePositionReal({
        symbol: pos.symbol,
        side: pos.side,
        quantity: pos.quantity,
      });
    } catch (closeErr) {
      console.warn('[Engine] Binance close order note:', closeErr);
    }

    // Update trade record directly in Supabase
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

  /**
   * Manual position close from UI
   */
  public async closePosition(positionId: string, reason: string = 'Manual close from UI'): Promise<Position | null> {
    const pos = this.positions.find((p) => p.id === positionId && p.status === 'OPEN');
    if (!pos) return null;

    const livePrice = await binanceCcxt.fetchTickerPrice(pos.symbol);
    const exitPrice = livePrice > 0 ? livePrice : pos.currentPrice;
    const isWin = (pos.side === 'LONG' ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice) >= 0;

    await this.finalizeClosePosition(pos, isWin ? 'WIN' : 'LOSS', exitPrice, reason);
    return pos;
  }

  /**
   * External Webhook Handler (/api/webhook)
   */
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

    // Run Gemini Validation
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
      geminiConfidence: validation.confidence,
      geminiReasoning: validation.reasoning,
      confluenceScore: analysis.confluenceScore,
      timestamp: Date.now(),
      status: validation.approved ? 'APPROVED' : 'REJECTED',
      source: 'WEBHOOK',
    };

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

  public updateSettings(newSettings: Partial<BotSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    if (newSettings.maxTotalMarginPct !== undefined) {
      this.settings.maxTotalMarginPct = Number(newSettings.maxTotalMarginPct);
      this.status.maxTotalMarginPct = this.settings.maxTotalMarginPct;
    }
    this.settings.marginMode = 'ISOLATED'; // Strictly ISOLATED only
    this.status.marginMode = 'ISOLATED';
    this.status.tradingMode = this.settings.tradingMode;
    this.status.geminiThreshold = this.settings.geminiThreshold;
    binanceCcxt.setCredentials(
      this.settings.binanceApiKey,
      this.settings.binanceApiSecret,
      this.settings.tradingMode === 'TESTNET'
    );
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

  /**
   * Option 1: Clear Unexecuted Signals/Analysis Only (Safe Mode)
   * Deletes all signals that did not turn into active trades and resets past engine logs.
   * STRICT SAFETY GUARD: All currently OPEN positions and their SL/TP tracking remain completely untouched.
   */
  public async clearUnexecutedSignalsAndLogs(): Promise<{
    success: boolean;
    clearedSignalsCount: number;
    clearedLogsCount: number;
    openPositionsPreserved: number;
  }> {
    // 1. Identify open positions to ensure safety
    const openPositions = this.positions.filter((p) => p.status === 'OPEN');
    const openSignalIds = new Set(
      openPositions.map((p) => p.signalId).filter((id): id is string => !!id)
    );

    const initialSignalsCount = this.signals.length;
    // Retain only signals that actually turned into active trades or match open trades
    this.signals = this.signals.filter(
      (s) => s.status === 'EXECUTED' || openSignalIds.has(s.id)
    );
    const clearedSignalsCount = initialSignalsCount - this.signals.length;

    const clearedLogsCount = this.scanLogs.length;
    this.scanLogs = [];

    this.addLog(
      `[Safe Mode Cleanup] Cleared ${clearedSignalsCount} unexecuted signals and ${clearedLogsCount} past logs. All ${openPositions.length} active OPEN trades strictly preserved.`,
      'info'
    );

    // 2. Execute deletion on Supabase database
    await deleteUnexecutedSignalsFromSupabase();

    // 3. Recalculate stats
    this.updateStats();

    return {
      success: true,
      clearedSignalsCount,
      clearedLogsCount,
      openPositionsPreserved: openPositions.length,
    };
  }

  /**
   * Option 2: Clear All History (Keep Active Positions)
   * Wipes out past logs, closed trade history, and previous analysis from Supabase and UI.
   * STRICT SAFETY GUARD: Active OPEN positions are NEVER deleted or disconnected from SL/TP tracking.
   */
  public async clearAllHistoryKeepOpenPositions(): Promise<{
    success: boolean;
    clearedClosedTradesCount: number;
    clearedSignalsCount: number;
    clearedLogsCount: number;
    openPositionsPreserved: number;
  }> {
    // 1. HARDCODED SAFETY GUARD: Strictly isolate and preserve all OPEN positions
    const openPositions = this.positions.filter((p) => p.status === 'OPEN');
    const openSignalIds = openPositions
      .map((p) => p.signalId)
      .filter((id): id is string => !!id);

    const closedTradesCount = this.positions.filter((p) => p.status !== 'OPEN').length;
    const initialSignalsCount = this.signals.length;
    const initialLogsCount = this.scanLogs.length;

    // 2. In-memory cleanup: Retain ONLY active OPEN positions
    this.positions = [...openPositions];

    // 3. Retain only signals attached to open positions
    this.signals = this.signals.filter((s) => s.id && openSignalIds.includes(s.id));
    const clearedSignalsCount = initialSignalsCount - this.signals.length;

    // 4. Reset logs
    this.scanLogs = [];
    this.addLog(
      `[History Cleanup] Cleared ${closedTradesCount} closed trades, ${clearedSignalsCount} historical signals, and ${initialLogsCount} logs. All ${openPositions.length} active OPEN trades strictly preserved.`,
      'info'
    );

    // 5. Execute Supabase cleanup
    await deleteAllHistoryKeepOpenPositionsFromSupabase(openSignalIds);

    // 6. Recalculate stats
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

