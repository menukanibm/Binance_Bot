import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { tradingEngine } from './src/services/tradingEngine';
import { binanceCcxt } from './src/services/binanceCcxtService';
import { analyzeSMC } from './src/services/technicalAnalysis';
import { validateTradeWithGemini } from './src/services/geminiValidator';
import { checkSupabaseConnection, SUPABASE_SQL_SCHEMA, SUPABASE_QUICK_FIX_SQL } from './src/services/supabaseClient';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(express.json());

  // CORS middleware for webhook clients
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // -------------------------------------------------------------
  // Webhook Route: /api/webhook and /api/webhook/route
  // -------------------------------------------------------------
  const handleWebhook = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      console.log('[Webhook Received]', JSON.stringify(payload));

      const symbol = payload.symbol || payload.ticker || payload.pair || 'BTCUSDT';
      const action = (payload.action || payload.side || (payload.order === 'buy' ? 'BUY' : 'SELL') || 'BUY').toUpperCase();
      const price = parseFloat(payload.price || payload.close || '0') || undefined;
      const stopLoss = parseFloat(payload.stopLoss || payload.sl || '0') || undefined;
      const takeProfit = parseFloat(payload.takeProfit || payload.tp || '0') || undefined;
      const pattern = payload.pattern || payload.strategy || 'External Webhook Alert';

      const result = await tradingEngine.handleWebhookSignal({
        symbol,
        action: action === 'SELL' ? 'SELL' : 'BUY',
        price,
        stopLoss,
        takeProfit,
        pattern,
      });

      return res.status(200).json(result);
    } catch (err: any) {
      console.error('[Webhook Error]', err);
      return res.status(500).json({ success: false, error: err.message || 'Webhook processing failed' });
    }
  };

  const handleWebhookInfo = (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      status: 'active',
      message: 'Binance SMC AI Webhook Receiver is online. Send POST requests with TradingView or external alerts.',
      samplePayload: {
        symbol: 'BTCUSDT',
        action: 'BUY',
        price: 90000,
        stopLoss: 89100,
        takeProfit: 91800,
        pattern: 'Bullish Order Block Confirmation',
      },
    });
  };

  app.post('/api/webhook', handleWebhook);
  app.post('/api/webhook/route', handleWebhook);
  app.get('/api/webhook', handleWebhookInfo);
  app.get('/api/webhook/route', handleWebhookInfo);

  // -------------------------------------------------------------
  // Automated 2-Minute Market Scanner Cron: /api/cron/scanner and /api/cron/scanner/route
  // -------------------------------------------------------------
  const handleCronScanner = async (req: Request, res: Response) => {
    try {
      console.log('[Cron Scanner Triggered via API]');
      tradingEngine.runScannerCycle();
      return res.status(200).json({
        success: true,
        message: '2-Minute Binance Futures Market Scanner cycle initiated across all pairs',
        status: tradingEngine.getStatus(),
      });
    } catch (err: any) {
      console.error('[Cron Scanner Error]', err);
      return res.status(500).json({ success: false, error: err.message || 'Scanner execution failed' });
    }
  };

  app.get('/api/cron/scanner', handleCronScanner);
  app.post('/api/cron/scanner', handleCronScanner);
  app.get('/api/cron/scanner/route', handleCronScanner);
  app.post('/api/cron/scanner/route', handleCronScanner);

  // -------------------------------------------------------------
  // Supabase Status & Schema Migration API
  // -------------------------------------------------------------
  app.get('/api/supabase/status', async (req: Request, res: Response) => {
    try {
      const status = await checkSupabaseConnection();
      res.status(200).json({
        ...status,
        schema: SUPABASE_SQL_SCHEMA,
        quickFixSql: SUPABASE_QUICK_FIX_SQL,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message, connected: false });
    }
  });

  // -------------------------------------------------------------
  // Bot Telemetry & Status APIs
  // -------------------------------------------------------------
  const handleBotStatus = (req: Request, res: Response) => {
    try {
      res.status(200).json({
        status: tradingEngine.getStatus(),
        settings: tradingEngine.getSettings(),
        activePositions: tradingEngine.getPositions().filter((p) => p.status === 'OPEN'),
        closedPositions: tradingEngine.getPositions().filter((p) => p.status !== 'OPEN'),
        signals: tradingEngine.getSignals().slice(0, 30),
        logs: tradingEngine.getLogs().slice(0, 40),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  app.get('/api/bot/status', handleBotStatus);
  app.post('/api/bot/status', handleBotStatus);

  const handleBotToggle = (req: Request, res: Response) => {
    try {
      const currentStatus = tradingEngine.getStatus();
      if (currentStatus.isRunning) {
        tradingEngine.stopEngine();
      } else {
        tradingEngine.startEngine();
      }
      return res.status(200).json({ success: true, status: tradingEngine.getStatus() });
    } catch (err: any) {
      console.error('[Bot Toggle Error]', err);
      return res.status(500).json({ success: false, error: err?.message || 'Toggle failed' });
    }
  };

  app.post('/api/bot/toggle', handleBotToggle);
  app.get('/api/bot/toggle', handleBotToggle);

  app.get('/api/bot/settings', (req: Request, res: Response) => {
    res.status(200).json(tradingEngine.getSettings());
  });

  app.post('/api/bot/settings', (req: Request, res: Response) => {
    try {
      tradingEngine.updateSettings(req.body);
      res.status(200).json({ success: true, settings: tradingEngine.getSettings() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // Position Management APIs
  // -------------------------------------------------------------
  const handleGetPositions = (req: Request, res: Response) => {
    res.status(200).json({
      open: tradingEngine.getPositions().filter((p) => p.status === 'OPEN'),
      history: tradingEngine.getPositions().filter((p) => p.status !== 'OPEN'),
    });
  };

  app.get('/api/positions', handleGetPositions);
  app.post('/api/positions', handleGetPositions);

  const handleClosePosition = async (req: Request, res: Response) => {
    const positionId = req.body?.positionId || req.query?.positionId;
    const reason = req.body?.reason || req.query?.reason;
    if (!positionId) {
      return res.status(400).json({ error: 'Missing positionId' });
    }
    const closed = await tradingEngine.closePosition(String(positionId), String(reason || 'Manual Close from UI'));
    res.status(200).json({ success: !!closed, position: closed });
  };

  app.post('/api/positions/close', handleClosePosition);
  app.get('/api/positions/close', handleClosePosition);

  // -------------------------------------------------------------
  // Data Cleanup APIs: Safe Mode & Full History Cleanup
  // -------------------------------------------------------------
  const handleCleanupSignals = async (req: Request, res: Response) => {
    try {
      console.log('[API Data Cleanup] Clearing unexecuted signals & analysis logs (Safe Mode)');
      const result = await tradingEngine.clearUnexecutedSignalsAndLogs();
      return res.status(200).json({
        message: 'Unexecuted signals and past analysis logs cleared from Supabase and UI. Active open positions remain untouched.',
        ...result,
      });
    } catch (err: any) {
      console.error('[Cleanup Signals Error]', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to clear unexecuted signals' });
    }
  };

  const handleCleanupHistory = async (req: Request, res: Response) => {
    try {
      console.log('[API Data Cleanup] Clearing trade history, past signals & logs (Preserving OPEN positions)');
      const result = await tradingEngine.clearAllHistoryKeepOpenPositions();
      return res.status(200).json({
        message: 'Closed trade history, past signals, and analysis logs cleared from Supabase and UI. Active open positions strictly preserved.',
        ...result,
      });
    } catch (err: any) {
      console.error('[Cleanup History Error]', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to clear history' });
    }
  };

  app.post('/api/cleanup/signals', handleCleanupSignals);
  app.get('/api/cleanup/signals', handleCleanupSignals);
  app.post('/api/cleanup/history', handleCleanupHistory);
  app.get('/api/cleanup/history', handleCleanupHistory);

  // -------------------------------------------------------------
  // Market Data & Pair Discovery (All USD-M Pairs via CCXT)
  // -------------------------------------------------------------
  app.get('/api/binance/pairs', async (req: Request, res: Response) => {
    try {
      const pairs = await binanceCcxt.fetchAllUsdmPairs();
      res.status(200).json(pairs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/binance/klines', async (req: Request, res: Response) => {
    try {
      const symbol = (req.query.symbol as string) || 'BTCUSDT';
      const interval = (req.query.interval as string) || '5m';
      const limit = parseInt((req.query.limit as string) || '60', 10);
      const klines = await binanceCcxt.fetchKlines(symbol, interval, limit);
      const analysis = analyzeSMC(symbol, klines);
      res.status(200).json({ klines, analysis });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Deep Gemini Validation on-demand endpoint
  app.post('/api/binance/validate-gemini', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.body;
      const candles = await binanceCcxt.fetchKlines(symbol || 'BTCUSDT', '5m', 60);
      const analysis = analyzeSMC(symbol || 'BTCUSDT', candles);
      const validation = await validateTradeWithGemini(analysis, candles);
      res.status(200).json({ analysis, validation });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // API Fallback 404 (Guarantees NO /api/* request EVER falls through to Vite HTML)
  // -------------------------------------------------------------
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: `API route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // -------------------------------------------------------------
  // Vite Integration (Dev) or Static Assets (Prod)
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`🚀 Binance Auto-Trading Engine Server listening on port ${port}`);
  });
}

createServer().catch((err) => {
  console.error('Fatal Server Boot Error:', err);
});
