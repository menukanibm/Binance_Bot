/**
 * Production Credentials and Global Configuration
 */

export const CONFIG = {
  // Supabase Project
  SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://geoamvgfucsnegxkktg.supabase.co',
  SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlb2FtdmdmdWNzbmVneGtra3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NjYzOTMsImV4cCI6MjEwODI0MjM5M30.R1UlTyRxTxiaz7gQJDYYY3kXVgXtpq657BVnPbByI6s',
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlb2FtdmdmdWNzbmVneGtra3RnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjY2NjM5MywiZXhwIjoyMTA4MjQyMzkzfQ.8-gzSyXeLYn7KUFyd-nva8MMCelI-Z-UN6_KQNyTwxU',

  // Google Gemini API Key
  GEMINI_API_KEY:
    process.env.GEMINI_API_KEY ||
    'AIzaSyDzKu_uePRj_0VPUpD21LHRflY7_o_dPgk',

  // Binance Futures Production Credentials
  BINANCE_API_KEY:
    process.env.BINANCE_API_KEY ||
    '3Tpfy3mdXl9YfEReTqaL4G81BfOwwwAbHy6Vqh29djo9Rr3FY6dMJf6ePsErocl0',
  BINANCE_SECRET_KEY:
    process.env.BINANCE_SECRET_KEY ||
    process.env.BINANCE_API_SECRET ||
    'mu1hPa8Utz1SLrNoFtHgIUgQlxkAeAfPONPGHYCfMuKL8hvxZy1Mt8gbZtiUCr4E',
  BINANCE_TESTNET:
    process.env.BINANCE_TESTNET === 'true' ? true : false,
};
