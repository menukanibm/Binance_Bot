import React, { useState } from 'react';
import { BotSettings } from '../types/trading';
import {
  X,
  Sliders,
  Shield,
  Key,
  Cpu,
  Check,
  AlertTriangle,
  Zap,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BotSettings;
  onSave: (newSettings: Partial<BotSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [form, setForm] = useState<BotSettings>({ ...settings });
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in duration-200">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-wide">
              Trading Bot & Engine Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Trading Execution Mode */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Trading Execution Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'PAPER', label: 'Paper Trading', desc: 'Real live prices, simulated fills' },
                { id: 'TESTNET', label: 'Binance Testnet', desc: 'testnet.binancefuture.com' },
                { id: 'LIVE', label: 'Binance Live', desc: 'fapi.binance.com' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setForm({ ...form, tradingMode: m.id as any })}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    form.tradingMode === m.id
                      ? 'bg-amber-500/10 border-amber-500 text-white shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold text-white">{m.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Risk & Leverage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Futures Leverage ({form.leverage}x)
              </label>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={form.leverage}
                onChange={(e) => setForm({ ...form, leverage: parseInt(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>1x</span>
                <span className="text-amber-400 font-bold">{form.leverage}x</span>
                <span>50x</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Risk Capital Per Trade ({form.riskPercentage}%)
              </label>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={form.riskPercentage}
                onChange={(e) => setForm({ ...form, riskPercentage: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>0.5%</span>
                <span className="text-amber-400 font-bold">{form.riskPercentage}%</span>
                <span>10%</span>
              </div>
            </div>
          </div>

          {/* Gemini AI Validation Threshold */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-amber-400" />
                Gemini AI Approval Confidence Threshold
              </label>
              <span className="text-xs font-bold font-mono text-amber-400">
                {form.geminiThreshold}% Confidence
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Only setups with Gemini AI confidence score greater than this threshold will be approved and auto-executed on Binance.
            </p>
            <input
              type="range"
              min="70"
              max="95"
              step="1"
              value={form.geminiThreshold}
              onChange={(e) => setForm({ ...form, geminiThreshold: parseInt(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Dynamic SL / TP defaults */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Dynamic Stop Loss (SL)
              </label>
              <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-rose-400">
                1.0% (Calculated from SMC Invalidation)
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Dynamic Take Profit (TP)
              </label>
              <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400">
                2.0% (1:2 R:R Target Ratio)
              </div>
            </div>
          </div>

          {/* Binance API Credentials */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Binance Futures API Credentials</span>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Binance API Key</label>
              <input
                type="text"
                value={form.binanceApiKey}
                onChange={(e) => setForm({ ...form, binanceApiKey: e.target.value })}
                placeholder="Enter Binance Futures API Key"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Binance API Secret (Optional for HMAC Order Signing)</label>
              <input
                type="password"
                value={form.binanceApiSecret}
                onChange={(e) => setForm({ ...form, binanceApiSecret: e.target.value })}
                placeholder="Enter Binance Futures API Secret"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Configuration</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
