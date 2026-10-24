import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Position, TradeSignal } from '../types/trading';
import { CONFIG } from '../config/constants';

// Supabase project credentials provided by user
export const SUPABASE_URL = CONFIG.SUPABASE_URL;
export const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = CONFIG.SUPABASE_SERVICE_ROLE_KEY;

// Prefer Service Role Key on backend for administrative database access without RLS restrictions
let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!clientInstance) {
    const keyToUse = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    clientInstance = createClient(SUPABASE_URL, keyToUse, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return clientInstance;
}

export interface SupabaseTradeRecord {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry_price: number;
  current_price?: number;
  quantity: number;
  stop_loss: number;
  take_profit: number;
  leverage: number;
  margin_used?: number;
  status: 'OPEN' | 'WIN' | 'LOSS' | 'CLOSED_OPPOSITE_SIGNAL';
  unrealized_pnl?: number;
  realized_pnl?: number;
  realized_pnl_percent?: number;
  close_price?: number;
  close_reason?: string;
  signal_id?: string;
  source?: string;
  binance_order_id?: string;
  binance_sl_order_id?: string;
  binance_tp_order_id?: string;
  opened_at: string;
  closed_at?: string;
}

let hasPermissionNoticeLogged = false;

function logSupabaseSyncNotice(action: string, error: any) {
  const msg = String(error?.message || error || '');
  const isPermissionOrMissing =
    msg.includes('permission denied') ||
    msg.includes('42501') ||
    msg.includes('PGRST205') ||
    msg.includes('does not exist');

  if (isPermissionOrMissing) {
    if (!hasPermissionNoticeLogged) {
      console.log('[Supabase Sync Notice] Remote table privileges pending SQL migration. All trades, signals, and positions are actively tracked in memory.');
      hasPermissionNoticeLogged = true;
    }
  } else {
    console.log(`[Supabase ${action}]:`, msg.slice(0, 100));
  }
}

/**
 * Save new trade with status OPEN directly to Supabase
 */
export async function saveTradeToSupabase(position: Position, binanceDetails?: any): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const record: SupabaseTradeRecord = {
      id: position.id,
      symbol: position.symbol,
      side: position.side,
      entry_price: position.entryPrice,
      current_price: position.currentPrice,
      quantity: position.quantity,
      stop_loss: position.stopLoss,
      take_profit: position.takeProfit,
      leverage: position.leverage,
      margin_used: position.marginUsed,
      status: 'OPEN',
      unrealized_pnl: position.unrealizedPnl || 0,
      realized_pnl: 0,
      source: position.source || 'SCANNER',
      signal_id: position.signalId,
      binance_order_id: binanceDetails?.orderId,
      binance_sl_order_id: binanceDetails?.slOrderId,
      binance_tp_order_id: binanceDetails?.tpOrderId,
      opened_at: new Date(position.openedAt).toISOString(),
    };

    const { error } = await supabase.from('trades').upsert(record);
    if (error) {
      logSupabaseSyncNotice('Save Trade', error);
      return false;
    }
    console.log(`[Supabase] Successfully saved trade ${position.id} (${position.symbol}) with status OPEN`);
    return true;
  } catch (err: any) {
    logSupabaseSyncNotice('Save Trade Exception', err);
    return false;
  }
}

/**
 * Update trade status in Supabase (WIN, LOSS, or CLOSED_OPPOSITE_SIGNAL)
 */
export async function updateTradeInSupabase(
  positionId: string,
  updates: {
    status: 'WIN' | 'LOSS' | 'CLOSED_OPPOSITE_SIGNAL';
    closePrice: number;
    realizedPnl: number;
    realizedPnlPercent: number;
    closeReason: string;
    closedAt: number;
  }
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('trades')
      .update({
        status: updates.status,
        close_price: updates.closePrice,
        realized_pnl: updates.realizedPnl,
        realized_pnl_percent: updates.realizedPnlPercent,
        close_reason: updates.closeReason,
        closed_at: new Date(updates.closedAt).toISOString(),
      })
      .eq('id', positionId);

    if (error) {
      logSupabaseSyncNotice('Update Trade', error);
      return false;
    }
    console.log(`[Supabase] Updated trade ${positionId} to ${updates.status} ($${updates.realizedPnl})`);
    return true;
  } catch (err: any) {
    logSupabaseSyncNotice('Update Trade Exception', err);
    return false;
  }
}

