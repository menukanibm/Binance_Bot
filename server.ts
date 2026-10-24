import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { tradingEngine } from './src/services/tradingEngine';
import { binanceCcxt } from './src/services/binanceCcxtService';
import { analyzeSMC } from './src/services/technicalAnalysis';
import { validateTradeWithGemini } from './src/services/geminiValidator';
import { checkSupabaseConnection, SUPABASE_SQL_SCHEMA } from './src/services/supabaseClient';

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

  app.post('/api/webhook', handleWebhook);
  app.post('/api/webhook/route', handleWebhook);

  // -------------------------------------------------------------
  // Automated 2-Minute Market Scanner Cron: /api/cron/scanner and /api/cron/scanner/route
  // -------------------------------------------------------------
  const handleCronScanner = async (req: Request, res: Response) => {
    try {
      console.log('[Cron Scanner Triggered via API]');
      tradingEngine.runScannerCycle();
      return res.status(200).json({
        success: true,
        message: '2-Minute Binance Futures Market Scanner cycle initiated across all 522+ pairs',
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
    const status = await checkSupabaseConnection();
    res.json({
      ...status,
      schema: SUPABASE_SQL_SCHEMA,
    });
  });

  // -------------------------------------------------------------
  // Bot Telemetry & Status APIs
  // -------------------------------------------------------------
  app.get('/api/bot/status', (req: Request, res: Response) => {
    res.json({
      status: tradingEngine.getStatus(),
      settings: tradingEngine.getSettings(),
      activePositions: tradingEngine.getPositions().filter((p) => p.status === 'OPEN'),
      closedPositions: tradingEngine.getPositions().filter((p) => p.status !== 'OPEN'),
      signals: tradingEngine.getSignals().slice(0, 30),
      logs: tradingEngine.getLogs().slice(0, 40),
    });
  });

  app.post('/api/bot/toggle', (req: Request, res: Response) => {
    const currentStatus = tradingEngine.getStatus();
    if (currentStatus.isRunning) {
      tradingEngine.stopEngine();
    } else {
      tradingEngine.startEngine();
    }
    res.json({ success: true, status: tradingEngine.getStatus() });
  });

  app.get('/api/bot/settings', (req: Request, res: Response) => {
    res.json(tradingEngine.getSettings());
  });

  app.post('/api/bot/settings', (req: Request, res: Response) => {
    tradingEngine.updateSettings(req.body);
    res.json({ success: true, settings: tradingEngine.getSettings() });
  });

  // -------------------------------------------------------------
  // Position Management APIs
  // -------------------------------------------------------------
  app.get('/api/positions', (req: Request, res: Response) => {
    res.json({
      open: tradingEngine.getPositions().filter((p) => p.status === 'OPEN'),
      history: tradingEngine.getPositions().filter((p) => p.status !== 'OPEN'),
    });
  });

  app.post('/api/positions/close', async (req: Request, res: Response) => {
    const { positionId, reason } = req.body;
    if (!positionId) {
      return res.status(400).json({ error: 'Missing positionId' });
    }
    const closed = await tradingEngine.closePosition(positionId, reason || 'Manual Close from UI');
    res.json({ success: !!closed, position: closed });
  });

  // -------------------------------------------------------------
  // Market Data & Pair Discovery (All 522+ USD-M Pairs via CCXT)
  // -------------------------------------------------------------
  app.get('/api/binance/pairs', async (req: Request, res: Response) => {
    try {
      const pairs = await binanceCcxt.fetchAllUsdmPairs();
      res.json(pairs);
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
      res.json({ klines, analysis });
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
      res.json({ analysis, validation });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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
