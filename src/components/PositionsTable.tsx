import React, { useState } from 'react';
import { Position } from '../types/trading';
import {
  TrendingUp,
  TrendingDown,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRightLeft,
  Trash2,
  ShieldCheck,
} from 'lucide-react';

interface PositionsTableProps {
  openPositions: Position[];
  closedPositions: Position[];
  onClosePosition: (positionId: string) => void;
  onSelectSymbol: (symbol: string) => void;
  onOpenCleanupHistory?: () => void;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({
  openPositions,
  closedPositions,
  onClosePosition,
  onSelectSymbol,
  onOpenCleanupHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'OPEN' | 'HISTORY'>('OPEN');
  const totalOpenMargin = openPositions.reduce(
    (sum, p) => sum + (p.marginUsed > 0 ? p.marginUsed : (p.entryPrice * p.quantity) / (p.leverage || 10)),
    0
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Header and Tab Switcher */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-white text-sm uppercase tracking-wider">
              Binance Futures Positions
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold hidden sm:inline-block">
            ISOLATED MARGIN MODE
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('OPEN')}
            className={`px-3 py-1 text-xs font-semibold rounded transition flex items-center gap-1.5 ${
              activeTab === 'OPEN'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Active Positions</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'OPEN' ? 'bg-slate-950 text-amber-400 font-bold' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {openPositions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-3 py-1 text-xs font-semibold rounded transition flex items-center gap-1.5 ${
              activeTab === 'HISTORY'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Trade History</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'HISTORY' ? 'bg-slate-950 text-amber-400 font-bold' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {closedPositions.length}
            </span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'OPEN' ? (
        openPositions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No active open positions. The 2-minute scanner will auto-execute positions once Gemini AI approves SMC setups (&gt;80% confidence).
          </div>
        ) : (
          <div>
            <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">
                Total Active Margin: <strong className="text-amber-400">${totalOpenMargin.toFixed(2)} USDT</strong>
              </span>
              <span className="text-slate-500 text-[11px]">
                Risk Rule: Max 10% Margin Cap &bull; Strictly ISOLATED Mode Enforced
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Symbol / Side</th>
                    <th className="py-2.5 px-3">Size / Margin</th>
                    <th className="py-2.5 px-3">Entry Price</th>
                    <th className="py-2.5 px-3">Mark Price</th>
                    <th className="py-2.5 px-3">Stop Loss (-1%)</th>
                    <th className="py-2.5 px-3">Take Profit (+2%)</th>
                    <th className="py-2.5 px-3 text-right">Unrealized PnL</th>
                    <th className="py-2.5 px-3 text-center">Auto-Close Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {openPositions.map((pos) => {
                    const isLong = pos.side === 'LONG';
                    const isProfitable = pos.unrealizedPnl >= 0;

                    return (
                      <tr key={pos.id} className="hover:bg-slate-800/30 transition">
                        {/* Symbol & Side */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              onClick={() => onSelectSymbol(pos.symbol)}
                              className="font-bold text-white hover:text-amber-400 cursor-pointer text-sm"
                            >
                              {pos.symbol}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isLong ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {pos.side} {pos.leverage}x
                            </span>
                            <span className="px-1 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              ISOLATED
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {new Date(pos.openedAt).toLocaleTimeString()}
                          </div>
                        </td>

                        {/* Size / Margin */}
                        <td className="py-3 px-3 text-slate-300">
                          <div>{pos.quantity} Qty</div>
                          <div className="text-[10px] text-slate-400 font-mono">${(pos.marginUsed || 0).toFixed(2)} USDT</div>
                        </td>

                      {/* Entry Price */}
                      <td className="py-3 px-3 text-slate-200">
                        ${pos.entryPrice.toFixed(pos.entryPrice > 10 ? 2 : 4)}
                      </td>

                      {/* Current / Mark Price */}
                      <td className="py-3 px-3 text-white font-bold">
                        ${pos.currentPrice.toFixed(pos.currentPrice > 10 ? 2 : 4)}
                      </td>

                      {/* Stop Loss (-1%) */}
                      <td className="py-3 px-3 text-rose-400">
                        ${pos.stopLoss.toFixed(pos.stopLoss > 10 ? 2 : 4)}
                      </td>

                      {/* Take Profit (+2%) */}
                      <td className="py-3 px-3 text-emerald-400">
                        ${pos.takeProfit.toFixed(pos.takeProfit > 10 ? 2 : 4)}
                      </td>

                      {/* Unrealized PnL */}
                      <td className="py-3 px-3 text-right">
                        <div
                          className={`font-bold text-sm ${
                            isProfitable ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isProfitable ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                        </div>
                        <div
                          className={`text-[10px] ${
                            isProfitable ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {isProfitable ? '+' : ''}{pos.unrealizedPnlPercent.toFixed(2)}%
                        </div>
                      </td>

                      {/* Auto-Close Status */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                          <span>Active SL/TP Monitor</span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => onClosePosition(pos.id)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-900/60 hover:text-rose-300 text-slate-300 border border-slate-700 text-xs transition"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )
      ) : (
        <div>
          {/* Closed Trades Action Header */}
          <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-400 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Historical Closed Trades ({closedPositions.length})</span>
            </div>

            {onOpenCleanupHistory && (
              <button
                onClick={onOpenCleanupHistory}
                className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto shadow-sm"
                title="Wipes closed trade history and logs from Supabase. Active open positions are strictly preserved."
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Clear History (Keep Open Trades)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>{openPositions.length} Open Protected</span>
                </span>
              </button>
            )}
          </div>

          {closedPositions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No closed trade history. Historical trades have either not occurred yet or have been cleared.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Symbol / Side</th>
                    <th className="py-2.5 px-3">Entry Price</th>
                    <th className="py-2.5 px-3">Close Price</th>
                    <th className="py-2.5 px-3">Realized PnL</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Auto Close Trigger Reason</th>
                    <th className="py-2.5 px-3 text-right">Closed At</th>
                  </tr>
                </thead>
            <tbody className="divide-y divide-slate-800/60">
              {closedPositions.map((pos) => {
                const isWin = pos.status === 'WIN';
                const isOppositeClosed = pos.status === 'CLOSED_OPPOSITE_SIGNAL';

                return (
                  <tr key={pos.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          onClick={() => onSelectSymbol(pos.symbol)}
                          className="font-bold text-white hover:text-amber-400 cursor-pointer"
                        >
                          {pos.symbol}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            pos.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {pos.side}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-300">
                      ${pos.entryPrice.toFixed(pos.entryPrice > 10 ? 2 : 4)}
                    </td>

                    <td className="py-3 px-3 text-white font-bold">
                      ${(pos.closePrice || pos.currentPrice).toFixed(pos.entryPrice > 10 ? 2 : 4)}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`font-bold ${
                          (pos.realizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {(pos.realizedPnl || 0) >= 0 ? '+' : ''}${pos.realizedPnl?.toFixed(2)}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isWin
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : isOppositeClosed
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {pos.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-300 max-w-[280px] truncate">
                      {pos.closeReason || 'Filled Target on Binance Futures'}
                    </td>

                    <td className="py-3 px-3 text-right text-slate-500">
                      {pos.closedAt ? new Date(pos.closedAt).toLocaleTimeString() : 'N/A'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
        </div>
      )}
    </div>
  );
};
