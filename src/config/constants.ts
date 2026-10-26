/**
 * Production Credentials and Global Configuration
 */

export const CONFIG = {
  // Supabase Project
  SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://geoamvgfucsnegxkkktg.supabase.co',
  SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlb2FtdmdmdWNzbmVneGtra3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NjYzOTMsImV4cCI6MjEwODI0MjM5M30.R1UlTyRxTxiaz7gQJDYYY3kXVgXtpq657BVnPbByI6s',
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlb2FtdmdmdWNzbmVneGtra3RnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjY2NjM5MywiZXhwIjoyMTA4MjQyMzkzfQ.8-gzSyXeLYn7KUFyd-nva8MMCelI-Z-UN6_KQNyTwxU',

  // Google Gemini API Key
  GEMINI_API_KEY:
    process.env.GEMINI_API_KEY || '',

  // Binance Futures Production Credentials
  BINANCE_API_KEY:
    process.env.BINANCE_API_KEY ||
    'MXFNZcJLg23OFN1JtKE5v0OOlNaNXnhmcFf6XNxMdGZnix6E5rU99YEgRDZDLaOj',
  BINANCE_SECRET_KEY:
    process.env.BINANCE_SECRET_KEY ||
    'TGeZ9tGjg8ILSCw65FOlRFC6xVuSmI5CMaWUUZGoLZ8vYLVc7w2fqWgC1ek7xFNI',
  BINANCE_TESTNET:
    process.env.BINANCE_TESTNET === 'true' ? true : false,

  // Risk & Margin Management Rules (Strict ISOLATED mode & Configurable Margin Cap)
  MAX_TOTAL_MARGIN_PCT: process.env.MAX_TOTAL_MARGIN_PCT
    ? parseFloat(process.env.MAX_TOTAL_MARGIN_PCT)
    : 10,
  MARGIN_MODE: 'ISOLATED' as const,
};

