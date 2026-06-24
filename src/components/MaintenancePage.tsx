import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Trophy, Wrench, ShieldAlert, Database, RefreshCw, Sparkles, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface MaintenancePageProps {
  onUnlockAdmin?: () => void;
}

export const MaintenancePage: React.FC<MaintenancePageProps> = ({ onUnlockAdmin }) => {
  const [logoClickCount, setLogoClickCount] = useState(0);

  const handleLogoClick = () => {
    const nextCount = logoClickCount + 1;
    setLogoClickCount(nextCount);
    if (nextCount >= 5 && onUnlockAdmin) {
      onUnlockAdmin();
    }
  };

  return (
    <div id="maintenance-container" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Dynamic ambient backing blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-xl w-full text-center relative z-10 px-4">
        
        {/* Animated Trophy Header Logo & Maintenance Symbol */}
        <div 
          id="maintenance-logo" 
          className="relative inline-block mb-8 cursor-pointer"
          onClick={handleLogoClick}
        >
          <div className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-3xl flex items-center justify-center shadow-[0_0_35px_rgba(245,158,11,0.25)] mx-auto relative transition-transform active:scale-95 duration-200">
            <Trophy className="w-10 h-10 text-slate-900 stroke-[2.2]" />
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.9, 1, 0.9]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -bottom-2 -right-2 w-8 h-8 bg-amber-500 border-2 border-slate-950 rounded-full flex items-center justify-center shadow-lg"
            >
              <Wrench className="w-4 h-4 text-slate-950" />
            </motion.div>
          </div>
        </div>

        {/* Title Block */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] font-black tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Site Under Maintenance
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold font-sans tracking-tight text-white uppercase leading-none">
            TML Prediction Game
          </h1>
          <p className="text-sm font-sans text-slate-400 font-medium max-w-md mx-auto leading-relaxed">
            We are currently optimizing and performing scheduled server enhancements. We will be back on pitch shortly!
          </p>
        </motion.div>

        {/* Humble Footer Note */}
        <p className="mt-12 text-[10px] uppercase font-mono text-slate-600 tracking-wider">
          Thank you for your patience, brothers.
        </p>

        {/* Subtle touch indicator for admin bypass after multiple clicks */}
        {logoClickCount > 0 && logoClickCount < 5 && (
          <p className="mt-2 text-[9px] font-mono text-amber-500/30">
            {5 - logoClickCount} steps remaining
          </p>
        )}
      </div>
    </div>
  );
};
