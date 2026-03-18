export const GRID_SIZE = 26;
export const START_SPEED_MS = 165;
export const LEVEL_UP_EVERY = 5;
export const MIN_SPEED_MS = 48;

export const SETTINGS_LIMITS = {
  MIN_SENSITIVITY: 0.6,
  MAX_SENSITIVITY: 1.8
};

export const DIR = {
  UP: { x: 0, z: -1 },
  DOWN: { x: 0, z: 1 },
  LEFT: { x: -1, z: 0 },
  RIGHT: { x: 1, z: 0 }
};

export const OPPOSITE_DIR = new Map([
  [DIR.UP, DIR.DOWN],
  [DIR.DOWN, DIR.UP],
  [DIR.LEFT, DIR.RIGHT],
  [DIR.RIGHT, DIR.LEFT]
]);

// --- v4: Sound Tracks ---
export const SOUNDTRACK_MAP = [
  { file: "/audio/Saving the City 16-bit - Loop.m4a",       maxLevel: 2  },
  { file: "/audio/Back Into Action 16-bit - Loop.m4a",      maxLevel: 4  },
  { file: "/audio/Enemy Ahead 16-bit - Loop.m4a",           maxLevel: 6  },
  { file: "/audio/Righteous Battle 16 bit - Loop.m4a",      maxLevel: 8  },
  { file: "/audio/Against the Enemy 16-bit - Loop.m4a",     maxLevel: Infinity }
];

// --- v4: Multi-food scaling per level ---
export const FOOD_SCALING = [
  { growth: 1, shrink: 0 },  // level 1
  { growth: 2, shrink: 0 },  // level 2
  { growth: 2, shrink: 1 },  // level 3
  { growth: 3, shrink: 1 },  // level 4
  { growth: 3, shrink: 1 },  // level 5
  { growth: 4, shrink: 1 },  // level 6
  { growth: 4, shrink: 2 },  // level 7
  { growth: 5, shrink: 2 },  // level 8+
];
export const SHRINK_AMOUNT = 2;
export const SHRINK_BONUS = 2;
export const MIN_SNAKE_LENGTH = 3;

// --- v4: Power-up shop ---
export const POWER_UP_COSTS = [50, 100, 200];
export const MAX_EXTRA_LIVES = 3;
export const INVINCIBILITY_MS = 1500;
