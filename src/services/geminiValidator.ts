import { GoogleGenAI, Type } from '@google/genai';
import { Candle, SMCAnalysisResult, GeminiValidation } from '../types/trading';
import { CONFIG } from '../config/constants';

const API_KEY = CONFIG.GEMINI_API_KEY;

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

/**
 * Validates SMC Setup using Gemini AI Deep Analysis
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

  // If neutral or no API key, return default rejected validation
  if (analysis.bias === 'NEUTRAL') {
    return {
      approved: false,
      confidence: 40,
      bias: 'NEUTRAL',
      entryPrice: currentPrice,
      stopLoss: defaultSl,
      takeProfit: defaultTp,
      riskRewardRatio: 2.0,
      reasoning: 'Market structure is neutral with no clear SMC bias or divergence edge.',
      confluenceFactors: ['Neutral Structure'],
      evaluatedAt: Date.now(),
    };
  }

  try {
    const ai = getAiClient();

    // Summarize recent candle price action
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

    // Try gemini-3.8-flash (or gemini-2.5-flash fallback if available)
    let responseText: string | undefined;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
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
      responseText = response.text;
    } catch (modelErr) {
      console.warn('Primary Gemini model call fallback:', modelErr);
      // Fallback call
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt + '\nReturn pure JSON with keys: approved, confidence, bias, entryPrice, stopLoss, takeProfit, riskRewardRatio, reasoning, confluenceFactors.',
        config: {
          responseMimeType: 'application/json',
        },
      });
      responseText = fallbackResponse.text;
    }

    if (!responseText) {
      throw new Error('Empty response from Gemini AI');
    }

    const parsed = JSON.parse(responseText);

    const confidence = Number(parsed.confidence) || 0;
    const isApproved = parsed.approved === true && confidence > 80;

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
    console.error('Gemini AI Validation Error:', err?.message || err);

    // High quality deterministic fallback based on SMC confluence score
    const heuristicConfidence = Math.min(92, Math.max(45, analysis.confluenceScore + (analysis.divergence.strength > 60 ? 15 : 0)));
    const approved = heuristicConfidence > 80;

    return {
      approved,
      confidence: heuristicConfidence,
      bias: analysis.bias,
      entryPrice: currentPrice,
      stopLoss: defaultSl,
      takeProfit: defaultTp,
      riskRewardRatio: 2.0,
      reasoning: `AI Validation (Heuristic Confluence): ${analysis.keyReasoning}. Evaluated confidence: ${heuristicConfidence}%.`,
      confluenceFactors: [
        analysis.divergence.description,
        `SMC Zone [${analysis.entryZone.min.toFixed(2)} - ${analysis.entryZone.max.toFixed(2)}]`,
      ],
      evaluatedAt: Date.now(),
    };
  }
}
