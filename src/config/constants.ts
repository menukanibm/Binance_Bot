/**
 * Production Credentials and Global Configuration
 * All sensitive values are strictly read from environment variables (.env).
 * Secrets are kept out of source code for security.
 */

export const CONFIG = {
  // Supabase Project Configuration
  SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '',
  SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '',
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '',

  // Google Gemini AI API Credentials
  GEMINI_API_KEY:
    process.env.GEMINI_API_KEY ||
    '',

  // Binance Futures Production Credentials
  BINANCE_API_KEY:
    process.env.BINANCE_API_KEY ||
    '',
  BINANCE_SECRET_KEY:
    process.env.BINANCE_SECRET_KEY ||
    process.env.BINANCE_API_SECRET ||
    '',
  BINANCE_TESTNET:
    process.env.BINANCE_TESTNET === 'true' ? true : false,

  // Risk & Margin Management Rules (Strict ISOLATED mode & Configurable Margin Cap)
  MAX_TOTAL_MARGIN_PCT: process.env.MAX_TOTAL_MARGIN_PCT
    ? parseFloat(process.env.MAX_TOTAL_MARGIN_PCT)
    : 10,
  MARGIN_MODE: 'ISOLATED' as const,
};

export default CONFIG;
