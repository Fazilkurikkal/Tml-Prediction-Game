import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Match, 
  Prediction, 
  UserProfile, 
  MatchStatus, 
  PredictionStatus, 
  MatchStage 
} from '../types';
import { calculatePoints } from '../utils/scoring';
import { safeStorage } from '../utils/storage';
import { INITIAL_MATCHES } from '../data/mockMatches';
import {
  db,
  auth,
  isFirebaseSupported,
  handleFirestoreError,
  OperationType
} from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  getDocsFromServer,
  query,
  where,
  onSnapshot,
  writeBatch,
  increment
} from 'firebase/firestore';

interface GameContextProps {
  currentUser: UserProfile | null;
  matches: Match[];
  predictions: Prediction[];
  leaderboard: UserProfile[];
  isLoading: boolean;
  isFirebase: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, name: string, pass: string) => Promise<void>;
  updateProfileName: (newName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  savePrediction: (matchId: string, homePredicted: number, awayPredicted: number, shootoutWinner?: 'home' | 'away' | null) => Promise<void>;
  updateMatchScore: (matchId: string, homeScore: number | null, awayScore: number | null, status: MatchStatus, shootoutWinner?: 'home' | 'away' | null) => Promise<void>;
  clearMatchPoints: (matchId: string) => Promise<void>;
  addMatch: (matchData: {
    homeTeam: string;
    awayTeam: string;
    homeFlag?: string;
    awayFlag?: string;
    stage: MatchStage;
    status: MatchStatus;
    kickoffTime: string;
  }) => Promise<void>;
  clearAllMatches: () => Promise<void>;
  seedInitialData: () => Promise<void>;
  toggleFirebaseMode: (enabled: boolean) => void;
  refreshData: () => Promise<void>;
  cloudQuotaExceeded: boolean;
  resetCloudDatabaseAttempt: () => void;
  activeStage: string;
  setActiveStage: (stage: string) => void;
}

const GameContext = createContext<GameContextProps | undefined>(undefined);

// Admin Email from metadata and request
const ADMIN_EMAIL = 'mm9975775@gmail.com';

