import type { MatchStage } from './types.js';

export const STAGE_LABELS: Record<MatchStage, string> = {
  group: 'Grup Aşaması',
  round_of_32: 'Son 32',
  round_of_16: 'Son 16',
  quarter_final: 'Çeyrek Final',
  semi_final: 'Yarı Final',
  third_place: '3.lük Maçı',
  final: 'Final',
};

export function getStageLabel(stage: MatchStage): string {
  return STAGE_LABELS[stage] ?? stage;
}
