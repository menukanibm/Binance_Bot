import React from 'react';
import { TradeSignal, BotStatus } from '../types/trading';
import {
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  Radio,
  Layers,
  Zap,
  Trash2,
  AlertCircle,
  Activity,
} from 'lucide-react';

interface SignalsFeedProps {
  signals?: TradeSignal[];
  status?: BotStatus;
  onSelectSymbol: (symbol: string) => void;
  onOpenCleanupSignals?: () => void;
}

export const SignalsFeed: React.FC<SignalsFeedProps> = ({
  signals = [],
  status,
  onSelectSymbol,
  onOpenCleanupSignals,
}) => {
  const safeSignals = Array.isArray(signals) ? signals : [];

  return (
    <div className="space-y-4">
      {/* Upcoming Signal Live Announcement Card */}
      {status?.upcomingSignal ? (
        <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-amber-950/40 border border-emerald-500/40 rounded-xl p-4 shadow-xl shadow-emerald-500/5 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center animate-pulse">
                <Radio className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                    Upcoming High-Confluence Signal
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono font-bold">
                    {status.upcomingSignal.confidence ?? 0}% Confluence
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-lg font-bold text-white font-mono">
                    {status.upcomingSignal.symbol}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-bold ${
                      status.upcomingSignal.bias === 'LONG'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {status.upcomingSignal.bias}
                  </span>
                  <span className="text-xs text-slate-400">
                    Est. Entry: ${(status.upcomingSignal.entryEst ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-900/90 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-mono text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>Deep Gemini AI Validation in progress...</span>
              </div>
              <button
                onClick={() => onSelectSymbol(status.upcomingSignal!.symbol)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
              >
                View Chart
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-300 font-mono">
            Pattern: {status.upcomingSignal.pattern}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>
              2-Minute Scanner is actively monitoring all USD-M pairs for fresh SMC Order Blocks, Elliott Waves & RSI Divergences...
            </span>
          </div>
          <span className="font-mono text-slate-500">Auto-Trading Active</span>
        </div>
      )}

      {/* Signals Feed Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Live Signal & Execution Feed
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Makka Smart Execution on Binance Futures (&gt;80% Gemini Validation)
          </span>
        </div>

        {onOpenCleanupSignals && (
          <button
            onClick={onOpenCleanupSignals}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 hover:border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto shadow-sm cursor-pointer"
            title="Safe Mode: Clear past unexecuted signals and logs. All active open positions are strictly preserved."
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Unexecuted Signals</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold">
              Safe Mode
            </span>
          </button>
        )}
      </div>

      {/* Signal Cards List */}
      {safeSignals.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
          Scanning pairs... Signals will automatically appear here once high-confluence SMC & Elliott Wave entry zones are confirmed.
        </div>
      ) : (
        <div className="space-y-3">
          {safeSignals.map((sig) => {
            if (!sig) return null;
            const isBuy = sig.side === 'BUY';
            const isExecuted = sig.status === 'EXECUTED';
            const isApproved = sig.status === 'APPROVED' || sig.status === 'EXECUTED';
            const isSkipped = sig.status.startsWith('SKIPPED_');
            const price = sig.price ?? 0;
            const takeProfit = sig.takeProfit ?? 0;
            const stopLoss = sig.stopLoss ?? 0;

            return (
              <div
                key={sig.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition shadow-sm"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  {/* Pair, Side, Timestamp */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isBuy
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {isBuy ? (
                        <ArrowUpRight className="w-5 h-5" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          onClick={() => onSelectSymbol(sig.symbol)}
                          className="font-bold font-mono text-white text-base hover:text-amber-400 cursor-pointer"
                        >
                          {sig.symbol}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-bold ${
                            isBuy
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {sig.side}
                        </span>
                        <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                          {sig.timeframe}
                        </span>
                        <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                          {sig.source}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono text-slate-400 mt-1">
                        <span>Price: ${price.toFixed(price > 10 ? 2 : 4)}</span>
                        <span>•</span>
                        <span className="text-emerald-400">TP: ${takeProfit.toFixed(price > 10 ? 2 : 4)} (+2%)</span>
                        <span>•</span>
                        <span className="text-rose-400">SL: ${stopLoss.toFixed(price > 10 ? 2 : 4)} (-1%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Gemini AI Validation Status Badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold ${
                        isApproved
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : isSkipped
                          ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                          : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Gemini AI: {sig.geminiConfidence ?? 0}%</span>
                      {isApproved ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                    </div>

                    <div
                      className={`text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg ${
                        isExecuted
                          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                          : isApproved
                          ? 'bg-amber-500 text-slate-950'
                          : isSkipped
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isExecuted ? 'BINANCE EXECUTED' : sig.status}
                    </div>

                    <button
                      onClick={() => onSelectSymbol(sig.symbol)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition cursor-pointer"
                    >
                      View Chart
                    </button>
                  </div>
                </div>

                {/* SMC & Elliott Wave Confluence Badges */}
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">
                    Confluence:
                  </span>
                  {sig.elliottWavePattern && (
                    <span className="text-xs font-mono bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 px-2 py-0.5 rounded">
                      Elliott: {sig.elliottWavePattern}
                    </span>
                  )}
                  <span className="text-xs font-mono bg-slate-800 border border-slate-700 text-slate-200 px-2 py-0.5 rounded">
                    {sig.smcPattern}
                  </span>
                  <span className="text-xs font-mono bg-slate-800 border border-slate-700 text-slate-200 px-2 py-0.5 rounded">
                    {sig.divergencePattern}
                  </span>
                  <span className="text-xs font-mono bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded">
                    Score: {sig.confluenceScore}/100
                  </span>
                </div>

                {/* Skip Reason Notice if applicable */}
                {sig.skipReason && (
                  <div className="mt-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded p-2 font-mono flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{sig.skipReason}</span>
                  </div>
                )}

                {/* Gemini Reasoning Text */}
                {sig.geminiReasoning && (
                  <div className="mt-2 text-xs text-slate-400 bg-slate-950/60 border border-slate-800/60 rounded p-2 font-sans flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-amber-400">Gemini Deep Reasoning:</strong>{' '}
                      {sig.geminiReasoning}
                    </span>
                  </div>
                )}

                <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between font-mono">
                  <span>ID: {sig.id}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(sig.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
