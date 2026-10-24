import React, { useState } from 'react';
import {
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Database,
  CheckCircle2,
  X,
  Loader2,
  Layers,
  Radio,
  Clock,
} from 'lucide-react';
import { Position, TradeSignal } from '../types/trading';

export type CleanupMode = 'UNEXECUTED_SIGNALS' | 'ALL_HISTORY';

interface CleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: CleanupMode;
  openPositions: Position[];
  closedPositions: Position[];
  signals: TradeSignal[];
  logsCount: number;
  onSuccess: () => void;
}

export const CleanupModal: React.FC<CleanupModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'UNEXECUTED_SIGNALS',
  openPositions,
  closedPositions,
  signals,
  logsCount,
  onSuccess,
}) => {
  const [mode, setMode] = useState<CleanupMode>(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedCheckbox, setConfirmedCheckbox] = useState(false);

  // Sync mode if initialMode changes
  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setResultMessage(null);
      setErrorMessage(null);
      setConfirmedCheckbox(false);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const unexecutedSignalsCount = signals.filter(
    (s) => s.status !== 'EXECUTED' && !openPositions.some((p) => p.signalId === s.id)
  ).length;

  const handleExecuteCleanup = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setResultMessage(null);

    const endpoint =
      mode === 'UNEXECUTED_SIGNALS' ? '/api/cleanup/signals' : '/api/cleanup/history';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Cleanup failed on server');
      }

      setResultMessage(data.message);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete cleanup');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl shadow-black/80 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Clear Market Analysis & History
              </h3>
              <p className="text-xs text-slate-400">
                Purge historical records from Supabase tables and dashboard memory
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setMode('UNEXECUTED_SIGNALS');
                setResultMessage(null);
                setErrorMessage(null);
              }}
              disabled={isLoading}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                mode === 'UNEXECUTED_SIGNALS'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Option 1: Safe Mode (Signals Only)</span>
            </button>

            <button
              onClick={() => {
                setMode('ALL_HISTORY');
                setResultMessage(null);
                setErrorMessage(null);
              }}
              disabled={isLoading}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                mode === 'ALL_HISTORY'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Option 2: Clear All History</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Strict Safety Guard Banner */}
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-3">
            <div className="p-1 rounded bg-emerald-500/20 text-emerald-400 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs space-y-1">
              <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                <span>STRICT SAFETY GUARD ACTIVE</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-200 text-[10px] font-mono">
                  {openPositions.length} Open Positions Safe
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Active open positions (<code className="font-mono text-emerald-300">status = 'OPEN'</code>) are
                strictly protected by code assertions and database query filters. They will{' '}
                <strong>NEVER</strong> be deleted, and their automated Stop-Loss / Take-Profit tracking will remain 100% active.
              </p>
            </div>
          </div>

          {/* Description of Selected Mode */}
          {mode === 'UNEXECUTED_SIGNALS' ? (
            <div className="space-y-3">
              <div className="text-xs text-slate-300 font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Option 1 Scope: Unexecuted Signals & Logs Only (Safe Mode)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-slate-400 text-[11px] mb-1">Unexecuted Signals to Wipe</div>
                  <div className="text-lg font-bold text-amber-400">{unexecutedSignalsCount}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Supabase table: signals</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-slate-400 text-[11px] mb-1">Engine Logs to Wipe</div>
                  <div className="text-lg font-bold text-amber-400">{logsCount}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Supabase table: bot_logs</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="font-semibold text-slate-200">Preserved Untouched:</div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-400">
                  <li>All {openPositions.length} currently open active trades in Binance & Supabase</li>
                  <li>All {closedPositions.length} closed trade records in your trade history</li>
                  <li>Account balance & overall performance statistics</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-rose-300 font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>Option 2 Scope: Clear All History (Keep Active Positions)</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-slate-400 text-[10px] mb-1">Closed Trades</div>
                  <div className="text-lg font-bold text-rose-400">{closedPositions.length}</div>
                  <div className="text-[9px] text-slate-500">WIN/LOSS rows</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-slate-400 text-[10px] mb-1">Past Signals</div>
                  <div className="text-lg font-bold text-rose-400">{signals.length}</div>
                  <div className="text-[9px] text-slate-500">Non-active signals</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-slate-400 text-[10px] mb-1">Engine Logs</div>
                  <div className="text-lg font-bold text-rose-400">{logsCount}</div>
                  <div className="text-[9px] text-slate-500">Stream records</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Strictly Preserved by Guard:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                  <li>
                    All <strong>{openPositions.length} Active OPEN Positions</strong> remain open on Binance and tracked in Supabase
                  </li>
                  <li>Automated Stop-Loss and Take-Profit monitoring continues without interruption</li>
                  <li>Account balance ($USDT) and exchange credentials remain untouched</li>
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>
                  This will execute a permanent SQL DELETE on Supabase table <code className="font-mono text-white">trades</code> where status is WIN, LOSS, or CLOSED.
                </span>
              </div>
            </div>
          )}

          {/* Feedback Messages */}
          {resultMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{resultMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Confirmation Checkbox */}
          {!resultMessage && (
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={confirmedCheckbox}
                onChange={(e) => setConfirmedCheckbox(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
              />
              <span className="text-xs text-slate-300">
                I confirm I want to wipe this historical data from Supabase and UI storage. I understand all{' '}
                <strong className="text-emerald-400">{openPositions.length} active open trades</strong> will be kept safe.
              </span>
            </label>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" />
            <span>Supabase Tables: signals, bot_logs{mode === 'ALL_HISTORY' ? ', trades' : ''}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              {resultMessage ? 'Close' : 'Cancel'}
            </button>

            {!resultMessage && (
              <button
                onClick={handleExecuteCleanup}
                disabled={!confirmedCheckbox || isLoading}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
                  !confirmedCheckbox || isLoading
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : mode === 'UNEXECUTED_SIGNALS'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Wiping Database...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {mode === 'UNEXECUTED_SIGNALS'
                        ? 'Confirm Safe Wipe'
                        : 'Confirm Wipe History'}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
