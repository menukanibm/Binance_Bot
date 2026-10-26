import {
  Candle,
  OrderBlock,
  FairValueGap,
  LiquiditySweep,
  DivergenceData,
  ElliottWaveAnalysis,
  SMCAnalysisResult,
} from '../types/trading';

/**
 * Technical Analysis & Smart Money Concepts (SMC) + Elliott Wave Engine
 * Analyzes Binance USD-M OHLCV data for:
 * 1. Order Blocks (Bullish & Bearish)
 * 2. Fair Value Gaps (FVG)
 * 3. Liquidity Sweeps (High/Low buy-side & sell-side sweeps)
 * 4. RSI & MACD Divergences
 * 5. Elliott Wave Theory Structures (Impulse 1-5 & Corrective ABC waves + Fibonacci confluence)
 */

export function calculateRSI(candles: Candle[], period: number = 14): number[] {
  if (candles.length <= period) return [];

  const rsi: number[] = new Array(candles.length).fill(50);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = (candles[i]?.close ?? 0) - (candles[i - 1]?.close ?? 0);
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < candles.length; i++) {
    const diff = (candles[i]?.close ?? 0) - (candles[i - 1]?.close ?? 0);
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
  for (let i = 0; i < period; i++) sum += values[i] ?? 0;
  ema[period - 1] = sum / period;

  const multiplier = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    ema[i] = ((values[i] ?? 0) - (ema[i - 1] ?? 0)) * multiplier + (ema[i - 1] ?? 0);
  }

  return ema;
}

export function calculateMACD(candles: Candle[]): {
  macd: number[];
  signal: number[];
  hist: number[];
} {
  const closes = candles.map((c) => c?.close ?? 0);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  const macdLine: number[] = new Array(closes.length).fill(0);
  for (let i = 25; i < closes.length; i++) {
    macdLine[i] = (ema12[i] ?? 0) - (ema26[i] ?? 0);
  }

  const signalLine = calculateEMA(macdLine.slice(25), 9);
  const paddedSignal: number[] = new Array(closes.length).fill(0);
  for (let i = 0; i < signalLine.length; i++) {
    paddedSignal[i + 25 + 8] = signalLine[i + 8] || 0;
  }

  const hist: number[] = new Array(closes.length).fill(0);
  for (let i = 33; i < closes.length; i++) {
    hist[i] = (macdLine[i] ?? 0) - (paddedSignal[i] ?? 0);
  }

  return { macd: macdLine, signal: paddedSignal, hist };
}

/**
 * Detect Order Blocks (OB)
 */
