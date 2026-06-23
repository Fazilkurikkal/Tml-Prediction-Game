import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { Trophy, Star, CircleCheckBig, Search, ShieldAlert, Award, ChevronRight, X, Clock, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MatchStatus, Prediction, UserProfile, PredictionStatus, Match } from '../types';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export const Leaderboard: React.FC = () => {
  const { leaderboard, currentUser, predictions, matches, isFirebase } = useGame();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [inspectedPredictions, setInspectedPredictions] = useState<Prediction[]>([]);
  const [isLoadingInspected, setIsLoadingInspected] = useState<boolean>(false);
  const [extraMatches, setExtraMatches] = useState<{ [id: string]: Match }>({});

  // Filter leaderboard based on search term
  const filteredLeaderboard = leaderboard.filter(player => {
    const displayName = player?.displayName || '';
    const email = player?.email || '';
    return displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Generate ranking trophy icon/colored circle
  const getRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return (
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-600 to-yellow-400 flex items-center justify-center text-slate-950 font-black text-xs shadow-[0_0_8px_rgba(245,158,11,0.4)]">
            1
          </div>
        );
      case 1:
        return (
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-slate-400 to-slate-200 flex items-center justify-center text-slate-950 font-black text-xs">
            2
          </div>
        );
      case 2:
        return (
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-800 to-amber-600 flex items-center justify-center text-white font-black text-xs">
            3
          </div>
        );
      default:
        return (
          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-mono text-xs">
            {index + 1}
          </div>
        );
    }
  };

  // Inspect checked opponent predictions (only Locked/Finished ones can be audited)
  useEffect(() => {
    if (!selectedUser) {
      setInspectedPredictions([]);
      return;
    }

    const isLocalOrSelf = !isFirebase || selectedUser.uid === currentUser?.uid;

    const fetchAuditedPredictions = async () => {
      setIsLoadingInspected(true);
      const fetched: Prediction[] = [];
      const dbInstance = db;

      if (isLocalOrSelf) {
        // If local/self, we can just get user's predictions from local context
        const selfPreds = predictions.filter(p => p.userId === selectedUser.uid);
        
        // Find missing matchIds from local context 'matches' and 'extraMatches'
        const missingMatchIds: string[] = Array.from(new Set(
          selfPreds
            .filter(p => !matches.some(m => m.id === p.matchId) && !extraMatches[p.matchId])
            .map(p => p.matchId)
        ));

        if (isFirebase && dbInstance && missingMatchIds.length > 0) {
          try {
            const fetchedDocs = await Promise.all(
              missingMatchIds.map((id: string) => getDoc(doc(dbInstance!, 'matches', id)))
            );
            const newMatchesMap: { [id: string]: Match } = {};
            fetchedDocs.forEach(d => {
              if (d.exists()) {
                newMatchesMap[d.id] = { id: d.id, ...d.data() } as Match;
              }
            });
            setExtraMatches(prev => {
              const updated = { ...prev, ...newMatchesMap };
              // Filter and set self predictions now that we've fetched the required matches
              const validSelfPreds = selfPreds.filter(p => {
                const match = matches.find(m => m.id === p.matchId) || updated[p.matchId];
                if (!match) return false;
                const isPastKickoff = new Date().getTime() > new Date(match.kickoffTime).getTime();
                return match.status === MatchStatus.FINISHED || match.status === MatchStatus.LOCKED || isPastKickoff;
              });
              setInspectedPredictions(validSelfPreds);
              return updated;
            });
            setIsLoadingInspected(false);
            return;
          } catch (error) {
            console.error("Error fetching missing matches for self inspection:", error);
          }
        }

        // Fallback for offline/mock or if nothing is missing
        const validSelfPreds = selfPreds.filter(p => {
          const match = matches.find(m => m.id === p.matchId) || extraMatches[p.matchId];
          if (!match) return false;
          const isPastKickoff = new Date().getTime() > new Date(match.kickoffTime).getTime();
          return match.status === MatchStatus.FINISHED || match.status === MatchStatus.LOCKED || isPastKickoff;
        });
        setInspectedPredictions(validSelfPreds);
        setIsLoadingInspected(false);
        return;
      }

      // Firebase mode + Selected a different user: dynamically fetch their public (locked/finished) predictions
      if (dbInstance) {
        try {
          const q = query(
            collection(dbInstance, 'predictions'),
            where('userId', '==', selectedUser.uid)
          );
          const querySnap = await getDocs(q);
          const rawPreds: Prediction[] = [];
          
          querySnap.forEach((docSnap) => {
            rawPreds.push({ id: docSnap.id, ...docSnap.data() } as Prediction);
          });

          // Find missing matchIds
          const missingMatchIds: string[] = Array.from(new Set(
            rawPreds
              .filter(p => !matches.some(m => m.id === p.matchId) && !extraMatches[p.matchId])
              .map(p => p.matchId)
          ));

          let latestExtraMatches = { ...extraMatches };

          if (missingMatchIds.length > 0) {
            const fetchedDocs = await Promise.all(
              missingMatchIds.map((id: string) => getDoc(doc(dbInstance!, 'matches', id)))
            );
            const newMatchesMap: { [id: string]: Match } = {};
            fetchedDocs.forEach(d => {
              if (d.exists()) {
                newMatchesMap[d.id] = { id: d.id, ...d.data() } as Match;
              }
            });
            latestExtraMatches = { ...extraMatches, ...newMatchesMap };
            setExtraMatches(latestExtraMatches);
          }

          rawPreds.forEach((predData) => {
            const match = matches.find(m => m.id === predData.matchId) || latestExtraMatches[predData.matchId];
            if (match) {
              const isPastKickoff = new Date().getTime() > new Date(match.kickoffTime).getTime();
              if (match.status === MatchStatus.FINISHED || match.status === MatchStatus.LOCKED || isPastKickoff) {
                fetched.push(predData);
              }
            }
          });

          // Sort fetched by match date or ID
          fetched.sort((a, b) => {
            const matchA = matches.find(m => m.id === a.matchId) || latestExtraMatches[a.matchId];
            const matchB = matches.find(m => m.id === b.matchId) || latestExtraMatches[b.matchId];
            if (matchA && matchB) {
              return new Date(matchA.kickoffTime).getTime() - new Date(matchB.kickoffTime).getTime();
            }
            return 0;
          });
          setInspectedPredictions(fetched);
        } catch (error) {
          console.error("Error fetching inspected user predictions:", error);
        }
      }
      setIsLoadingInspected(false);
    };

    fetchAuditedPredictions();
  }, [selectedUser, predictions, matches, currentUser, isFirebase]);

  return (
    <div id="leaderboard-container" className="space-y-6">
      {/* Title + Search Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> Leaderboard standings
          </h2>
          <p className="text-xs text-slate-400">Tap on any participant to inspect their match-day predictions history.</p>
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search participant..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-11 pr-4 text-white text-xs placeholder-slate-500 focus:border-amber-500 outline-none transition"
          />
        </div>
      </div>

      {/* Leaderboard Table Grid */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                <th className="py-4 px-4 w-16 text-center">Rank</th>
                <th className="py-4 px-4">Participant</th>
                <th className="py-4 px-4 text-center">Total Points</th>
                <th className="py-4 px-4 text-center">Exacts (3p)</th>
                <th className="py-4 px-4 text-center">Outcomes (1p)</th>
                <th className="py-4 px-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredLeaderboard.length > 0 ? (
                filteredLeaderboard.map((player, idx) => {
                  const isMe = player.uid === currentUser?.uid;
                  return (
                    <motion.tr
                      key={player.uid}
                      onClick={() => setSelectedUser(player)}
                      className={`hover:bg-slate-850/60 transition cursor-pointer ${
                        isMe ? 'bg-amber-500/5 border-l-2 border-l-amber-500' : ''
                      }`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {/* Rank Col */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center">{getRankBadge(idx)}</div>
                      </td>

                      {/* Participant Details Col */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 font-semibold text-white text-xs md:text-sm">
                            <span className="truncate max-w-[140px] md:max-w-xs">{player.displayName}</span>
                            {isMe && (
                              <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                ME
                              </span>
                            )}
                            {player.isAdmin && (
                              <span className="text-[9px] bg-indigo-950/40 text-indigo-400 border border-indigo-500/10 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                Admin
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono truncate max-w-[180px] md:max-w-xs">
                            {/^[0-9]+$/.test(player.email) ? `ID: #${player.email}` : player.email}
                          </span>
                        </div>
                      </td>

                      {/* Total Points (Bold Display) */}
                      <td className="py-4 px-4 text-center">
                        <div className="text-base font-black font-mono text-amber-400 select-none">
                          {player.totalPoints} <span className="text-[10px] text-slate-400 font-semibold uppercase">PTS</span>
                        </div>
                      </td>

                      {/* Exact Bets count (3p) */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-slate-300 font-mono text-sm">
                          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                          <span>{player.exactScoresCount}</span>
                        </div>
                      </td>

                      {/* Correct Outcomes winner count (1p) */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-slate-300 font-mono text-sm">
                          <Award className="w-3.5 h-3.5 text-sky-400" />
                          <span>{player.correctOutcomesCount}</span>
                        </div>
                      </td>

                      {/* Chevron inspector link */}
                      <td className="py-4 px-4 text-center text-slate-500">
                        <ChevronRight className="w-4 h-4 stroke-[2]" />
                      </td>
                    </motion.tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                    No participants matched search entries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INDEPENDENT AUDITING DRAWER MODAL */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
            {/* Overlay click to exit */}
            <div className="absolute inset-0" onClick={() => setSelectedUser(null)} />
            
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="relative w-full max-w-lg bg-slate-950 border-l border-slate-800 h-full flex flex-col z-10 shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-bold text-base flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" /> Predictions Auditor
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Viewing locks and completed outcomes of <span className="font-semibold text-amber-400">{selectedUser.displayName}</span>.
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-bold text-sm leading-tight">{selectedUser.displayName}</h4>
                    <span className="text-[10px] text-slate-500 font-mono">{selectedUser.email}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black font-mono text-amber-400">{selectedUser.totalPoints} PTS</div>
                    <span className="text-[9px] uppercase font-bold text-slate-400">Total Score</span>
                  </div>
                </div>

                <h5 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Locked Match Preds {!isLoadingInspected ? `(${inspectedPredictions.length})` : ''}
                </h5>

                {isLoadingInspected ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center">
                    <span className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-xs text-slate-500 font-medium">Loading audited predictions...</p>
                  </div>
                ) : inspectedPredictions.length > 0 ? (
                  <div className="space-y-3">
                    {inspectedPredictions.map((pred) => {
                      const matchDetails = matches.find(m => m.id === pred.matchId) || extraMatches[pred.matchId];
                      if (!matchDetails) return null;

                      const isExact = matchDetails.status === MatchStatus.FINISHED && pred.status === PredictionStatus.EXACT_CORRECT;
                      const isWinner = matchDetails.status === MatchStatus.FINISHED && pred.status === PredictionStatus.WINNER_CORRECT;

                      return (
                        <div 
                          key={pred.id} 
                          className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                            isExact 
                              ? 'bg-amber-950/15 border-amber-500/20' 
                              : isWinner 
                                ? 'bg-slate-900 border-slate-850' 
                                : 'bg-slate-900/40 border-slate-900'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span className="font-mono bg-slate-950 px-1.5 py-0.5 rounded text-[9px]">{matchDetails.stage}</span>
                            <span className="text-slate-400 font-bold uppercase">{matchDetails.homeTeam} vs {matchDetails.awayTeam}</span>
                          </div>

                          <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">PREDICTED Score</span>
                              <span className="text-sm font-black font-mono text-white mt-0.5">
                                {pred.homePredicted} - {pred.awayPredicted}
                              </span>
                            </div>

                             <div className="flex flex-col text-center">
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">ACTUAL SCORE</span>
                              <span className="text-sm font-black font-mono text-slate-400 mt-0.5">
                                {matchDetails.status === MatchStatus.FINISHED 
                                  ? `${matchDetails.homeScore} - ${matchDetails.awayScore}`
                                  : matchDetails.status === MatchStatus.CANCELLED
                                    ? 'Cancelled'
                                    : 'Playing...'}
                              </span>
                            </div>

                            <div className="flex flex-col text-right">
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">AWARDED</span>
                              <span className={`text-sm font-black font-mono mt-0.5 ${
                                isExact ? 'text-amber-400' : isWinner ? 'text-slate-200' : 'text-slate-500'
                              }`}>
                                {matchDetails.status === MatchStatus.FINISHED 
                                  ? `+${pred.pointsAwarded} PTS` 
                                  : matchDetails.status === MatchStatus.CANCELLED
                                    ? 'Cancelled'
                                    : 'Locked'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-900/30 border border-slate-850 border-dashed rounded-xl">
                    <AlertCircle className="w-8 h-8 text-slate-650 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-medium">No locked or finished games predicted by this user.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
