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
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Activity,
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
  const [form, setForm] = useState<BotSettings>(() => {
    const savedGemini = typeof window !== 'undefined' ? localStorage.getItem('menuka_gemini_api_key') || '' : '';
    return {
      ...settings,
      geminiApiKey: settings.geminiApiKey || savedGemini,
    };
  });
  const [saved, setSaved] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const [showBinanceSecret, setShowBinanceSecret] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isTestingBinance, setIsTestingBinance] = useState(false);
  const [binanceTestResult, setBinanceTestResult] = useState<{
    success: boolean;
    message: string;
    balance?: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestBinance = async () => {
    if (!form.binanceApiKey || !form.binanceApiSecret) {
      setBinanceTestResult({
        success: false,
        message: 'Please fill in both Binance API Key and Secret Key before testing connection.',
      });
      return;
    }

    setIsTestingBinance(true);
    setBinanceTestResult(null);

    try {
      const res = await fetch('/api/test-binance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          apiKey: form.binanceApiKey,
          secretKey: form.binanceApiSecret,
          testnet: form.tradingMode === 'TESTNET',
        }),
      });

      const data = await res.json();
      setBinanceTestResult({
        success: Boolean(data.success),
        message: data.message || data.error || 'Connection test finished.',
        balance: data.totalWalletBalance,
      });
    } catch (err: any) {
      setBinanceTestResult({
        success: false,
        message: `Network error connecting to test endpoint: ${err?.message || err}`,
      });
    } finally {
      setIsTestingBinance(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.geminiApiKey !== undefined) {
      try {
        localStorage.setItem('menuka_gemini_api_key', form.geminiApiKey.trim());
      } catch (err) {
        console.warn('localStorage save note:', err);
      }
    }
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

          {/* Position Capital Allocation (% of Capital Per Trade) - User Configurable */}
          <div className="bg-slate-950/90 border border-emerald-500/40 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald-400" />
                Position Capital Allocation (% of Capital)
              </label>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {form.positionCapitalPercent || 10}% Per Trade
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Determines exactly what percentage of your capital is used as margin for each trade. Each opened position will strictly utilize this exact margin amount.
            </p>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 mr-1 font-semibold">Presets:</span>
              {[5, 10, 15, 20, 25, 50].map((pct) => (
                <button
                  type="button"
                  key={pct}
                  onClick={() => setForm({ ...form, positionCapitalPercent: pct })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition ${
                    (form.positionCapitalPercent || 10) === pct
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>

            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={form.positionCapitalPercent || 10}
              onChange={(e) => setForm({ ...form, positionCapitalPercent: parseInt(e.target.value) || 10 })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1% Micro</span>
              <span className="text-emerald-400 font-bold">{form.positionCapitalPercent || 10}% Per Position</span>
              <span>100% Full Cap</span>
            </div>

            {/* Live Calculation Preview */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-[11px] font-mono text-slate-300 flex items-center justify-between">
              <div>
                <span className="text-slate-400">Position Margin: </span>
                <span className="text-emerald-400 font-bold">
                  ${(((form.customCapitalUsdt || 1000) * (form.positionCapitalPercent || 10)) / 100).toFixed(2)} USDT
                </span>
                <span className="text-slate-500 text-[10px]"> ({form.positionCapitalPercent || 10}% of ${(form.customCapitalUsdt || 1000).toLocaleString()})</span>
              </div>
              <div>
                <span className="text-slate-400">Notional @ {form.leverage}x: </span>
                <span className="text-white font-bold">
                  ${((((form.customCapitalUsdt || 1000) * (form.positionCapitalPercent || 10)) / 100) * form.leverage).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Account Capital Configuration (USDT) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Account Trading Capital (USDT)
              </label>
              <span className="text-xs font-mono text-cyan-400 font-bold">
                ${(form.customCapitalUsdt || 1000).toLocaleString()} USDT
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Your trading capital base. If your live Binance USD-M wallet balance is $0.00 (or funds are in spot/awaiting transfer), the engine uses this capital amount to calculate your {form.positionCapitalPercent || 10}% position margin.
            </p>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-mono text-slate-500">$</span>
              <input
                type="number"
                min="10"
                step="10"
                value={form.customCapitalUsdt || 1000}
                onChange={(e) => setForm({ ...form, customCapitalUsdt: Math.max(10, parseFloat(e.target.value) || 100) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
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
                Max Total Margin Cap ({form.maxTotalMarginPct || 50}%)
              </label>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={form.maxTotalMarginPct || 50}
                onChange={(e) => setForm({ ...form, maxTotalMarginPct: parseInt(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>10%</span>
                <span className="text-amber-400 font-bold">{form.maxTotalMarginPct || 50}%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

            {/* Isolated Margin Mode Only Banner */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1">
                    <span>Margin Mode:</span>
                    <span className="text-emerald-400 font-mono uppercase">ISOLATED ONLY</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Cross margin is strictly disabled & rejected to protect account capital from liquidation.
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                ENFORCED
              </span>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Binance Futures API Credentials</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
                ISOLATED ONLY
              </span>
            </div>

            {/* Binance Cloud IP Whitelist Guide */}
            <div className="bg-slate-950 border border-cyan-500/40 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Binance IP Whitelist (Resolves Code -2015)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('34.34.226.197');
                    setCopiedIp(true);
                    setTimeout(() => setCopiedIp(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/40 transition flex items-center gap-1"
                >
                  {copiedIp ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedIp ? 'Copied 34.34.226.197!' : 'Copy Server IP'}
                </button>
              </div>
              <div className="text-[11px] font-mono bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Server Outbound IP:</span>
                <span className="text-cyan-400 font-bold select-all">34.34.226.197</span>
              </div>
              <div className="text-[10px] text-slate-400 space-y-1">
                <p>1. In Binance API Management &rarr; Edit &rarr; Select <strong>"Restrict access to trusted IPs only"</strong> and paste <code className="text-cyan-400 font-mono font-bold">34.34.226.197</code> (or select "Unrestricted").</p>
                <p>2. Ensure the <strong>"Enable Futures"</strong> permission checkbox is ticked on Binance.</p>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Binance API Key</label>
              <input
                type="text"
                value={form.binanceApiKey}
                onChange={(e) => {
                  setForm({ ...form, binanceApiKey: e.target.value });
                  setBinanceTestResult(null);
                }}
                placeholder="Enter Binance Futures API Key"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-400">Binance API Secret Key</label>
                <button
                  type="button"
                  onClick={() => setShowBinanceSecret(!showBinanceSecret)}
                  className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
                >
                  {showBinanceSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showBinanceSecret ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showBinanceSecret ? 'text' : 'password'}
                value={form.binanceApiSecret}
                onChange={(e) => {
                  setForm({ ...form, binanceApiSecret: e.target.value });
                  setBinanceTestResult(null);
                }}
                placeholder="Enter Binance Futures API Secret Key"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Test Connection Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleTestBinance}
                disabled={isTestingBinance}
                className="w-full py-2 px-3 bg-slate-950 hover:bg-slate-800 text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/60 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isTestingBinance ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Testing Binance Futures Connection (/fapi/v2/account)...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                    <span>Test Binance Connection</span>
                  </>
                )}
              </button>
            </div>

            {/* Connection Test Result Feedback Banner */}
            {binanceTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs leading-relaxed animate-in fade-in duration-200 ${
                  binanceTestResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {binanceTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>{binanceTestResult.success ? 'Binance Connection Verified!' : 'Connection Check Failed'}</span>
                      {binanceTestResult.success && binanceTestResult.balance !== undefined && (
                        <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Wallet: ${binanceTestResult.balance.toFixed(2)} USDT
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-90">{binanceTestResult.message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Customizable Gemini API Key with Persistence */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Google Gemini API Key (Customizable & Persisted)
              </label>
              <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30 font-semibold">
                PERSISTED
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Enter your own Gemini API key to override defaults. Saved securely to your browser storage and passed dynamically to the backend AI trade validation engine across refreshes.
            </p>
            <div className="relative">
              <input
                type={showGeminiKey ? 'text' : 'password'}
                value={form.geminiApiKey || ''}
                onChange={(e) => setForm({ ...form, geminiApiKey: e.target.value })}
                placeholder="Enter custom Gemini API key (e.g. AIzaSy... or AQ...)"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 pr-10 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Supports both Google AI Studio Free Tier and Paid Tier keys</span>
              <span className="text-emerald-400/90 font-mono">Dynamic fallback active on quota limit</span>
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
