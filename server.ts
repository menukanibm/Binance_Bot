import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
import ccxt from 'ccxt';
import { tradingEngine } from './src/services/tradingEngine';
import { binanceCcxt } from './src/services/binanceCcxtService';
import { analyzeSMC } from './src/services/technicalAnalysis';
import { validateTradeWithGemini, setCustomGeminiApiKey } from './src/services/geminiValidator';
import { checkSupabaseConnection, SUPABASE_SQL_SCHEMA, SUPABASE_QUICK_FIX_SQL } from './src/services/supabaseClient';

dotenv.config();

// Cross-compatible __dirname resolution for both ESM (tsx) and CJS (Electron / esbuild)
let currentDirname = process.cwd();
try {
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    currentDirname = path.dirname(fileURLToPath(import.meta.url));
  } else if (typeof __dirname !== 'undefined') {
    currentDirname = __dirname;
  }
} catch {
  currentDirname = process.cwd();
}

async function createServer(customPort?: number) {
  const app = express();
  const port = customPort || process.env.PORT || 3000;

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
  // Bot Telemetry & Status APIs (Synced with Binance USD-M /fapi/v2/account & /fapi/v2/positionRisk)
  // -------------------------------------------------------------
  const handleBotStatus = async (req: Request, res: Response) => {
    try {
      // Synchronize live account balance and positions directly from Binance USD-M
      await tradingEngine.syncBinanceLiveState();

      res.status(200).json({
        status: tradingEngine.getStatus(),
        settings: tradingEngine.getSettings(),
        activePositions: tradingEngine.getPositions().filter((p) => p.status === 'OPEN'),
        closedPositions: tradingEngine.getPositions().filter((p) => p.status !== 'OPEN'),
        signals: tradingEngine.getSignals().slice(0, 30),
        ineligibleSignals: tradingEngine.getIneligibleSignals().slice(0, 40),
        logs: tradingEngine.getLogs().slice(0, 40),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  app.get('/api/bot/status', handleBotStatus);
  app.post('/api/bot/status', handleBotStatus);

  app.get('/api/signals/ineligible', (req: Request, res: Response) => {
    res.status(200).json({ success: true, ineligibleSignals: tradingEngine.getIneligibleSignals() });
  });

  // Direct Live Binance USD-M Endpoints
  app.get('/api/binance/account', async (req: Request, res: Response) => {
    try {
      const account = await binanceCcxt.fetchLiveFuturesAccountV2();
      res.status(200).json({ success: true, ...account });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/binance/positions', async (req: Request, res: Response) => {
    try {
      const posRisk = await binanceCcxt.fetchLivePositionsRiskV2();
      res.status(200).json({ success: true, ...posRisk });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

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

  app.post('/api/bot/settings', async (req: Request, res: Response) => {
    try {
      if (req.body?.geminiApiKey) {
        setCustomGeminiApiKey(String(req.body.geminiApiKey).trim());
      }
      await tradingEngine.updateSettings(req.body);
      res.status(200).json({
        success: true,
        settings: tradingEngine.getSettings(),
        status: tradingEngine.getStatus(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // Binance Connection Test Endpoint (/api/test-binance)
  // Verifies provided credentials directly against Binance Futures /fapi/v2/account
  // -------------------------------------------------------------
  app.post('/api/test-binance', async (req: Request, res: Response) => {
    try {
      const apiKey = (req.body?.apiKey || '').trim();
      const secretKey = (req.body?.secretKey || '').trim();
      const testnet = Boolean(req.body?.testnet);

      if (!apiKey || !secretKey) {
        return res.status(200).json({
          success: false,
          error: 'Please enter both Binance API Key and Secret Key to test connection.',
        });
      }

      // Initialize CCXT client with candidate credentials
      const testClient = new ccxt.binanceusdm({
        apiKey,
        secret: secretKey,
        enableRateLimit: true,
        options: {
          defaultType: 'future',
          adjustForTimeDifference: true,
        },
      });

      if (testnet) {
        testClient.setSandboxMode(true);
      }

      // Execute signed query to Binance USD-M /fapi/v2/account
      const acc = await testClient.fapiPrivateV2GetAccount();
      const totalWalletBalance = parseFloat(acc?.totalWalletBalance || '0');
      const availableBalance = parseFloat(acc?.availableBalance || '0');
      const canTrade = Boolean(acc?.canTrade);

      console.log(`[TEST BINANCE] Connection verified successfully. Wallet: $${totalWalletBalance}, Available: $${availableBalance}, canTrade: ${canTrade}`);

      return res.status(200).json({
        success: true,
        message: `Connected successfully to Binance Futures! Total Wallet Balance: $${totalWalletBalance.toFixed(2)} USDT (Available: $${availableBalance.toFixed(2)} USDT). Trading Enabled: ${canTrade ? 'Yes' : 'No'}.`,
        totalWalletBalance,
        availableBalance,
        canTrade,
      });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.warn('[TEST BINANCE] Verification notice:', errMsg);
      let friendlyError = errMsg;

      if (errMsg.includes('-2015') || errMsg.includes('Invalid API-key, IP, or permissions')) {
        friendlyError = 'Binance Error (-2015): Invalid API-key, IP restriction, or missing permissions. Please ensure "Enable Futures" is checked on Binance, and add IP 34.34.226.197 to your IP whitelist (or select Unrestricted).';
      } else if (errMsg.includes('-2014') || errMsg.includes('API-key format invalid')) {
        friendlyError = 'Binance Error (-2014): API Key format is invalid. Please double check for trailing spaces or special characters.';
      } else if (errMsg.includes('-1022') || errMsg.includes('Signature for this request is not valid')) {
        friendlyError = 'Binance Error (-1022): Secret Key or signature is invalid. Please re-copy the Secret Key from Binance.';
      } else if (errMsg.includes('-1021') || errMsg.includes('Timestamp')) {
        friendlyError = 'Binance Error (-1021): Request timestamp issue. Adjusting server time...';
      }

      return res.status(200).json({
        success: false,
        error: friendlyError,
        rawError: errMsg,
      });
    }
  });

  // -------------------------------------------------------------
  // Position Management APIs
  // -------------------------------------------------------------
  const handleGetPositions = async (req: Request, res: Response) => {
    try {
      await tradingEngine.syncBinanceLiveState();
      res.status(200).json({
        open: tradingEngine.getPositions().filter((p) => p.status === 'OPEN'),
        history: tradingEngine.getPositions().filter((p) => p.status !== 'OPEN'),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch positions' });
    }
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
  if (process.env.NODE_ENV !== 'production' && !process.env.SERVE_STATIC) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn('[Vite Middleware Warn] Vite failed to mount in dev, falling back to static:', viteErr);
    }
  } else {
    // Locate the dist directory across various execution roots (bundled Electron, tsx, node)
    const possibleDistDirs = [
      path.resolve(currentDirname, 'dist'),
      path.resolve(currentDirname, '..', 'dist'),
      path.resolve(process.cwd(), 'dist'),
    ];
    const resolvedDistDir = possibleDistDirs.find((d) => fs.existsSync(d)) || possibleDistDirs[0];

    app.use(express.static(resolvedDistDir));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(resolvedDistDir, 'index.html'));
    });
  }

  return new Promise<{ app: express.Express; server: http.Server; port: number }>((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`🚀 Binance Auto-Trading Engine Server listening on port ${port}`);
      resolve({ app, server, port: Number(port) });
    });
    server.on('error', (err) => {
      console.error(`[Server Listen Error on port ${port}]:`, err);
      reject(err);
    });
  });
}

export { createServer };

// Direct execution auto-boot
if (!process.env.ELECTRON_MANAGED) {
  createServer().catch((err) => {
    console.error('Fatal Server Boot Error:', err);
  });
}
