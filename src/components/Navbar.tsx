import React from 'react';
import { BotStatus, BotSettings } from '../types/trading';
import {
  Activity,
  Play,
  Pause,
  RefreshCw,
  Cpu,
  Radio,
  Sliders,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface NavbarProps {
  status: BotStatus;
  settings: BotSettings;
  onToggleBot: () => void;
  onTriggerScan: () => void;
  onOpenSettings: () => void;
  countdown: number;
  isScanning: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  status,
  settings,
  onToggleBot,
  onTriggerScan,
  onOpenSettings,
  countdown,
  isScanning,
}) => {
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Bot Status */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-base">
                BINANCE <span className="text-amber-400">SMC AI</span>
              </span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                USD-M Futures
              </span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {settings.tradingMode}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              100% Automated SMC Engine + Gemini AI Deep Validation
            </p>
          </div>
        </div>

        {/* Live Status Preview Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Bot Status: Scanning Binance Pairs */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
              status.isRunning
                ? 'bg-slate-900/90 border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-500/10'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            <span className="relative flex h-2 w-2">
              {status.isRunning && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  status.isRunning ? 'bg-emerald-500' : 'bg-slate-500'
                }`}
              ></span>
            </span>
            <span className="font-semibold truncate max-w-[240px]">
              {status.currentAction || 'Bot Status: Scanning Binance Pairs...'}
            </span>
          </div>

          {/* Currently Analyzing Ticker Card */}
          {status.analyzingSymbol && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono animate-pulse">
              <Activity className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span>
                Analyzing: <strong>{status.analyzingSymbol}</strong>
              </span>
            </div>
          )}

          {/* Upcoming Signal Card */}
          {status.upcomingSignal && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
              <span>
                Upcoming: <strong>{status.upcomingSignal.symbol}</strong> ({status.upcomingSignal.bias})
              </span>
            </div>
          )}
        </div>

        {/* Action Controls & Countdown */}
        <div className="flex items-center gap-2">
          {/* Next 2-Min Scan Countdown */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
            <RefreshCw
              className={`w-3.5 h-3.5 text-slate-400 ${isScanning ? 'animate-spin text-amber-400' : ''}`}
            />
            <span className="text-[11px] text-slate-400">Next Scan:</span>
            <span className="font-bold text-amber-400">{formatCountdown(countdown)}</span>
          </div>

          {/* Scan Now Button */}
          <button
            onClick={onTriggerScan}
            disabled={isScanning}
            title="Trigger Immediate 2-Minute Market Scanner"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition disabled:opacity-50 border border-slate-700"
          >
            <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Scan Now</span>
          </button>

          {/* Auto-Trading Toggle */}
          <button
            onClick={onToggleBot}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
              status.isRunning
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/30 shadow-lg shadow-emerald-600/20'
                : 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border-rose-800'
            }`}
          >
            {status.isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>AUTO-TRADE ON</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>PAUSED</span>
              </>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            title="Bot Settings & API Keys"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
