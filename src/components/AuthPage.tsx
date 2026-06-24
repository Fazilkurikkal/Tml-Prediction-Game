import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Trophy, Mail, Lock, User, Sparkles, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AuthPage: React.FC = () => {
  const { loginWithGoogle, login, signUp, isFirebase, toggleFirebaseMode, cloudQuotaExceeded, resetCloudDatabaseAttempt } = useGame();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Tab/Toggle state: 'login' | 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  
  // Input fields
  const [userNumber, setUserNumber] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userNumber || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      if (authMode === 'register') {
        if (!displayName.trim()) {
          setError("Please enter a display name for the leaderboards.");
          setIsLoading(false);
          return;
        }
        await signUp(userNumber.trim(), displayName.trim(), password);
      } else {
        await login(userNumber.trim(), password);
      }
    } catch (err: any) {
      console.error(err);
      let msg = err?.message || "Authentication failed. Please check credentials.";
      const errStr = String(err?.code || err?.message || err || '').toLowerCase();
      
      // Clean up common firebase errors for friendly reading
      if (errStr.includes('invalid-credential') || errStr.includes('user-not-found') || errStr.includes('wrong-password') || errStr.includes('incorrect password') || errStr.includes('not registered')) {
        msg = err?.message || "Invalid number or password. Please verify and try again.";
      } else if (errStr.includes('weak-password')) {
        msg = "Password should be at least 6 characters.";
      } else if (errStr.includes('already-in-use') || errStr.includes('already_in_use') || errStr.includes('already exist') || errStr.includes('already registered')) {
        msg = err?.message || "This number is already registered. Try signing in instead.";
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="auth-container" className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Decorative ambient background spots */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.5 }}
         className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 md:p-8 backdrop-blur shadow-2xl relative z-10"
      >
        {/* Connection Switcher */}
        <div className="mb-6 flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800/60 shadow-inner select-none" id="db-mode-selector">
          <div className="flex items-center gap-2 pl-1.5">
            <span className={`w-2 h-2 rounded-full ${isFirebase ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">
              {isFirebase ? "Cloud Firestore (Online)" : "Local Sandbox (Offline)"}
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              const newMode = !isFirebase;
              toggleFirebaseMode(newMode);
              setError(null);
            }}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 font-extrabold uppercase rounded-lg text-[9px] tracking-widest transition cursor-pointer select-none"
            id="db-mode-toggle-btn"
          >
            {isFirebase ? "Go Sandbox mode" : "Enable Firebase"}
          </button>
        </div>

        {/* Brand Banner Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.25)] mb-4">
            <Trophy className="w-8 h-8 text-slate-900 stroke-[2]" />
          </div>
          <h1 className="text-2xl font-extrabold font-sans tracking-tight text-white mb-2 uppercase">
            TML BROTHERS
          </h1>
          <p className="text-amber-500 font-bold font-sans text-xs uppercase tracking-widest flex items-center gap-1">
            <Sparkles className="w-3 h-3 animate-pulse" /> World Cup Prediction Game
          </p>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs leading-relaxed flex flex-col gap-1.5">
            <span>{error}</span>
            {error.includes("already in use") && (
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setError(null);
                }}
                className="mt-1 text-left text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer text-xs"
              >
                Switch to Sign In tab &rarr;
              </button>
            )}
            {(error.toLowerCase().includes("not registered") || error.toLowerCase().includes("sign up first")) && (
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setError(null);
                }}
                className="mt-1 text-left text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer text-xs"
              >
                Switch to Create Account tab to register #{userNumber} &rarr;
              </button>
            )}
          </div>
        )}

        <div className="space-y-5" id="firebase-auth-section">
          {/* Google Sign In Federated Provider (Standard Option) */}
          <div>
            <button
              id="google-signin-btn"
              type="button"
              disabled={isLoading}
              onClick={async () => {
                setError(null);
                setIsLoading(true);
                try {
                  await loginWithGoogle();
                } catch (err: any) {
                  console.error(err);
                  setError(
                    "Google Sign-In was blocked or cancelled. (Tip: Try entering email & password below to bypass Safari/Chrome cookie restrictions!)"
                  );
                } finally {
                  setIsLoading(false);
                }
              }}
              className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-slate-50 text-slate-950 font-bold text-sm py-3 px-4 rounded-xl shadow-md transition duration-150 cursor-pointer border border-slate-200"
            >
              {isLoading && authMode === 'login' && userNumber === '' ? (
                <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 py-1 select-none">
            <span className="h-px bg-slate-800 flex-1" />
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">or sign in with credentials</span>
            <span className="h-px bg-slate-800 flex-1" />
          </div>

          {/* Tab Selection */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
            <button
               id="tab-login-btn"
              type="button"
              onClick={() => { setAuthMode('login'); setError(null); }}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-slate-800 text-amber-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
               id="tab-register-btn"
              type="button"
              onClick={() => { setAuthMode('register'); setError(null); }}
              className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                authMode === 'register'
                  ? 'bg-slate-800 text-amber-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          <form id="auth-credentials-form" onSubmit={handleSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div id="username-field-group">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Your Display Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="auth-name-input"
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-xs font-semibold text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all font-sans"
                  />
                </div>
              </div>
            )}

            <div id="number-field-group">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Your Custom Number (e.g. Phone or Code)
              </label>
              <div className="relative">
                <div id="hash-prefix" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs select-none">#</div>
                <input
                  id="auth-number-input"
                  type="tel"
                  required
                  placeholder="Enter login number (e.g. 775)"
                  value={userNumber}
                  onChange={(e) => setUserNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-xs font-semibold text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all font-sans font-mono"
                />
              </div>
            </div>

            <div id="password-field-group">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="auth-password-input"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-xs font-semibold text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all font-sans"
                />
              </div>
            </div>

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:from-slate-800 disabled:to-slate-850 text-slate-950 disabled:text-slate-500 font-bold text-xs py-3 rounded-xl transition shadow-[0_3px_10px_rgba(245,158,11,0.15)] disabled:shadow-none cursor-pointer uppercase tracking-wider"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{authMode === 'login' ? 'Sign In to World Cup' : 'Register Tournament Profile'}</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Secure / Sandbox Indicator */}
          <div className="pt-2 text-center select-none" id="auth-footer-help-text">
            <p className="text-[10px] font-semibold text-slate-500 leading-relaxed font-sans">
              🔒 Custom number/password login is secure, lightweight, and fully persistent.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

