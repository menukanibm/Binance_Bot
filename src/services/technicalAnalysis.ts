import {
  Candle,
  OrderBlock,
  FairValueGap,
  LiquiditySweep,
  DivergenceData,
  SMCAnalysisResult,
} from '../types/trading';

/**
 * Technical Analysis & Smart Money Concepts (SMC) Engine
 * Analyzes OHLCV data for:
 * 1. Order Blocks (Bullish & Bearish)
 * 2. Fair Value Gaps (FVG)
 * 3. Liquidity Sweeps (High/Low buy-side & sell-side sweeps)
 * 4. RSI & MACD Divergences
 */

export function calculateRSI(candles: Candle[], period: number = 14): number[] {
  if (candles.length <= period) return [];

  const rsi: number[] = new Array(candles.length).fill(50);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

export function calculateEMA(values: number[], period: number): number[] {
  const ema: number[] = new Array(values.length).fill(0);
  if (values.length < period) return ema;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  ema[period - 1] = sum / period;

  const multiplier = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    ema[i] = (values[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }

  return ema;
}

export function calculateMACD(candles: Candle[]): {
  macd: number[];
  signal: number[];
  hist: number[];
} {
  const closes = candles.map((c) => c.close);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  const macdLine: number[] = new Array(closes.length).fill(0);
  for (let i = 25; i < closes.length; i++) {
    macdLine[i] = ema12[i] - ema26[i];
  }

  const signalLine = calculateEMA(macdLine.slice(25), 9);
  const paddedSignal: number[] = new Array(closes.length).fill(0);
  for (let i = 0; i < signalLine.length; i++) {
    paddedSignal[i + 25 + 8] = signalLine[i + 8] || 0;
  }

  const hist: number[] = new Array(closes.length).fill(0);
  for (let i = 33; i < closes.length; i++) {
    hist[i] = macdLine[i] - paddedSignal[i];
  }

  return { macd: macdLine, signal: paddedSignal, hist };
}

/**
 * Detect Order Blocks (OB)
 * Bullish OB: Last down-close candle before a strong impulsive rally breaking swing high.
 * Bearish OB: Last up-close candle before a strong impulsive drop breaking swing low.
 */
export function detectOrderBlocks(candles: Candle[]): OrderBlock[] {
  const orderBlocks: OrderBlock[] = [];
  const len = candles.length;
  if (len < 10) return orderBlocks;

  const currentPrice = candles[len - 1].close;

  for (let i = 5; i < len - 2; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const next1 = candles[i + 1];
    const next2 = candles[i + 2];

    const isDownCandle = c.close < c.open;
    const isUpCandle = c.close > c.open;

    // Bullish OB: down candle followed by 2 strong green candles with volume expansion
    if (isDownCandle && next1.close > next1.open && next2.close > next2.open) {
      const impulseMove = next2.close - c.low;
      const averageBody = Math.abs(prev.close - prev.open) || 1;
      const displacementRatio = impulseMove / averageBody;

      // Break of local high
      const localHigh = Math.max(...candles.slice(Math.max(0, i - 4), i).map((x) => x.high));
      const brokeStructure = next2.high > localHigh;

      if (brokeStructure || displacementRatio > 2.2) {
        // Check mitigation: did any subsequent candle breach below the OB low?
        let mitigated = false;
        for (let j = i + 3; j < len; j++) {
          if (candles[j].low < c.low) {
            mitigated = true;
            break;
          }
        }

        orderBlocks.push({
          type: 'BULLISH',
          high: Math.max(c.open, c.close),
          low: c.low,
          candleIndex: i,
          timestamp: c.time,
          mitigated,
          strength: Math.min(95, Math.round(displacementRatio * 20)),
        });
      }
    }

    // Bearish OB: up candle followed by 2 strong red candles with volume expansion
    if (isUpCandle && next1.close < next1.open && next2.close < next2.open) {
      const impulseMove = c.high - next2.close;
      const averageBody = Math.abs(prev.close - prev.open) || 1;
      const displacementRatio = impulseMove / averageBody;

      // Break of local low
      const localLow = Math.min(...candles.slice(Math.max(0, i - 4), i).map((x) => x.low));
      const brokeStructure = next2.low < localLow;

      if (brokeStructure || displacementRatio > 2.2) {
        let mitigated = false;
        for (let j = i + 3; j < len; j++) {
          if (candles[j].high > c.high) {
            mitigated = true;
            break;
          }
        }

        orderBlocks.push({
          type: 'BEARISH',
          high: c.high,
          low: Math.min(c.open, c.close),
          candleIndex: i,
          timestamp: c.time,
          mitigated,
          strength: Math.min(95, Math.round(displacementRatio * 20)),
        });
      }
    }
  }

  // Return unmitigated or closest recent active blocks
  return orderBlocks.slice(-8);
}

/**
 * Detect Fair Value Gaps (FVG)
 * Bullish FVG: low[i] > high[i-2]
 * Bearish FVG: high[i] < low[i-2]
 */
export function detectFairValueGaps(candles: Candle[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  const len = candles.length;
  if (len < 5) return fvgs;

  for (let i = 2; i < len; i++) {
    const candle1 = candles[i - 2];
    const candle3 = candles[i];

    // Bullish FVG
    if (candle3.low > candle1.high) {
      const gapSize = candle3.low - candle1.high;
      const minThreshold = candle1.high * 0.0008; // 0.08% minimum gap

      if (gapSize >= minThreshold) {
        // Check mitigation: has later price dipped into the gap?
        let mitigated = false;
        for (let j = i + 1; j < len; j++) {
          if (candles[j].low <= candle1.high) {
            mitigated = true;
            break;
          }
        }

        fvgs.push({
          type: 'BULLISH',
          top: candle3.low,
          bottom: candle1.high,
          candleIndex: i - 1,
          timestamp: candles[i - 1].time,
          mitigated,
        });
      }
    }

    // Bearish FVG
    if (candle3.high < candle1.low) {
      const gapSize = candle1.low - candle3.high;
      const minThreshold = candle1.low * 0.0008;

      if (gapSize >= minThreshold) {
        let mitigated = false;
        for (let j = i + 1; j < len; j++) {
          if (candles[j].high >= candle1.low) {
            mitigated = true;
            break;
          }
        }

        fvgs.push({
          type: 'BEARISH',
          top: candle1.low,
          bottom: candle3.high,
          candleIndex: i - 1,
          timestamp: candles[i - 1].time,
          mitigated,
        });
      }
    }
  }

  return fvgs.slice(-10);
}

/**
 * Detect Liquidity Sweeps
 * Identifies wick sweeps above swing highs or below swing lows followed by rapid rejection
 */
export function detectLiquiditySweeps(candles: Candle[]): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = [];
  const len = candles.length;
  if (len < 15) return sweeps;

  for (let i = 10; i < len; i++) {
    const c = candles[i];
    const prevRange = candles.slice(i - 8, i);
    const priorHigh = Math.max(...prevRange.map((x) => x.high));
    const priorLow = Math.min(...prevRange.map((x) => x.low));

    // High Liquidity Sweep: wicked above prior high but closed below it
    if (c.high > priorHigh && c.close < priorHigh) {
      const upperWick = c.high - Math.max(c.open, c.close);
      const totalCandle = c.high - c.low || 1;
      const wickPercent = (upperWick / totalCandle) * 100;

      if (wickPercent >= 45) {
        sweeps.push({
          type: 'HIGH_SWEEP',
          level: priorHigh,
          candleIndex: i,
          timestamp: c.time,
          wickSizePercent: Math.round(wickPercent),
        });
      }
    }

    // Low Liquidity Sweep: wicked below prior low but closed above it
    if (c.low < priorLow && c.close > priorLow) {
      const lowerWick = Math.min(c.open, c.close) - c.low;
      const totalCandle = c.high - c.low || 1;
      const wickPercent = (lowerWick / totalCandle) * 100;

      if (wickPercent >= 45) {
        sweeps.push({
          type: 'LOW_SWEEP',
          level: priorLow,
          candleIndex: i,
          timestamp: c.time,
          wickSizePercent: Math.round(wickPercent),
        });
      }
    }
  }

  return sweeps.slice(-6);
}

/**
 * Detect Divergence: RSI & MACD
 * Bullish Divergence: Price Lower Low, RSI/MACD Higher Low
 * Bearish Divergence: Price Higher High, RSI/MACD Lower High
 */
export function detectDivergence(candles: Candle[]): DivergenceData {
  const len = candles.length;
  if (len < 30) {
    return {
      type: 'NONE',
      rsiValue: 50,
      macdHist: 0,
      description: 'Insufficient candles for divergence detection',
      strength: 0,
    };
  }

  const rsi = calculateRSI(candles, 14);
  const { hist } = calculateMACD(candles);

  const currentRsi = Math.round(rsi[len - 1] || 50);
  const currentHist = hist[len - 1] || 0;

  // Find swing lows and swing highs in price
  let low1Idx = -1;
  let low2Idx = -1;
  let high1Idx = -1;
  let high2Idx = -1;

  for (let i = len - 3; i >= len - 20; i--) {
    // Local low
    if (candles[i].low <= candles[i - 1].low && candles[i].low <= candles[i + 1].low) {
      if (low2Idx === -1) low2Idx = i;
      else if (low1Idx === -1 && i < low2Idx - 2) {
        low1Idx = i;
        break;
      }
    }
  }

  for (let i = len - 3; i >= len - 20; i--) {
    // Local high
    if (candles[i].high >= candles[i - 1].high && candles[i].high >= candles[i + 1].high) {
      if (high2Idx === -1) high2Idx = i;
      else if (high1Idx === -1 && i < high2Idx - 2) {
        high1Idx = i;
        break;
      }
    }
  }

  // Check Bullish Divergence
  if (low1Idx !== -1 && low2Idx !== -1) {
    const priceLow1 = candles[low1Idx].low;
    const priceLow2 = candles[low2Idx].low;
    const rsiLow1 = rsi[low1Idx];
    const rsiLow2 = rsi[low2Idx];

    // Price made Lower Low or equal, RSI made Higher Low
    if (priceLow2 < priceLow1 && rsiLow2 > rsiLow1 + 1.5 && rsiLow2 < 45) {
      return {
        type: 'BULLISH_RSI',
        rsiValue: currentRsi,
        macdHist: currentHist,
        description: `Bullish RSI Divergence: Price lower low (${priceLow2.toFixed(2)}) with RSI higher low (${rsiLow1.toFixed(1)} -> ${rsiLow2.toFixed(1)})`,
        strength: Math.min(95, Math.round((rsiLow2 - rsiLow1) * 6 + 50)),
      };
    }

    // MACD Histogram Bullish Divergence
    if (priceLow2 < priceLow1 && hist[low2Idx] > hist[low1Idx] && hist[low2Idx] < 0) {
      return {
        type: 'BULLISH_MACD',
        rsiValue: currentRsi,
        macdHist: currentHist,
        description: `Bullish MACD Divergence: Histogram momentum curling up while price made lower low`,
        strength: 75,
      };
    }
  }

  // Check Bearish Divergence
  if (high1Idx !== -1 && high2Idx !== -1) {
    const priceHigh1 = candles[high1Idx].high;
    const priceHigh2 = candles[high2Idx].high;
    const rsiHigh1 = rsi[high1Idx];
    const rsiHigh2 = rsi[high2Idx];

    // Price made Higher High, RSI made Lower High
    if (priceHigh2 > priceHigh1 && rsiHigh2 < rsiHigh1 - 1.5 && rsiHigh2 > 55) {
      return {
        type: 'BEARISH_RSI',
        rsiValue: currentRsi,
        macdHist: currentHist,
        description: `Bearish RSI Divergence: Price higher high (${priceHigh2.toFixed(2)}) with RSI lower high (${rsiHigh1.toFixed(1)} -> ${rsiHigh2.toFixed(1)})`,
        strength: Math.min(95, Math.round((rsiHigh1 - rsiHigh2) * 6 + 50)),
      };
    }

    if (priceHigh2 > priceHigh1 && hist[high2Idx] < hist[high1Idx] && hist[high2Idx] > 0) {
      return {
        type: 'BEARISH_MACD',
        rsiValue: currentRsi,
        macdHist: currentHist,
        description: `Bearish MACD Divergence: Histogram fading while price created new highs`,
        strength: 75,
      };
    }
  }

  return {
    type: 'NONE',
    rsiValue: currentRsi,
    macdHist: currentHist,
    description: `No divergence. RSI: ${currentRsi}, MACD Hist: ${currentHist.toFixed(4)}`,
    strength: 0,
  };
}

/**
 * Full SMC Analysis synthesizing Order Blocks, Fair Value Gaps, Liquidity Sweeps, and Divergence
 */
export function analyzeSMC(symbol: string, candles: Candle[]): SMCAnalysisResult {
  const currentPrice = candles[candles.length - 1]?.close || 0;
  const orderBlocks = detectOrderBlocks(candles);
  const fvgZones = detectFairValueGaps(candles);
  const liquiditySweeps = detectLiquiditySweeps(candles);
  const divergence = detectDivergence(candles);

  const activeBullishOB = orderBlocks.find((b) => b.type === 'BULLISH' && !b.mitigated);
  const activeBearishOB = orderBlocks.find((b) => b.type === 'BEARISH' && !b.mitigated);

  const activeBullishFVG = fvgZones.find((f) => f.type === 'BULLISH' && !f.mitigated);
  const activeBearishFVG = fvgZones.find((f) => f.type === 'BEARISH' && !f.mitigated);

  const recentSweep = liquiditySweeps[liquiditySweeps.length - 1];

  let longScore = 0;
  let shortScore = 0;
  const reasons: string[] = [];

  // Evaluate Long Confluence
  if (divergence.type === 'BULLISH_RSI' || divergence.type === 'BULLISH_MACD') {
    longScore += 35;
    reasons.push(divergence.description);
  }
  if (recentSweep && recentSweep.type === 'LOW_SWEEP') {
    longScore += 25;
    reasons.push(`Sell-side liquidity sweep at ${recentSweep.level.toFixed(2)} with ${recentSweep.wickSizePercent}% rejection wick`);
  }
  if (activeBullishOB) {
    const distToOB = Math.abs(currentPrice - activeBullishOB.high) / currentPrice;
    if (distToOB < 0.015) {
      longScore += 25;
      reasons.push(`Price testing Bullish Order Block zone [${activeBullishOB.low.toFixed(2)} - ${activeBullishOB.high.toFixed(2)}]`);
    } else {
      longScore += 10;
    }
  }
  if (activeBullishFVG) {
    const distToFVG = Math.abs(currentPrice - activeBullishFVG.top) / currentPrice;
    if (distToFVG < 0.015) {
      longScore += 20;
      reasons.push(`Active Bullish FVG imbalance [${activeBullishFVG.bottom.toFixed(2)} - ${activeBullishFVG.top.toFixed(2)}]`);
    }
  }

  // Evaluate Short Confluence
  if (divergence.type === 'BEARISH_RSI' || divergence.type === 'BEARISH_MACD') {
    shortScore += 35;
    reasons.push(divergence.description);
  }
  if (recentSweep && recentSweep.type === 'HIGH_SWEEP') {
    shortScore += 25;
    reasons.push(`Buy-side liquidity sweep at ${recentSweep.level.toFixed(2)} with ${recentSweep.wickSizePercent}% rejection wick`);
  }
  if (activeBearishOB) {
    const distToOB = Math.abs(currentPrice - activeBearishOB.low) / currentPrice;
    if (distToOB < 0.015) {
      shortScore += 25;
      reasons.push(`Price testing Bearish Order Block zone [${activeBearishOB.low.toFixed(2)} - ${activeBearishOB.high.toFixed(2)}]`);
    } else {
      shortScore += 10;
    }
  }
  if (activeBearishFVG) {
    const distToFVG = Math.abs(currentPrice - activeBearishFVG.bottom) / currentPrice;
    if (distToFVG < 0.015) {
      shortScore += 20;
      reasons.push(`Active Bearish FVG imbalance [${activeBearishFVG.bottom.toFixed(2)} - ${activeBearishFVG.top.toFixed(2)}]`);
    }
  }

  let bias: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  let confluenceScore = 0;
  let entryZone = { min: currentPrice * 0.995, max: currentPrice * 1.005, mid: currentPrice };

  if (longScore >= 55 && longScore > shortScore) {
    bias = 'LONG';
    confluenceScore = Math.min(95, longScore);
    const obLow = activeBullishOB ? activeBullishOB.low : currentPrice * 0.99;
    const obHigh = activeBullishOB ? activeBullishOB.high : currentPrice * 1.002;
    entryZone = { min: Math.min(obLow, currentPrice * 0.995), max: Math.max(obHigh, currentPrice), mid: currentPrice };
  } else if (shortScore >= 55 && shortScore > longScore) {
    bias = 'SHORT';
    confluenceScore = Math.min(95, shortScore);
    const obLow = activeBearishOB ? activeBearishOB.low : currentPrice * 0.998;
    const obHigh = activeBearishOB ? activeBearishOB.high : currentPrice * 1.01;
    entryZone = { min: Math.min(obLow, currentPrice), max: Math.max(obHigh, currentPrice * 1.005), mid: currentPrice };
  } else {
    confluenceScore = Math.max(longScore, shortScore);
  }

  return {
    symbol,
    currentPrice,
    orderBlocks,
    fvgZones,
    liquiditySweeps,
    divergence,
    bias,
    confluenceScore,
    entryZone,
    keyReasoning: reasons.length > 0 ? reasons.join(' • ') : 'Neutral market structure - waiting for clean OB / FVG tap or liquidity sweep',
  };
}
