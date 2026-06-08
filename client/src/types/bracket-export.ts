export type PosterGroupRow = {
  rank: number;
  name: string;
  tier?: string | null;
  badge: 'green' | 'yellow' | 'red';
};

export type PosterGroup = {
  code: string;
  rows: PosterGroupRow[];
};

export type PosterThirdPick = {
  code: string;
  name: string;
  tier?: string | null;
};
