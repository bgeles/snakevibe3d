const STORAGE_KEY = "snake-vibe-profile-v2";

const DEFAULT_PROFILE = {
  highScore: 0,
  soundEnabled: true,
  sensitivity: 1,
  theme: "neon-sunset",
  language: "pt-BR",
  cameraMode: "cinematic",
  coins: 0,
  rewards: {
    lastDailyClaimAt: "",
    rewardedAdsWatched: 0,
    totalLevelRewards: 0
  },
  achievements: {
    score20: false,
    level5: false,
    streak30: false
  }
};

export function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      achievements: {
        ...DEFAULT_PROFILE.achievements,
        ...(parsed.achievements || {})
      },
      rewards: {
        ...DEFAULT_PROFILE.rewards,
        ...(parsed.rewards || {})
      },
      theme: sanitizeTheme(parsed.theme),
      language: sanitizeLanguage(parsed.language),
      cameraMode: sanitizeCameraMode(parsed.cameraMode),
      coins: Math.max(0, Number(parsed.coins) || 0),
      sensitivity: clamp(Number(parsed.sensitivity) || 1, 0.6, 1.8),
      highScore: Math.max(0, Number(parsed.highScore) || 0)
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(profile) {
  const safe = {
    ...DEFAULT_PROFILE,
    ...profile,
    highScore: Math.max(0, Number(profile.highScore) || 0),
    soundEnabled: Boolean(profile.soundEnabled),
    sensitivity: clamp(Number(profile.sensitivity) || 1, 0.6, 1.8),
    theme: sanitizeTheme(profile.theme),
    language: sanitizeLanguage(profile.language),
    cameraMode: sanitizeCameraMode(profile.cameraMode),
    coins: Math.max(0, Number(profile.coins) || 0),
    rewards: {
      ...DEFAULT_PROFILE.rewards,
      ...(profile.rewards || {})
    },
    achievements: {
      ...DEFAULT_PROFILE.achievements,
      ...(profile.achievements || {})
    }
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  return safe;
}

export function updateHighScore(profile, score) {
  if (score <= profile.highScore) return profile;
  return saveProfile({ ...profile, highScore: score });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeTheme(theme) {
  if (theme === "ocean-glow" || theme === "cyber-arena" || theme === "neon-sunset") {
    return theme;
  }
  return "neon-sunset";
}

function sanitizeLanguage(language) {
  if (language === "pt-BR" || language === "en-US" || language === "es-ES") {
    return language;
  }
  return "pt-BR";
}

function sanitizeCameraMode(cameraMode) {
  if (cameraMode === "arcade" || cameraMode === "cinematic") {
    return cameraMode;
  }
  return "cinematic";
}