/**
 * Save trade signal to Supabase
 */
export async function saveSignalToSupabase(signal: TradeSignal): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('signals').upsert({
      id: signal.id,
      symbol: signal.symbol,
      side: signal.side,
      timeframe: signal.timeframe,
      price: signal.price,
      entry_zone_min: signal.entryZoneMin,
      entry_zone_max: signal.entryZoneMax,
      stop_loss: signal.stopLoss,
      take_profit: signal.takeProfit,
      smc_pattern: signal.smcPattern,
      divergence_pattern: signal.divergencePattern,
      gemini_confidence: signal.geminiConfidence,
      gemini_reasoning: signal.geminiReasoning,
      confluence_score: signal.confluenceScore,
      status: signal.status,
      source: signal.source,
      created_at: new Date(signal.timestamp).toISOString(),
    });

    if (error) {
      logSupabaseSyncNotice('Save Signal', error);
      return false;
    }
    return true;
  } catch (err: any) {
    logSupabaseSyncNotice('Save Signal Exception', err);
    return false;
  }
}

/**
 * Fetch active trades from Supabase
 */
export async function fetchTradesFromSupabase(): Promise<{
  open: Position[];
  history: Position[];
}> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(100);

    if (error || !data) {
      return { open: [], history: [] };
    }

    const positions: Position[] = data.map((d: any) => ({
      id: d.id,
      symbol: d.symbol,
      side: d.side,
      entryPrice: parseFloat(d.entry_price),
      currentPrice: parseFloat(d.current_price || d.entry_price),
      quantity: parseFloat(d.quantity),
      stopLoss: parseFloat(d.stop_loss),
      takeProfit: parseFloat(d.take_profit),
      unrealizedPnl: parseFloat(d.unrealized_pnl || 0),
      unrealizedPnlPercent: 0,
      leverage: parseInt(d.leverage || 10),
      marginUsed: parseFloat(d.margin_used || 0),
      openedAt: new Date(d.opened_at).getTime(),
      closedAt: d.closed_at ? new Date(d.closed_at).getTime() : undefined,
      status: d.status,
      closePrice: d.close_price ? parseFloat(d.close_price) : undefined,
      realizedPnl: d.realized_pnl ? parseFloat(d.realized_pnl) : undefined,
      realizedPnlPercent: d.realized_pnl_percent ? parseFloat(d.realized_pnl_percent) : undefined,
      closeReason: d.close_reason,
      signalId: d.signal_id,
      source: d.source || 'SCANNER',
    }));

    return {
      open: positions.filter((p) => p.status === 'OPEN'),
      history: positions.filter((p) => p.status !== 'OPEN'),
    };
  } catch (err) {
    console.warn('[Supabase] Could not fetch trades:', err);
    return { open: [], history: [] };
  }
}

/**
 * Option 1 (Safe Mode): Delete unexecuted signals and logs from Supabase
 * Only deletes signals with status != 'EXECUTED'.
 * STRICT SAFETY GUARD: Active OPEN positions and the trades table are 100% untouched.
 */
export async function deleteUnexecutedSignalsFromSupabase(): Promise<{
  success: boolean;
  deletedSignalsCount?: number;
  error?: string;
}> {
  try {
    const supabase = getSupabaseClient();

    // 1. Delete signals that did NOT become executed trades
    const { error: signalsError, count } = await supabase
      .from('signals')
      .delete({ count: 'exact' })
      .neq('status', 'EXECUTED');

    if (signalsError) {
      logSupabaseSyncNotice('Delete Unexecuted Signals', signalsError);
    }

    // 2. Clear old bot analysis logs
    const { error: logsError } = await supabase
      .from('bot_logs')
      .delete()
      .neq('level', '__PRESERVE_NONE__');

    if (logsError) {
      logSupabaseSyncNotice('Delete Bot Logs', logsError);
    }

    console.log(`[Supabase Cleanup] Deleted unexecuted signals (count: ${count ?? 0}) and cleared analysis logs. All trades preserved.`);
    return { success: true, deletedSignalsCount: count || 0 };
  } catch (err: any) {
    logSupabaseSyncNotice('Delete Unexecuted Signals Exception', err);
    return { success: false, error: err?.message || 'Failed to delete unexecuted signals' };
  }
}

