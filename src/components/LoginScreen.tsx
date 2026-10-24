import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  Zap,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (username: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    setTimeout(() => {
      // Validate credentials: Username = Menuka, Password = 2006
      if (trimmedUser === 'Menuka' && trimmedPass === '2006') {
        const sessionData = {
          user: 'Menuka',
          loggedInAt: Date.now(),
          rememberMe,
        };
        localStorage.setItem('menuka_trading_auth', JSON.stringify(sessionData));
        onLoginSuccess('Menuka');
      } else {
        setError('Invalid username or password. Please verify your credentials.');
        setIsSubmitting(false);
      }
    }, 350);
  };

  const handleFillDemo = () => {
    setUsername('Menuka');
    setPassword('2006');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md z-10">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 backdrop-blur-xl overflow-hidden p-8 sm:p-9 space-y-6">
          {/* Brand Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 shadow-xl shadow-amber-500/25 mb-1">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Zap className="w-7 h-7 text-amber-400" />
              </div>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
              Menuka <span className="text-amber-400">Terminal</span>
            </h1>
            <p className="text-xs text-slate-400">
              Binance USD-M Futures • SMC Order Blocks & Gemini AI
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Protected Access Gate</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  autoFocus
                  required
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/70 border border-slate-800 focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/40 rounded-xl text-sm text-white placeholder-slate-500 transition outline-none font-medium"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-950/70 border border-slate-800 focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/40 rounded-xl text-sm text-white placeholder-slate-500 transition outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Quick Credential Hint */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0"
                />
                <span>Remember session</span>
              </label>

              <button
                type="button"
                onClick={handleFillDemo}
                className="text-amber-400/90 hover:text-amber-300 flex items-center gap-1 font-mono transition text-[11px]"
                title="Fill credentials for Menuka"
              >
                <KeyRound className="w-3 h-3" />
                <span>Auto-fill</span>
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !username || !password}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Session...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Unlock Trading Terminal</span>
                </>
              )}
            </button>
          </form>

          {/* Credentials Info Pill for User */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Authorized User: <strong className="text-slate-200">Menuka</strong></span>
              </div>
              <span className="font-mono text-slate-400">Pass: 2006</span>
            </div>
          </div>
        </div>

        {/* Security & System Status Tags */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Supabase Sync</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
            <span>Binance USD-M</span>
          </div>
          <span>•</span>
          <span>SMC v2.4</span>
        </div>
      </div>
    </div>
  );
};
