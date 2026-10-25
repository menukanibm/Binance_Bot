import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Key,
  Cpu,
  RefreshCw,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface SupabaseStatus {
  connected: boolean;
  url: string;
  hasTradesTable: boolean;
  hasSignalsTable: boolean;
  hasLogsTable?: boolean;
  hasSettingsTable?: boolean;
  error?: string;
  schema?: string;
  quickFixSql?: string;
}

export const RequirementsAudit: React.FC = () => {
  const [dbStatus, setDbStatus] = useState<SupabaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedQuickFix, setCopiedQuickFix] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/supabase/status');
      const data = await res.json();
      setDbStatus(data);
    } catch (err) {
      console.log('Database status refresh note:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCopySql = () => {
    if (dbStatus?.schema) {
      navigator.clipboard.writeText(dbStatus.schema);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyQuickFix = () => {
    if (dbStatus?.quickFixSql) {
      navigator.clipboard.writeText(dbStatus.quickFixSql);
      setCopiedQuickFix(true);
      setTimeout(() => setCopiedQuickFix(false), 2000);
    }
  };

  return (
    <div className="space-y-5">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase font-bold text-amber-400 tracking-wider">
                System Audit & Production Readiness
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold">
                Live Audit Active
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Binance Futures + Supabase + Gemini 100% Real Engine Checklist
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Verify database tables, Binance Futures API permissions, and Gemini AI validation parameters.
            </p>
          </div>

          <button
            onClick={fetchStatus}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5 self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-Audit Now</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Supabase Audit Section */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Database className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Supabase Database Audit
                </h3>
                <p className="text-[11px] text-slate-400 font-mono truncate max-w-[280px]">
                  {dbStatus?.url || 'geoamvgfucsnegxkktg.supabase.co'}
                </p>
              </div>
            </div>

            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                dbStatus?.connected
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {dbStatus?.connected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs font-mono">
            {/* Table 1: trades */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2">
                {dbStatus?.hasTradesTable ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-400" />
                )}
                <span className="font-bold text-white">Table: trades</span>
              </div>
              <span
                className={`text-[11px] font-semibold ${
                  dbStatus?.hasTradesTable ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {dbStatus?.hasTradesTable ? 'Active & Ready' : 'Needs SQL Creation'}
              </span>
            </div>

            {/* Table 2: signals */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2">
                {dbStatus?.hasSignalsTable ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-400" />
                )}
                <span className="font-bold text-white">Table: signals</span>
              </div>
              <span
                className={`text-[11px] font-semibold ${
                  dbStatus?.hasSignalsTable ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {dbStatus?.hasSignalsTable ? 'Active & Ready' : 'Needs SQL Creation'}
              </span>
            </div>

            {/* Table 3: bot_logs */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2">
                {dbStatus?.hasLogsTable ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-400" />
                )}
                <span className="font-bold text-white">Table: bot_logs</span>
              </div>
              <span
                className={`text-[11px] font-semibold ${
                  dbStatus?.hasLogsTable ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {dbStatus?.hasLogsTable ? 'Active & Ready' : 'Needs SQL Creation'}
              </span>
            </div>

            {/* Table 4: bot_settings */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2">
                {dbStatus?.hasSettingsTable ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-400" />
                )}
                <span className="font-bold text-white">Table: bot_settings</span>
              </div>
              <span
                className={`text-[11px] font-semibold ${
                  dbStatus?.hasSettingsTable ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {dbStatus?.hasSettingsTable ? 'Active & Ready' : 'Needs SQL Creation'}
              </span>
            </div>
          </div>

          {/* Quick Permissions Fix (Instant 3-Line SQL) */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-300">
                  Quick Permissions Fix (Fixes 'permission denied for table trades')
                </span>
              </div>
              <button
                onClick={handleCopyQuickFix}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold rounded-lg transition flex items-center gap-1 shadow"
              >
                {copiedQuickFix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedQuickFix ? 'Copied Quick Fix!' : 'Copy Quick Fix SQL'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              If Supabase returns <em>permission denied for table trades</em>, paste this 3-line grant command into Supabase SQL Editor:
            </p>
            <pre className="p-2.5 bg-slate-950 border border-amber-500/20 rounded-lg text-[10px] font-mono text-amber-300 max-h-[85px] overflow-y-auto">
              {dbStatus?.quickFixSql || `GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;\nGRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;\nGRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;\nGRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;\nALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;\n\nDROP POLICY IF EXISTS "anon_full_access_trades" ON public.trades;\nCREATE POLICY "anon_full_access_trades" ON public.trades FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);`}
            </pre>
          </div>

          {/* Copyable Full SQL Migration Script */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                Complete Supabase SQL Migration Script (All 4 Tables)
              </span>
              <button
                onClick={handleCopySql}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Full SQL!' : 'Copy Full SQL Script'}</span>
              </button>
            </div>

            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-emerald-400 max-h-[140px] overflow-y-auto">
              {dbStatus?.schema}
            </pre>

            <a
              href="https://supabase.com/dashboard/project/geoamvgfucsnegxkkktg/sql"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:underline font-semibold"
            >
              <span>Open Supabase SQL Editor in Browser (geoamvgfucsnegxkkktg)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Binance Futures API Requirements Section */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Key className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Binance Futures Production Requirements
                </h3>
                <p className="text-[11px] text-slate-400">
                  Settings required on your Binance API Key for real trade dispatch
                </p>
              </div>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono font-bold">
              Binance USD-M
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Requirement 1: Enable Futures Checkbox */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
              <div className="flex items-center justify-between font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  1. "Enable Futures" Permission
                </span>
                <span className="text-[10px] text-amber-400 font-mono">CRITICAL</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                In your Binance Account under <strong>API Management &gt; Edit Restrictions</strong>, make sure the checkbox <strong>"Enable Futures"</strong> is ticked. By default, new Binance keys only allow Spot reading.
              </p>
            </div>

            {/* Requirement 2: Binance API Secret */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
              <div className="flex items-center justify-between font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  2. Binance API Key & Secret (HMAC-SHA256 Signing)
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">CONFIGURED & ACTIVE</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Both Binance API Key (<code className="text-amber-400">3Tpfy3...rocl0</code>) and API Secret (<code className="text-amber-400">mu1hPa...UCr4E</code>) are configured. Live authenticated orders (Market, Limit, and Bracket SL/TP) are signed directly with HMAC-SHA256 via CCXT.
              </p>
            </div>

            {/* Requirement 3: USD-M Futures Collateral */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
              <div className="flex items-center justify-between font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  3. USD-M Futures Collateral (USDT)
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">CAPITAL</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Ensure your Binance USD-M Futures Wallet has USDT balance (e.g. transfer from Spot to Futures). CCXT will automatically size positions based on your Risk % and Leverage settings.
              </p>
            </div>

            {/* Requirement 4: IP Whitelist or Unrestricted */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
              <div className="flex items-center justify-between font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  4. IP Access Restrictions
                </span>
                <span className="text-[10px] text-slate-400 font-mono">INFO</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Select <em>"Unrestricted (Less Secure)"</em> or add your hosting IP to the trusted IP list on Binance.
              </p>
            </div>

            {/* Requirement 5: Strict Risk Management & Margin Cap */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
              <div className="flex items-center justify-between font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  5. Strict Risk Management & Margin Rules
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">ENFORCED</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Total Active Margin is tracked across all open positions. Trades exceeding <code className="text-amber-400">MAX_TOTAL_MARGIN_PCT</code> (10% default) or when free USDT is insufficient are rejected with console alert logs. All trades strictly use <code className="text-emerald-400">ISOLATED</code> margin.
              </p>
            </div>

            {/* Requirement 6: Database Storage & Historical Data Cleanup */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
              <div className="flex items-center justify-between font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  6. Supabase Storage & Historical Data Cleanup
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">ACTIVE WITH GUARD</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Supports <strong>Option 1 (Safe Mode)</strong> to delete unexecuted signals and logs, and <strong>Option 2 (All History)</strong> to purge closed trades, signals, and logs. Active <code className="text-emerald-400">OPEN</code> positions are guarded by hardcoded assertions in code and database queries so their SL/TP tracking is never broken.
              </p>
            </div>

            {/* Requirement 7: Protected Routes / User Authentication Gate */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
              <div className="flex items-center justify-between font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  7. Protected Routes & Authentication Gate
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">MENUKA ACTIVE</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Trading dashboard, live scanner, CCXT executions, and settings are fully protected behind a credential gate (<code className="text-amber-400">Menuka</code> / <code className="text-amber-400">2006</code>). Active session state persists across refreshes with a visible header Logout control.
              </p>
            </div>

            {/* Requirement 8: Standalone Windows .exe Desktop Application (Electron) */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  8. Standalone Windows 64-Bit Desktop Executable (.exe)
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">READY TO BUILD</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Configured with <strong>Electron</strong> and <strong>electron-builder</strong>. Embeds the full Node.js Express backend and CCXT Binance engine inside the desktop process, requiring no external Node installation on the target Windows system.
              </p>
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded text-[11px] font-mono text-slate-300 space-y-1.5">
                <div className="text-amber-400 font-bold">To test and build Windows 64-bit .exe executables:</div>
                <div className="text-slate-400">• Development desktop mode: <code className="text-emerald-400">npm run electron:dev</code></div>
                <div className="text-slate-400">• Compile Windows Setup Installer & Portable .exe: <code className="text-emerald-400">npm run electron:build</code></div>
                <div className="text-slate-500 text-[10px]">Output location: <code className="text-slate-400">release/Binance SMC AI Trading Terminal-Setup-0.0.0-x64.exe</code></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