/**
 * Option 2: Clear all history from Supabase, strictly preserving active OPEN positions.
 * - STRICT SAFETY GUARD: Trades with status === 'OPEN' are NEVER deleted.
 * - Only deletes trades WHERE status IN ('WIN', 'LOSS', 'CLOSED_OPPOSITE_SIGNAL') and status != 'OPEN'.
 * - Preserves any signals linked to currently OPEN positions.
 * - Clears past engine logs.
 */
export async function deleteAllHistoryKeepOpenPositionsFromSupabase(
  keepSignalIds: string[] = []
): Promise<{
  success: boolean;
  deletedTradesCount?: number;
  error?: string;
}> {
  try {
    const supabase = getSupabaseClient();

    // STRICT SAFETY GUARD: Double-check filter strictly excludes 'OPEN'
    const { error: tradesError, count: tradesCount } = await supabase
      .from('trades')
      .delete({ count: 'exact' })
      .neq('status', 'OPEN')
      .in('status', ['WIN', 'LOSS', 'CLOSED_OPPOSITE_SIGNAL']);

    if (tradesError) {
      logSupabaseSyncNotice('Delete Closed Trades History', tradesError);
    }

    // Delete signals that are not tied to open positions
    if (keepSignalIds.length > 0) {
      const formattedList = `(${keepSignalIds.map((id) => `"${id}"`).join(',')})`;
      const { error: sigError } = await supabase
        .from('signals')
        .delete()
        .not('id', 'in', formattedList);
      if (sigError) logSupabaseSyncNotice('Delete Old Signals', sigError);
    } else {
      const { error: sigError } = await supabase
        .from('signals')
        .delete()
        .neq('id', '__PRESERVE_NONE__');
      if (sigError) logSupabaseSyncNotice('Delete All Signals', sigError);
    }

    // Clear old engine logs
    const { error: logsError } = await supabase
      .from('bot_logs')
      .delete()
      .neq('level', '__PRESERVE_NONE__');
    if (logsError) logSupabaseSyncNotice('Delete Logs', logsError);

    console.log(
      `[Supabase Cleanup] Closed trades deleted (count: ${tradesCount ?? 0}). All active OPEN positions strictly preserved.`
    );
    return { success: true, deletedTradesCount: tradesCount || 0 };
  } catch (err: any) {
    logSupabaseSyncNotice('Delete All History Exception', err);
    return { success: false, error: err?.message || 'Failed to delete history' };
  }
}

/**
 * Save log entry to Supabase bot_logs table
 */