export function detectOrderBlocks(candles: Candle[]): OrderBlock[] {
  const orderBlocks: OrderBlock[] = [];
  const len = candles.length;
  if (len < 10) return orderBlocks;

  for (let i = 5; i < len - 2; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const next1 = candles[i + 1];
    const next2 = candles[i + 2];

    if (!c || !prev || !next1 || !next2) continue;

    const isDownCandle = c.close < c.open;
    const isUpCandle = c.close > c.open;

    // Bullish OB
    if (isDownCandle && next1.close > next1.open && next2.close > next2.open) {
      const impulseMove = next2.close - c.low;
      const averageBody = Math.abs(prev.close - prev.open) || 1;
      const displacementRatio = impulseMove / averageBody;

      const localHigh = Math.max(...candles.slice(Math.max(0, i - 4), i).map((x) => x?.high ?? 0));
      const brokeStructure = next2.high > localHigh;

      if (brokeStructure || displacementRatio > 2.2) {
        let mitigated = false;
        for (let j = i + 3; j < len; j++) {
          if ((candles[j]?.low ?? Infinity) < c.low) {
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

    // Bearish OB
    if (isUpCandle && next1.close < next1.open && next2.close < next2.open) {
      const impulseMove = c.high - next2.close;
      const averageBody = Math.abs(prev.close - prev.open) || 1;
      const displacementRatio = impulseMove / averageBody;

      const localLow = Math.min(...candles.slice(Math.max(0, i - 4), i).map((x) => x?.low ?? Infinity));
      const brokeStructure = next2.low < localLow;

      if (brokeStructure || displacementRatio > 2.2) {
        let mitigated = false;
        for (let j = i + 3; j < len; j++) {
          if ((candles[j]?.high ?? -Infinity) > c.high) {
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

  return orderBlocks.slice(-8);
}

/**
 * Detect Fair Value Gaps (FVG)
 */
export function detectFairValueGaps(candles: Candle[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  const len = candles.length;
  if (len < 5) return fvgs;

  for (let i = 2; i < len; i++) {
    const candle1 = candles[i - 2];
    const candle3 = candles[i];
    if (!candle1 || !candle3) continue;

    // Bullish FVG
    if (candle3.low > candle1.high) {
      const gapSize = candle3.low - candle1.high;
      const minThreshold = candle1.high * 0.0008;

      if (gapSize >= minThreshold) {
        let mitigated = false;
        for (let j = i + 1; j < len; j++) {
          if ((candles[j]?.low ?? Infinity) <= candle1.high) {
            mitigated = true;
            break;
          }
        }

        fvgs.push({
          type: 'BULLISH',
          top: candle3.low,
          bottom: candle1.high,
          candleIndex: i - 1,
          timestamp: candles[i - 1]?.time ?? 0,
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
          if ((candles[j]?.high ?? -Infinity) >= candle1.low) {
            mitigated = true;
            break;
          }
        }

        fvgs.push({
          type: 'BEARISH',
          top: candle1.low,
          bottom: candle3.high,
          candleIndex: i - 1,
          timestamp: candles[i - 1]?.time ?? 0,
          mitigated,
        });
      }
    }
  }

  return fvgs.slice(-10);
}

/**
 * Detect Liquidity Sweeps
 */
export function detectLiquiditySweeps(candles: Candle[]): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = [];
  const len = candles.length;
  if (len < 15) return sweeps;

  for (let i = 10; i < len; i++) {
    const c = candles[i];
    if (!c) continue;
    const prevRange = candles.slice(i - 8, i);
    const priorHigh = Math.max(...prevRange.map((x) => x?.high ?? 0));
    const priorLow = Math.min(...prevRange.map((x) => x?.low ?? Infinity));

    // High Liquidity Sweep
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

    // Low Liquidity Sweep
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

  let low1Idx = -1;
  let low2Idx = -1;
  let high1Idx = -1;
  let high2Idx = -1;

  for (let i = len - 3; i >= len - 20; i--) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const next = candles[i + 1];
    if (!curr || !prev || !next) continue;

    if (curr.low <= prev.low && curr.low <= next.low) {
      if (low2Idx === -1) low2Idx = i;
      else if (low1Idx === -1 && i < low2Idx - 2) {
        low1Idx = i;
        break;
      }
    }
  }

  for (let i = len - 3; i >= len - 20; i--) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const next = candles[i + 1];
    if (!curr || !prev || !next) continue;

    if (curr.high >= prev.high && curr.high >= next.high) {
      if (high2Idx === -1) high2Idx = i;
      else if (high1Idx === -1 && i < high2Idx - 2) {
        high1Idx = i;
        break;
      }
    }
  }

  // Check Bullish Divergence
  if (low1Idx !== -1 && low2Idx !== -1) {
    const priceLow1 = candles[low1Idx]?.low ?? 0;
    const priceLow2 = candles[low2Idx]?.low ?? 0;
    const rsiLow1 = rsi[low1Idx] ?? 50;
    const rsiLow2 = rsi[low2Idx] ?? 50;

    if (priceLow2 < priceLow1 && rsiLow2 > rsiLow1 + 1.5 && rsiLow2 < 45) {
      return {
        type: 'BULLISH_RSI',
        rsiValue: currentRsi,
        macdHist: currentHist,
        description: `Bullish RSI Divergence: Price lower low (${priceLow2.toFixed(2)}) with RSI higher low (${rsiLow1.toFixed(1)} -> ${rsiLow2.toFixed(1)})`,
        strength: Math.min(95, Math.round((rsiLow2 - rsiLow1) * 6 + 50)),
      };
    }

    if (priceLow2 < priceLow1 && (hist[low2Idx] ?? 0) > (hist[low1Idx] ?? 0) && (hist[low2Idx] ?? 0) < 0) {
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
    const priceHigh1 = candles[high1Idx]?.high ?? 0;
    const priceHigh2 = candles[high2Idx]?.high ?? 0;
    const rsiHigh1 = rsi[high1Idx] ?? 50;
    const rsiHigh2 = rsi[high2Idx] ?? 50;

    if (priceHigh2 > priceHigh1 && rsiHigh2 < rsiHigh1 - 1.5 && rsiHigh2 > 55) {
      return {
        type: 'BEARISH_RSI',
        rsiValue: currentRsi,
        macdHist: currentHist,
        description: `Bearish RSI Divergence: Price higher high (${priceHigh2.toFixed(2)}) with RSI lower high (${rsiHigh1.toFixed(1)} -> ${rsiHigh2.toFixed(1)})`,
        strength: Math.min(95, Math.round((rsiHigh1 - rsiHigh2) * 6 + 50)),
      };
    }

    if (priceHigh2 > priceHigh1 && (hist[high2Idx] ?? 0) < (hist[high1Idx] ?? 0) && (hist[high2Idx] ?? 0) > 0) {
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
 * Elliott Wave Theory Analyzer
 * Detects:
 * 1. 5-Wave Impulsive Structure (Waves 1-2-3-4-5)
 * 2. 3-Wave Corrective Pattern (Waves A-B-C)
 * 3. Fibonacci Retracement Levels (0.382, 0.500, 0.618) & Golden Pocket Confluence
 */
export function detectElliottWave(
  candles: Candle[],
  orderBlocks: OrderBlock[],
  fvgs: FairValueGap[]
): ElliottWaveAnalysis {
  const len = candles.length;
  if (len < 25) {
    return {
      pattern: 'COMPLEX_RANGE',
      currentWave: 'UNDEFINED',
      trendDirection: 'NEUTRAL',
      fibRetracement: 0.5,
      description: 'Insufficient candles for Elliott Wave cycle mapping',
      confluenceWithSmc: false,
      waveStrength: 40,
    };
  }

  const currentPrice = candles[len - 1]?.close ?? 0;

  // Identify swing pivots (Highs & Lows) over the last 30-40 candles
  interface Pivot {
    type: 'HIGH' | 'LOW';
    index: number;
    price: number;
    time: number;
  }

  const pivots: Pivot[] = [];
  const lookback = Math.min(len - 2, 45);

  for (let i = len - lookback; i < len - 2; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const prev2 = candles[i - 2];
    const next = candles[i + 1];
    const next2 = candles[i + 2];
    if (!c || !prev || !next) continue;

    // Swing High
    if (
      c.high >= prev.high &&
      (!prev2 || c.high >= prev2.high) &&
      c.high >= next.high &&
      (!next2 || c.high >= next2.high)
    ) {
      if (pivots.length === 0 || pivots[pivots.length - 1].type !== 'HIGH') {
        pivots.push({ type: 'HIGH', index: i, price: c.high, time: c.time });
      } else if (c.high > pivots[pivots.length - 1].price) {
        pivots[pivots.length - 1] = { type: 'HIGH', index: i, price: c.high, time: c.time };
      }
    }

    // Swing Low
    if (
      c.low <= prev.low &&
      (!prev2 || c.low <= prev2.low) &&
      c.low <= next.low &&
      (!next2 || c.low <= next2.low)
    ) {
      if (pivots.length === 0 || pivots[pivots.length - 1].type !== 'LOW') {
        pivots.push({ type: 'LOW', index: i, price: c.low, time: c.time });
      } else if (c.low < pivots[pivots.length - 1].price) {
        pivots[pivots.length - 1] = { type: 'LOW', index: i, price: c.low, time: c.time };
      }
    }
  }

  const recentPivots = pivots.slice(-6);
  if (recentPivots.length < 3) {
    return {
      pattern: 'COMPLEX_RANGE',
      currentWave: 'UNDEFINED',
      trendDirection: 'NEUTRAL',
      fibRetracement: 0.5,
      description: 'Developing swing structure - monitoring Elliott cycle boundaries',
      confluenceWithSmc: false,
      waveStrength: 45,
    };
  }

  // Calculate Fibonacci of the most recent significant swing move
  const lastPivot = recentPivots[recentPivots.length - 1];
  const secondLastPivot = recentPivots[recentPivots.length - 2];
  const swingRange = Math.abs(lastPivot.price - secondLastPivot.price) || 1;

  let fib = 0.5;
  if (lastPivot.type === 'HIGH') {
    // Retracing downwards from high to low
    fib = Math.max(0, Math.min(1, (lastPivot.price - currentPrice) / swingRange));
  } else {
    // Retracing upwards from low to high
    fib = Math.max(0, Math.min(1, (currentPrice - lastPivot.price) / swingRange));
  }
  const fibRounded = Math.round(fib * 1000) / 1000;

  // Check if current price is in the Golden Pocket (0.500 to 0.618 Fib) overlapping an Order Block
  const inGoldenPocket = fibRounded >= 0.48 && fibRounded <= 0.65;
  const overlapsBullishOB = orderBlocks.some(
    (ob) => ob.type === 'BULLISH' && !ob.mitigated && currentPrice >= ob.low * 0.998 && currentPrice <= ob.high * 1.005
  );
  const overlapsBearishOB = orderBlocks.some(
    (ob) => ob.type === 'BEARISH' && !ob.mitigated && currentPrice <= ob.high * 1.002 && currentPrice >= ob.low * 0.995
  );
  const overlapsFVG = fvgs.some(
    (f) => !f.mitigated && currentPrice >= Math.min(f.bottom, f.top) * 0.998 && currentPrice <= Math.max(f.bottom, f.top) * 1.002
  );
  const confluenceWithSmc = (inGoldenPocket && (overlapsBullishOB || overlapsBearishOB || overlapsFVG)) || (overlapsBullishOB || overlapsBearishOB);

  // Analyze Impulse vs Corrective Sequences
  const highs = recentPivots.filter((p) => p.type === 'HIGH');
  const lows = recentPivots.filter((p) => p.type === 'LOW');

  const hasHigherHighs = highs.length >= 2 && highs[highs.length - 1].price > highs[highs.length - 2].price;
  const hasHigherLows = lows.length >= 2 && lows[lows.length - 1].price > lows[lows.length - 2].price;
  const hasLowerHighs = highs.length >= 2 && highs[highs.length - 1].price < highs[highs.length - 2].price;
  const hasLowerLows = lows.length >= 2 && lows[lows.length - 1].price < lows[lows.length - 2].price;

  // Bullish Impulse Wave 1-5 or Wave 4 Pullback into Order Block
  if (hasHigherHighs && hasHigherLows) {
    if (lastPivot.type === 'HIGH' && currentPrice < lastPivot.price) {
      // Wave 4 Corrective Pullback in an ascending impulse sequence
      return {
        pattern: 'IMPULSE_1_5',
        currentWave: 'WAVE_4',
        trendDirection: 'BULLISH',
        fibRetracement: fibRounded,
        description: `Bullish Impulse Wave 4 Pullback (Fib ${(fibRounded * 100).toFixed(1)}%)${confluenceWithSmc ? ' overlapping SMC Order Block / FVG' : ''}`,
        confluenceWithSmc,
        waveStrength: confluenceWithSmc ? 90 : 78,
      };
    } else {
      // Wave 3 or Wave 5 Expansion
      return {
        pattern: 'IMPULSE_1_5',
        currentWave: 'WAVE_3',
        trendDirection: 'BULLISH',
        fibRetracement: fibRounded,
        description: `Bullish Impulse Wave 3 Expansion with clean Higher Highs & Higher Lows`,
        confluenceWithSmc,
        waveStrength: 85,
      };
    }
  }

  // Bearish Corrective ABC or Bearish Impulse
  if (hasLowerHighs && hasLowerLows) {
    if (lastPivot.type === 'LOW' && currentPrice > lastPivot.price) {
      // Corrective Wave B rally into Bearish Order Block
      return {
        pattern: 'CORRECTIVE_ABC',
        currentWave: 'WAVE_B',
        trendDirection: 'BEARISH',
        fibRetracement: fibRounded,
        description: `Bearish Corrective Wave B counter-rally (Fib ${(fibRounded * 100).toFixed(1)}%)${confluenceWithSmc ? ' tapping Bearish Order Block' : ''}`,
        confluenceWithSmc,
        waveStrength: confluenceWithSmc ? 88 : 75,
      };
    } else {
      // Wave C Exhaustion or Wave 3 Impulse down
      return {
        pattern: 'CORRECTIVE_ABC',
        currentWave: 'WAVE_C',
        trendDirection: 'BEARISH',
        fibRetracement: fibRounded,
        description: `Bearish Wave C impulsive continuation breaking local swing lows`,
        confluenceWithSmc,
        waveStrength: 82,
      };
    }
  }

  // Neutral / Range / Diagonal
  return {
    pattern: 'COMPLEX_RANGE',
    currentWave: 'WAVE_2',
    trendDirection: 'NEUTRAL',
    fibRetracement: fibRounded,
    description: `Consolidation range / Wave 2 reaccumulation (Fib ${(fibRounded * 100).toFixed(1)}%)`,
    confluenceWithSmc,
    waveStrength: 60,
  };
}

/**
 * Full Analysis synthesizing SMC (Order Blocks, Fair Value Gaps, Liquidity Sweeps)
 * and Elliott Wave Theory (Impulse 1-5, Corrective ABC, Fib Retracements)
 */
export function analyzeSMC(symbol: string, candles: Candle[]): SMCAnalysisResult {
  const currentPrice = candles[candles.length - 1]?.close || 0;
  const orderBlocks = detectOrderBlocks(candles);
  const fvgZones = detectFairValueGaps(candles);
  const liquiditySweeps = detectLiquiditySweeps(candles);
  const divergence = detectDivergence(candles);
  const elliottWave = detectElliottWave(candles, orderBlocks, fvgZones);

  const activeBullishOB = orderBlocks.find((b) => b.type === 'BULLISH' && !b.mitigated);
  const activeBearishOB = orderBlocks.find((b) => b.type === 'BEARISH' && !b.mitigated);

  const activeBullishFVG = fvgZones.find((f) => f.type === 'BULLISH' && !f.mitigated);
  const activeBearishFVG = fvgZones.find((f) => f.type === 'BEARISH' && !f.mitigated);

  const recentSweep = liquiditySweeps[liquiditySweeps.length - 1];

  let longScore = 0;
  let shortScore = 0;
  const reasons: string[] = [];

  // 1. Elliott Wave Theory Confluence
  if (elliottWave.trendDirection === 'BULLISH') {
    longScore += elliottWave.confluenceWithSmc ? 30 : 20;
    reasons.push(elliottWave.description);
  } else if (elliottWave.trendDirection === 'BEARISH') {
    shortScore += elliottWave.confluenceWithSmc ? 30 : 20;
    reasons.push(elliottWave.description);
  }

  // 2. SMC Divergence Confluence
  if (divergence.type === 'BULLISH_RSI' || divergence.type === 'BULLISH_MACD') {
    longScore += 30;
    reasons.push(divergence.description);
  } else if (divergence.type === 'BEARISH_RSI' || divergence.type === 'BEARISH_MACD') {
    shortScore += 30;
    reasons.push(divergence.description);
  }

  // 3. Liquidity Sweeps
  if (recentSweep && recentSweep.type === 'LOW_SWEEP') {
    longScore += 25;
    reasons.push(`Sell-side liquidity sweep at ${recentSweep.level.toFixed(2)} with ${recentSweep.wickSizePercent}% rejection wick`);
  } else if (recentSweep && recentSweep.type === 'HIGH_SWEEP') {
    shortScore += 25;
    reasons.push(`Buy-side liquidity sweep at ${recentSweep.level.toFixed(2)} with ${recentSweep.wickSizePercent}% rejection wick`);
  }

  // 4. Order Blocks & FVG
  if (activeBullishOB) {
    const distToOB = Math.abs(currentPrice - activeBullishOB.high) / (currentPrice || 1);
    if (distToOB < 0.015) {
      longScore += 25;
      reasons.push(`Price testing Bullish Order Block zone [${activeBullishOB.low.toFixed(2)} - ${activeBullishOB.high.toFixed(2)}]`);
    } else {
      longScore += 10;
    }
  }

  if (activeBullishFVG) {
    const distToFVG = Math.abs(currentPrice - activeBullishFVG.top) / (currentPrice || 1);
    if (distToFVG < 0.015) {
      longScore += 15;
      reasons.push(`Active Bullish FVG imbalance [${activeBullishFVG.bottom.toFixed(2)} - ${activeBullishFVG.top.toFixed(2)}]`);
    }
  }

  if (activeBearishOB) {
    const distToOB = Math.abs(currentPrice - activeBearishOB.low) / (currentPrice || 1);
    if (distToOB < 0.015) {
      shortScore += 25;
      reasons.push(`Price testing Bearish Order Block zone [${activeBearishOB.low.toFixed(2)} - ${activeBearishOB.high.toFixed(2)}]`);
    } else {
      shortScore += 10;
    }
  }

  if (activeBearishFVG) {
    const distToFVG = Math.abs(currentPrice - activeBearishFVG.bottom) / (currentPrice || 1);
    if (distToFVG < 0.015) {
      shortScore += 15;
      reasons.push(`Active Bearish FVG imbalance [${activeBearishFVG.bottom.toFixed(2)} - ${activeBearishFVG.top.toFixed(2)}]`);
    }
  }

  let bias: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  let confluenceScore = 0;
  let entryZone = { min: currentPrice * 0.995, max: currentPrice * 1.005, mid: currentPrice };

  if (longScore >= 55 && longScore > shortScore) {
    bias = 'LONG';
    confluenceScore = Math.min(96, longScore);
    const obLow = activeBullishOB ? activeBullishOB.low : currentPrice * 0.99;
    const obHigh = activeBullishOB ? activeBullishOB.high : currentPrice * 1.002;
    entryZone = { min: Math.min(obLow, currentPrice * 0.995), max: Math.max(obHigh, currentPrice), mid: currentPrice };
  } else if (shortScore >= 55 && shortScore > longScore) {
    bias = 'SHORT';
    confluenceScore = Math.min(96, shortScore);
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
    elliottWave,
    bias,
    confluenceScore,
    entryZone,
    keyReasoning: reasons.length > 0 ? reasons.join(' • ') : 'Neutral market structure - waiting for clean OB / FVG tap or liquidity sweep',
  };
}
