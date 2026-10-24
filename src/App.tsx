import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { MetricsCards } from './components/MetricsCards';
import { CandleChart } from './components/CandleChart';
import { SignalsFeed } from './components/SignalsFeed';
import { PositionsTable } from './components/PositionsTable';
import { MarketScannerList } from './components/MarketScannerList';
import { WebhookIntegration } from './components/WebhookIntegration';
import { SettingsModal } from './components/SettingsModal';
import { RequirementsAudit } from './components/RequirementsAudit';
import { CleanupModal, CleanupMode } from './components/CleanupModal';
import { LoginScreen } from './components/LoginScreen';
import {
  Candle,
  SMCAnalysisResult,
  TradeSignal,
  Position,
  BotStatus,
  BotSettings,
} from './types/trading';
import { CcxtPairInfo } from './services/binanceCcxtService';
import {
  Terminal,
  Radio,
  Layers,
  Search,
  Webhook,
  Activity,
  Sparkles,
  Zap,
  Database,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

export default function App() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [selectedInterval, setSelectedInterval] = useState('5m');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [analysis, setAnalysis] = useState<SMCAnalysisResult | null>(null);
  const [pairs, setPairs] = useState<CcxtPairInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'TERMINAL' | 'SIGNALS' | 'POSITIONS' | 'SCANNER' | 'WEBHOOK' | 'LOGS' | 'AUDIT'>('TERMINAL');

  const [status, setStatus] = useState<BotStatus>({
    isRunning: true,
    currentAction: 'Bot Status: Scanning Binance Pairs...',
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
    accountBalance: 0,
    freeUsdt: 0,
    totalActiveMarginUsdt: 0,
    totalActiveMarginPercent: 0,
    maxTotalMarginPct: 10,
    marginMode: 'ISOLATED',
    tradingMode: 'LIVE',
    geminiModel: 'gemini-3.8-flash',
    geminiThreshold: 80,
  });

  const [settings, setSettings] = useState<BotSettings>({
    autoTrading: true,
    scanIntervalMinutes: 2,
    leverage: 10,
    riskPercentage: 2,
    geminiThreshold: 80,
    tradingMode: 'LIVE',
    defaultSlPercent: 1.0,
    defaultTpPercent: 2.0,
    binanceApiKey: '',
    binanceApiSecret: '',
    maxTotalMarginPct: 10,
    marginMode: 'ISOLATED',
  });

  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [logs, setLogs] = useState<{ time: string; message: string; type: string }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [countdown, setCountdown] = useState(120);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
  const [cleanupInitialMode, setCleanupInitialMode] = useState<CleanupMode>('UNEXECUTED_SIGNALS');
  const [cleanupToast, setCleanupToast] = useState<string | null>(null);

  // Authentication State with Session Persistence
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('menuka_trading_auth');
      if (!stored) return false;
      const parsed = JSON.parse(stored);
      return Boolean(parsed && parsed.user === 'Menuka');
    } catch {
      return false;
    }
  });
  const [currentUser, setCurrentUser] = useState<string>('Menuka');

  const handleLoginSuccess = (username: string) => {
    setCurrentUser(username);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('menuka_trading_auth');
    } catch (err) {
      console.warn('Logout session clear error:', err);
    }
    setIsAuthenticated(false);
  };

  const openCleanupModal = (mode: CleanupMode) => {
    setCleanupInitialMode(mode);
    setIsCleanupModalOpen(true);
  };

  // Fetch Bot Status and Positions
  const fetchBotStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/status', {
        headers: { Accept: 'application/json' },
      });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) return;
      const data = await res.json();
      if (data.status) setStatus(data.status);
      if (data.settings) setSettings(data.settings);
      if (data.activePositions) setOpenPositions(data.activePositions);
      if (data.closedPositions) setClosedPositions(data.closedPositions);
      if (data.signals) setSignals(data.signals);
      if (data.logs) setLogs(data.logs);
    } catch (err) {
      console.warn('Bot status fetch poll note:', err);
    }
  }, []);

  // Fetch Candles & SMC for Selected Symbol
  const fetchKlines = useCallback(async (sym: string, tf: string) => {
    try {
      const res = await fetch(`/api/binance/klines?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(tf)}&limit=70`, {
        headers: { Accept: 'application/json' },
      });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) return;
      const data = await res.json();
      if (data.klines) setCandles(data.klines);
      if (data.analysis) setAnalysis(data.analysis);
    } catch (err) {
      console.warn('Klines fetch poll note:', err);
    }
  }, []);

  // Fetch Binance USD-M Pairs
  const fetchPairs = useCallback(async () => {
    try {
      const res = await fetch('/api/binance/pairs', {
        headers: { Accept: 'application/json' },
      });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) return;
      const data = await res.json();
      setPairs(data);
    } catch (err) {
      console.warn('Pairs fetch poll note:', err);
    }
  }, []);

  // Initial Load and Polling - Only active when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchBotStatus();
    fetchKlines(selectedSymbol, selectedInterval);
    fetchPairs();

    // Regular Polling for real-time status and live PnL updates
    const statusInterval = setInterval(fetchBotStatus, 2500);
    const chartInterval = setInterval(() => {
      fetchKlines(selectedSymbol, selectedInterval);
    }, 4000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(chartInterval);
    };
  }, [isAuthenticated, fetchBotStatus, fetchKlines, fetchPairs, selectedSymbol, selectedInterval]);

  // Countdown timer calculation - Only active when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const timer = setInterval(() => {
      if (status.nextScanTime) {
        const remaining = Math.max(0, Math.floor((status.nextScanTime - Date.now()) / 1000));
        setCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isAuthenticated, status.nextScanTime]);

  // Toggle Bot Auto-Trading
  const handleToggleBot = async () => {
    try {
      const res = await fetch('/api/bot/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (data.status) {
          setStatus(data.status);
        } else {
          await fetchBotStatus();
        }
      } else {
        await fetchBotStatus();
      }
    } catch (err) {
      console.error('Toggle error:', err);
      fetchBotStatus();
    }
  };

  // Trigger Immediate 2-Minute Scan
  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      await fetch('/api/cron/scanner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      await fetchBotStatus();
    } catch (err) {
      console.error('Scan trigger error:', err);
    } finally {
      setTimeout(() => setIsScanning(false), 2000);
    }
  };

  // Close Position
  const handleClosePosition = async (positionId: string) => {
    try {
      await fetch('/api/positions/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ positionId, reason: 'Manual close from UI dashboard' }),
      });
      fetchBotStatus();
    } catch (err) {
      console.error('Close position error:', err);
    }
  };

  // Save Settings
  const handleSaveSettings = async (newSettings: Partial<BotSettings>) => {
    try {
      const res = await fetch('/api/bot/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(newSettings),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (data.settings) setSettings(data.settings);
        fetchBotStatus();
      }
    } catch (err) {
      console.error('Save settings error:', err);
    }
  };

  const handleSelectSymbol = (sym: string) => {
    setSelectedSymbol(sym);
    fetchKlines(sym, selectedInterval);
    setActiveTab('TERMINAL');
  };

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navigation & Status Bar */}
      <Navbar
        status={status}
        settings={settings}
        onToggleBot={handleToggleBot}
        onTriggerScan={handleTriggerScan}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCleanup={() => openCleanupModal('UNEXECUTED_SIGNALS')}
        countdown={countdown}
        isScanning={isScanning}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto p-4 space-y-4 flex-1">
        {/* Performance Metrics Summary Bar */}
        <MetricsCards status={status} />

        {/* Temporary Cleanup Feedback Toast */}
        {cleanupToast && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow-lg shadow-emerald-500/10">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{cleanupToast}</span>
            </div>
            <button
              onClick={() => setCleanupToast(null)}
              className="text-emerald-400 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-emerald-900/40 transition"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Switcher Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('TERMINAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'TERMINAL'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Live Terminal & Chart</span>
            </button>

            <button
              onClick={() => setActiveTab('SIGNALS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'SIGNALS'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Signals ({signals.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('POSITIONS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'POSITIONS'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Positions ({openPositions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('SCANNER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'SCANNER'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>USD-M Heatmap ({pairs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('WEBHOOK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'WEBHOOK'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Webhook className="w-3.5 h-3.5" />
              <span>TradingView Webhook</span>
            </button>

            <button
              onClick={() => setActiveTab('LOGS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'LOGS'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Engine Logs ({logs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('AUDIT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'AUDIT'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Audit & Requirements</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openCleanupModal('UNEXECUTED_SIGNALS')}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center gap-1.5 transition shadow-sm"
              title="Safe Mode: Delete unexecuted signals & logs. All active open positions are strictly preserved."
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Unexecuted Signals</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                Safe Mode
              </span>
            </button>

            <button
              onClick={() => openCleanupModal('ALL_HISTORY')}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 flex items-center gap-1.5 transition shadow-sm"
              title="Clear all closed trade history, past signals & logs. Active open positions are strictly preserved."
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear History (Keep Open Trades)</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                {openPositions.length} Protected
              </span>
            </button>

            <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold font-mono text-xs flex items-center gap-1">
              <Database className="w-3 h-3" />
              <span>Supabase Live</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-400 font-bold font-mono text-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {status.geminiModel}
            </span>
          </div>
        </div>

        {/* Tab 1: Terminal & Live Chart */}
        {activeTab === 'TERMINAL' && (
          <div className="space-y-4">
            <CandleChart
              candles={candles}
              analysis={analysis}
              symbol={selectedSymbol}
              interval={selectedInterval}
              onSymbolChange={handleSelectSymbol}
              onIntervalChange={(tf) => {
                setSelectedInterval(tf);
                fetchKlines(selectedSymbol, tf);
              }}
            />

            {/* Quick Two-Column View: Active Positions + Recent Signals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PositionsTable
                openPositions={openPositions}
                closedPositions={closedPositions}
                onClosePosition={handleClosePosition}
                onSelectSymbol={handleSelectSymbol}
                onOpenCleanupHistory={() => openCleanupModal('ALL_HISTORY')}
              />
              <SignalsFeed
                signals={signals}
                status={status}
                onSelectSymbol={handleSelectSymbol}
                onOpenCleanupSignals={() => openCleanupModal('UNEXECUTED_SIGNALS')}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Full Signals Feed */}
        {activeTab === 'SIGNALS' && (
          <SignalsFeed
            signals={signals}
            status={status}
            onSelectSymbol={handleSelectSymbol}
            onOpenCleanupSignals={() => openCleanupModal('UNEXECUTED_SIGNALS')}
          />
        )}

        {/* Tab 3: Positions & Trade History */}
        {activeTab === 'POSITIONS' && (
          <PositionsTable
            openPositions={openPositions}
            closedPositions={closedPositions}
            onClosePosition={handleClosePosition}
            onSelectSymbol={handleSelectSymbol}
            onOpenCleanupHistory={() => openCleanupModal('ALL_HISTORY')}
          />
        )}

        {/* Tab 4: Binance USD-M Pair Heatmap & Scanner */}
        {activeTab === 'SCANNER' && (
          <MarketScannerList
            pairs={pairs}
            onSelectSymbol={handleSelectSymbol}
            onScanPair={handleSelectSymbol}
            selectedSymbol={selectedSymbol}
          />
        )}

        {/* Tab 5: Webhook & TradingView Integration */}
        {activeTab === 'WEBHOOK' && <WebhookIntegration />}

        {/* Tab 6: Engine Activity Logs Console */}
        {activeTab === 'LOGS' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white text-xs uppercase tracking-wider">
                  2-Minute Scanner & Execution Telemetry Stream
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Real-time cron output
              </span>
            </div>
            <div className="p-4 font-mono text-xs space-y-1.5 max-h-[500px] overflow-y-auto bg-slate-950">
              {logs.length === 0 ? (
                <div className="text-slate-500">Initializing engine log stream...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="text-slate-500 select-none">[{log.time}]</span>
                    <span
                      className={
                        log.type === 'trade'
                          ? 'text-amber-400 font-bold'
                          : log.type === 'success'
                          ? 'text-emerald-400'
                          : log.type === 'warn'
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 7: Requirements & Database Audit */}
        {activeTab === 'AUDIT' && <RequirementsAudit />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-3 px-4 text-center text-xs text-slate-500 font-mono bg-slate-950">
        Binance Futures USD-M Automated Engine • SMC Order Blocks & Divergence • Gemini AI &gt;80% Confidence
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {/* Historical Data & Database Storage Cleanup Modal */}
      <CleanupModal
        isOpen={isCleanupModalOpen}
        onClose={() => setIsCleanupModalOpen(false)}
        initialMode={cleanupInitialMode}
        openPositions={openPositions}
        closedPositions={closedPositions}
        signals={signals}
        logsCount={logs.length}
        onSuccess={() => {
          fetchBotStatus();
          setCleanupToast('Database & dashboard cleanup completed. Active open positions remain preserved.');
          setTimeout(() => setCleanupToast(null), 5000);
        }}
      />
    </div>
  );
}
