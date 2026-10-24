-- ==============================================================================
-- BINANCE SMC AI AUTO-TRADING ENGINE - PRODUCTION SUPABASE DATABASE SCHEMA
-- Target Project: https://geoamvgfucsnegxkktg.supabase.co
-- Generated for 100% Real Binance Futures USD-M Auto-Trading
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TABLE: signals (Market Scanner & Webhook Signals)
-- ==============================================================================
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

-- ==============================================================================
-- 3. TABLE: trades (Active Positions & Closed Order History)
-- ==============================================================================
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

-- ==============================================================================
-- 4. TABLE: bot_logs (Engine Activity & Telemetry Stream)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.bot_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'success', 'warn', 'error', 'trade')),
    message TEXT NOT NULL,
    symbol TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. TABLE: bot_settings (Engine State, Capital & Risk Parameters)
-- ==============================================================================
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

-- Insert initial default settings row if it doesn't exist
INSERT INTO public.bot_settings (id, auto_trading, scan_interval_minutes, leverage, risk_percentage, gemini_threshold, trading_mode)
VALUES ('default', true, 2, 10, 2.0, 80, 'LIVE')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 6. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_trades_status ON public.trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON public.trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_opened_at ON public.trades(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_closed_at ON public.trades(closed_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_created_at ON public.signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON public.signals(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_status ON public.signals(status);

CREATE INDEX IF NOT EXISTS idx_bot_logs_created_at ON public.bot_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_logs_level ON public.bot_logs(level);
CREATE INDEX IF NOT EXISTS idx_bot_logs_symbol ON public.bot_logs(symbol);

-- ==============================================================================
-- 7. AUTO-UPDATE UPDATED_AT TRIGGER
-- ==============================================================================
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

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;

-- Service Role (Backend Engine): Full Unrestricted Access
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

-- Public / Anon / Authenticated (UI Dashboard & Webhooks):
-- Read access to display signals, trades, logs, and settings
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

-- Allow public insert on signals for webhook alerts
DROP POLICY IF EXISTS "public_insert_webhook_signals" ON public.signals;
CREATE POLICY "public_insert_webhook_signals" ON public.signals
    FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Allow public update on settings for UI controls
DROP POLICY IF EXISTS "public_update_settings" ON public.bot_settings;
CREATE POLICY "public_update_settings" ON public.bot_settings
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 9. SUPABASE REALTIME REPLICATION (For live dashboard updates)
-- ==============================================================================
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
    -- Ignore if tables are already in publication
    NULL;
END $$;
