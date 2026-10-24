import React, { useState } from 'react';
import {
  Webhook,
  Copy,
  Check,
  Send,
  Code,
  Terminal,
  ExternalLink,
  Zap,
} from 'lucide-react';

export const WebhookIntegration: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [testSymbol, setTestSymbol] = useState('SOLUSDT');
  const [testAction, setTestAction] = useState<'BUY' | 'SELL'>('BUY');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const webhookUrl = `${window.location.origin}/api/webhook`;

  const samplePayload = {
    symbol: "{{ticker}}",
    action: "{{strategy.order.action}}",
    price: "{{close}}",
    pattern: "TradingView SMC Alert",
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTestWebhook = async () => {
    setTestSending(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: testSymbol,
          action: testAction,
          pattern: 'Manual Webhook Trigger (Testing Auto-Execution Flow)',
        }),
      });

      const data = await res.json();
      setTestResult(data.message || JSON.stringify(data));
    } catch (err: any) {
      setTestResult(`Error: ${err.message || 'Webhook failed'}`);
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Webhook className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Webhook & TradingView Auto-Trading Engine
            </h3>
            <p className="text-xs text-slate-400">
              Receive external webhook signals, validate via Gemini AI, and auto-execute on Binance
            </p>
          </div>
        </div>
      </div>

      {/* Webhook Endpoint URL */}
      <div>
        <label className="text-xs text-slate-400 block mb-1.5 font-medium">
          Live Webhook URL (For TradingView Webhook Alerts / Custom Bots)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={webhookUrl}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-amber-400 focus:outline-none select-all"
          />
          <button
            onClick={handleCopyUrl}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-medium transition flex items-center gap-1.5 border border-slate-700"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* TradingView Alert Message JSON Format */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-amber-400" />
            TradingView Alert Message JSON Body
          </label>
          <span className="text-[10px] text-slate-500 font-mono">POST /api/webhook</span>
        </div>
        <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-400 overflow-x-auto">
{JSON.stringify(samplePayload, null, 2)}
        </pre>
      </div>

      {/* Instant Webhook Signal Dispatcher */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-amber-400" />
            Test Inbound Webhook Execution
          </span>
          <span className="text-[10px] text-slate-500">Triggers Gemini AI Deep Check</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[140px]">
            <input
              type="text"
              value={testSymbol}
              onChange={(e) => setTestSymbol(e.target.value.toUpperCase())}
              placeholder="BTCUSDT"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setTestAction('BUY')}
              className={`px-3 py-1 text-xs font-bold rounded transition ${
                testAction === 'BUY'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              BUY / LONG
            </button>
            <button
              onClick={() => setTestAction('SELL')}
              className={`px-3 py-1 text-xs font-bold rounded transition ${
                testAction === 'SELL'
                  ? 'bg-rose-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              SELL / SHORT
            </button>
          </div>

          <button
            onClick={handleSendTestWebhook}
            disabled={testSending}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs rounded-lg shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{testSending ? 'Sending & Validating...' : 'Trigger Webhook'}</span>
          </button>
        </div>

        {testResult && (
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-300">
            <strong>Response:</strong> {testResult}
          </div>
        )}
      </div>
    </div>
  );
};
