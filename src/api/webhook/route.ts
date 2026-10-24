import { tradingEngine } from '../../services/tradingEngine';

/**
 * Inbound TradingView & Webhook Signal Route
 * Receives external alert signals, runs SMC verification & Gemini AI deep validation (>80%),
 * and executes real trades on Binance Futures.
 */
export async function POST(reqBody: any) {
  try {
    const symbol = reqBody.symbol || reqBody.ticker || reqBody.pair || 'BTCUSDT';
    const action = (reqBody.action || reqBody.side || (reqBody.order === 'buy' ? 'BUY' : 'SELL') || 'BUY').toUpperCase();
    const price = parseFloat(reqBody.price || reqBody.close || '0') || undefined;
    const stopLoss = parseFloat(reqBody.stopLoss || reqBody.sl || '0') || undefined;
    const takeProfit = parseFloat(reqBody.takeProfit || reqBody.tp || '0') || undefined;
    const pattern = reqBody.pattern || reqBody.strategy || 'External Webhook Alert';

    const result = await tradingEngine.handleWebhookSignal({
      symbol,
      action: action === 'SELL' ? 'SELL' : 'BUY',
      price,
      stopLoss,
      takeProfit,
      pattern,
    });

    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Webhook processing failed',
    };
  }
}
