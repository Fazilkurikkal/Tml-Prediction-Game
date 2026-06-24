import React, { useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { Dashboard } from './components/Dashboard';
import { Leaderboard } from './components/Leaderboard';
import { AdminPanel } from './components/AdminPanel';
import { MaintenancePage } from './components/MaintenancePage';
import { AuthPage } from './components/AuthPage';
import { Trophy, LogOut, LayoutDashboard, Award, ShieldAlert, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function GameAppContent() {
  const { currentUser, isLoading, logout, cloudQuotaExceeded, resetCloudDatabaseAttempt } = useGame();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaderboard' | 'admin'>('dashboard');
  const [isMaintenance, setIsMaintenance] = useState<boolean>(true);
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(false);

  // Render Loader if data is syncing/getting fetched
  if (isLoading) {
    return (
      <div id="loading" className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mb-4 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
        />
        <span className="font-mono text-xs uppercase tracking-widest text-slate-400">Loading Game Workspace...</span>
      </div>
    );
  }

  // Render Maintenance Page if applicable (Unlockable via 5 logo clicks, redirecting back to main layout)
  if (isMaintenance && !adminUnlocked) {
    return (
      <MaintenancePage 
        onUnlockAdmin={() => {
          setAdminUnlocked(true);
          setIsMaintenance(false);
          setActiveTab('admin');
        }} 
      />
    );
  }

  // Render Auth Page if no logged-in user session exists
  if (!currentUser) {
    return <AuthPage />;
  }

  const isUserAdmin = currentUser.isAdmin || adminUnlocked;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Dynamic Background Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.025),transparent_60%)] pointer-events-none" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-30 bg-slate-900/80 border-b border-slate-800/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand/Logo Layout */}
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.2)] cursor-pointer"
              onClick={() => setIsMaintenance(true)}
              title="Maintenance View"
            >
              <Trophy className="w-5 h-5 text-slate-950 stroke-[2.3]" />
            </div>
            <div>
              <span className="text-sm font-black text-white uppercase tracking-wider block">TML Brothers</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest -mt-1 block">Prediction Game</span>
            </div>
          </div>

          {/* Tab Selection Navigation */}
          <nav className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/60">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Predict</span>
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Award className="w-4 h-4" />
              <span className="hidden sm:inline">Leaderboard</span>
            </button>
            {isUserAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/15'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
          </nav>

          {/* Profile Badge & LogOut Trigger */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-bold text-white mb-0.5">{currentUser.displayName}</span>
              <span className="text-[10px] text-amber-400 font-mono font-bold">{currentUser.totalPoints} Points</span>
            </div>
            <button
              onClick={logout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-rose-400 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>

        </div>
      </header>

      {/* Firestore Quota Banner Warning if Local Fallback Triggered */}
      {cloudQuotaExceeded && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-2.5 px-4 text-center">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 flex-wrap">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-200/90 font-medium">
              Firestore quota was temporarily exceeded. Operating on safe sandboxed offline state.
            </p>
            <button 
              onClick={resetCloudDatabaseAttempt}
              className="text-xs font-bold underline text-amber-400 hover:text-amber-300 ml-2"
            >
              Retry Sync
            </button>
          </div>
        </div>
      )}

      {/* Main Container Dashboard Router */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
          >
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'leaderboard' && <Leaderboard />}
            {activeTab === 'admin' && isUserAdmin && <AdminPanel />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <GameAppContent />
    </GameProvider>
  );
}