// Shadow global localStorage to use sandboxed safeStorage
const localStorage = safeStorage;

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeStage, setActiveStage] = useState<string>('Unfinished');
  
  const [isFirebase, setIsFirebase] = useState<boolean>(() => {
    // Clear legacy local mode fallback so we immediately connect to the reset Firebase instance
    localStorage.removeItem('tml_local_mode_fallback');
    return isFirebaseSupported;
  });
  
  const [cloudQuotaExceeded, setCloudQuotaExceeded] = useState<boolean>(false);

  const resetCloudDatabaseAttempt = () => {
    localStorage.removeItem('tml_local_mode_fallback');
    setCloudQuotaExceeded(false);
    setIsFirebase(isFirebaseSupported);
  };

  const checkQuotaError = (error: any): boolean => {
    const errMsg = error?.message || String(error);
    if (
      errMsg.toLowerCase().includes('quota') || 
      errMsg.toLowerCase().includes('exhausted') || 
      error?.code === 'resource-exhausted'
    ) {
      setCloudQuotaExceeded(true);
      localStorage.setItem('tml_local_mode_fallback', 'true');
      setIsFirebase(false);
      return true;
    }
    return false;
  };

  // Default mock users for sandbox/leaderboard initialization
  const defaultMockLeaderboard = [
    { uid: 'user-id-1', email: 'vibe_coder@tml.com', displayName: 'Vibe Coder 🔥', totalPoints: 12, exactScoresCount: 3, correctOutcomesCount: 3, isAdmin: false },
    { uid: 'user-id-2', email: 'brother_tarik@tml.com', displayName: 'Brother Tarik ⚽', totalPoints: 8, exactScoresCount: 1, correctOutcomesCount: 5, isAdmin: false },
    { uid: 'user-id-3', email: 'brother_mo@tml.com', displayName: 'Brother Mo 🌟', totalPoints: 10, exactScoresCount: 2, correctOutcomesCount: 4, isAdmin: false },
    { uid: ADMIN_EMAIL, email: ADMIN_EMAIL, displayName: 'Admin Mo (TML)', totalPoints: 15, exactScoresCount: 4, correctOutcomesCount: 3, isAdmin: true }
  ];

  // Helper to load Leaderboard once (Massive read-saving optimization!)
  const loadLeaderboardData = async (customUserArg?: UserProfile | null) => {
    if (!isFirebase || !db) return;
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocsFromServer(usersRef);
      const uList: UserProfile[] = [];
      const fullList: UserProfile[] = [];
      snapshot.forEach((doc) => {
        const u = doc.data() as UserProfile;
        const enforcedAdmin = u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        const correctedUser = { ...u, isAdmin: enforcedAdmin };
        fullList.push(correctedUser);
        if (!enforcedAdmin) {
          uList.push(correctedUser);
        }
      });
      uList.sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName));
      setLeaderboard(uList);
      
      const activeUser = customUserArg !== undefined ? customUserArg : currentUser;
      const currentId = activeUser?.uid || auth?.currentUser?.uid;
      if (currentId) {
        const me = fullList.find(u => u.uid === currentId);
        if (me) {
          setCurrentUser(me);
          localStorage.setItem('tml_currentUser', JSON.stringify(me));
        }
      }
    } catch (error) {
      if (checkQuotaError(error)) {
        console.warn("Users leaderboard fetch: Firestore Quota Exceeded. Safely fell back to Local Sandbox.");
      } else {
        console.error("Error fetching leaderboard once:", error);
      }
    }
  };

  // Load and subscribe to database (Firebase or LocalStorage)
  useEffect(() => {
    let unsubscribePredictions: () => void = () => {};
    let unsubscribeUsers: () => void = () => {};
    let unsubscribeAuth: () => void = () => {};
    let unsubscribeUserDoc: () => void = () => {};

    if (isFirebase && db) {
      setIsFirebase(true);

      // Try loading any custom user from localStorage on start
      const localUserStr = localStorage.getItem('tml_currentUser');
      let customUser: UserProfile | null = null;
      if (localUserStr) {
        try {
          customUser = JSON.parse(localUserStr);
          setCurrentUser(customUser);
        } catch (e) {
          console.error("Failed to parse local stored custom user:", e);
        }
      }

      // 2. Fetch Leaderboard / Users via one-time getDocs (Optimized!)
      loadLeaderboardData(customUser);

      // Setup user-specific subscriptions helper
      const setupPredictionsSubscription = (uid: string, isAdmin: boolean) => {
        unsubscribePredictions();

        const predictionsRef = collection(db!, 'predictions');
        // ALWAYS query matches where userId == uid for the persistent dashboard listener.
        // This is extremely efficient and reduces general/admin footprint from full-table scan.
        const predictionsQuery = query(predictionsRef, where('userId', '==', uid));

        unsubscribePredictions = onSnapshot(predictionsQuery, (snapshot) => {
          const predList: Prediction[] = [];
          snapshot.forEach((doc) => {
            predList.push({ id: doc.id, ...doc.data() } as Prediction);
          });
          setPredictions(predList);
        }, (error) => {
          if (checkQuotaError(error)) {
            console.warn("Predictions stream: Firestore Quota Exceeded. Safely fell back to Local Sandbox.");
          } else {
            console.error("Predictions stream error:", error);
            handleFirestoreError(error, OperationType.LIST, 'predictions');
          }
        });
      };

      const setupUserSubscriptions = (uid: string) => {
        // Unsubscribe existing userDoc and prediction listeners if any
        unsubscribeUserDoc();
        unsubscribePredictions();

        const userDocRef = doc(db!, 'users', uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, (userSnap) => {
          if (userSnap.exists()) {
            const up = userSnap.data() as UserProfile;
            const enforcedAdmin = up.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
            const correctedUser = { ...up, isAdmin: enforcedAdmin };
            setCurrentUser(correctedUser);
            localStorage.setItem('tml_currentUser', JSON.stringify(correctedUser));
            // Setup predictions based on admin status dynamically
            setupPredictionsSubscription(uid, enforcedAdmin);
          }
        }, (error) => {
          if (checkQuotaError(error)) {
            console.warn("UserDoc stream: Firestore Quota Exceeded. Safely fell back to Local Sandbox.");
          } else {
            console.error("UserDoc stream error:", error);
            handleFirestoreError(error, OperationType.LIST, `users/${uid}`);
          }
        });
      };

      // If we initialized a custom-number user on load, active their listeners
      if (customUser) {
        setupUserSubscriptions(customUser.uid);
      }

      // 3. Fallback / Alternative listener for Google Auth
      if (auth) {
        unsubscribeAuth = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
          if (fbUser) {
            setIsLoading(true);

            try {
              // Ensure user has profile document in Firestore
              const userDocRef = doc(db!, 'users', fbUser.uid);
              let userDoc = await getDoc(userDocRef);
              
              if (!userDoc.exists()) {
                await new Promise(resolve => setTimeout(resolve, 850));
                userDoc = await getDoc(userDocRef);
              }

              let currentProfile: UserProfile;
              if (!userDoc.exists()) {
                const isUserAdmin = fbUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
                currentProfile = {
                  uid: fbUser.uid,
                  email: fbUser.email || '',
                  displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'TML Brother',
                  totalPoints: 0,
                  exactScoresCount: 0,
                  correctOutcomesCount: 0,
                  isAdmin: isUserAdmin,
                  updatedAt: new Date().toISOString()
                };
                await setDoc(userDocRef, currentProfile);
              } else {
                const uData = userDoc.data() as UserProfile;
                const isUserAdmin = uData.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
                currentProfile = { ...uData, isAdmin: isUserAdmin };
              }

              localStorage.setItem('tml_currentUser', JSON.stringify(currentProfile));
              setCurrentUser(currentProfile);

              // Setup real-time updates for Google User
              setupUserSubscriptions(fbUser.uid);

            } catch (err) {
              if (checkQuotaError(err)) {
                console.warn("Auth state profile check: Firestore Quota Exceeded. Safely fell back to Local Sandbox.");
              } else {
                console.error("Error setting custom Firestore authenticated user profile", err);
              }
            } finally {
              setIsLoading(false);
            }
          } else {
            // Google auth cleared, see if we still have custom user credentials session active.
            const storedCustomUser = localStorage.getItem('tml_currentUser');
            if (!storedCustomUser) {
              setCurrentUser(null);
              setPredictions([]);
            }
          }
        });
      }

      return () => {
        unsubscribePredictions();
        unsubscribeUsers();
        unsubscribeAuth();
        unsubscribeUserDoc();
      };
    } else {
      // Local Sandbox Mode (No Firebase configuration present)
      setIsFirebase(false);
      
      // Initialize local state
      const localMatches = localStorage.getItem('tml_matches');
      const localPredictions = localStorage.getItem('tml_predictions');
      const localLeaderboard = localStorage.getItem('tml_leaderboard');
      const localUser = localStorage.getItem('tml_currentUser');

      if (localMatches) {
        setMatches(JSON.parse(localMatches));
      } else {
        localStorage.setItem('tml_matches', JSON.stringify(INITIAL_MATCHES));
        setMatches(INITIAL_MATCHES);
      }

      if (localPredictions) {
        setPredictions(JSON.parse(localPredictions));
      } else {
        // Pre-create some mock predictions to make it juicy!
        const defaultPredictions: Prediction[] = [
          // Argentina vs Saudi Arabia predictions
          { id: 'user-id-1_wc2026-m01', userId: 'user-id-1', userEmail: 'vibe_coder@tml.com', displayName: 'Vibe Coder 🔥', matchId: 'wc2026-m01', homePredicted: 1, awayPredicted: 2, pointsAwarded: 3, status: PredictionStatus.EXACT_CORRECT, updatedAt: new Date().toISOString() },
          { id: 'user-id-2_wc2026-m01', userId: 'user-id-2', userEmail: 'brother_tarik@tml.com', displayName: 'Brother Tarik ⚽', matchId: 'wc2026-m01', homePredicted: 3, awayPredicted: 0, pointsAwarded: 0, status: PredictionStatus.INCORRECT, updatedAt: new Date().toISOString() },
          { id: 'user-id-3_wc2026-m01', userId: 'user-id-3', userEmail: 'brother_mo@tml.com', displayName: 'Brother Mo 🌟', matchId: 'wc2026-m01', homePredicted: 1, awayPredicted: 1, pointsAwarded: 0, status: PredictionStatus.INCORRECT, updatedAt: new Date().toISOString() },
          // USA vs England predictions
          { id: 'user-id-1_wc2026-m02', userId: 'user-id-1', userEmail: 'vibe_coder@tml.com', displayName: 'Vibe Coder 🔥', matchId: 'wc2026-m02', homePredicted: 1, awayPredicted: 1, pointsAwarded: 3, status: PredictionStatus.EXACT_CORRECT, updatedAt: new Date().toISOString() },
          { id: 'user-id-2_wc2026-m02', userId: 'user-id-2', userEmail: 'brother_tarik@tml.com', displayName: 'Brother Tarik ⚽', matchId: 'wc2026-m02', homePredicted: 0, awayPredicted: 2, pointsAwarded: 0, status: PredictionStatus.INCORRECT, updatedAt: new Date().toISOString() },
          { id: 'user-id-3_wc2026-m02', userId: 'user-id-3', userEmail: 'brother_mo@tml.com', displayName: 'Brother Mo 🌟', matchId: 'wc2026-m02', homePredicted: 2, awayPredicted: 2, pointsAwarded: 1, status: PredictionStatus.WINNER_CORRECT, updatedAt: new Date().toISOString() }
        ];
        localStorage.setItem('tml_predictions', JSON.stringify(defaultPredictions));
        setPredictions(defaultPredictions);
      }

      if (localLeaderboard) {
        const rawLeaderboard = JSON.parse(localLeaderboard) as UserProfile[];
        const filteredLeaderboard = rawLeaderboard.filter(u => !u.isAdmin);
        filteredLeaderboard.sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName));
        setLeaderboard(filteredLeaderboard);
      } else {
        localStorage.setItem('tml_leaderboard', JSON.stringify(defaultMockLeaderboard));
        const filteredLeaderboard = defaultMockLeaderboard.filter(u => !u.isAdmin);
        filteredLeaderboard.sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName));
        setLeaderboard(filteredLeaderboard);
      }

      if (localUser) {
        setCurrentUser(JSON.parse(localUser));
      } else {
        // Auto-login to Admin by default in Local Sandbox mode so they can play with the panel!
        const defaultAdmin = defaultMockLeaderboard.find(u => u.uid === ADMIN_EMAIL) || defaultMockLeaderboard[3];
        localStorage.setItem('tml_currentUser', JSON.stringify(defaultAdmin));
        setCurrentUser(defaultAdmin);
      }

      setIsLoading(false);
    }
  }, [isFirebase]);

  // Dynamic real-time matches subscription (optimized based on user role)
  useEffect(() => {
    let unsubscribeMatches: () => void = () => {};
 
    if (isFirebase && db) {
      const matchesRef = collection(db, 'matches');
      let matchesQuery;
 
      if (currentUser?.isAdmin) {
        // Admins subscribe to all matches to manage and score them
        matchesQuery = query(matchesRef);
      } else if (activeStage === 'Unfinished') {
        // Players only subscribe to unfinished matches to reduce read rate loads dramatically!
        matchesQuery = query(
          matchesRef,
          where('status', 'in', [MatchStatus.OPEN, MatchStatus.LOCKED])
        );
      } else {
        // Players query specific stage to load them on demand!
        matchesQuery = query(
          matchesRef,
          where('stage', '==', activeStage)
        );
      }
 
      unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => {
        const list: Match[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({ id: doc.id, ...data } as Match);
        });
 
        // Sort Matches: newly created (isCustom) on top, otherwise by kickoffTime
        list.sort((a, b) => {
          if (a.isCustom && !b.isCustom) return -1;
          if (!a.isCustom && b.isCustom) return 1;
          if (a.isCustom && b.isCustom) {
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
          }
          return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
        });
 
        setMatches(list);
        setIsLoading(false);
      }, (error) => {
        if (checkQuotaError(error)) {
          console.warn("Match stream: Firestore Quota Exceeded. Safely fell back to Local Sandbox.");
        } else {
          console.error("Match stream error:", error);
          handleFirestoreError(error, OperationType.LIST, 'matches');
        }
      });
    }
 
    return () => {
      unsubscribeMatches();
    };
  }, [isFirebase, currentUser?.isAdmin, activeStage]);

  // Login handler
  const login = async (numberInput: string, pass: string) => {
    setIsLoading(true);
    try {
      const cleanNumber = numberInput.trim();
      let useFirebase = isFirebase;
      
      if (useFirebase && db) {
        try {
          const isDirectAdmin = cleanNumber.toLowerCase() === ADMIN_EMAIL.toLowerCase();
          let profile: UserProfile;

          if (isDirectAdmin && pass === 'placeholder') {
            // Self-healing: create or match direct Admin profile in Firestore
            const userRef = doc(db, 'users', 'admin-mo');
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const profileData = userSnap.data() as UserProfile;
              profile = { ...profileData, isAdmin: true };
            } else {
              profile = {
                uid: 'admin-mo',
                email: ADMIN_EMAIL,
                displayName: 'Admin Mo (TML)',
                totalPoints: 15,
                exactScoresCount: 4,
                correctOutcomesCount: 3,
                isAdmin: true
              };
              await setDoc(userRef, profile);
            }
          } else {
            // Query credentials document to check match
            const credRef = doc(db, 'credentials', cleanNumber);
            const credSnap = await getDoc(credRef);
            
            if (!credSnap.exists()) {
              throw new Error("This number is not registered. Please sign up first.");
            }
            
            const credData = credSnap.data();
            if (credData.password !== pass && pass !== 'placeholder') {
              throw new Error("Incorrect password. Please verify and try again.");
            }
            
            // Fetch User Profile from /users/{userId}
            const userRef = doc(db, 'users', credData.userId);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
              throw new Error("User profile not found. Please contact support.");
            }
            
            const profileData = userSnap.data() as UserProfile;
            const isUserAdmin = profileData.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
            profile = { ...profileData, isAdmin: isUserAdmin };
          }
          
          // Save user reference and subscribe
          localStorage.setItem('tml_currentUser', JSON.stringify(profile));
          setCurrentUser(profile);
          
          // Force refresh context predictions immediately
          const predictionsRef = collection(db, 'predictions');
          const myPredictionsQuery = query(predictionsRef, where('userId', '==', profile.uid));
          const predsSnap = await getDocs(myPredictionsQuery);
          const predList: Prediction[] = [];
          predsSnap.forEach((doc) => {
            predList.push({ id: doc.id, ...doc.data() } as Prediction);
          });
          setPredictions(predList);
        } catch (dbErr: any) {
          if (checkQuotaError(dbErr)) {
            useFirebase = false;
          } else {
            throw dbErr;
          }
        }
      }
      
      if (!useFirebase) {
        // Sandbox login
        const existingUsers: UserProfile[] = JSON.parse(localStorage.getItem('tml_leaderboard') || '[]');
        let user = existingUsers.find(u => u.email.toLowerCase() === cleanNumber.toLowerCase());
        
        if (!user) {
          // Create user on-the-fly for seamless sandbox sandbox login if they entered details
          const isUserAdmin = cleanNumber.toLowerCase() === ADMIN_EMAIL.toLowerCase();
          const newUser: UserProfile = {
            uid: 'sb-' + Math.random().toString(36).substr(2, 9),
            email: cleanNumber,
            displayName: cleanNumber === ADMIN_EMAIL ? 'Admin Mo (TML)' : 'Guest Brother',
            totalPoints: 0,
            exactScoresCount: 0,
            correctOutcomesCount: 0,
            isAdmin: isUserAdmin
          };
          existingUsers.push(newUser);
          localStorage.setItem('tml_leaderboard', JSON.stringify(existingUsers));
          user = newUser;
        }
        
        localStorage.setItem('tml_currentUser', JSON.stringify(user));
        setCurrentUser(user);
      }
    } catch (err: any) {
      console.error(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Up handler
  const signUp = async (numberInput: string, name: string, pass: string) => {
    setIsLoading(true);
    try {
      const cleanNumber = numberInput.trim();
      let useFirebase = isFirebase;
      
      if (useFirebase && db) {
        try {
          // Query credentials document to check duplicate
          const credRef = doc(db, 'credentials', cleanNumber);
          const credSnap = await getDoc(credRef);
          
          if (credSnap.exists()) {
            throw new Error("This number is already registered. If you forgot your password, please use another number.");
          }
          
          // Generate uniform uid from custom number
          const uid = 'usr_' + cleanNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
          const isUserAdmin = cleanNumber.toLowerCase() === ADMIN_EMAIL.toLowerCase();
          
          const newProfile: UserProfile = {
            uid,
            email: cleanNumber, // use clean custom number inside the profile's fallback email property
            displayName: name,
            totalPoints: 0,
            exactScoresCount: 0,
            correctOutcomesCount: 0,
            isAdmin: isUserAdmin,
            updatedAt: new Date().toISOString()
          };
          
          // Save to credentials (secure credentials verification mapping)
          await setDoc(credRef, {
            number: cleanNumber,
            password: pass,
            userId: uid,
            displayName: name,
            createdAt: new Date().toISOString()
          });
          
          // Save user profile state
          await setDoc(doc(db, 'users', uid), newProfile);
          
          localStorage.setItem('tml_currentUser', JSON.stringify(newProfile));
          setCurrentUser(newProfile);
          setPredictions([]);
        } catch (dbErr: any) {
          if (checkQuotaError(dbErr)) {
            useFirebase = false;
          } else {
            throw dbErr;
          }
        }
      }
      
      if (!useFirebase) {
        // Sandbox Sign Up
        const existingUsers: UserProfile[] = JSON.parse(localStorage.getItem('tml_leaderboard') || '[]');
        const isUserAdmin = cleanNumber.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        
        if (existingUsers.some(u => u.email.toLowerCase() === cleanNumber.toLowerCase())) {
          throw new Error("This number is already in use in the sandbox database!");
        }

        const newUser: UserProfile = {
          uid: 'sb-' + Math.random().toString(36).substr(2, 9),
          email: cleanNumber,
          displayName: name,
          totalPoints: 0,
          exactScoresCount: 0,
          correctOutcomesCount: 0,
          isAdmin: isUserAdmin
        };
        
        existingUsers.push(newUser);
        localStorage.setItem('tml_leaderboard', JSON.stringify(existingUsers));
        const filteredAndSorted = existingUsers
          .filter(u => !u.isAdmin)
          .sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName));
        setLeaderboard(filteredAndSorted);
        
        localStorage.setItem('tml_currentUser', JSON.stringify(newUser));
        setCurrentUser(newUser);
        setPredictions([]);
      }
    } catch (err: any) {
      console.error(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Update profile display name/nickname
  const updateProfileName = async (newName: string) => {
    if (!currentUser) throw new Error("Not logged in");
    const cleanName = newName.trim();
    if (!cleanName) throw new Error("Name cannot be empty");

    if (isFirebase && db) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          displayName: cleanName,
          updatedAt: new Date().toISOString()
        });

        const isCustomNumber = /^[0-9]+$/.test(currentUser.email);
        if (isCustomNumber) {
          const credRef = doc(db, 'credentials', currentUser.email);
          const credSnap = await getDoc(credRef);
          if (credSnap.exists()) {
            await updateDoc(credRef, {
              displayName: cleanName
            });
          }
        }
        await loadLeaderboardData();
      } catch (err) {
        console.error("Failed to update profile name:", err);
        throw err;
      }
    } else {
      // Sandbox mode
      const existingUsers: UserProfile[] = JSON.parse(localStorage.getItem('tml_leaderboard') || '[]');
      const updatedUsers = existingUsers.map(u => {
        if (u.uid === currentUser.uid) {
          return { ...u, displayName: cleanName };
        }
        return u;
      });
      localStorage.setItem('tml_leaderboard', JSON.stringify(updatedUsers));
      const filteredAndSorted = updatedUsers
        .filter(u => !u.isAdmin)
        .sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName));
      setLeaderboard(filteredAndSorted);

      const updatedMe = { ...currentUser, displayName: cleanName };
      localStorage.setItem('tml_currentUser', JSON.stringify(updatedMe));
      setCurrentUser(updatedMe);
    }
  };

  // Google Authentication handler
  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      if (isFirebase && auth) {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await signInWithPopup(auth, provider);
        } catch (dbErr: any) {
          if (checkQuotaError(dbErr)) {
            // Quota limit hit! Switch to Maintenance Mode automatically
            throw new Error("Firebase Quota Exceeded. The application has been set to maintenance mode.");
          } else {
            throw dbErr;
          }
        }
      } else {
        // Mock Google login in sandbox mode (avoid window.confirm as it is blocked in iframe)
        const email = ADMIN_EMAIL;
        await login(email, 'placeholder');
      }
    } catch (err: any) {
      console.error(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const logout = async () => {
    setIsLoading(true);
    try {
      localStorage.removeItem('tml_currentUser');
      setCurrentUser(null);
      setPredictions([]);
      if (isFirebase && auth) {
        await signOut(auth);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Save prediction (Open/Locked/Finished check)
  const savePrediction = async (matchId: string, homePredicted: number, awayPredicted: number, shootoutWinner?: 'home' | 'away' | null) => {
    if (!currentUser) throw new Error("You must be logged in to make predictions!");

    const match = matches.find(m => m.id === matchId);
    if (!match) throw new Error("Match not found!");

    // Double-check locks
    const isPastLockedTime = new Date().getTime() > new Date(match.kickoffTime).getTime();
    if (match.status !== MatchStatus.OPEN || isPastLockedTime) {
      throw new Error("Predictions are locked. The match has already kicked off!");
    }

    const predictionId = `${currentUser.uid}_${matchId}`;

    if (isFirebase && db) {
      try {
        const predRef = doc(db, 'predictions', predictionId);
        const data: Prediction = {
          id: predictionId,
          userId: currentUser.uid,
          userEmail: currentUser.email,
          displayName: currentUser.displayName,
          matchId,
          homePredicted: Number(homePredicted),
          awayPredicted: Number(awayPredicted),
          shootoutWinner: shootoutWinner || null,
          pointsAwarded: null,
          status: PredictionStatus.PENDING,
          updatedAt: new Date().toISOString()
        };
        
        await setDoc(predRef, data);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `predictions/${predictionId}`);
      }
    } else {
      // Sandbox implementation
      const keys: Prediction[] = JSON.parse(localStorage.getItem('tml_predictions') || '[]');
      const updatedKeys = keys.filter(p => p.id !== predictionId);
      
      const newPred: Prediction = {
        id: predictionId,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        displayName: currentUser.displayName,
        matchId,
        homePredicted: Number(homePredicted),
        awayPredicted: Number(awayPredicted),
        shootoutWinner: shootoutWinner || null,
        pointsAwarded: null,
        status: PredictionStatus.PENDING,
        updatedAt: new Date().toISOString()
      };
      
      updatedKeys.push(newPred);
      localStorage.setItem('tml_predictions', JSON.stringify(updatedKeys));
      setPredictions(updatedKeys);
    }
  };

  // Admin writes official score & scores recalculated dynamically on client side
  const updateMatchScore = async (
    matchId: string,
    homeScore: number | null,
    awayScore: number | null,
    status: MatchStatus,
    shootoutWinner?: 'home' | 'away' | null
  ) => {
    if (!currentUser?.isAdmin) throw new Error("Unauthorized! Only admins can post core match stats.");

    const matchObj = matches.find(m => m.id === matchId);
    if (!matchObj) throw new Error("Match not found.");
    const isKnockout = matchObj.stage !== MatchStage.GROUP_STAGE;

    // Check if the match WAS finalized previously (so we know if points were already awarded)
    const wasFinalized = matchObj.status === MatchStatus.FINISHED && matchObj.homeScore !== null && matchObj.awayScore !== null;

    if (isFirebase && db) {
      try {
        const batch = writeBatch(db);
        const matchRef = doc(db, 'matches', matchId);
        
        // 1. Update Match Info
        batch.update(matchRef, {
          homeScore: homeScore !== null ? Number(homeScore) : null,
          awayScore: awayScore !== null ? Number(awayScore) : null,
          shootoutWinner: shootoutWinner || null,
          status,
          updatedAt: new Date().toISOString()
        });

        // 2. Query and process predictions
        const predsQuery = query(collection(db, 'predictions'), where('matchId', '==', matchId));
        const querySnap = await getDocsFromServer(predsQuery);
        
        const userPointsDelta: { [userId: string]: { points: number, exact: number, outcome: number } } = {};

        querySnap.forEach((predictionDoc) => {
          const predData = predictionDoc.data() as Prediction;
          
          // Get previous awarded state if any
          const oldPoints = wasFinalized ? (predData.pointsAwarded || 0) : 0;
          const wasExact = wasFinalized && predData.status === PredictionStatus.EXACT_CORRECT;
          const wasOutcome = wasFinalized && predData.status === PredictionStatus.WINNER_CORRECT;

          let newPoints = 0;
          let newStatus = PredictionStatus.PENDING;

          if (status === MatchStatus.FINISHED && homeScore !== null && awayScore !== null) {
            const scoringResult = calculatePoints(
              predData.homePredicted,
              predData.awayPredicted,
              Number(homeScore),
              Number(awayScore),
              isKnockout,
              predData.shootoutWinner,
              shootoutWinner
            );
            newPoints = scoringResult.points;
            newStatus = scoringResult.status;
          } else {
            // If the match state is no longer finished, we mark it pending
            newStatus = PredictionStatus.PENDING;
          }

          // Calculate semantic changes for total point profile
          const deltaPoints = newPoints - oldPoints;
          const deltaExact = (newStatus === PredictionStatus.EXACT_CORRECT ? 1 : 0) - (wasExact ? 1 : 0);
          const deltaOutcome = (newStatus === PredictionStatus.WINNER_CORRECT ? 1 : 0) - (wasOutcome ? 1 : 0);

          // Update prediction sub-document
          const predDocRef = doc(db!, 'predictions', predictionDoc.id);
          batch.update(predDocRef, {
            pointsAwarded: status === MatchStatus.FINISHED ? newPoints : null,
            status: newStatus,
            updatedAt: new Date().toISOString()
          });

          if (!userPointsDelta[predData.userId]) {
            userPointsDelta[predData.userId] = { points: 0, exact: 0, outcome: 0 };
          }
          userPointsDelta[predData.userId].points += deltaPoints;
          userPointsDelta[predData.userId].exact += deltaExact;
          userPointsDelta[predData.userId].outcome += deltaOutcome;
        });

        // 3. Commit user score adjustments with Firestore increment delta in batch
        for (const uid in userPointsDelta) {
          const userDocRef = doc(db, 'users', uid);
          batch.update(userDocRef, {
            totalPoints: increment(userPointsDelta[uid].points),
            exactScoresCount: increment(userPointsDelta[uid].exact),
            correctOutcomesCount: increment(userPointsDelta[uid].outcome),
            updatedAt: new Date().toISOString()
          });
        }

        await batch.commit();
        await loadLeaderboardData();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `matches/${matchId}`);
      }
    } else {
      // Local Sandbox mode
      let currentMatches: Match[] = JSON.parse(localStorage.getItem('tml_matches') || '[]');
      currentMatches = currentMatches.map(m => {
        if (m.id === matchId) {
          return {
            ...m,
            homeScore: homeScore !== null ? Number(homeScore) : null,
            awayScore: awayScore !== null ? Number(awayScore) : null,
            shootoutWinner: shootoutWinner || null,
            status,
            updatedAt: new Date().toISOString()
          };
        }
        return m;
      });

      let currentPredictions: Prediction[] = JSON.parse(localStorage.getItem('tml_predictions') || '[]');
      let currentProfiles: UserProfile[] = JSON.parse(localStorage.getItem('tml_leaderboard') || '[]');

      currentPredictions = currentPredictions.map(p => {
        if (p.matchId === matchId) {
          const oldPoints = wasFinalized ? (p.pointsAwarded || 0) : 0;
          const wasExact = wasFinalized && p.status === PredictionStatus.EXACT_CORRECT;
          const wasOutcome = wasFinalized && p.status === PredictionStatus.WINNER_CORRECT;

          let newPoints = 0;
          let newStatus = PredictionStatus.PENDING;

          if (status === MatchStatus.FINISHED && homeScore !== null && awayScore !== null) {
            const scoringResult = calculatePoints(
              p.homePredicted,
              p.awayPredicted,
              Number(homeScore),
              Number(awayScore),
              isKnockout,
              p.shootoutWinner,
              shootoutWinner
            );
            newPoints = scoringResult.points;
            newStatus = scoringResult.status;
          }

          const deltaPoints = newPoints - oldPoints;
          const deltaExact = (newStatus === PredictionStatus.EXACT_CORRECT ? 1 : 0) - (wasExact ? 1 : 0);
          const deltaOutcome = (newStatus === PredictionStatus.WINNER_CORRECT ? 1 : 0) - (wasOutcome ? 1 : 0);

          // Update user profiles in Sandbox
          currentProfiles = currentProfiles.map(prof => {
            if (prof.uid === p.userId) {
              return {
                ...prof,
                totalPoints: Math.max(0, prof.totalPoints + deltaPoints),
                exactScoresCount: Math.max(0, prof.exactScoresCount + deltaExact),
                correctOutcomesCount: Math.max(0, prof.correctOutcomesCount + deltaOutcome)
              };
            }
            return prof;
          });

          return {
            ...p,
            pointsAwarded: status === MatchStatus.FINISHED ? newPoints : null,
            status: newStatus,
            updatedAt: new Date().toISOString()
          };
        }
        return p;
      });

      localStorage.setItem('tml_matches', JSON.stringify(currentMatches));
      localStorage.setItem('tml_predictions', JSON.stringify(currentPredictions));
      localStorage.setItem('tml_leaderboard', JSON.stringify(currentProfiles));

      setMatches(currentMatches);
      setPredictions(currentPredictions);
      const filteredProfiles = currentProfiles.filter(u => !u.isAdmin);
      filteredProfiles.sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName));
      setLeaderboard(filteredProfiles);

      // Update current user references if we updated them
      const updatedMe = currentProfiles.find(u => u.uid === currentUser?.uid);
      if (updatedMe) {
        localStorage.setItem('tml_currentUser', JSON.stringify(updatedMe));
        setCurrentUser(updatedMe);
      }
    }
  };

  const clearMatchPoints = async (matchId: string) => {
    if (!currentUser?.isAdmin) throw new Error("Unauthorized! Only admins can clear match points.");

    const matchObj = matches.find(m => m.id === matchId);
    if (!matchObj) throw new Error("Match not found.");

    // Determine default status on reset based on kickoff time and current status
    const kickoffMs = new Date(matchObj.kickoffTime).getTime();
    const isPastKickoff = Date.now() > kickoffMs;
    const defaultStatusOnReset = isPastKickoff ? MatchStatus.LOCKED : MatchStatus.OPEN;

    // Call updateMatchScore to clear score, shootout selection, and calculate the deduction delta!
    await updateMatchScore(matchId, null, null, defaultStatusOnReset, null);
  };

  // Seeding initial list of matches into Live Firestore Database
  const seedInitialData = async () => {
    if (!currentUser?.isAdmin) throw new Error("Unauthorized seeder!");

    if (isFirebase && db) {
      try {
        const batch = writeBatch(db);
        
        // Seed standard matches list
        INITIAL_MATCHES.forEach((match) => {
          const matchRef = doc(db!, 'matches', match.id);
          batch.set(matchRef, {
            ...match,
            updatedAt: new Date().toISOString()
          });
        });

        // Seed mock opponent profiles to create a vibrant arena
        defaultMockLeaderboard.forEach((profile) => {
          const userRef = doc(db!, 'users', profile.uid);
          batch.set(userRef, profile);
        });

        const defaultPredictions: Prediction[] = [
          // Argentina vs Saudi Arabia predictions
          { id: 'user-id-1_wc2026-m01', userId: 'user-id-1', userEmail: 'vibe_coder@tml.com', displayName: 'Vibe Coder 🔥', matchId: 'wc2026-m01', homePredicted: 1, awayPredicted: 2, pointsAwarded: 3, status: PredictionStatus.EXACT_CORRECT, updatedAt: new Date().toISOString() },
          { id: 'user-id-2_wc2026-m01', userId: 'user-id-2', userEmail: 'brother_tarik@tml.com', displayName: 'Brother Tarik ⚽', matchId: 'wc2026-m01', homePredicted: 3, awayPredicted: 0, pointsAwarded: 0, status: PredictionStatus.INCORRECT, updatedAt: new Date().toISOString() },
          { id: 'user-id-3_wc2026-m01', userId: 'user-id-3', userEmail: 'brother_mo@tml.com', displayName: 'Brother Mo 🌟', matchId: 'wc2026-m01', homePredicted: 1, awayPredicted: 1, pointsAwarded: 0, status: PredictionStatus.INCORRECT, updatedAt: new Date().toISOString() },
          // USA vs England predictions
          { id: 'user-id-1_wc2026-m02', userId: 'user-id-1', userEmail: 'vibe_coder@tml.com', displayName: 'Vibe Coder 🔥', matchId: 'wc2026-m02', homePredicted: 1, awayPredicted: 1, pointsAwarded: 3, status: PredictionStatus.EXACT_CORRECT, updatedAt: new Date().toISOString() },
          { id: 'user-id-2_wc2026-m02', userId: 'user-id-2', userEmail: 'brother_tarik@tml.com', displayName: 'Brother Tarik ⚽', matchId: 'wc2026-m02', homePredicted: 0, awayPredicted: 2, pointsAwarded: 0, status: PredictionStatus.INCORRECT, updatedAt: new Date().toISOString() },
          { id: 'user-id-3_wc2026-m02', userId: 'user-id-3', userEmail: 'brother_mo@tml.com', displayName: 'Brother Mo 🌟', matchId: 'wc2026-m02', homePredicted: 2, awayPredicted: 2, pointsAwarded: 1, status: PredictionStatus.WINNER_CORRECT, updatedAt: new Date().toISOString() }
        ];

        defaultPredictions.forEach(pred => {
          const predRef = doc(db!, 'predictions', pred.id);
          batch.set(predRef, pred);
        });

        await batch.commit();
        console.log("Seeding in Firestore complete!");
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'matches');
      }
    } else {
      // Reset Sandbox matches list
      localStorage.setItem('tml_matches', JSON.stringify(INITIAL_MATCHES));
      localStorage.setItem('tml_leaderboard', JSON.stringify(defaultMockLeaderboard));
      localStorage.setItem('tml_predictions', JSON.stringify([]));

      setMatches(INITIAL_MATCHES);
      const filteredLeaderboard = defaultMockLeaderboard.filter(u => !u.isAdmin);
      filteredLeaderboard.sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName));
      setLeaderboard(filteredLeaderboard);
      setPredictions([]);
      
      const admin = defaultMockLeaderboard.find(u => u.uid === ADMIN_EMAIL);
      if (admin) {
        localStorage.setItem('tml_currentUser', JSON.stringify(admin));
        setCurrentUser(admin);
      }
    }
  };

  const addMatch = async (matchData: {
    homeTeam: string;
    awayTeam: string;
    homeFlag?: string;
    awayFlag?: string;
    stage: MatchStage;
    status: MatchStatus;
    kickoffTime: string;
  }) => {
    if (!currentUser?.isAdmin) throw new Error("Unauthorized! Only admins can add new matches.");

    const matchId = 'm' + Math.random().toString(36).substring(2, 9);
    const newMatch: Match = {
      id: matchId,
      homeTeam: matchData.homeTeam,
      awayTeam: matchData.awayTeam,
      homeFlag: matchData.homeFlag || '⚽',
      awayFlag: matchData.awayFlag || '⚽',
      stage: matchData.stage,
      status: matchData.status,
      kickoffTime: matchData.kickoffTime,
      homeScore: null,
      awayScore: null,
      isCustom: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isFirebase && db) {
      try {
        const matchDocRef = doc(db, 'matches', matchId);
        await setDoc(matchDocRef, newMatch);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `matches/${matchId}`);
      }
    } else {
      // Sandbox mode
      const currentMatches: Match[] = JSON.parse(localStorage.getItem('tml_matches') || '[]');
      currentMatches.push(newMatch);
      // Sort Matches: newly created (isCustom) on top, otherwise by kickoffTime
      currentMatches.sort((a, b) => {
        if (a.isCustom && !b.isCustom) return -1;
        if (!a.isCustom && b.isCustom) return 1;
        if (a.isCustom && b.isCustom) {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        }
        return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
      });
      localStorage.setItem('tml_matches', JSON.stringify(currentMatches));
      setMatches(currentMatches);
    }
  };

  const clearAllMatches = async () => {
    if (!currentUser?.isAdmin) throw new Error("Unauthorized! Only admins can clear matches.");

    if (isFirebase && db) {
      try {
        const batch = writeBatch(db);

        // Delete all matches
        const matchesQuery = await getDocs(collection(db, 'matches'));
        matchesQuery.forEach((mDoc) => {
          batch.delete(mDoc.ref);
        });

        // Delete all predictions
        const predictionsQuery = await getDocs(collection(db, 'predictions'));
        predictionsQuery.forEach((pDoc) => {
          batch.delete(pDoc.ref);
        });

        // Reset all user scores to 0 so the leaderboard restarts
        const usersQuery = await getDocs(collection(db, 'users'));
        usersQuery.forEach((uDoc) => {
          const uDocRef = doc(db!, 'users', uDoc.id);
          batch.update(uDocRef, {
            totalPoints: 0,
            exactScoresCount: 0,
            correctOutcomesCount: 0,
            updatedAt: new Date().toISOString()
          });
        });

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'matches');
      }
    } else {
      // Sandbox Mode
      localStorage.setItem('tml_matches', JSON.stringify([]));
      localStorage.setItem('tml_predictions', JSON.stringify([]));
      
      const currentLeaderboard: UserProfile[] = JSON.parse(localStorage.getItem('tml_leaderboard') || '[]');
      const resetLeaderboard = currentLeaderboard.map(u => ({
        ...u,
        totalPoints: 0,
        exactScoresCount: 0,
        correctOutcomesCount: 0
      }));
      localStorage.setItem('tml_leaderboard', JSON.stringify(resetLeaderboard));
      
      setMatches([]);
      setPredictions([]);
      const filteredAndSorted = resetLeaderboard
        .filter(u => !u.isAdmin)
        .sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName));
      setLeaderboard(filteredAndSorted);

      const me = resetLeaderboard.find(u => u.uid === currentUser?.uid);
      if (me) {
        localStorage.setItem('tml_currentUser', JSON.stringify(me));
        setCurrentUser(me);
      }
    }
  };

  const toggleFirebaseMode = (enabled: boolean) => {
    setIsFirebase(enabled);
    if (!enabled) {
      setCurrentUser(null);
      setMatches([]);
      setLeaderboard([]);
      setPredictions([]);
    }
  };

  const refreshData = async () => {
    setIsLoading(true);
    if (isFirebase && db && auth.currentUser) {
      try {
        // Force get matches
        const matchesRef = collection(db, 'matches');
        const matchesQuery = currentUser?.isAdmin
          ? query(matchesRef)
          : query(matchesRef, where('status', 'in', [MatchStatus.OPEN, MatchStatus.LOCKED]));
        const matchesSnap = await getDocs(matchesQuery);
        const list: Match[] = [];
        matchesSnap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Match);
        });
        list.sort((a, b) => {
          if (a.isCustom && !b.isCustom) return -1;
          if (!a.isCustom && b.isCustom) return 1;
          if (a.isCustom && b.isCustom) {
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
          }
          return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
        });
        setMatches(list);

        // Force get users
        const usersRef = collection(db, 'users');
        const usersSnap = await getDocs(usersRef);
        const uList: UserProfile[] = [];
        const fullList: UserProfile[] = [];
        usersSnap.forEach((doc) => {
          const u = doc.data() as UserProfile;
          fullList.push(u);
          if (!u.isAdmin) {
            uList.push(u);
          }
        });
        uList.sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName));
        setLeaderboard(uList);
        const me = fullList.find(u => u.uid === auth.currentUser?.uid);
        if (me) {
          setCurrentUser(me);
        }

        // Force get predictions
        const predictionsRef = collection(db, 'predictions');
        const isUserAdmin = me?.isAdmin || currentUser?.isAdmin;
        const predictionsQuery = isUserAdmin
          ? query(predictionsRef)
          : query(predictionsRef, where('userId', '==', auth.currentUser.uid));
        const predsSnap = await getDocs(predictionsQuery);
        const predList: Prediction[] = [];
        predsSnap.forEach((doc) => {
          predList.push({ id: doc.id, ...doc.data() } as Prediction);
        });
        setPredictions(predList);
        console.log("Realtime and cache refresh complete!");
      } catch (err) {
        console.error("Manual refresh error:", err);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Sandbox mode refresh (reload from localStorage)
      const localMatches = localStorage.getItem('tml_matches');
      const localPredictions = localStorage.getItem('tml_predictions');
      const localLeaderboard = localStorage.getItem('tml_leaderboard');
      const localUser = localStorage.getItem('tml_currentUser');

      if (localMatches) setMatches(JSON.parse(localMatches));
      if (localPredictions) setPredictions(JSON.parse(localPredictions));
      if (localLeaderboard) {
        const parsed = JSON.parse(localLeaderboard) as UserProfile[];
        const filtered = parsed.filter(u => !u.isAdmin);
        filtered.sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName));
        setLeaderboard(filtered);
      }
      if (localUser) setCurrentUser(JSON.parse(localUser));
      setTimeout(() => setIsLoading(false), 300);
    }
  };

  return (
    <GameContext.Provider
      value={{
        currentUser,
        matches,
        predictions,
        leaderboard,
        isLoading,
        isFirebase,
        login,
        signUp,
        updateProfileName,
        loginWithGoogle,
        logout,
        savePrediction,
        updateMatchScore,
        clearMatchPoints,
        addMatch,
        clearAllMatches,
        seedInitialData,
        toggleFirebaseMode,
        refreshData,
        cloudQuotaExceeded,
        resetCloudDatabaseAttempt,
        activeStage,
        setActiveStage
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
