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
