import type { MatchStage } from '../lib/types.js';

export type BracketSlot =
  | `${1 | 2}${'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'}`
  | `3@${'1A' | '1B' | '1D' | '1E' | '1G' | '1I' | '1K' | '1L'}`
  | `W${number}`
  | `L${number}`;

export type BracketMatchTemplate = {
  number: number;
  stage: MatchStage;
  homeSlot: BracketSlot;
  awaySlot: BracketSlot;
  scheduledAt: string;
  roundLabel: string;
  externalId: string;
};

export const THIRD_PLACE_WINNER_SLOTS = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L'] as const;

export type ThirdPlaceWinnerSlot = (typeof THIRD_PLACE_WINNER_SLOTS)[number];

export const WC2026_KNOCKOUT_BRACKET: BracketMatchTemplate[] = [
  { number: 73, stage: 'round_of_32', homeSlot: '2A', awaySlot: '2B', scheduledAt: '2026-06-28T19:00:00Z', roundLabel: 'Son 32 - Maç 73', externalId: 'wc2026-ko-M73' },
  { number: 74, stage: 'round_of_32', homeSlot: '1E', awaySlot: '3@1E', scheduledAt: '2026-06-29T23:30:00Z', roundLabel: 'Son 32 - Maç 74', externalId: 'wc2026-ko-M74' },
  { number: 75, stage: 'round_of_32', homeSlot: '1F', awaySlot: '2C', scheduledAt: '2026-06-29T23:00:00Z', roundLabel: 'Son 32 - Maç 75', externalId: 'wc2026-ko-M75' },
  { number: 76, stage: 'round_of_32', homeSlot: '1C', awaySlot: '2F', scheduledAt: '2026-06-29T20:00:00Z', roundLabel: 'Son 32 - Maç 76', externalId: 'wc2026-ko-M76' },
  { number: 77, stage: 'round_of_32', homeSlot: '1I', awaySlot: '3@1I', scheduledAt: '2026-06-30T00:00:00Z', roundLabel: 'Son 32 - Maç 77', externalId: 'wc2026-ko-M77' },
  { number: 78, stage: 'round_of_32', homeSlot: '2E', awaySlot: '2I', scheduledAt: '2026-06-30T20:00:00Z', roundLabel: 'Son 32 - Maç 78', externalId: 'wc2026-ko-M78' },
  { number: 79, stage: 'round_of_32', homeSlot: '1A', awaySlot: '3@1A', scheduledAt: '2026-06-30T04:00:00Z', roundLabel: 'Son 32 - Maç 79', externalId: 'wc2026-ko-M79' },
  { number: 80, stage: 'round_of_32', homeSlot: '1L', awaySlot: '3@1L', scheduledAt: '2026-07-01T19:00:00Z', roundLabel: 'Son 32 - Maç 80', externalId: 'wc2026-ko-M80' },
  { number: 81, stage: 'round_of_32', homeSlot: '1D', awaySlot: '3@1D', scheduledAt: '2026-07-01T03:00:00Z', roundLabel: 'Son 32 - Maç 81', externalId: 'wc2026-ko-M81' },
  { number: 82, stage: 'round_of_32', homeSlot: '1G', awaySlot: '3@1G', scheduledAt: '2026-07-01T23:00:00Z', roundLabel: 'Son 32 - Maç 82', externalId: 'wc2026-ko-M82' },
  { number: 83, stage: 'round_of_32', homeSlot: '2K', awaySlot: '2L', scheduledAt: '2026-07-02T02:00:00Z', roundLabel: 'Son 32 - Maç 83', externalId: 'wc2026-ko-M83' },
  { number: 84, stage: 'round_of_32', homeSlot: '1H', awaySlot: '2J', scheduledAt: '2026-07-02T22:00:00Z', roundLabel: 'Son 32 - Maç 84', externalId: 'wc2026-ko-M84' },
  { number: 85, stage: 'round_of_32', homeSlot: '1B', awaySlot: '3@1B', scheduledAt: '2026-07-02T06:00:00Z', roundLabel: 'Son 32 - Maç 85', externalId: 'wc2026-ko-M85' },
  { number: 86, stage: 'round_of_32', homeSlot: '1J', awaySlot: '2H', scheduledAt: '2026-07-04T01:00:00Z', roundLabel: 'Son 32 - Maç 86', externalId: 'wc2026-ko-M86' },
  { number: 87, stage: 'round_of_32', homeSlot: '1K', awaySlot: '3@1K', scheduledAt: '2026-07-04T04:30:00Z', roundLabel: 'Son 32 - Maç 87', externalId: 'wc2026-ko-M87' },
  { number: 88, stage: 'round_of_32', homeSlot: '2D', awaySlot: '2G', scheduledAt: '2026-07-03T21:00:00Z', roundLabel: 'Son 32 - Maç 88', externalId: 'wc2026-ko-M88' },
  { number: 89, stage: 'round_of_16', homeSlot: 'W74', awaySlot: 'W77', scheduledAt: '2026-07-04T20:00:00Z', roundLabel: 'Son 16 - Maç 89', externalId: 'wc2026-ko-M89' },
  { number: 90, stage: 'round_of_16', homeSlot: 'W73', awaySlot: 'W75', scheduledAt: '2026-07-04T23:00:00Z', roundLabel: 'Son 16 - Maç 90', externalId: 'wc2026-ko-M90' },
  { number: 91, stage: 'round_of_16', homeSlot: 'W76', awaySlot: 'W78', scheduledAt: '2026-07-05T20:00:00Z', roundLabel: 'Son 16 - Maç 91', externalId: 'wc2026-ko-M91' },
  { number: 92, stage: 'round_of_16', homeSlot: 'W79', awaySlot: 'W80', scheduledAt: '2026-07-05T23:00:00Z', roundLabel: 'Son 16 - Maç 92', externalId: 'wc2026-ko-M92' },
  { number: 93, stage: 'round_of_16', homeSlot: 'W83', awaySlot: 'W84', scheduledAt: '2026-07-06T23:00:00Z', roundLabel: 'Son 16 - Maç 93', externalId: 'wc2026-ko-M93' },
  { number: 94, stage: 'round_of_16', homeSlot: 'W81', awaySlot: 'W82', scheduledAt: '2026-07-06T02:00:00Z', roundLabel: 'Son 16 - Maç 94', externalId: 'wc2026-ko-M94' },
  { number: 95, stage: 'round_of_16', homeSlot: 'W86', awaySlot: 'W88', scheduledAt: '2026-07-07T23:00:00Z', roundLabel: 'Son 16 - Maç 95', externalId: 'wc2026-ko-M95' },
  { number: 96, stage: 'round_of_16', homeSlot: 'W85', awaySlot: 'W87', scheduledAt: '2026-07-07T02:00:00Z', roundLabel: 'Son 16 - Maç 96', externalId: 'wc2026-ko-M96' },
  { number: 97, stage: 'quarter_final', homeSlot: 'W89', awaySlot: 'W90', scheduledAt: '2026-07-09T23:00:00Z', roundLabel: 'Çeyrek Final - Maç 97', externalId: 'wc2026-ko-M97' },
  { number: 98, stage: 'quarter_final', homeSlot: 'W93', awaySlot: 'W94', scheduledAt: '2026-07-10T22:00:00Z', roundLabel: 'Çeyrek Final - Maç 98', externalId: 'wc2026-ko-M98' },
  { number: 99, stage: 'quarter_final', homeSlot: 'W91', awaySlot: 'W92', scheduledAt: '2026-07-11T23:00:00Z', roundLabel: 'Çeyrek Final - Maç 99', externalId: 'wc2026-ko-M99' },
  { number: 100, stage: 'quarter_final', homeSlot: 'W95', awaySlot: 'W96', scheduledAt: '2026-07-11T20:00:00Z', roundLabel: 'Çeyrek Final - Maç 100', externalId: 'wc2026-ko-M100' },
  { number: 101, stage: 'semi_final', homeSlot: 'W97', awaySlot: 'W98', scheduledAt: '2026-07-14T23:00:00Z', roundLabel: 'Yarı Final - Maç 101', externalId: 'wc2026-ko-M101' },
  { number: 102, stage: 'semi_final', homeSlot: 'W99', awaySlot: 'W100', scheduledAt: '2026-07-15T23:00:00Z', roundLabel: 'Yarı Final - Maç 102', externalId: 'wc2026-ko-M102' },
  { number: 103, stage: 'third_place', homeSlot: 'L101', awaySlot: 'L102', scheduledAt: '2026-07-18T20:00:00Z', roundLabel: '3.lük Maçı - Maç 103', externalId: 'wc2026-ko-M103' },
  { number: 104, stage: 'final', homeSlot: 'W101', awaySlot: 'W102', scheduledAt: '2026-07-19T22:00:00Z', roundLabel: 'Final - Maç 104', externalId: 'wc2026-ko-M104' },
];
