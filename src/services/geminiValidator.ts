import { GoogleGenAI, Type } from '@google/genai';
import { Candle, SMCAnalysisResult, GeminiValidation } from '../types/trading';
import { CONFIG } from '../config/constants';

const API_KEY = CONFIG.GEMINI_API_KEY;

let aiInstance: GoogleGenAI | null = null;
let quotaCooldownUntil: number = 0;
let quotaExceededLogged: boolean = false;

function getAiClient(): GoogleGenAI | null {
  if (!API_KEY || API_KEY.trim().length === 0) return null;
  if (!aiInstance) {
    try {
      aiInstance = new GoogleGenAI({
        apiKey: API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch {
      aiInstance = null;
    }
  }
  return aiInstance;
}

/**
 * Validates SMC Setup using Gemini AI Deep Analysis or Quantitative SMC Fallback
 * Requires >80% confidence to approve trade execution.
 * Pre-calculates dynamic 1% Stop Loss and 2% Take Profit based on SMC level.
 */
export async function validateTradeWithGemini(
  analysis: SMCAnalysisResult,
  recentCandles: Candle[]
): Promise<GeminiValidation> {
  const currentPrice = analysis.currentPrice;

  // Baseline 1% SL and 2% TP calculation
  const isLong = analysis.bias === 'LONG';
  const defaultSl = isLong ? currentPrice * 0.99 : currentPrice * 1.01;
  const defaultTp = isLong ? currentPrice * 1.02 : currentPrice * 0.98;

  // If neutral market structure, immediately return neutral without consuming quota
  if (analysis.bias === 'NEUTRAL') {
    return {
      approved: false,
      confidence: 40,
      bias: 'NEUTRAL',
      entryPrice: currentPrice,
      stopLoss: defaultSl,
      takeProfit: defaultTp,
      riskRewardRatio: 2.0,
      reasoning: 'Market structure is neutral with no confirmed SMC order block or divergence confluence.',
      confluenceFactors: ['Neutral Structure'],
      evaluatedAt: Date.now(),
    };
  }

  // Check if Gemini API quota is currently cooling down
  const now = Date.now();
  const isCooldownActive = now < quotaCooldownUntil;

  if (isCooldownActive) {
    return evaluateQuantitativeConfluence(analysis, currentPrice, defaultSl, defaultTp, 'Gemini AI Quota Exceeded (Free Tier limit reached). Quantitative SMC Confluence Engine Active');
  }

  const ai = getAiClient();
  if (!ai) {
    return evaluateQuantitativeConfluence(analysis, currentPrice, defaultSl, defaultTp, 'Quantitative SMC Confluence Engine Active');
  }

  try {
    const last10Candles = recentCandles.slice(-10).map((c) => ({
      t: new Date(c.time).toLocaleTimeString(),
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
      v: Math.round(c.volume),
    }));

    const prompt = `
You are an elite quantitative crypto prop trader specializing in Smart Money Concepts (SMC), Price Action, Liquidity Engineering, and Momentum Divergence on Binance Futures USD-M.

Analyze this detected setup for ${analysis.symbol}:
- Current Price: ${currentPrice}
- SMC Directional Bias: ${analysis.bias}
- Confluence Score: ${analysis.confluenceScore}/100
- Detected Order Blocks: ${analysis.orderBlocks.map((ob) => `${ob.type} [${ob.low} - ${ob.high}] mitigated=${ob.mitigated}`).join('; ') || 'None'}
- Fair Value Gaps (FVG): ${analysis.fvgZones.map((fvg) => `${fvg.type} [${fvg.bottom} - ${fvg.top}] mitigated=${fvg.mitigated}`).join('; ') || 'None'}
- Liquidity Sweeps: ${analysis.liquiditySweeps.map((s) => `${s.type} at ${s.level} wick=${s.wickSizePercent}%`).join('; ') || 'None'}
- Divergence: ${analysis.divergence.description} (Strength: ${analysis.divergence.strength}%)
- Entry Zone: [${analysis.entryZone.min.toFixed(4)} - ${analysis.entryZone.max.toFixed(4)}]
- Recent 10 Candles: ${JSON.stringify(last10Candles)}

CRITICAL VALIDATION CRITERIA:
1. ONLY APPROVE with confidence > 80% if there is clean confluence between SMC (OB/FVG/Sweep) AND momentum divergence (RSI or MACD), with high probability of market structure hold.
2. Invalidate if price is chasing extended wicks without retracement into the entry zone.
3. Compute dynamic Stop Loss (approx 1% from entry, placed beyond the invalidation SMC swing/OB) and Take Profit (approx 2% from entry, aiming for next liquidity pool with min 1:2 Risk-to-Reward).
4. Return strict JSON.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            approved: {
              type: Type.BOOLEAN,
              description: 'True if confidence > 80% and setup is high-probability',
            },
            confidence: {
              type: Type.INTEGER,
              description: 'Confidence percentage from 0 to 100',
            },
            bias: {
              type: Type.STRING,
              description: 'LONG, SHORT, or NEUTRAL',
            },
            entryPrice: {
              type: Type.NUMBER,
              description: 'Recommended entry price within entry zone',
            },
            stopLoss: {
              type: Type.NUMBER,
              description: 'Calculated invalidation Stop Loss level',
            },
            takeProfit: {
              type: Type.NUMBER,
              description: 'Calculated Take Profit target level',
            },
            riskRewardRatio: {
              type: Type.NUMBER,
              description: 'Calculated Risk to Reward ratio, minimum 1.5 - 2.0',
            },
            reasoning: {
              type: Type.STRING,
              description: 'Detailed technical reasoning for the decision',
            },
            confluenceFactors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Key confirmed confluence factors',
            },
          },
          required: [
            'approved',
            'confidence',
            'bias',
            'entryPrice',
            'stopLoss',
            'takeProfit',
            'riskRewardRatio',
            'reasoning',
            'confluenceFactors',
          ],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Empty response from Gemini AI');
    }

    const parsed = JSON.parse(responseText);
    const confidence = Number(parsed.confidence) || 0;
    const isApproved = parsed.approved === true && confidence > 80;

    // Reset quota error logged flag if successful
    quotaExceededLogged = false;

    return {
      approved: isApproved,
      confidence: confidence,
      bias: parsed.bias === 'LONG' || parsed.bias === 'SHORT' ? parsed.bias : analysis.bias,
      entryPrice: Number(parsed.entryPrice) || currentPrice,
      stopLoss: Number(parsed.stopLoss) || defaultSl,
      takeProfit: Number(parsed.takeProfit) || defaultTp,
      riskRewardRatio: Number(parsed.riskRewardRatio) || 2.0,
      reasoning: parsed.reasoning || analysis.keyReasoning,
      confluenceFactors: Array.isArray(parsed.confluenceFactors) ? parsed.confluenceFactors : ['SMC Order Block', 'RSI Divergence'],
      evaluatedAt: Date.now(),
    };
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    const isRateLimit =
      errorMsg.includes('429') ||
      errorMsg.includes('RESOURCE_EXHAUSTED') ||
      errorMsg.includes('quota') ||
      errorMsg.includes('Quota exceeded');

    if (isRateLimit) {
      // Cooldown for 30 minutes to stop flooding the API
      quotaCooldownUntil = Date.now() + 30 * 60 * 1000;
      if (!quotaExceededLogged) {
        console.log('[Gemini AI] Free tier daily quota limit reached (20 requests/day). Seamlessly activated Quantitative SMC Confluence Engine.');
        quotaExceededLogged = true;
      }
    } else {
      console.warn('[Gemini AI Call Note]:', errorMsg.slice(0, 150));
    }

    // High quality deterministic fallback based on SMC confluence score
    return evaluateQuantitativeConfluence(
      analysis,
      currentPrice,
      defaultSl,
      defaultTp,
      isRateLimit
        ? 'Gemini AI Quota Exceeded (Free Tier limit reached). Quantitative SMC Confluence Engine Active'
        : 'Quantitative SMC Confluence Engine Active'
    );
  }
}

/**
 * Deterministic Quantitative SMC & Divergence Confluence Engine
 * Evaluates market structure mathematically without requiring external API calls.
 */
function evaluateQuantitativeConfluence(
  analysis: SMCAnalysisResult,
  currentPrice: number,
  defaultSl: number,
  defaultTp: number,
  engineNotice: string
): GeminiValidation {
  // Score breakdown:
  // Base confluence score from SMC (0-100)
  // Extra points if RSI/MACD divergence is strong (>60%)
  // Extra points if unmitigated Order Block aligns with Liquidity Sweep
  let confidence = analysis.confluenceScore;
  const factors: string[] = [];

  if (analysis.divergence.type !== 'NONE') {
    factors.push(analysis.divergence.description);
    if (analysis.divergence.strength >= 70) {
      confidence = Math.min(94, confidence + 12);
    }
  }

  const activeOB = analysis.orderBlocks.find(
    (ob) => !ob.mitigated && ((analysis.bias === 'LONG' && ob.type === 'BULLISH') || (analysis.bias === 'SHORT' && ob.type === 'BEARISH'))
  );
  if (activeOB) {
    factors.push(`Unmitigated ${activeOB.type} Order Block [${activeOB.low.toFixed(2)} - ${activeOB.high.toFixed(2)}]`);
    if (activeOB.strength > 60) {
      confidence = Math.min(95, confidence + 8);
    }
  }

  const activeFVG = analysis.fvgZones.find(
    (f) => !f.mitigated && ((analysis.bias === 'LONG' && f.type === 'BULLISH') || (analysis.bias === 'SHORT' && f.type === 'BEARISH'))
  );
  if (activeFVG) {
    factors.push(`Fair Value Gap Imbalance [${activeFVG.bottom.toFixed(2)} - ${activeFVG.top.toFixed(2)}]`);
  }

  const recentSweep = analysis.liquiditySweeps[analysis.liquiditySweeps.length - 1];
  if (recentSweep) {
    factors.push(`Liquidity Sweep at ${recentSweep.level.toFixed(2)} (${recentSweep.wickSizePercent}% rejection wick)`);
    if (recentSweep.wickSizePercent >= 50) {
      confidence = Math.min(95, confidence + 10);
    }
  }

  // Must exceed 80% to be approved
  const isApproved = confidence > 80 && analysis.bias !== 'NEUTRAL';

  return {
    approved: isApproved,
    confidence: Math.round(confidence),
    bias: analysis.bias,
    entryPrice: currentPrice,
    stopLoss: defaultSl,
    takeProfit: defaultTp,
    riskRewardRatio: 2.0,
    reasoning: `${engineNotice}: ${analysis.keyReasoning}. Evaluated confidence: ${Math.round(confidence)}% based on SMC order block, FVG imbalance, and divergence confluence.`,
    confluenceFactors: factors.length > 0 ? factors : ['SMC Market Structure', 'Volume Displacement'],
    evaluatedAt: Date.now(),
  };
}
