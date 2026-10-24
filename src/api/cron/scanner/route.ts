import { tradingEngine } from '../../../services/tradingEngine';

/**
 * Automated 2-Minute Market Scanner Cron Service
 * Monitors all 522+ Binance Futures USD-M pairs, calculates SMC & Divergence,
 * triggers Gemini AI deep validation (>80%), and executes real trades.
 */
export async function GET() {
  try {
    tradingEngine.runScannerCycle();
    return {
      success: true,
      message: 'Automated 2-minute market scanner cycle initiated across all 522+ Binance Futures pairs.',
      status: tradingEngine.getStatus(),
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Scanner cycle failed',
    };
  }
}

export async function POST() {
  return GET();
}
