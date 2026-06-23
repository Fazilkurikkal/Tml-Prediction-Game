import { PredictionStatus } from '../types';

/**
 * Calculates prediction points and status based on predicted and actual scores.
 * Supporting group stage draws and knockout stage penalty shootouts.
 */
export function calculatePoints(
  homePredicted: number,
  awayPredicted: number,
  homeActual: number,
  awayActual: number,
  isKnockout: boolean = false,
  predShootoutWinner?: 'home' | 'away' | null,
  actualShootoutWinner?: 'home' | 'away' | null
): { points: number; status: PredictionStatus } {
  // 1. Determine Predicted Winner
  let predictedWinner: 'home' | 'away' | 'draw' = 'draw';
  if (homePredicted > awayPredicted) {
    predictedWinner = 'home';
  } else if (homePredicted < awayPredicted) {
    predictedWinner = 'away';
  } else {
    if (isKnockout) {
      predictedWinner = predShootoutWinner || 'draw';
    } else {
      predictedWinner = 'draw';
    }
  }

  // 2. Determine Actual Winner
  let actualWinner: 'home' | 'away' | 'draw' = 'draw';
  if (homeActual > awayActual) {
    actualWinner = 'home';
  } else if (homeActual < awayActual) {
    actualWinner = 'away';
  } else {
    if (isKnockout) {
      actualWinner = actualShootoutWinner || 'draw';
    } else {
      actualWinner = 'draw';
    }
  }

  // 3. Score Matches Check
  const scoreMatches = homePredicted === homeActual && awayPredicted === awayActual;
  
  // For knockout tied score, exact correctness requires BOTH score match AND shootout winner match.
  let exactMatch = scoreMatches;
  if (isKnockout && scoreMatches && homePredicted === awayPredicted) {
    exactMatch = predShootoutWinner === actualShootoutWinner && !!predShootoutWinner;
  }

  if (exactMatch) {
    return {
      points: 3,
      status: PredictionStatus.EXACT_CORRECT
    };
  }

  // 4. Outcome Correct (1 point)
  // Win/Loss matched
  if (predictedWinner === actualWinner && predictedWinner !== 'draw') {
    return {
      points: 1,
      status: PredictionStatus.WINNER_CORRECT
    };
  }

  // Group stage Draw matched but different score (e.g., 1-1 predicted vs 2-2 actual)
  if (!isKnockout && predictedWinner === 'draw' && actualWinner === 'draw') {
    return {
      points: 1,
      status: PredictionStatus.WINNER_CORRECT
    };
  }

  // 5. Incorrect
  return {
    points: 0,
    status: PredictionStatus.INCORRECT
  };
}
