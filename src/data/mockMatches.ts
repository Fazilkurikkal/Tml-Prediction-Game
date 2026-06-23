import { Match, MatchStage, MatchStatus } from '../types';

export const INITIAL_MATCHES: Match[] = [
  {
    id: 'wc2026-m01',
    homeTeam: 'Argentina',
    awayTeam: 'Saudi Arabia',
    homeFlag: '🇦🇷',
    awayFlag: '🇸🇦',
    stage: MatchStage.GROUP_STAGE,
    status: MatchStatus.FINISHED,
    kickoffTime: '2026-06-10T11:00:00Z', // Has passed
    homeScore: 1,
    awayScore: 2
  },
  {
    id: 'wc2026-m02',
    homeTeam: 'USA',
    awayTeam: 'England',
    homeFlag: '🇺🇸',
    awayFlag: '🇬🇧',
    stage: MatchStage.GROUP_STAGE,
    status: MatchStatus.FINISHED,
    kickoffTime: '2026-06-10T18:00:00Z', // Has passed
    homeScore: 1,
    awayScore: 1
  },
  {
    id: 'wc2026-m03',
    homeTeam: 'Germany',
    awayTeam: 'Croatia',
    homeFlag: '🇩🇪',
    awayFlag: '🇭🇷',
    stage: MatchStage.GROUP_STAGE,
    status: MatchStatus.LOCKED, // Locked for kicks, but scores not updated yet
    kickoffTime: '2026-06-11T09:00:00Z', // Just passed (now is 09:17 UTC)
    homeScore: null,
    awayScore: null
  },
  {
    id: 'wc2026-m04',
    homeTeam: 'Brazil',
    awayTeam: 'Senegal',
    homeFlag: '🇧🇷',
    awayFlag: '🇸🇳',
    stage: MatchStage.GROUP_STAGE,
    status: MatchStatus.OPEN,
    kickoffTime: '2026-06-12T16:00:00Z', // Tomorrow
    homeScore: null,
    awayScore: null
  },
  {
    id: 'wc2026-m05',
    homeTeam: 'Spain',
    awayTeam: 'Japan',
    homeFlag: '🇪🇸',
    awayFlag: '🇯🇵',
    stage: MatchStage.GROUP_STAGE,
    status: MatchStatus.OPEN,
    kickoffTime: '2026-06-13T19:00:00Z',
    homeScore: null,
    awayScore: null
  },
  {
    id: 'wc2026-m06',
    homeTeam: 'Portugal',
    awayTeam: 'Morocco',
    homeFlag: '🇵🇹',
    awayFlag: '🇲🇦',
    stage: MatchStage.GROUP_STAGE,
    status: MatchStatus.OPEN,
    kickoffTime: '2026-06-14T15:00:00Z',
    homeScore: null,
    awayScore: null
  },
  {
    id: 'wc2026-m07',
    homeTeam: 'France',
    awayTeam: 'Mexico',
    homeFlag: '🇫🇷',
    awayFlag: '🇲🇽',
    stage: MatchStage.GROUP_STAGE,
    status: MatchStatus.OPEN,
    kickoffTime: '2026-06-15T20:00:00Z',
    homeScore: null,
    awayScore: null
  },
  {
    id: 'wc2026-m08',
    homeTeam: 'Netherlands',
    awayTeam: 'Poland',
    homeFlag: '🇳🇱',
    awayFlag: '🇵🇱',
    stage: MatchStage.ROUND_OF_32,
    status: MatchStatus.OPEN,
    kickoffTime: '2026-06-18T16:00:00Z',
    homeScore: null,
    awayScore: null
  },
  {
    id: 'wc2026-m09',
    homeTeam: 'Italy',
    awayTeam: 'Canada',
    homeFlag: '🇮🇹',
    awayFlag: '🇨🇦',
    stage: MatchStage.ROUND_OF_32,
    status: MatchStatus.OPEN,
    kickoffTime: '2026-06-19T18:00:00Z',
    homeScore: null,
    awayScore: null
  },
  {
    id: 'wc2026-m10',
    homeTeam: 'Winner Group A',
    awayTeam: 'Runner Group B',
    homeFlag: '🌍',
    awayFlag: '🌎',
    stage: MatchStage.ROUND_OF_16,
    status: MatchStatus.OPEN,
    kickoffTime: '2026-06-22T15:00:00Z',
    homeScore: null,
    awayScore: null
  },
  {
    id: 'wc2026-m11',
    homeTeam: 'Quarterfinalist 1',
    awayTeam: 'Quarterfinalist 2',
    homeFlag: '🏆',
    awayFlag: '🏆',
    stage: MatchStage.QUARTERFINALS,
    status: MatchStatus.OPEN,
    kickoffTime: '2026-06-28T19:00:00Z',
    homeScore: null,
    awayScore: null
  },
  {
    id: 'wc2026-m12',
    homeTeam: 'Semifinalist 1',
    awayTeam: 'Semifinalist 2',
    homeFlag: '⏳',
    awayFlag: '⏳',
    stage: MatchStage.QUARTERFINALS, // and semifinal wait
    status: MatchStatus.OPEN,
    kickoffTime: '2026-07-02T19:00:00Z',
    homeScore: null,
    awayScore: null
  },
  {
    id: 'wc2026-m13',
    homeTeam: 'Finalist A',
    awayTeam: 'Finalist B',
    homeFlag: '👑',
    awayFlag: '👑',
    stage: MatchStage.FINAL,
    status: MatchStatus.OPEN,
    kickoffTime: '2026-07-06T18:00:00Z',
    homeScore: null,
    awayScore: null
  }
];
