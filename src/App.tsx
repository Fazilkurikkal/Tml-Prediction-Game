import React, { useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { AuthPage } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';
import { Leaderboard } from './components/Leaderboard';
import { AdminPanel } from './components/AdminPanel';
import { MaintenancePage } from './components/MaintenancePage';
import { Trophy, LogOut, LayoutGrid, Award, ShieldAlert, Sparkles, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const GameLayout: React.FC = () => {
  const { currentUser, logout, isLoading, isFirebase, updateProfileName, cloudQuotaExceeded, resetCloudDatabaseAttempt } = useGame();
  const [activeTab, setActiveTab] = useState<'matches' | 'leaderboard' | 'admin'>('matches');

  // Nickname Editing states
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(currentUser?.displayName || '');
  const [isSavingName, setIsSavingName] = useState(false);

  // Loader state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.3)] mb-6"
        >
          <Trophy className="w-8 h-8 text-slate-950 stroke-[2.5]" />
        </motion.div>
        <p className="text-white font-sans font-black tracking-widest text-xs uppercase animate-pulse">
          TML Prediction Game Loading...
        </p>
      </div>
    );
  }

  // Top-Level Maintenance Mode Guard (Only displayed if the actual Firestore quota is exceeded)
  if (cloudQuotaExceeded) {
    return <MaintenancePage />;
  }

  if (!currentUser) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative select-none">
      
      {/* Dynamic Header navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/80 border-b border-slate-800/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              <Trophy className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-sm font-black font-sans tracking-wider text-white select-none uppercase leading-none">
                TML Brothers
              </h1>
              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest leading-none">
                PREDICTION GAME
              </span>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setActiveTab('matches')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer ${
                activeTab === 'matches' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <LayoutGrid className="w-4 h-4" /> Match Feed
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer ${
                activeTab === 'leaderboard' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-white hover:bg-slate-880/40'
              }`}
            >
              <Award className="w-4 h-4" /> Leaderboard
            </button>
            {currentUser.isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer ${
                  activeTab === 'admin' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldAlert className="w-4 h-4" /> Admin Console
              </button>
            )}
          </nav>

          {/* User profile actions */}
          <div className="flex items-center gap-3">
            
            {/* Points Capsule */}
            <div className="bg-slate-950/60 border border-slate-800/50 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="text-xs font-black font-mono text-white select-none">
                {currentUser.totalPoints} <span className="text-[9px] text-slate-500 font-bold uppercase">PTS</span>
              </span>
            </div>

            {/* Profile Detail Name */}
            <div className="flex flex-col text-right max-w-[120px] sm:max-w-xs select-none">
              {isEditingName ? (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!editedName.trim() || isSavingName) return;
                    setIsSavingName(true);
                    try {
                      await updateProfileName(editedName.trim());
                      setIsEditingName(false);
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsSavingName(false);
                    }
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    type="text"
                    required
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    maxLength={18}
                    className="bg-slate-950 border border-slate-700 text-white font-sans font-bold text-xs px-2 py-0.5 rounded focus:outline-none focus:border-amber-500 w-16 sm:w-28 text-right font-sans"
                    placeholder="Nickname"
                    autoFocus
                  />
                  <button 
                    type="submit" 
                    disabled={isSavingName}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 p-0.5 rounded text-[10px] font-bold cursor-pointer"
                  >
                    ✓
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setIsEditingName(false); setEditedName(currentUser.displayName); }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-350 p-0.5 rounded text-[10px] font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <div 
                  onClick={() => { setIsEditingName(true); setEditedName(currentUser.displayName); }}
                  className="group flex items-center gap-1 justify-end cursor-pointer text-slate-300 hover:text-amber-400 transition"
                  title="Click to edit nickname"
                >
                  <span className="text-xs font-sans font-black text-white group-hover:text-amber-400 transition leading-none truncate max-w-[80px] sm:max-w-[150px]">
                    {currentUser.displayName}
                  </span>
                  <svg className="w-2.5 h-2.5 text-slate-500 group-hover:text-amber-500 transition opacity-60 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
              )}
              <span className="text-[8px] sm:text-[9px] text-slate-500 font-mono leading-none mt-1 truncate">
                {/^[0-9]+$/.test(currentUser.email) ? `ID: #${currentUser.email}` : currentUser.email}
              </span>
            </div>

            {/* Logout Trigger button */}
            <button
              onClick={logout}
              title="Sign Out"
              className="w-9 h-9 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800/60 flex items-center justify-center text-slate-400 hover:text-red-400 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile quick-navigation tabs */}
        <div className="md:hidden border-t border-slate-800/50 flex select-none">
          <button
            onClick={() => setActiveTab('matches')}
            className={`flex-1 py-3 text-center text-xs font-bold font-sans tracking-wide border-b-2 flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
              activeTab === 'matches' ? 'border-b-amber-500 text-amber-500 bg-slate-900/10' : 'border-b-transparent text-slate-400'
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> Match Feed
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 py-3 text-center text-xs font-bold font-sans tracking-wide border-b-2 flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
              activeTab === 'leaderboard' ? 'border-b-amber-500 text-amber-500 bg-slate-900/10' : 'border-b-transparent text-slate-400'
            }`}
          >
            <Award className="w-4 h-4" /> Leaderboard
          </button>
          {currentUser.isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-3 text-center text-xs font-bold font-sans tracking-wide border-b-2 flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                activeTab === 'admin' ? 'border-b-indigo-500 text-indigo-400 bg-indigo-950/20' : 'border-b-transparent text-slate-400'
              }`}
            >
              <ShieldAlert className="w-4 h-4" /> Admin Console
            </button>
          )}
        </div>
      </header>

      {/* Cloud Quota Fallback Notice Banner */}
      {cloudQuotaExceeded && currentUser?.isAdmin && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-200 py-2.5 px-4 text-xs font-medium font-sans">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span>
                <strong>Cloud Database Daily Quota Reached:</strong> Switched to <strong>Local Sandbox Mode</strong> automatically so you can keep playing & predicting seamlessly! No data is lost.
              </span>
            </div>
            {currentUser?.isAdmin && (
              <button
                onClick={resetCloudDatabaseAttempt}
                className="bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 px-3 py-1 rounded text-[10px] font-bold transition shrink-0 cursor-pointer shadow-sm"
              >
                Reset & Try Cloud Again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Arena */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 select-text overflow-hidden">
        
        {/* Tab Selection Page Injection */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'matches' && <Dashboard />}
            {activeTab === 'leaderboard' && <Leaderboard />}
            {activeTab === 'admin' && <AdminPanel />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Branding credits */}
      <footer className="bg-slate-950/80 p-6 text-center border-t border-slate-905 select-none mt-12">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-medium">
          TML Brothers Prediction Game © 2026. Built with extreme craft and attention to detail.
        </span>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <GameProvider>
      <GameLayout />
    </GameProvider>
  );
}
