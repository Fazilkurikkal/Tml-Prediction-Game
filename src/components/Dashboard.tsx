import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { MatchCard } from './MatchCard';
import { MatchStage, MatchStatus } from '../types';
import { Trophy, Star, CircleAlert, Flame, CircleCheckBig, Layers, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

export const Dashboard: React.FC = () => {
  const { matches, predictions, currentUser, refreshData, activeStage, setActiveStage } = useGame();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 550); // slight delay for smooth rotation feel
    }
  };

  // Stages available for filtering
  const filterStages = [
    'Unfinished',
    MatchStage.GROUP_STAGE,
    MatchStage.ROUND_OF_32,
    MatchStage.ROUND_OF_16,
    MatchStage.QUARTERFINALS,
    MatchStage.SEMIFINALS,
    MatchStage.FINAL
  ];

  // Filter matches list based on selected stage
  const filteredMatches = activeStage === 'Unfinished' 
    ? matches.filter(m => m.status !== MatchStatus.FINISHED && m.status !== MatchStatus.CANCELLED)
    : matches.filter(m => m.stage === activeStage);

  // User Performance Stats
  const userPredictions = predictions.filter(p => p.userId === currentUser?.uid);
  const totalPredicted = userPredictions.length;
  const completedPredictions = userPredictions.filter(p => p.pointsAwarded !== null);

  return (
    <div id="dashboard-container" className="space-y-6">
      {/* Participant Stats Summary Deck */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 shadow-xl"
      >
        {/* Total Points */}
        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/40">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-white select-none">
              {currentUser?.totalPoints ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              Total Points
            </div>
          </div>
        </div>

        {/* Exact Scores Hit */}
        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/40">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400">
            <Star className="w-5 h-5 fill-yellow-400" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-white select-none">
              {currentUser?.exactScoresCount ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              Exact Scores hit (+3p)
            </div>
          </div>
        </div>

        {/* Correct Outcome Winner Matches */}
        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/40">
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
            <CircleCheckBig className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-white select-none">
              {currentUser?.correctOutcomesCount ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              Outcomes Correct (+1p)
            </div>
          </div>
        </div>

        {/* Prediction completion meter */}
        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/40">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-white select-none">
              {totalPredicted} / {matches.length}
            </div>
            <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              Bids Submitted
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stage Switching Selection Rail & Manual Refresh Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/40 pb-3 select-none">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
          <span className="text-slate-400 text-xs font-semibold uppercase flex items-center gap-1.5 shrink-0 px-2">
            <Layers className="w-4 h-4 text-amber-500" /> Filter Stage:
          </span>
          {filterStages.map((stage) => (
            <button
              key={stage}
              onClick={() => setActiveStage(stage)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition shrink-0 cursor-pointer ${
                activeStage === stage
                  ? 'bg-amber-500 text-slate-950 shadow-[0_2px_8px_rgba(245,158,11,0.25)]'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              {stage}
            </button>
          ))}
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer border ${
            isRefreshing
              ? 'bg-slate-900 text-slate-500 border-slate-850/60 cursor-not-allowed'
              : 'bg-indigo-600/10 border-indigo-500/25 text-indigo-400 hover:bg-indigo-650/15 hover:text-indigo-300'
          }`}
          title="Force-synchronize predictions, points, and standings"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing feed...' : 'Refresh Standings & Feed'}
        </button>
      </div>

      {/* Match Cards Interactive Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filteredMatches.length > 0 ? (
          filteredMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))
        ) : (
          <div className="col-span-full py-16 px-4 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl">
            <CircleAlert className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <h3 className="text-white font-medium text-base mb-1">No Matches Listed</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              There are no matches currently entered for the "{activeStage}" sub-bracket.
              {currentUser?.isAdmin && " Seed initial schedules from the Admin tab."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
