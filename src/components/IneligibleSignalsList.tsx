import React, { useState } from 'react';
import { IneligibleSignal } from '../types/trading';
import {
  AlertCircle,
  Clock,
  Sparkles,
  DollarSign,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  CheckCircle2,
} from 'lucide-react';

interface IneligibleSignalsListProps {
  ineligibleSignals: IneligibleSignal[];
  onSelectSymbol: (symbol: string) => void;
}

export const IneligibleSignalsList: React.FC<IneligibleSignalsListProps> = ({
  ineligibleSignals = [],
  onSelectSymbol,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'INSUFFICIENT_CAPITAL' | 'LOW_AI_SCORE' | 'RISK_CAP_EXCEEDED'>('ALL');

  const filtered = (ineligibleSignals || []).filter((sig) => {
    if (filter === 'ALL') return true;
    return sig.reasonCategory === filter;
  });

  const insufficientCapitalCount = (ineligibleSignals || []).filter((s) => s.reasonCategory === 'INSUFFICIENT_CAPITAL').length;
  const lowAiCount = (ineligibleSignals || []).filter((s) => s.reasonCategory === 'LOW_AI_SCORE').length;
  const riskCapCount = (ineligibleSignals || []).filter((s) => s.reasonCategory === 'RISK_CAP_EXCEEDED').length;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg space-y-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm uppercase tracking-wider">
                Ineligible & Skipped Signals
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                {ineligibleSignals.length} Total Skipped
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Signals that were not forwarded to Binance due to capital shortage, low AI score, or risk rules.
            </p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs font-semibold">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-2.5 py-1 rounded transition ${
              filter === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({ineligibleSignals.length})
          </button>
          <button
            onClick={() => setFilter('INSUFFICIENT_CAPITAL')}
            className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
              filter === 'INSUFFICIENT_CAPITAL'
                ? 'bg-rose-500 text-white font-bold'
                : 'text-slate-400 hover:text-rose-300'
            }`}
          >
            <DollarSign className="w-3 h-3" />
            <span>Capital ({insufficientCapitalCount})</span>
          </button>
          <button
            onClick={() => setFilter('LOW_AI_SCORE')}
            className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
              filter === 'LOW_AI_SCORE'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>AI Score ({lowAiCount})</span>
          </button>
          <button
            onClick={() => setFilter('RISK_CAP_EXCEEDED')}
            className={`px-2.5 py-1 rounded transition ${
              filter === 'RISK_CAP_EXCEEDED'
                ? 'bg-blue-500 text-white font-bold'
                : 'text-slate-400 hover:text-blue-300'
            }`}
          >
            Risk ({riskCapCount})
          </button>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
          <div className="text-slate-300 font-semibold text-sm">No Ineligible Signals Found</div>
          <p className="text-slate-500 mt-1 max-w-md mx-auto">
            All recent qualified signals have either passed the validation pipeline or there are no filtered skip events.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/70 max-h-[480px] overflow-y-auto">
          {filtered.map((sig) => {
            const isBuy = sig.side === 'BUY';
            const isCapitalIssue = sig.reasonCategory === 'INSUFFICIENT_CAPITAL';
            const isAiIssue = sig.reasonCategory === 'LOW_AI_SCORE';
            const isRiskIssue = sig.reasonCategory === 'RISK_CAP_EXCEEDED';

            return (
              <div
                key={sig.id}
                className="p-3.5 hover:bg-slate-800/30 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      onClick={() => onSelectSymbol(sig.symbol)}
                      className="font-bold text-white font-mono hover:text-amber-400 cursor-pointer text-sm"
                    >
                      {sig.symbol}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 ${
                        isBuy
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {sig.side}
                    </span>

                    {/* Status Pill */}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                        isCapitalIssue
                          ? 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                          : isAiIssue
                          ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                          : 'bg-blue-950/60 text-blue-300 border-blue-500/40'
                      }`}
                    >
                      {isCapitalIssue
                        ? 'Skipped: Insufficient Capital'
                        : isAiIssue
                        ? `Skipped: Low AI Score (${sig.confidence}%)`
                        : 'Skipped: Risk Rules (Margin Cap)'}
                    </span>

                    <span className="text-slate-500 font-mono text-[11px] ml-auto md:ml-0">
                      ${(sig.price || 0).toFixed(sig.price > 10 ? 2 : 4)}
                    </span>
                  </div>

                  {/* Detailed Reason Explanation */}
                  <div className="text-slate-300 text-xs font-mono bg-slate-950/80 p-2 rounded border border-slate-800/80 flex items-start gap-2">
                    <AlertCircle
                      className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                        isCapitalIssue
                          ? 'text-rose-400'
                          : isAiIssue
                          ? 'text-amber-400'
                          : 'text-blue-400'
                      }`}
                    />
                    <div>
                      <span className="font-semibold">{sig.detailedReason}</span>
                      {sig.availableCapitalUsdt !== undefined && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Available: ${(sig.availableCapitalUsdt ?? 0).toFixed(2)} USDT &bull; Required Margin: ${(sig.requiredCapitalUsdt ?? 10).toFixed(2)} USDT
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Technical & Elliott Wave Confluence */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 pt-0.5 font-mono">
                    {sig.elliottWaveSummary && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        Elliott: {sig.elliottWaveSummary}
                      </span>
                    )}
                    {sig.smcSummary && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        SMC: {sig.smcSummary}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <div className="text-right text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(sig.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <button
                    onClick={() => onSelectSymbol(sig.symbol)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                  >
                    View Chart
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
