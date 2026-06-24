import React, { useState, useEffect } from 'react';
import { Match, MatchStatus, Prediction, PredictionStatus } from '../types';
import { useGame } from '../context/GameContext';
import { Lock, Check, Clock, Eye, EyeOff, ShieldCheck, Star, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export const MatchCard: React.FC<{ match: Match }> = ({ match }) => {
  const { currentUser, predictions, savePrediction } = useGame();
  
  // Find current user's prediction for this match
  const myPrediction = predictions.find(p => p.matchId === match.id && p.userId === currentUser?.uid);
  
  // Input states for score prediction
  const [homePred, setHomePred] = useState<string>('');
  const [awayPred, setAwayPred] = useState<string>('');
  const [predShootout, setPredShootout] = useState<'home' | 'away' | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showOtherPredictions, setShowOtherPredictions] = useState<boolean>(false);
  const [isEditingPrediction, setIsEditingPrediction] = useState<boolean>(false);
  const [liveLocked, setLiveLocked] = useState<boolean>(false);

  // Automatically lock prediction if kickoff time passes while client is on the page
  useEffect(() => {
    const kickoffMs = new Date(match.kickoffTime).getTime();
    const now = Date.now();
    
    if (now >= kickoffMs) {
      setLiveLocked(true);
      return;
    }
    
    setLiveLocked(false);
    const delay = kickoffMs - now;
    
    // Safety check for maximum 32-bit integer timeout delay (approx 24.8 days)
    if (delay < 2147483647) {
      const timer = setTimeout(() => {
        setLiveLocked(true);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [match.kickoffTime, match.id]);

  // Reset or load initial fields when switching matches
  useEffect(() => {
    if (myPrediction) {
      setHomePred(myPrediction.homePredicted.toString());
      setAwayPred(myPrediction.awayPredicted.toString());
      setPredShootout(myPrediction.shootoutWinner || null);
    } else {
      setHomePred('');
      setAwayPred('');
      setPredShootout(null);
    }
    setIsEditingPrediction(false);
  }, [match.id]);

  // Keep fields synced with database loads if we are NOT actively editing
  useEffect(() => {
    if (myPrediction && !isEditingPrediction) {
      setHomePred(myPrediction.homePredicted.toString());
      setAwayPred(myPrediction.awayPredicted.toString());
      setPredShootout(myPrediction.shootoutWinner || null);
    } else if (!myPrediction && !isEditingPrediction) {
      setHomePred('');
      setAwayPred('');
      setPredShootout(null);
    }
  }, [myPrediction, isEditingPrediction]);

  // Score adjustments (handy on mobile!)
  const adjustHome = (amount: number) => {
    if (isLocked) return;
    const current = parseInt(homePred);
    const newValue = isNaN(current) ? 0 : Math.max(0, current + amount);
    setHomePred(newValue.toString());
  };

  const adjustAway = (amount: number) => {
    if (isLocked) return;
    const current = parseInt(awayPred);
    const newValue = isNaN(current) ? 0 : Math.max(0, current + amount);
    setAwayPred(newValue.toString());
  };

  // Is match locked?
  const isPastKickoff = liveLocked || new Date().getTime() > new Date(match.kickoffTime).getTime();
  const isLocked = match.status === MatchStatus.LOCKED || match.status === MatchStatus.FINISHED || match.status === MatchStatus.CANCELLED || isPastKickoff;
  const isKnockout = match.stage !== 'Group Stage';

  // Have the predictions changed?
  const isDirty = myPrediction 
    ? (homePred !== myPrediction.homePredicted.toString() || 
       awayPred !== myPrediction.awayPredicted.toString() ||
       (parseInt(homePred) === parseInt(awayPred) && isKnockout && predShootout !== (myPrediction.shootoutWinner || null)))
    : (homePred !== '' && awayPred !== '');

  const handlePredictSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    const homeNum = parseInt(homePred);
    const awayNum = parseInt(awayPred);

    if (isNaN(homeNum) || isNaN(awayNum) || homeNum < 0 || awayNum < 0) {
      setSaveError("Score must be valid positive integers.");
      return;
    }

    if (isKnockout && homeNum === awayNum && !predShootout) {
      setSaveError("Tied knockout scores require selecting a shootout winner!");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await savePrediction(match.id, homeNum, awayNum, homeNum === awayNum && isKnockout ? predShootout : null);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditingPrediction(false);
      }, 1500);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to submit prediction.');
    } finally {
      setIsSaving(false);
    }
  };

  // Find all other predictions on this match (only visible after match locks)
  const otherPredictions = predictions.filter(p => p.matchId === match.id && p.userId !== currentUser?.uid);

  // Formatting Kickoff Date/Time
  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Custom pill coloring based on stage complexity
  const getStageBadgeStyle = (stage: string) => {
    switch (stage) {
      case 'Final':
        return 'bg-gradient-to-r from-amber-500/15 to-yellow-500/15 border-amber-500/30 text-amber-400';
      case 'Semifinals':
        return 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400';
      case 'Quarterfinals':
        return 'bg-orange-500/10 border border-orange-500/20 text-orange-400';
      case 'Round of 16':
      case 'Round of 32':
        return 'bg-indigo-505/10 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300';
      default:
        return 'bg-slate-950/60 border border-slate-850 text-slate-400';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800/60 hover:border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl p-5 backdrop-blur flex flex-col justify-between group"
    >
      <div>
        {/* Match Header Info Section */}
        <div className="flex justify-between items-center mb-4 pb-3.5 border-b border-slate-800/40 text-xs">
          <span className={`px-2.5 py-0.5 rounded-lg border font-semibold text-[10px] tracking-wide ${getStageBadgeStyle(match.stage)}`}>
            {match.stage}
          </span>
          
          <div className="flex items-center gap-2">
            {match.status === MatchStatus.FINISHED ? (
              <span className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase text-[9px] px-2 py-0.5 rounded-md tracking-wider">
                <ShieldCheck className="w-3 h-3 text-emerald-500" /> Finished
              </span>
            ) : match.status === MatchStatus.CANCELLED ? (
              <span className="flex items-center gap-1 bg-slate-500/10 border border-slate-500/20 text-slate-400 font-bold uppercase text-[9px] px-2 py-0.5 rounded-md tracking-wider">
                <XCircle className="w-3 h-3 text-slate-400" /> Cancelled
              </span>
            ) : isLocked ? (
              <span className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold uppercase text-[9px] px-2 py-0.5 rounded-md tracking-wider animate-pulse">
                <Lock className="w-3 h-3 text-rose-500" /> Locked
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold uppercase text-[9px] px-2 py-0.5 rounded-md tracking-wider align-middle">
                <Clock className="w-3 h-3 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} /> Open
              </span>
            )}
            <span className="text-slate-850 text-slate-700 font-bold">|</span>
            <span className="text-slate-400 font-mono text-[10px] bg-slate-950/40 border border-slate-850 px-2 py-0.5 rounded-md select-none">{formatDate(match.kickoffTime)}</span>
          </div>
        </div>

        {/* Cohesive Stadium Scoreboard Grid - flags center-aligned cleanly */}
        <div className="grid grid-cols-12 gap-2 items-center mb-5 py-2">
          {/* Home Team (Right Aligned) */}
          <div className="col-span-5 flex items-center justify-end gap-2.5 md:gap-3.5 text-right overflow-hidden">
            <span className="text-sm md:text-base font-bold text-white tracking-tight truncate hover:whitespace-normal transition-all" title={match.homeTeam}>
              {match.homeTeam}
            </span>
            <div className="flex-shrink-0 w-11 h-11 md:w-13 md:h-13 bg-slate-950 border border-slate-800/80 rounded-full flex items-center justify-center text-xl md:text-2xl shadow-inner select-none transition-transform duration-350 group-hover:scale-105">
              {match.homeFlag || '⚽'}
            </div>
          </div>

          {/* Versus Center scoreboard block */}
          <div className="col-span-2 flex flex-col items-center justify-center">
            {match.status === MatchStatus.FINISHED ? (
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-2.5 py-1.5 md:px-3.5 md:py-2 flex items-center justify-center gap-2 shadow-inner select-none">
                <span className="text-lg md:text-2xl font-black font-mono text-white tracking-tight">{match.homeScore}</span>
                <span className="text-amber-500 font-bold text-sm">:</span>
                <span className="text-lg md:text-2xl font-black font-mono text-white tracking-tight">{match.awayScore}</span>
              </div>
            ) : (
              <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-3 py-1.5 flex flex-col items-center justify-center select-none shadow">
                <span className="text-[10px] font-black font-mono text-amber-500/80 tracking-widest uppercase">VS</span>
              </div>
            )}
            {match.status === MatchStatus.FINISHED && (
              <span className="text-[8px] uppercase font-black text-emerald-400 mt-1.5 font-sans tracking-widest text-center block leading-tight">
                {isKnockout && match.homeScore === match.awayScore && match.shootoutWinner 
                  ? `PEN: ${match.shootoutWinner === 'home' ? 'HOME' : 'AWAY'}`
                  : 'FINAL'}
              </span>
            )}
          </div>

          {/* Away Team (Left Aligned) */}
          <div className="col-span-5 flex items-center justify-start gap-2.5 md:gap-3.5 text-left overflow-hidden">
            <div className="flex-shrink-0 w-11 h-11 md:w-13 md:h-13 bg-slate-950 border border-slate-800/80 rounded-full flex items-center justify-center text-xl md:text-2xl shadow-inner select-none transition-transform duration-350 group-hover:scale-105">
              {match.awayFlag || '⚽'}
            </div>
            <span className="text-sm md:text-base font-bold text-white tracking-tight truncate hover:whitespace-normal transition-all" title={match.awayTeam}>
              {match.awayTeam}
            </span>
          </div>
        </div>

        {/* Prediction Input / Outputs Drawer */}
        <div className="mt-2 pt-4 border-t border-slate-800/30 relative overflow-hidden min-h-[140px]">
          
          {/* SUCCESS OVERLAY */}
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 text-center select-none"
            >
              <motion.div
                initial={{ scale: 0.6, rotate: -15 }}
                animate={{ scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 200, damping: 15 } }}
                className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-2.5 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                <ShieldCheck className="w-8 h-8" />
              </motion.div>
              <h4 className="text-sm font-black text-emerald-400 tracking-wider uppercase select-none flex items-center gap-1.5 justify-center">
                Predicted Successfully! ★
              </h4>
              <p className="text-[11px] text-slate-300 mt-1 font-sans font-medium max-w-xs px-2">
                Your prediction has been secured. Prediction is completed!
              </p>
            </motion.div>
          )}

          {isLocked ? (
            /* LOCKED CARD - DISPLAY PERMANENT STATS AND SCORE MULTIPLIERS */
            myPrediction ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/45 border border-slate-850/80 w-full shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                    My Prediction:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="text-xs md:text-sm font-black font-mono text-slate-200 bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl shadow-inner select-none flex items-center gap-1">
                      <span>{myPrediction.homePredicted}</span>
                      <span className="text-slate-600 font-bold">-</span>
                      <span>{myPrediction.awayPredicted}</span>
                    </div>
                    {isKnockout && myPrediction.homePredicted === myPrediction.awayPredicted && myPrediction.shootoutWinner && (
                      <span className="text-[9px] bg-indigo-550/15 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-lg font-bold uppercase">
                        SO: {myPrediction.shootoutWinner === 'home' ? match.homeTeam : match.awayTeam}
                      </span>
                    )}
                  </div>
                </div>

                {match.status === MatchStatus.FINISHED && (
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {myPrediction.status === PredictionStatus.EXACT_CORRECT ? (
                      <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs px-3 py-1.5 rounded-xl font-bold animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                        <span>Exact Score Match (+3 PTS)</span>
                      </div>
                    ) : myPrediction.status === PredictionStatus.WINNER_CORRECT ? (
                      <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs px-3 py-1.5 rounded-xl font-bold select-none">
                        <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>Outcome Correct (+1 PT)</span>
                      </div>
                    ) : (
                      <div className="bg-slate-950 border border-slate-900 text-slate-500 text-xs px-3 py-1.5 rounded-xl font-semibold select-none">
                        Incorrect Outcome (0 PTS)
                      </div>
                    )}
                  </div>
                )}
                {match.status === MatchStatus.CANCELLED && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950/80 border border-slate-900 px-3 py-1.5 rounded-xl font-semibold select-none shrink-0 self-start sm:self-auto">
                    <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Match Cancelled (No Points Awarded)</span>
                  </div>
                )}
                {match.status !== MatchStatus.FINISHED && match.status !== MatchStatus.CANCELLED && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950/80 border border-slate-900 px-3 py-1.5 rounded-xl font-semibold select-none shrink-0 self-start sm:self-auto">
                    <Lock className="w-3.2 h-3.2 text-slate-500" />
                    <span>Locked. Awaiting Official Result</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-3.5 rounded-2xl bg-slate-950/30 border border-dashed border-slate-800 text-slate-500 text-xs italic select-none">
                🔒 No predictions were submitted before kickoff.
              </div>
            )
          ) : myPrediction && !isEditingPrediction ? (
            /* SECURED PREDICTION MODE (BEFORE KICKOFF) */
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-between p-4.5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-slate-950/60 to-slate-950/45 border border-emerald-500/25 w-full shadow-lg text-center"
            >
              <div className="flex flex-col items-center gap-1 my-1">
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs px-3 py-1 rounded-full font-black uppercase tracking-wider select-none animate-pulse">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Successfully Predicted! ★</span>
                </div>
                <p className="text-[11px] text-slate-305 mt-1.5 leading-relaxed font-sans max-w-sm">
                  You successfully predicted this game! Your prediction is secured and locked. 
                </p>
              </div>

              {/* Large Display of predicted score resembling a scoreboard */}
              <div className="flex items-center justify-center gap-5 bg-slate-950 border border-slate-800/85 rounded-2xl px-6 py-2.5 shadow-inner mt-2.5 mb-1 select-none">
                <div className="flex flex-col items-center">
                  <span className="text-xl md:text-2xl font-black font-mono text-white tracking-tight">{myPrediction.homePredicted}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[70px]" title={match.homeTeam}>{match.homeTeam}</span>
                </div>
                <span className="text-amber-500 font-bold text-base bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 leading-none">:</span>
                <div className="flex flex-col items-center">
                  <span className="text-xl md:text-2xl font-black font-mono text-white tracking-tight">{myPrediction.awayPredicted}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[70px]" title={match.awayTeam}>{match.awayTeam}</span>
                </div>
              </div>

              {isKnockout && myPrediction.homePredicted === myPrediction.awayPredicted && myPrediction.shootoutWinner && (
                <div className="mt-2 text-xs text-indigo-300 font-bold bg-indigo-950/40 border border-indigo-500/20 px-3 py-1 rounded-xl uppercase flex items-center justify-center gap-1.5 select-none hover:border-indigo-500/30 transition-all">
                  <span>Penalty SO Winner:</span>
                  <span className="bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded-lg border border-indigo-500/20 font-black">
                    {myPrediction.shootoutWinner === 'home' ? match.homeTeam : match.awayTeam}
                  </span>
                </div>
              )}

              {/* Edit / Change Button */}
              <div className="mt-3.5 flex items-center justify-center w-full">
                <button
                  type="button"
                  onClick={() => setIsEditingPrediction(true)}
                  className="bg-slate-900/80 hover:bg-slate-850 text-slate-304 hover:text-white border border-slate-800/80 hover:border-slate-705 text-[11px] px-4 py-2 font-bold rounded-xl transition duration-200 cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit Prediction</span>
                </button>
              </div>
            </motion.div>
          ) : (
            /* OPEN CARD - INTERACTIVE SCORE ADJUSTMENT DRAWER */
            <form onSubmit={handlePredictSubmit} className="space-y-4">
              {/* Quick-choice Outcome Matcher */}
              <div className="space-y-1.5 bg-slate-950/20 p-3 rounded-xl border border-slate-800/40">
                <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  Quick Select / Support Draw
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHomePred('2');
                      setAwayPred('1');
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition duration-200 border cursor-pointer select-none flex flex-col items-center justify-center gap-1 ${
                      homePred && awayPred && parseInt(homePred) > parseInt(awayPred)
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-extrabold'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <span className="text-sm">👑</span>
                    <span className="truncate max-w-full text-[10px]">{match.homeTeam} Win</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHomePred('1');
                      setAwayPred('1');
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition duration-200 border cursor-pointer select-none flex flex-col items-center justify-center gap-1 ${
                      homePred && awayPred && parseInt(homePred) === parseInt(awayPred)
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-extrabold'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <span className="text-sm shadow-sm">🤝</span>
                    <span className="uppercase text-[10px]">Predict Draw</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHomePred('1');
                      setAwayPred('2');
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition duration-200 border cursor-pointer select-none flex flex-col items-center justify-center gap-1 ${
                      homePred && awayPred && parseInt(homePred) < parseInt(awayPred)
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-extrabold'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <span className="text-sm">👑</span>
                    <span className="truncate max-w-full text-[10px]">{match.awayTeam} Win</span>
                  </button>
                </div>

                {/* If Knockout match and predictions are tied, show shootout winner selector! */}
                {isKnockout && homePred !== '' && awayPred !== '' && parseInt(homePred) === parseInt(awayPred) && (
                  <div className="space-y-2 p-3 mt-2 bg-indigo-500/5 rounded-xl border border-indigo-500/20">
                    <span className="block text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                      ⚡ Knockout Tiebreaker - Predict Shootout Winner
                    </span>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Knockout stage matches cannot end in a draw. Select who wins the penalty shootout:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPredShootout('home')}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          predShootout === 'home'
                            ? 'bg-indigo-600/30 border-indigo-500 text-indigo-400 font-extrabold shadow-sm'
                            : 'bg-slate-950/65 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        <span className="shrink-0">{match.homeFlag || '⚽'}</span>
                        <span className="truncate">{match.homeTeam}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPredShootout('away')}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          predShootout === 'away'
                            ? 'bg-indigo-600/30 border-indigo-500 text-indigo-400 font-extrabold shadow-sm'
                            : 'bg-slate-950/65 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        <span className="shrink-0">{match.awayFlag || '⚽'}</span>
                        <span className="truncate">{match.awayTeam}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Score-adjustor details and dynamic text */}
                <div className="text-[10px] text-slate-400 leading-relaxed font-semibold mt-1 bg-slate-950/40 p-2 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-1">
                  <span>⚽ Points: Draw/Winner correctly = <strong className="text-amber-500 font-black">1pt</strong>. Exact score = <strong className="text-amber-500 font-black">3pts</strong>.</span>
                  {homePred && awayPred && (
                    <span className="text-amber-400 text-[9px] font-bold uppercase tracking-wide">
                      {parseInt(homePred) > parseInt(awayPred)
                        ? `Predicting: ${match.homeTeam} Win`
                        : parseInt(homePred) < parseInt(awayPred)
                        ? `Predicting: ${match.awayTeam} Win`
                        : isKnockout 
                          ? `Predicting: DRAW (SO: ${predShootout ? (predShootout === 'home' ? match.homeTeam : match.awayTeam) : 'None elegido'})`
                          : "Predicting: DRAW"}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-950/40 border border-slate-850/60 rounded-2xl">
                
                {/* Visual Tactile Increments Console */}
                <div className="flex items-center justify-center gap-3 select-none w-full sm:w-auto">
                  <span className="text-slate-500 text-[10px] font-bold uppercase mr-1 select-none hidden lg:inline">Score:</span>
                  {/* Home Predictions Counter */}
                  <div className="flex items-center gap-1.5 bg-slate-900/40 p-1 border border-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => adjustHome(-1)}
                      className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer font-bold shrink-0 text-xs selection:bg-transparent"
                    >
                      －
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      placeholder="0"
                      value={homePred}
                      onChange={(e) => setHomePred(e.target.value)}
                      className="w-11 h-9 bg-slate-950 text-white border border-slate-800/80 hover:border-slate-700 focus:border-amber-500 text-center rounded-lg text-sm font-black font-mono focus:ring-1 focus:ring-amber-500 outline-none transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => adjustHome(1)}
                      className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer font-bold shrink-0 text-xs selection:bg-transparent"
                    >
                      ＋
                    </button>
                  </div>

                  <span className="text-slate-700 font-bold select-none text-[10px]">—</span>

                  {/* Away Predictions Counter */}
                  <div className="flex items-center gap-1.5 bg-slate-900/40 p-1 border border-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => adjustAway(-1)}
                      className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer font-bold shrink-0 text-xs selection:bg-transparent"
                    >
                      －
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      placeholder="0"
                      value={awayPred}
                      onChange={(e) => setAwayPred(e.target.value)}
                      className="w-11 h-9 bg-slate-950 text-white border border-slate-800/80 hover:border-slate-700 focus:border-amber-500 text-center rounded-lg text-sm font-black font-mono focus:ring-1 focus:ring-amber-500 outline-none transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => adjustAway(1)}
                      className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer font-bold shrink-0 text-xs selection:bg-transparent"
                    >
                      ＋
                    </button>
                  </div>
                </div>

                {/* Submitting Operations Action Center */}
                <div className="flex items-center justify-end gap-3 self-center sm:self-auto w-full sm:w-auto">
                  {saveError && (
                    <span className="text-[9px] text-red-400 font-semibold max-w-[120px] truncate block" title={saveError}>
                      {saveError}
                    </span>
                  )}
                  {saveSuccess && !isDirty && (
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/20 border border-emerald-500/20 px-3 py-1.5 rounded-xl animate-pulse">
                      <Check className="w-3.5 h-3.5" /> Saved!
                    </span>
                  )}
                  
                  {myPrediction && (
                    <button
                      type="button"
                      onClick={() => {
                        setHomePred(myPrediction.homePredicted.toString());
                        setAwayPred(myPrediction.awayPredicted.toString());
                        setPredShootout(myPrediction.shootoutWinner || null);
                        setIsEditingPrediction(false);
                      }}
                      className="border border-slate-800 hover:border-slate-700 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-305 text-xs px-3.5 py-2 font-bold rounded-xl cursor-pointer transition shrink-0"
                    >
                      Cancel
                    </button>
                  )}
                  {isDirty ? (
                    <button
                      type="submit"
                      disabled={isSaving || saveSuccess}
                      className={`w-full sm:w-auto text-xs px-4 py-2 font-bold rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                        saveSuccess 
                          ? 'bg-emerald-500 text-slate-950' 
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      {isSaving ? (
                        <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : saveSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          Prediction Completed!
                        </>
                      ) : (
                        <>Save Prediction</>
                      )}
                    </button>
                  ) : (
                    (myPrediction || saveSuccess) && (
                      <span className="text-[11px] text-emerald-400/90 font-bold flex items-center justify-center gap-1 border border-emerald-500/15 bg-emerald-950/10 px-3 py-2 rounded-xl w-full sm:w-auto shrink-0 select-none">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Prediction Completed
                      </span>
                    )
                  )}
                </div>

              </div>
            </form>
          )}
        </div>
      </div>

      {/* OTHER MEMBERS COLLAPSIBLE AUDIT BOX (Triggered after lock status) */}
      {isLocked && otherPredictions.length > 0 && (
        <div className="mt-4 border-t border-slate-800/40 pt-3">
          <button
            type="button"
            onClick={() => setShowOtherPredictions(!showOtherPredictions)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-500 transition cursor-pointer select-none"
          >
            {showOtherPredictions ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>
              {showOtherPredictions ? 'Hide' : 'Reveal'} participant predictions ({otherPredictions.length})
            </span>
          </button>

          {showOtherPredictions && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 overflow-hidden px-0.5 pb-0.5"
            >
              {otherPredictions.map((pred) => {
                const isExact = match.status === MatchStatus.FINISHED && pred.status === PredictionStatus.EXACT_CORRECT;
                const isOutcome = match.status === MatchStatus.FINISHED && pred.status === PredictionStatus.WINNER_CORRECT;

                return (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={pred.id} 
                    className={`flex items-center justify-between p-3 rounded-xl text-xs border transition shadow-sm ${
                      isExact 
                        ? 'bg-amber-950/20 border-amber-500/25 text-amber-300' 
                        : isOutcome 
                          ? 'bg-indigo-950/15 border-indigo-500/20 text-indigo-300' 
                          : 'bg-slate-950/40 border-slate-850/80 text-slate-450'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-1">
                      <div className="w-5.5 h-5.5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[9px] text-slate-300 uppercase shrink-0">
                        {pred.displayName.substring(0, 2)}
                      </div>
                      <span className="font-semibold text-slate-200 truncate" title={pred.displayName}>
                        {pred.displayName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex flex-col items-end">
                        <span className="font-mono font-bold text-slate-200 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded-md">
                          {pred.homePredicted}-{pred.awayPredicted}
                        </span>
                        {isKnockout && pred.homePredicted === pred.awayPredicted && pred.shootoutWinner && (
                          <span className="text-[7px] text-indigo-400 font-bold uppercase mt-0.5 leading-none">
                            SO: {pred.shootoutWinner === 'home' ? 'HOME' : 'AWAY'}
                          </span>
                        )}
                      </div>
                      {match.status === MatchStatus.FINISHED && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                          isExact ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : isOutcome ? 'bg-indigo-500/15 text-indigo-400' : 'bg-slate-900 text-slate-500'
                        }`}>
                          {isExact ? '+3P' : isOutcome ? '+1P' : '0P'}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
};