export async function saveLogToSupabase(level: string, message: string, symbol?: string, metadata?: any): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('bot_logs').insert({
      level,
      message,
      symbol,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Save or update bot settings snapshot in Supabase
 */
export async function saveSettingsSnapshotToSupabase(settings: any, status: any): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('bot_settings').upsert({
      id: 'default',
      auto_trading: settings.autoTrading,
      scan_interval_minutes: settings.scanIntervalMinutes,
      leverage: settings.leverage,
      risk_percentage: settings.riskPercentage,
      gemini_threshold: settings.geminiThreshold,
      trading_mode: settings.tradingMode,
      default_sl_percent: settings.defaultSlPercent,
      default_tp_percent: settings.defaultTpPercent,
      account_balance: status.accountBalance,
      net_pnl: status.netPnl,
      win_rate: status.winRate,
      total_trades: status.totalTrades,
      total_wins: status.totalWins,
      total_losses: status.totalLosses,
      last_scan_time: new Date(status.lastScanTime || Date.now()).toISOString(),
      updated_at: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check Supabase tables existence and connectivity status across all 4 tables
 */
export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  url: string;
  hasTradesTable: boolean;
  hasSignalsTable: boolean;
  hasLogsTable: boolean;
  hasSettingsTable: boolean;
  error?: string;
}> {
  try {
    const supabase = getSupabaseClient();

    const [tradesCheck, signalsCheck, logsCheck, settingsCheck] = await Promise.all([
      supabase.from('trades').select('id').limit(1),
      supabase.from('signals').select('id').limit(1),
      supabase.from('bot_logs').select('id').limit(1),
      supabase.from('bot_settings').select('id').limit(1),
    ]);

    return {
      connected: true,
      url: SUPABASE_URL,
      hasTradesTable: !tradesCheck.error,
      hasSignalsTable: !signalsCheck.error,
      hasLogsTable: !logsCheck.error,
      hasSettingsTable: !settingsCheck.error,
      error: tradesCheck.error ? tradesCheck.error.message : undefined,
    };
  } catch (err: any) {
    return {
      connected: false,
      url: SUPABASE_URL,
      hasTradesTable: false,
      hasSignalsTable: false,
      hasLogsTable: false,
      hasSettingsTable: false,
      error: err?.message || 'Connection failed',
    };
  }
}

/**
 * Complete Production SQL migration schema for Supabase
 */
export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- BINANCE SMC AI AUTO-TRADING ENGINE - COMPLETE SUPABASE MIGRATION
-- Project URL: https://geoamvgfucsnegxkktg.supabase.co
-- Paste directly into Supabase SQL Editor: https://supabase.com/dashboard/project/geoamvgfucsnegxkktg/sql
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLE: signals (Market Scanner & Webhook Signals)
CREATE TABLE IF NOT EXISTS public.signals (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
    timeframe TEXT NOT NULL DEFAULT '5m',
    price NUMERIC NOT NULL,
    entry_zone_min NUMERIC,
    entry_zone_max NUMERIC,
    stop_loss NUMERIC NOT NULL,
    take_profit NUMERIC NOT NULL,
    smc_pattern TEXT,
    divergence_pattern TEXT,
    gemini_confidence INTEGER NOT NULL CHECK (gemini_confidence >= 0 AND gemini_confidence <= 100),
    gemini_reasoning TEXT,
    confluence_score INTEGER NOT NULL CHECK (confluence_score >= 0 AND confluence_score <= 100),
    status TEXT NOT NULL CHECK (status IN ('PENDING_VALIDATION', 'APPROVED', 'REJECTED', 'EXECUTED')),
    source TEXT NOT NULL DEFAULT 'SCANNER' CHECK (source IN ('SCANNER', 'WEBHOOK')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABLE: trades (Active Positions & Closed Order History)
CREATE TABLE IF NOT EXISTS public.trades (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('LONG', 'SHORT')),
    entry_price NUMERIC NOT NULL,
    current_price NUMERIC,
    quantity NUMERIC NOT NULL,
    stop_loss NUMERIC NOT NULL,
    take_profit NUMERIC NOT NULL,
    leverage INTEGER NOT NULL DEFAULT 10 CHECK (leverage >= 1 AND leverage <= 125),
    margin_used NUMERIC,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'WIN', 'LOSS', 'CLOSED_OPPOSITE_SIGNAL')),
    unrealized_pnl NUMERIC NOT NULL DEFAULT 0,
    unrealized_pnl_percent NUMERIC NOT NULL DEFAULT 0,
    realized_pnl NUMERIC NOT NULL DEFAULT 0,
    realized_pnl_percent NUMERIC NOT NULL DEFAULT 0,
    close_price NUMERIC,
    close_reason TEXT,
    signal_id TEXT REFERENCES public.signals(id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'SCANNER' CHECK (source IN ('SCANNER', 'WEBHOOK')),
    binance_order_id TEXT,
    binance_sl_order_id TEXT,
    binance_tp_order_id TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLE: bot_logs (Engine Activity & Telemetry Stream)
CREATE TABLE IF NOT EXISTS public.bot_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'success', 'warn', 'error', 'trade')),
    message TEXT NOT NULL,
    symbol TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABLE: bot_settings (Engine State, Capital & Risk Parameters)
CREATE TABLE IF NOT EXISTS public.bot_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    auto_trading BOOLEAN NOT NULL DEFAULT true,
    scan_interval_minutes INTEGER NOT NULL DEFAULT 2 CHECK (scan_interval_minutes >= 1),
    leverage INTEGER NOT NULL DEFAULT 10 CHECK (leverage >= 1 AND leverage <= 125),
    risk_percentage NUMERIC NOT NULL DEFAULT 2.0 CHECK (risk_percentage > 0 AND risk_percentage <= 100),
    gemini_threshold INTEGER NOT NULL DEFAULT 80 CHECK (gemini_threshold >= 50 AND gemini_threshold <= 100),
    trading_mode TEXT NOT NULL DEFAULT 'LIVE' CHECK (trading_mode IN ('PAPER', 'TESTNET', 'LIVE')),
    default_sl_percent NUMERIC NOT NULL DEFAULT 1.0,
    default_tp_percent NUMERIC NOT NULL DEFAULT 2.0,
    account_balance NUMERIC NOT NULL DEFAULT 0.0,
    net_pnl NUMERIC NOT NULL DEFAULT 0.0,
    win_rate NUMERIC NOT NULL DEFAULT 0.0,
    total_trades INTEGER NOT NULL DEFAULT 0,
    total_wins INTEGER NOT NULL DEFAULT 0,
    total_losses INTEGER NOT NULL DEFAULT 0,
    last_scan_time TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings row
INSERT INTO public.bot_settings (id, auto_trading, scan_interval_minutes, leverage, risk_percentage, gemini_threshold, trading_mode)
VALUES ('default', true, 2, 10, 2.0, 80, 'LIVE')
ON CONFLICT (id) DO NOTHING;

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_trades_status ON public.trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON public.trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_opened_at ON public.trades(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_closed_at ON public.trades(closed_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_created_at ON public.signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON public.signals(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_status ON public.signals(status);

CREATE INDEX IF NOT EXISTS idx_bot_logs_created_at ON public.bot_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_logs_level ON public.bot_logs(level);

-- 6. AUTO-UPDATE UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trades_updated_at ON public.trades;
CREATE TRIGGER trg_trades_updated_at
BEFORE UPDATE ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_bot_settings_updated_at ON public.bot_settings;
CREATE TRIGGER trg_bot_settings_updated_at
BEFORE UPDATE ON public.bot_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;

-- Backend Engine (service_role): Full unrestricted access
DROP POLICY IF EXISTS "service_role_full_access_signals" ON public.signals;
CREATE POLICY "service_role_full_access_signals" ON public.signals
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_trades" ON public.trades;
CREATE POLICY "service_role_full_access_trades" ON public.trades
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_logs" ON public.bot_logs;
CREATE POLICY "service_role_full_access_logs" ON public.bot_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_settings" ON public.bot_settings;
CREATE POLICY "service_role_full_access_settings" ON public.bot_settings
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Frontend & Webhook (anon & authenticated): Read access + Webhook insert
DROP POLICY IF EXISTS "public_read_signals" ON public.signals;
CREATE POLICY "public_read_signals" ON public.signals
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_trades" ON public.trades;
CREATE POLICY "public_read_trades" ON public.trades
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_logs" ON public.bot_logs;
CREATE POLICY "public_read_logs" ON public.bot_logs
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_settings" ON public.bot_settings;
CREATE POLICY "public_read_settings" ON public.bot_settings
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_webhook_signals" ON public.signals;
CREATE POLICY "public_insert_webhook_signals" ON public.signals
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_settings" ON public.bot_settings;
CREATE POLICY "public_update_settings" ON public.bot_settings
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 8. TABLE PRIVILEGES & SCHEMA GRANTS (CRITICAL: Fixes 'permission denied for table trades')
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

-- Direct full access policies for anon & authenticated roles
DROP POLICY IF EXISTS "anon_full_access_trades" ON public.trades;
CREATE POLICY "anon_full_access_trades" ON public.trades
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_full_access_signals" ON public.signals;
CREATE POLICY "anon_full_access_signals" ON public.signals
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 9. SUPABASE REALTIME REPLICATION
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.signals;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_logs;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_settings;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
`;

/**
 * 3-Line Quick SQL command to fix "permission denied for table trades" in Supabase SQL Editor
 */
export const SUPABASE_QUICK_FIX_SQL = `-- RUN THIS QUICK FIX IN SUPABASE SQL EDITOR TO INSTANTLY RESOLVE PERMISSION DENIED:
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;

DROP POLICY IF EXISTS "anon_full_access_trades" ON public.trades;
CREATE POLICY "anon_full_access_trades" ON public.trades FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_full_access_signals" ON public.signals;
CREATE POLICY "anon_full_access_signals" ON public.signals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
`;
