export type BracketStage =
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'third_place'
  | 'final';

export type BracketTeam = { teamId: number; name: string };

export type BracketMatch = {
  number: number;
  stage: BracketStage;
  roundLabel: string;
  homeSlot: string;
  awaySlot: string;
  /** Son 32 için çözülmüş takım; sonraki turlarda null (W/L slotu). */
  home: BracketTeam | null;
  away: BracketTeam | null;
};

export type BracketPreview = {
  combinationNo: number;
  thirdAssignments: Record<string, string>;
  matches: BracketMatch[];
};

/** Bir maçın anlık çözümlenmiş durumu (kazanan tahminleri uygulanmış). */
export type ResolvedMatch = {
  number: number;
  stage: BracketStage;
  home: BracketTeam | null;
  away: BracketTeam | null;
  /** Takım çözülemediğinde gösterilecek yer tutucu (ör. "M74 kazananı"). */
  homeLabel: string;
  awayLabel: string;
  winnerTeamId: number | null;
};
