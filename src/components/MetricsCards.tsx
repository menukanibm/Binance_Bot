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
} from 'lucide-react';

interface MetricsCardsProps {
  status: BotStatus;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ status }) => {
  const isPnlPositive = status.netPnl >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
          {isPnlPositive ? '+' : ''}${status.netPnl.toFixed(2)}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          {status.totalTrades} Closed Trades
        </div>
      </div>

      {/* Win Rate */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
          <span>Win Rate</span>
          <Target className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-lg font-bold font-mono text-white">
          {status.winRate}%
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5 flex gap-1.5">
          <span className="text-emerald-400 font-semibold">{status.totalWins}W</span>
          <span>/</span>
          <span className="text-rose-400 font-semibold">{status.totalLosses}L</span>
        </div>
      </div>

      {/* Active Positions */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
          <span>Active Positions</span>
          <Layers className="w-4 h-4 text-blue-400" />
        </div>
        <div className="text-lg font-bold font-mono text-white">
          {status.activePositionsCount}
        </div>
        <div className="text-[10px] text-blue-400 mt-0.5">
          Auto SL/TP Active
        </div>
      </div>

      {/* Account Balance */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
          <span>Account Capital</span>
          <DollarSign className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-lg font-bold font-mono text-white">
          ${status.accountBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          USDT Collateral
        </div>
      </div>

      {/* Monitored Pairs */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
          <span>Monitored Pairs</span>
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="text-lg font-bold font-mono text-white">
          {status.monitoredPairsCount} USD-M
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          2-Min Full Scan
        </div>
      </div>

      {/* Gemini AI Deep Validation */}
      <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-3 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
          <span className="text-amber-400 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Gemini AI
          </span>
          <span className="text-[10px] font-mono text-amber-400/80">
            &gt;{status.geminiThreshold}% Conf
          </span>
        </div>
        <div className="text-sm font-bold font-mono text-white truncate">
          {status.geminiModel}
        </div>
        <div className="text-[10px] text-emerald-400 mt-0.5">
          Deep Validation Active
        </div>
      </div>
    </div>
  );
};
