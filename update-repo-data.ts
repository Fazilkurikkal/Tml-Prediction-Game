import * as fs from 'fs';
import * as path from 'path';

// Define paths
const exportDir = path.join(process.cwd(), 'firebase_data_export');
const targetDataDir = path.join(process.cwd(), 'src', 'data');

if (!fs.existsSync(targetDataDir)) {
  fs.mkdirSync(targetDataDir, { recursive: true });
}

// 1. Copy all JSON files from firebase_data_export to src/data
const jsonFiles = ['credentials.json', 'leaderboard.json', 'matches.json', 'predictions.json', 'test.json', 'users.json'];

for (const file of jsonFiles) {
  const sourcePath = path.join(exportDir, file);
  const destPath = path.join(targetDataDir, file);
  
  if (fs.existsSync(sourcePath)) {
    const content = fs.readFileSync(sourcePath, 'utf8');
    fs.writeFileSync(destPath, content, 'utf8');
    console.log(`Copied ${file} to src/data/${file}`);
  } else {
    console.warn(`Source file not found: ${sourcePath}`);
  }
}

// 2. Generate src/data/mockMatches.ts using matches.json
const matchesJsonPath = path.join(exportDir, 'matches.json');
if (fs.existsSync(matchesJsonPath)) {
  const matches = JSON.parse(fs.readFileSync(matchesJsonPath, 'utf8'));
  
  // Format each match to typescript
  let tsContent = `import { Match, MatchStage, MatchStatus } from '../types';\n\n`;
  tsContent += `export const INITIAL_MATCHES: Match[] = [\n`;
  
  for (const match of matches) {
    // Map stage enum correctly
    let stageEnumStr = 'MatchStage.GROUP_STAGE';
    const rawStage = match.stage || '';
    if (rawStage === 'Round of 32' || rawStage === 'ROUND_OF_32') stageEnumStr = 'MatchStage.ROUND_OF_32';
    else if (rawStage === 'Round of 16' || rawStage === 'ROUND_OF_16') stageEnumStr = 'MatchStage.ROUND_OF_16';
    else if (rawStage === 'Quarterfinals' || rawStage === 'QUARTERFINALS') stageEnumStr = 'MatchStage.QUARTERFINALS';
    else if (rawStage === 'Semifinals' || rawStage === 'SEMIFINALS') stageEnumStr = 'MatchStage.SEMIFINALS';
    else if (rawStage === 'Final' || rawStage === 'FINAL') stageEnumStr = 'MatchStage.FINAL';
    else stageEnumStr = 'MatchStage.GROUP_STAGE';
    
    // Map status enum correctly
    let statusEnumStr = 'MatchStatus.OPEN';
    const rawStatus = match.status || '';
    if (rawStatus === 'Locked' || rawStatus === 'LOCKED') statusEnumStr = 'MatchStatus.LOCKED';
    else if (rawStatus === 'Finished' || rawStatus === 'FINISHED') statusEnumStr = 'MatchStatus.FINISHED';
    else if (rawStatus === 'Cancelled' || rawStatus === 'CANCELLED') statusEnumStr = 'MatchStatus.CANCELLED';
    else statusEnumStr = 'MatchStatus.OPEN';
    
    tsContent += `  {\n`;
    tsContent += `    id: ${JSON.stringify(match.id || match._id)},\n`;
    tsContent += `    homeTeam: ${JSON.stringify(match.homeTeam || '')},\n`;
    tsContent += `    awayTeam: ${JSON.stringify(match.awayTeam || '')},\n`;
    if (match.homeFlag !== undefined) tsContent += `    homeFlag: ${JSON.stringify(match.homeFlag)},\n`;
    if (match.awayFlag !== undefined) tsContent += `    awayFlag: ${JSON.stringify(match.awayFlag)},\n`;
    tsContent += `    stage: ${stageEnumStr},\n`;
    tsContent += `    status: ${statusEnumStr},\n`;
    tsContent += `    kickoffTime: ${JSON.stringify(match.kickoffTime || '')},\n`;
    tsContent += `    homeScore: ${match.homeScore !== undefined && match.homeScore !== null ? match.homeScore : 'null'},\n`;
    tsContent += `    awayScore: ${match.awayScore !== undefined && match.awayScore !== null ? match.awayScore : 'null'},\n`;
    if (match.shootoutWinner !== undefined && match.shootoutWinner !== null) {
      tsContent += `    shootoutWinner: ${JSON.stringify(match.shootoutWinner)},\n`;
    }
    if (match.isCustom !== undefined) {
      tsContent += `    isCustom: ${match.isCustom},\n`;
    }
    if (match.createdAt !== undefined) {
      tsContent += `    createdAt: ${JSON.stringify(match.createdAt)},\n`;
    }
    if (match.updatedAt !== undefined) {
      tsContent += `    updatedAt: ${JSON.stringify(match.updatedAt)},\n`;
    }
    tsContent += `  },\n`;
  }
  
  tsContent += `];\n`;
  
  const mockMatchesTsPath = path.join(targetDataDir, 'mockMatches.ts');
  fs.writeFileSync(mockMatchesTsPath, tsContent, 'utf8');
  console.log(`Generated mockMatches.ts at src/data/mockMatches.ts with ${matches.length} matches!`);
} else {
  console.error('matches.json not found to generate mockMatches.ts');
}
