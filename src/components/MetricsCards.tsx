import React from 'react';
import { BotStatus } from '../types/trading';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Layers,
  Sparkles,
  DollarSign,
  CheckCircle2,
  Shield,
} from 'lucide-react';

interface MetricsCardsProps {
  status?: BotStatus;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ status }) => {
  const safeStatus = status || {
    netPnl: 0,
    totalTrades: 0,
    winRate: 0,
    totalWins: 0,
    totalLosses: 0,
    activePositionsCount: 0,
    accountBalance: 0,
    freeUsdt: 0,
    totalActiveMarginUsdt: 0,
    totalActiveMarginPercent: 0,
    maxTotalMarginPct: 50,
    monitoredPairsCount: 522,
    geminiModel: 'gemini-3.8-flash',
    geminiThreshold: 80,
    positionCapitalPercent: 10,
    isLiveWalletConnected: false,
  };

  const netPnl = safeStatus.netPnl ?? 0;
  const isPnlPositive = netPnl >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {/* Net Realized PnL */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
          <span>Net Realized PnL</span>
          {isPnlPositive ? (
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-rose-400" />
          )}
        </div>
        <div
          className={`text-lg font-bold font-mono ${
            isPnlPositive ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {isPnlPositive ? '+' : ''}${netPnl.toFixed(2)}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          {safeStatus.totalTrades ?? 0} Closed Trades
        </div>
      </div>

      {/* Win Rate */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
          <span>Win Rate</span>
          <Target className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-lg font-bold font-mono text-white">
          {safeStatus.winRate ?? 0}%
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5 flex gap-1.5">
          <span className="text-emerald-400 font-semibold">{safeStatus.totalWins ?? 0}W</span>
          <span>/</span>
          <span className="text-rose-400 font-semibold">{safeStatus.totalLosses ?? 0}L</span>
        </div>
      </div>

      {/* Active Positions */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
          <span>Active Positions</span>
          <Layers className="w-4 h-4 text-blue-400" />
        </div>
        <div className="text-lg font-bold font-mono text-white">
          {safeStatus.activePositionsCount ?? 0}
        </div>
        <div className="text-[10px] text-blue-400 mt-0.5 font-mono">
          {(safeStatus.activePositionsCount ?? 0) > 0 ? `${safeStatus.activePositionsCount} Open on Binance` : '0 Open Trades'}
        </div>
      </div>

      {/* Account Balance & Capital */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
          <span className="font-semibold text-slate-300">Account Capital</span>
          {safeStatus.isLiveWalletConnected ? (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              LIVE USD-M
            </span>
          ) : (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-bold">
              KEYS REQUIRED
            </span>
          )}
        </div>
        <div className="text-lg font-bold font-mono text-emerald-400">
          ${(safeStatus.accountBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between font-mono">
          <span>Free: ${(safeStatus.freeUsdt || 0).toFixed(2)}</span>
          <span className="text-emerald-400/90 font-semibold">{safeStatus.positionCapitalPercent || 10}% / pos</span>
        </div>
      </div>

      {/* Active Margin & Position Sizing */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
          <span className="flex items-center gap-1 text-amber-400 font-semibold">
            <Shield className="w-3.5 h-3.5 text-amber-400" /> Active Margin
          </span>
          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            ISOLATED
          </span>
        </div>
        <div className="text-lg font-bold font-mono text-white">
          ${(safeStatus.totalActiveMarginUsdt || 0).toFixed(2)}
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between font-mono">
          <span className={(safeStatus.totalActiveMarginPercent ?? 0) > (safeStatus.maxTotalMarginPct || 50) * 0.8 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
            {(safeStatus.totalActiveMarginPercent || 0).toFixed(1)}% Active
          </span>
          <span className="text-slate-500">Cap: {safeStatus.maxTotalMarginPct || 50}%</span>
        </div>
      </div>

      {/* Monitored Pairs */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
          <span>Monitored Pairs</span>
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="text-lg font-bold font-mono text-white">
          {safeStatus.monitoredPairsCount || 522} USD-M
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          2-Min Full Scan
        </div>
      </div>

      {/* Gemini AI Deep Validation (Low Credit Mode) */}
      <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-3 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
          <span className="text-amber-400 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Gemini AI
          </span>
          <span className="text-[9px] font-mono text-amber-400/90 font-bold bg-amber-500/10 px-1 rounded border border-amber-500/30">
            LOW CREDIT
          </span>
        </div>
        <div className="text-sm font-bold font-mono text-white truncate">
          {safeStatus.geminiModel || 'gemini-3.8-flash'}
        </div>
        <div className="text-[10px] text-emerald-400 mt-0.5 flex items-center justify-between font-mono">
          <span>Best Signal First</span>
          <span className="text-slate-400">&gt;{safeStatus.geminiThreshold || 80}% Conf</span>
        </div>
      </div>
    </div>
  );
};
