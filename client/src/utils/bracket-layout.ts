/** Son 32’den finale kadar FIFA Annex C #122 ağaç yapısı (M73–M104). */

export type BracketFeederPair = {
  feeders: [number, number];
  roundOf16: number;
};

export type BracketQuarter = {
  quarterFinal: number;
  pairs: BracketFeederPair[];
};

export type BracketSemiSide = {
  semiFinal: number;
  quarters: BracketQuarter[];
};

/** Sol yarı: M101 yolculuğu (W97/W98). */
export const BRACKET_LEFT: BracketSemiSide = {
  semiFinal: 101,
  quarters: [
    {
      quarterFinal: 97,
      pairs: [
        { feeders: [74, 77], roundOf16: 89 },
        { feeders: [73, 75], roundOf16: 90 },
      ],
    },
    {
      quarterFinal: 98,
      pairs: [
        { feeders: [83, 84], roundOf16: 93 },
        { feeders: [81, 82], roundOf16: 94 },
      ],
    },
  ],
};

/** Sağ yarı: M102 yolculuğu (W99/W100). */
export const BRACKET_RIGHT: BracketSemiSide = {
  semiFinal: 102,
  quarters: [
    {
      quarterFinal: 99,
      pairs: [
        { feeders: [76, 78], roundOf16: 91 },
        { feeders: [79, 80], roundOf16: 92 },
      ],
    },
    {
      quarterFinal: 100,
      pairs: [
        { feeders: [86, 88], roundOf16: 95 },
        { feeders: [85, 87], roundOf16: 96 },
      ],
    },
  ],
};

/** Yukarıdan aşağı bracket sırası — tek sütunda eşleşen çiftler. */
export const BRACKET_R32_PAIRS: BracketFeederPair[] = [
  ...BRACKET_LEFT.quarters[0].pairs,
  ...BRACKET_LEFT.quarters[1].pairs,
  ...BRACKET_RIGHT.quarters[0].pairs,
  ...BRACKET_RIGHT.quarters[1].pairs,
];

export const BRACKET_QUARTER_FINALS = [
  BRACKET_LEFT.quarters[0].quarterFinal,
  BRACKET_LEFT.quarters[1].quarterFinal,
  BRACKET_RIGHT.quarters[0].quarterFinal,
  BRACKET_RIGHT.quarters[1].quarterFinal,
] as const;

export const BRACKET_SEMI_FINALS = [BRACKET_LEFT.semiFinal, BRACKET_RIGHT.semiFinal] as const;

export const BRACKET_FINAL = 104;
export const BRACKET_THIRD_PLACE = 103;
