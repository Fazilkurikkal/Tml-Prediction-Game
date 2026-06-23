import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { MatchStatus, Match, MatchStage, Prediction } from '../types';
import { ShieldCheck, PlusCircle, RotateCcw, AlertTriangle, HelpCircle, Save, CheckCircle, Database, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

export const AdminPanel: React.FC = () => {
  const { currentUser, matches, predictions, leaderboard, updateMatchScore, clearMatchPoints, addMatch, clearAllMatches, seedInitialData, isFirebase } = useGame();
  
  // Local state to load all user predictions for administrative overview
  const [adminPredictions, setAdminPredictions] = useState<Prediction[]>([]);
  const [isLoadingPreds, setIsLoadingPreds] = useState<boolean>(false);

  const fetchAdminPredictions = () => {
    if (isFirebase && db) {
      setIsLoadingPreds(true);
      getDocs(collection(db, 'predictions')).then(snap => {
        const list: Prediction[] = [];
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() } as Prediction);
        });
        setAdminPredictions(list);
        setIsLoadingPreds(false);
      }).catch(err => {
        console.error("Error loading predictions for admin panel:", err);
        setIsLoadingPreds(false);
      });
    }
  };

  useEffect(() => {
    fetchAdminPredictions();
  }, [isFirebase]);

  const activePredictions = isFirebase ? adminPredictions : predictions;

  // Local state for tracking collapsible predictions lists
  const [expandedPredictions, setExpandedPredictions] = useState<{ [matchId: string]: boolean }>({});
  const [isClearingMatch, setIsClearingMatch] = useState<{ [matchId: string]: boolean }>({});
  const [confirmClearPoints, setConfirmClearPoints] = useState<{ [matchId: string]: boolean }>({});
  
  const togglePredictionsExpand = (matchId: string) => {
    setExpandedPredictions(prev => ({
      ...prev,
      [matchId]: !prev[matchId]
    }));
  };

  // Local state for editing matches
  const [editingScores, setEditingScores] = useState<{ [matchId: string]: { home: string, away: string, status: MatchStatus, shootoutWinner: 'home' | 'away' | null } }>({});
  const [successMsg, setSuccessMsg] = useState<{ [matchId: string]: string }>({});
  const [errorMsg, setErrorMsg] = useState<{ [matchId: string]: string }>({});
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [seedSuccess, setSeedSuccess] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [clearSuccess, setClearSuccess] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [adminError, setAdminError] = useState<string>('');

  // Form state for creating a new match
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [homeTeam, setHomeTeam] = useState<string>('');
  const [awayTeam, setAwayTeam] = useState<string>('');
  const [homeFlag, setHomeFlag] = useState<string>('⚽');
  const [awayFlag, setAwayFlag] = useState<string>('⚽');
  const [stage, setStage] = useState<MatchStage>(MatchStage.GROUP_STAGE);
  const [status, setStatus] = useState<MatchStatus>(MatchStatus.OPEN);
  const [kickoffTime, setKickoffTime] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');
  const [isSubmittingNew, setIsSubmittingNew] = useState<boolean>(false);

  // Authorization Check
  if (!currentUser?.isAdmin) {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col items-center"
        >
          <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center text-red-500 mb-4 animate-bounce">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">Access Control Restricted</h3>
          <p className="text-slate-400 text-xs mb-6 text-center leading-relaxed">
            The administrative panel is exclusively locked to the league owner ({'mm9975775@gmail.com'}). 
            Please sign out and log in with the administrator profile to continue.
          </p>
          <div className="p-3 bg-slate-950 rounded-lg text-slate-500 font-mono text-[10px] text-left w-full border border-slate-850">
            <span className="text-slate-400 font-semibold">Sandbox tip:</span> In local mode, click the preseeded 'Admin Mo (TML)' shortcut in the auth page to log in as admin instantly!
          </div>
        </motion.div>
      </div>
    );
  }

  // Handle local inputs change
  const handleScoreChange = (matchId: string, side: 'home' | 'away', val: string) => {
    setEditingScores(prev => {
      const match = matches.find(m => m.id === matchId);
      const current = prev[matchId] || { 
        home: match?.homeScore?.toString() || '',
        away: match?.awayScore?.toString() || '',
        status: match?.status || MatchStatus.OPEN,
        shootoutWinner: match?.shootoutWinner || null
      };
      return {
        ...prev,
        [matchId]: {
          ...current,
          [side]: val
        }
      };
    });
  };

  // Handle status select change
  const handleStatusChange = (matchId: string, status: MatchStatus) => {
    setEditingScores(prev => {
      const match = matches.find(m => m.id === matchId);
      const current = prev[matchId] || { 
        home: match?.homeScore?.toString() || '',
        away: match?.awayScore?.toString() || '',
        status: match?.status || MatchStatus.OPEN,
        shootoutWinner: match?.shootoutWinner || null
      };
      
      // If status changed and it is Open/Locked, we reset score fields to empty
      let updatedHome = current.home;
      let updatedAway = current.away;
      if (status !== MatchStatus.FINISHED) {
        updatedHome = '';
        updatedAway = '';
      }

      return {
        ...prev,
        [matchId]: {
          ...current,
          home: updatedHome,
          away: updatedAway,
          status
        }
      };
    });
  };

  // Handle shootout winner change
  const handleShootoutWinnerChange = (matchId: string, winner: 'home' | 'away' | null) => {
    setEditingScores(prev => {
      const match = matches.find(m => m.id === matchId);
      const current = prev[matchId] || { 
        home: match?.homeScore?.toString() || '',
        away: match?.awayScore?.toString() || '',
        status: match?.status || MatchStatus.OPEN,
        shootoutWinner: match?.shootoutWinner || null
      };
      return {
        ...prev,
        [matchId]: {
          ...current,
          shootoutWinner: winner
        }
      };
    });
  };

  // Save changes to database (triggers automated points engine updates!)
  const handleSaveMatch = async (matchId: string) => {
    const editState = editingScores[matchId];
    if (!editState) return;

    setErrorMsg(prev => ({ ...prev, [matchId]: '' }));
    setSuccessMsg(prev => ({ ...prev, [matchId]: '' }));

    let homeNum: number | null = null;
    let awayNum: number | null = null;

    if (editState.status === MatchStatus.FINISHED) {
      homeNum = parseInt(editState.home);
      awayNum = parseInt(editState.away);

      if (isNaN(homeNum) || isNaN(awayNum) || homeNum < 0 || awayNum < 0) {
        setErrorMsg(prev => ({ ...prev, [matchId]: 'Please input valid positive integer scores to finalize matching.' }));
        return;
      }

      const match = matches.find(m => m.id === matchId);
      const isKnockout = match ? match.stage !== MatchStage.GROUP_STAGE : false;
      if (isKnockout && homeNum === awayNum && !editState.shootoutWinner) {
        setErrorMsg(prev => ({ ...prev, [matchId]: 'Tied knockout matches require selecting an official shootout winner!' }));
        return;
      }
    }

    try {
      await updateMatchScore(matchId, homeNum, awayNum, editState.status, editState.shootoutWinner || null);
      setSuccessMsg(prev => ({ ...prev, [matchId]: 'Successfully published changes to the database!' }));
      fetchAdminPredictions();
      setTimeout(() => {
        setSuccessMsg(prev => ({ ...prev, [matchId]: '' }));
      }, 3000);
    } catch (err: any) {
      setErrorMsg(prev => ({ ...prev, [matchId]: err?.message || 'Failed updating score.' }));
    }
  };

  const handleClearMatchPoints = async (matchId: string) => {
    // If not in confirmation state yet, trigger it
    if (!confirmClearPoints[matchId]) {
      setConfirmClearPoints(prev => ({ ...prev, [matchId]: true }));
      // Auto-reset confirmation indicator after 4 seconds
      setTimeout(() => {
        setConfirmClearPoints(prev => ({ ...prev, [matchId]: false }));
      }, 4000);
      return;
    }

    try {
      setErrorMsg(prev => ({ ...prev, [matchId]: '' }));
      setSuccessMsg(prev => ({ ...prev, [matchId]: '' }));
      setIsClearingMatch(prev => ({ ...prev, [matchId]: true }));
      setConfirmClearPoints(prev => ({ ...prev, [matchId]: false }));
      
      await clearMatchPoints(matchId);
      
      setSuccessMsg(prev => ({ ...prev, [matchId]: 'Match details and points cleared successfully!' }));
      fetchAdminPredictions();
      setTimeout(() => {
        setSuccessMsg(prev => ({ ...prev, [matchId]: '' }));
      }, 3000);

      // Clean up the editing state for this match
      setEditingScores(prev => {
        const match = matches.find(m => m.id === matchId);
        return {
          ...prev,
          [matchId]: {
            home: '',
            away: '',
            status: MatchStatus.OPEN,
            shootoutWinner: null
          }
        };
      });
    } catch (err: any) {
      setErrorMsg(prev => ({ ...prev, [matchId]: err?.message || 'Failed clearing match points.' }));
    } finally {
      setIsClearingMatch(prev => ({ ...prev, [matchId]: false }));
    }
  };

  // Seeding trigger
  const handleDatabaseSeed = async () => {
    setIsSeeding(true);
    setSeedSuccess(false);
    setAdminError('');
    try {
      await seedInitialData();
      setSeedSuccess(true);
      fetchAdminPredictions();
      setTimeout(() => setSeedSuccess(false), 5000);
    } catch (err: any) {
      console.error(err);
      setAdminError("Seeding failed: " + (err?.message || JSON.stringify(err)));
    } finally {
      setIsSeeding(false);
    }
  };

  const executeClearAllMatches = async () => {
    setIsClearing(true);
    setClearSuccess(false);
    setAdminError('');
    try {
      await clearAllMatches();
      setClearSuccess(true);
      setShowClearConfirm(false);
      fetchAdminPredictions();
      setTimeout(() => setClearSuccess(false), 5500);
    } catch (err: any) {
      console.error(err);
      setAdminError("Failed clearing matches: " + (err?.message || JSON.stringify(err)));
    } finally {
      setIsClearing(false);
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!homeTeam.trim() || !awayTeam.trim()) {
      setFormError('Both Home and Away teams are required.');
      return;
    }

    if (!kickoffTime) {
      setFormError('Please select a kickoff date and time.');
      return;
    }

    setIsSubmittingNew(true);
    try {
      const isoKickoff = new Date(kickoffTime).toISOString();
      
      await addMatch({
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        homeFlag: homeFlag.trim() || '⚽',
        awayFlag: awayFlag.trim() || '⚽',
        stage,
        status,
        kickoffTime: isoKickoff
      });

      setFormSuccess('Match created successfully! Added to the tournament database.');
      // Reset form variables
      setHomeTeam('');
      setAwayTeam('');
      setHomeFlag('⚽');
      setAwayFlag('⚽');
      setStage(MatchStage.GROUP_STAGE);
      setStatus(MatchStatus.OPEN);
      setKickoffTime('');
      
      setTimeout(() => {
        setFormSuccess('');
      }, 4000);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create match.');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  return (
    <div id="admin-panel-container" className="space-y-6">
      
      {/* Tournament Database Initialization card */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/20 to-slate-900 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <h3 className="text-white font-bold text-base flex justify-start items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" /> Tournament System Database Config
          </h3>
          <p className="text-xs text-slate-400 max-w-xl">
            Select an action below to either wipe the database clean to add your own custom matches one-by-one, or reset and populate with our template World Cup list of matches and predictions.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 self-start lg:self-auto shrink-0 w-full sm:w-auto">
          {/* Clear All Matches Button */}
          <button
            type="button"
            disabled={isClearing || isSeeding || showClearConfirm}
            onClick={() => setShowClearConfirm(true)}
            className="bg-rose-950/40 hover:bg-rose-600 border border-rose-500/20 text-rose-200 hover:text-white font-bold text-xs px-5 py-3 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto shadow-md"
          >
            {isClearing ? (
              <span className="w-4 h-4 border-2 border-rose-200 border-t-transparent rounded-full animate-spin" />
            ) : clearSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Database Cleared Cleanly
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" /> Clear All Matches
              </>
            )}
          </button>

          {/* Seed Matches Button */}
          <button
            type="button"
            disabled={isSeeding || isClearing || showClearConfirm}
            onClick={handleDatabaseSeed}
            className="bg-indigo-650 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-3 rounded-xl transition duration-205 cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto shadow-[0_4px_12px_rgba(99,102,241,0.15)]"
          >
            {isSeeding ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : seedSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Seeding Complete
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" /> Seeding Template Brackets
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Admin general errors */}
      {adminError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-400 text-xs flex justify-between items-center gap-2"
        >
          <span>{adminError}</span>
          <button onClick={() => setAdminError('')} className="text-slate-400 hover:text-white font-bold px-2 py-1 text-xs cursor-pointer">
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Custom Clean Confirmation Banner */}
      {showClearConfirm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-slate-900 border border-rose-500/35 space-y-4 shadow-xl"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Confirm Database Flush
              </h4>
              <p className="text-xs text-slate-400">
                Are you absolutely sure? This action will permanently **delete all matches**, **erase all user predictions**, and **reset user leaderboard points & statistics** to zero.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isClearing}
              onClick={executeClearAllMatches}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              {isClearing ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Yes, Clear Everything</>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Admin Game Result Card controls list */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800 gap-2">
          <h2 className="text-lg font-bold font-sans text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" /> Live Match Administration
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-md"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              {showCreateForm ? 'Close Scheduler' : 'Add New Match'}
            </button>
            <span className="text-[10px] bg-slate-900 text-slate-500 border border-slate-800 font-mono px-2 py-1 rounded">
              {matches.length} Total Matches
            </span>
          </div>
        </div>

        {/* Collapsible Create Match Form */}
        {showCreateForm && (
          <motion.form 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleCreateMatch}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-indigo-400" /> Schedule Match Details
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Create new fixture</span>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/20 text-red-500 text-xs">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-xs">
                {formSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Home Team */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Home Team</label>
                <div className="grid grid-cols-4 gap-2">
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="🇧🇷"
                    value={homeFlag}
                    onChange={(e) => setHomeFlag(e.target.value)}
                    className="col-span-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white p-2.5 rounded-lg outline-none text-center font-sans"
                  />
                  <input
                    type="text"
                    placeholder="Brazil"
                    value={homeTeam}
                    onChange={(e) => setHomeTeam(e.target.value)}
                    className="col-span-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white p-2.5 rounded-lg outline-none font-sans"
                    required
                  />
                </div>
              </div>

              {/* Away Team */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Away Team</label>
                <div className="grid grid-cols-4 gap-2">
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="🇫🇷"
                    value={awayFlag}
                    onChange={(e) => setAwayFlag(e.target.value)}
                    className="col-span-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white p-2.5 rounded-lg outline-none text-center font-sans"
                  />
                  <input
                    type="text"
                    placeholder="France"
                    value={awayTeam}
                    onChange={(e) => setAwayTeam(e.target.value)}
                    className="col-span-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white p-2.5 rounded-lg outline-none font-sans"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Stage */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Match Stage</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as MatchStage)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white p-2.5 rounded-lg outline-none cursor-pointer font-sans"
                >
                  {Object.values(MatchStage).map((stg) => (
                    <option key={stg} value={stg}>{stg}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Initial Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MatchStatus)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white p-2.5 rounded-lg outline-none cursor-pointer font-sans"
                >
                  <option value={MatchStatus.OPEN}>Open (Accept predicting)</option>
                  <option value={MatchStatus.LOCKED}>Locked (Freeze bidding)</option>
                  <option value={MatchStatus.FINISHED}>Finished</option>
                  <option value={MatchStatus.CANCELLED}>Cancelled</option>
                </select>
              </div>

              {/* Kickoff */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Kickoff Date & Time</label>
                <input
                  type="datetime-local"
                  value={kickoffTime}
                  onChange={(e) => setKickoffTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white p-2.5 rounded-lg outline-none cursor-pointer text-slate-350 font-sans"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setFormError('');
                  setFormSuccess('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-350 text-xs font-bold rounded-lg transition cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingNew}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-md font-sans"
              >
                {isSubmittingNew ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Create Match</>
                )}
              </button>
            </div>
          </motion.form>
        )}

        <div className="space-y-4">
          {matches.map((match) => {
            const currentEdit = editingScores[match.id] || {
              home: match.homeScore?.toString() || '',
              away: match.awayScore?.toString() || '',
              status: match.status,
              shootoutWinner: match.shootoutWinner || null
            };

            const isSubmitting = currentEdit.status === MatchStatus.FINISHED;

            return (
              <div 
                key={match.id} 
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Match Information summary details */}
                <div className="flex flex-col gap-1.5 lg:w-1/3">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-slate-800 text-slate-300 font-mono font-bold px-1.5 py-0.2 rounded">
                      {match.stage}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${
                      match.status === MatchStatus.FINISHED ? 'text-emerald-400' :
                      match.status === MatchStatus.LOCKED ? 'text-red-400' :
                      match.status === MatchStatus.CANCELLED ? 'text-slate-400' : 'text-amber-500'
                    }`}>
                      {match.status}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2 mt-0.5">
                    <span>{match.homeFlag || '⚽'} {match.homeTeam}</span>
                    <span className="text-slate-500 font-mono text-xs">VS</span>
                    <span>{match.awayFlag || '⚽'} {match.awayTeam}</span>
                  </div>
                  {match.status === MatchStatus.FINISHED ? (
                    <div className="text-[10px] text-slate-500 font-mono">
                      Current recorded result: <span className="font-bold text-white">{match.homeScore} - {match.awayScore}</span>
                      {match.stage !== MatchStage.GROUP_STAGE && match.homeScore === match.awayScore && match.shootoutWinner && (
                        <span className="text-[9px] text-indigo-400 font-bold ml-1.5 uppercase bg-indigo-500/10 px-1.5 py-0.5 rounded">
                          Shootout Winner: {match.shootoutWinner === 'home' ? match.homeTeam : match.awayTeam}
                        </span>
                      )}
                    </div>
                  ) : (
                    /* UNFINISHED MATCH PREDICTION ANALYSIS */
                    <div className="mt-2 space-y-1.5 bg-slate-950/40 p-2.5 border border-slate-800/50 rounded-xl">
                      <div className="flex items-center justify-between text-[11px] gap-2">
                        <span className="text-slate-400 font-medium">Predictions submitted:</span>
                        <span className="font-bold text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 font-mono">
                          {activePredictions.filter(p => p.matchId === match.id).length} {isLoadingPreds ? 'Loading...' : 'Completed'}
                        </span>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => togglePredictionsExpand(match.id)}
                        className="w-full text-left text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer select-none py-0.5 flex items-center gap-1.5"
                      >
                        {expandedPredictions[match.id] ? "Hide Participant Details ▲" : "View Participant Status ▼"}
                      </button>

                      {expandedPredictions[match.id] && (
                        <div className="mt-2 pt-2 border-t border-slate-85 shadow-lg space-y-2 text-[10px]">
                          {/* List of active participants who predicted */}
                          <div className="space-y-1">
                            <span className="text-slate-500 font-bold block uppercase tracking-wider text-[8px]">Predicted Members:</span>
                            {(() => {
                              const matchPreds = activePredictions.filter(p => p.matchId === match.id);
                              if (matchPreds.length === 0) {
                                return <span className="text-slate-500 italic block pl-1">No one has predicted yet.</span>;
                              }
                              return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 bg-slate-950/60 p-1.5 rounded-lg border border-slate-900">
                                  {matchPreds.map(p => (
                                    <div key={p.id} className="flex justify-between items-center bg-slate-900/60 px-2 py-1 rounded border border-slate-800 text-slate-300">
                                      <span className="truncate max-w-[110px] font-medium" title={p.displayName}>{p.displayName}</span>
                                      <span className="font-bold text-amber-300 bg-slate-950 border border-slate-850 px-1 py-0.2 rounded font-mono">
                                        {p.homePredicted} - {p.awayPredicted}
                                        {match.stage !== MatchStage.GROUP_STAGE && p.homePredicted === p.awayPredicted && p.shootoutWinner && (
                                          <span className="text-[7px] text-indigo-400 ml-0.5" title={p.shootoutWinner}>
                                            ({p.shootoutWinner === 'home' ? 'H' : 'A'})
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>

                          {/* List of active participants who have NOT predicted */}
                          <div className="space-y-1">
                            <span className="text-slate-500 font-bold block uppercase tracking-wider text-[8px]">Awaiting Predictions:</span>
                            {(() => {
                              const matchPredUsers = new Set(activePredictions.filter(p => p.matchId === match.id).map(p => p.userId));
                              const awaitingUsers = leaderboard.filter(u => !matchPredUsers.has(u.uid));
                              if (awaitingUsers.length === 0) {
                                return <span className="text-emerald-500 font-medium block pl-1">★ Everyone has predicted!</span>;
                              }
                              return (
                                <div className="flex flex-wrap gap-1 bg-slate-950/60 p-1.5 rounded-lg border border-slate-900">
                                  {awaitingUsers.map(u => (
                                    <span key={u.uid} className="bg-slate-900 text-slate-400 border border-slate-850 px-1.5 py-0.5 rounded text-[9px] hover:text-white" title={u.email}>
                                      {u.displayName}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Score inputs & Status controller */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:w-2/3 justify-end leading-relaxed">
                  
                  {/* Status Dropdown */}
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase font-sans mb-1">State status</span>
                    <select
                      value={currentEdit.status}
                      onChange={(e) => handleStatusChange(match.id, e.target.value as MatchStatus)}
                      className="bg-slate-950 border border-slate-800 text-xs text-white px-3 py-2 rounded-lg outline-none focus:border-indigo-500 select-none font-sans cursor-pointer transition"
                    >
                      <option value={MatchStatus.OPEN}>Open (Bidding active)</option>
                      <option value={MatchStatus.LOCKED}>Locked (Freeze bidding)</option>
                      <option value={MatchStatus.FINISHED}>Finished (Calculate points)</option>
                      <option value={MatchStatus.CANCELLED}>Cancelled (No result/revert points)</option>
                    </select>
                  </div>

                  {/* Goal inputs */}
                  {isSubmitting && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-500 uppercase font-sans mb-1">{match.homeTeam} goals</span>
                          <input
                            type="number"
                            placeholder="Home"
                            min="0"
                            value={currentEdit.home}
                            onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)}
                            className="w-20 bg-slate-950 text-white border border-slate-800 px-2 py-1.5 text-center text-xs focus:border-indigo-500 outline-none rounded-lg font-mono font-bold"
                          />
                        </div>
                        
                        <span className="text-slate-600 font-bold self-end mb-2">-</span>

                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-500 uppercase font-sans mb-1">{match.awayTeam} goals</span>
                          <input
                            type="number"
                            placeholder="Away"
                            min="0"
                            value={currentEdit.away}
                            onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)}
                            className="w-20 bg-slate-950 text-white border border-slate-800 px-2 py-1.5 text-center text-xs focus:border-indigo-500 outline-none rounded-lg font-mono font-bold"
                          />
                        </div>
                      </div>

                      {/* Shootout selection under tie conditions in knockout stages */}
                      {match.stage !== MatchStage.GROUP_STAGE && currentEdit.home !== '' && currentEdit.away !== '' && parseInt(currentEdit.home) === parseInt(currentEdit.away) && (
                        <div className="flex flex-col gap-1.5 bg-indigo-550/10 border border-indigo-500/20 p-2 rounded-lg">
                          <span className="text-[9px] font-bold text-indigo-400 uppercase">⚡ Assign Shootout Winner</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button; cursor: pointer"
                              onClick={() => handleShootoutWinnerChange(match.id, 'home')}
                              className={`px-2 py-1 text-[10px] font-bold rounded-md border cursor-pointer select-none truncate max-w-[100px] transition ${
                                currentEdit.shootoutWinner === 'home'
                                  ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                              title={match.homeTeam}
                            >
                              Home SO
                            </button>
                            <button
                              type="button; cursor: pointer"
                              onClick={() => handleShootoutWinnerChange(match.id, 'away')}
                              className={`px-2 py-1 text-[10px] font-bold rounded-md border cursor-pointer select-none truncate max-w-[100px] transition ${
                                currentEdit.shootoutWinner === 'away'
                                  ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                              title={match.awayTeam}
                            >
                              Away SO
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Save button & Result status notification */}
                  <div className="flex flex-col self-end gap-2 w-full sm:w-auto items-end">
                    {errorMsg[match.id] && <span className="text-[10px] text-red-500 font-medium">{errorMsg[match.id]}</span>}
                    {successMsg[match.id] && <span className="text-[10px] text-emerald-400 font-semibold">{successMsg[match.id]}</span>}
                    
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      {match.status === MatchStatus.FINISHED && (
                        <button
                          type="button"
                          onClick={() => handleClearMatchPoints(match.id)}
                          disabled={isClearingMatch[match.id]}
                          className={`font-bold text-xs px-3.5 py-2 rounded-lg transition duration-200 cursor-pointer flex items-center gap-1.5 h-9 border ${
                            confirmClearPoints[match.id]
                              ? 'bg-red-650 hover:bg-red-600 text-white border-red-500 animate-pulse'
                              : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-555/30 hover:border-red-400'
                          }`}
                          title="Wipe away calculated scores and restore participants' totals"
                        >
                          {isClearingMatch[match.id] ? (
                            <span className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <RotateCcw className={`w-3.5 h-3.5 ${confirmClearPoints[match.id] ? 'rotate-180 transition-transform duration-300' : ''}`} />
                          )}
                          {confirmClearPoints[match.id] ? 'Confirm Clear?' : 'Clear Points'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSaveMatch(match.id)}
                        className="bg-emerald-650 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 hover:shadow-[0_2px_8px_rgba(16,185,129,0.15)] rounded-lg transition duration-200 cursor-pointer flex items-center gap-1.5 h-9"
                      >
                        <Save className="w-3.5 h-3.5" /> Publish Result
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
