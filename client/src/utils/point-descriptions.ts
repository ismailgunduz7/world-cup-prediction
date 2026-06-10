type PointEntry = {
  description?: string;
  points?: number;
  ruleCode?: string | null;
  ruleName?: string | null;
};

export function formatSigned(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function formatRuleDescription(entry: PointEntry) {
  const desc = entry.description ?? '';
  const code = entry.ruleCode;

  const legacyScored = desc.match(/Attığı gol \((\d+) x (-?\d+(?:\.\d+)?)\)/);
  if (code === 'goals_scored' && legacyScored) {
    return `Attığı gol (${legacyScored[1]}) başına ${formatSigned(Number(legacyScored[2]))} puan`;
  }

  const legacyConceded = desc.match(/Yediği gol \((\d+) x (-?\d+(?:\.\d+)?)\)/);
  if (code === 'goals_conceded' && legacyConceded) {
    return `Yediği gol (${legacyConceded[1]}) başına ${formatSigned(Number(legacyConceded[2]))} puan`;
  }

  const modernPerGoal = desc.match(/(Attığı gol|Yediği gol) \((\d+)\) başına ([+-]?\d+(?:\.\d+)?) puan/);
  if (modernPerGoal) {
    return `${modernPerGoal[1]} (${modernPerGoal[2]}) başına ${formatSigned(Number(modernPerGoal[3]))} puan`;
  }

  return desc;
}
