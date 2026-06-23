/**
 * Types and interfaces for TML Brothers Prediction Game
 */

export enum MatchStage {
  GROUP_STAGE = 'Group Stage',
  ROUND_OF_32 = 'Round of 32',
  ROUND_OF_16 = 'Round of 16',
  QUARTERFINALS = 'Quarterfinals',
  SEMIFINALS = 'Semifinals',
  FINAL = 'Final'
}

export enum MatchStatus {
  OPEN = 'Open',
  LOCKED = 'Locked',
  FINISHED = 'Finished',
  CANCELLED = 'Cancelled'
}

export enum PredictionStatus {
  PENDING = 'Pending',
  EXACT_CORRECT = 'ExactCorrect',   // 3 points
  WINNER_CORRECT = 'WinnerCorrect', // 1 point
  INCORRECT = 'Incorrect'           // 0 points
}

export interface Match {
  id: string; // matches document ID as matchId
  homeTeam: string;
  awayTeam: string;
  homeFlag?: string; // Emoji or short code
  awayFlag?: string; // Emoji or short code
  stage: MatchStage;
  status: MatchStatus;
  kickoffTime: string; // ISO LocalDateTime format: e.g. '2026-06-15T18:00:00Z'
  homeScore: number | null; // null if not finished
  awayScore: number | null; // null if not finished
  shootoutWinner?: 'home' | 'away' | null;
  isCustom?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Prediction {
  id: string; // predictionId is userUid_matchId
  userId: string;
  userEmail: string;
  displayName: string;
  matchId: string;
  homePredicted: number;
  awayPredicted: number;
  shootoutWinner?: 'home' | 'away' | null;
  pointsAwarded: number | null; // null until matched is Finished
  status: PredictionStatus;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  totalPoints: number;
  exactScoresCount: number;
  correctOutcomesCount: number;
  isAdmin: boolean;
  updatedAt?: string;
  rank?: number;
}
