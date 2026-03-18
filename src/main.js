import "./style.css";
import { SnakeGame } from "./game/SnakeGame.js";
import { loadProfile, saveProfile } from "./game/profileStore.js";
import { detectLanguage, t } from "./game/i18n.js";
import { MobileAdsService } from "./mobile/adService.js";
import { POWER_UP_COSTS, MAX_EXTRA_LIVES } from "./game/config.js";

const COIN_REWARD_PER_LEVEL = 5;
const COIN_REWARD_DAILY = 20;
const COIN_REWARD_AD = 30;

const ACHIEVEMENTS = [
  { id: "score20", key: "achievementScore20", fallback: "Hungry Rookie", rule: (ctx) => ctx.score >= 20, reward: 10 },
  { id: "level5", key: "achievementLevel5", fallback: "Pattern Master", rule: (ctx) => ctx.level >= 5, reward: 12 },
  { id: "streak30", key: "achievementStreak30", fallback: "No-Collision Streak", rule: (ctx) => ctx.score >= 30, reward: 15 }
];

const canvas = document.getElementById("game-canvas");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const coinsEl = document.getElementById("coins");
const menuCoinsEl = document.getElementById("menu-coins");
const highScoreEl = document.getElementById("high-score");
const menuHighScoreEl = document.getElementById("menu-high-score");
const achievementListEl = document.getElementById("achievement-list");
const achievementToastEl = document.getElementById("achievement-toast");

const startMenuEl = document.getElementById("start-menu");
const pauseMenuEl = document.getElementById("pause-menu");
const gameoverMenuEl = document.getElementById("gameover-menu");
const finalScoreEl = document.getElementById("final-score");
const finalHighScoreEl = document.getElementById("final-high-score");

const settingsPanelEl = document.getElementById("settings-panel");
const pauseBtn = document.getElementById("pause-btn");
const settingsBtn = document.getElementById("settings-btn");
const startBtn = document.getElementById("start-btn");
const menuSettingsBtn = document.getElementById("menu-settings-btn");
const gameoverSettingsBtn = document.getElementById("gameover-settings-btn");
const resumeBtn = document.getElementById("resume-btn");
const restartBtn = document.getElementById("restart-btn");
const playAgainBtn = document.getElementById("play-again-btn");
const saveProfileBtn = document.getElementById("save-profile");
const closeSettingsBtn = document.getElementById("close-settings-btn");
const dailyRewardBtn = document.getElementById("daily-reward-btn");
const rewardAdBtn = document.getElementById("reward-ad-btn");
const buyLifeBtn = document.getElementById("buy-life-btn");
const livesDisplayEl = document.getElementById("lives-display");
const lifeCostEl = document.getElementById("life-cost");
const livesHudEl = document.getElementById("lives-hud");
const livesCountEl = document.getElementById("lives-count");

const soundToggle = document.getElementById("sound-toggle");
const themeSelect = document.getElementById("theme-select");
const cameraSelect = document.getElementById("camera-select");
const languageSelect = document.getElementById("language-select");
const sensitivityInput = document.getElementById("sensitivity");
const sensitivityValue = document.getElementById("sensitivity-value");
const touchPad = document.getElementById("touch-pad");

const ads = new MobileAdsService();

let profile = loadProfile();
if (!profile.language) {
  profile = saveProfile({ ...profile, language: detectLanguage() });
}
let toastTimer = null;
let lastAwardedLevel = 1;
let pendingExtraLives = 0;

function updatePowerUpShopUi() {
  const currentLives = pendingExtraLives;
  livesDisplayEl.textContent = `x${currentLives}`;
  if (currentLives >= MAX_EXTRA_LIVES) {
    buyLifeBtn.disabled = true;
    lifeCostEl.textContent = "—";
  } else {
    const cost = POWER_UP_COSTS[currentLives];
    lifeCostEl.textContent = `${cost}`;
    buyLifeBtn.disabled = profile.coins < cost;
  }
}

function buyExtraLife() {
  if (pendingExtraLives >= MAX_EXTRA_LIVES) {
    showToast(t(profile.language, "maxLives"));
    return;
  }
  const cost = POWER_UP_COSTS[pendingExtraLives];
  if (profile.coins < cost) {
    showToast(t(profile.language, "notEnoughCoins"));
    return;
  }
  const coins = profile.coins - cost;
  pendingExtraLives++;
  persistProfile({ coins });
  updatePowerUpShopUi();
}

function applyTranslations() {
  document.documentElement.lang = profile.language;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (!key) return;
    node.textContent = t(profile.language, key);
  });

  const titleEl = document.querySelector("title");
  if (titleEl) titleEl.textContent = t(profile.language, "title");

  const themeOptionMap = {
    "neon-sunset": "Neon Sunset",
    "ocean-glow": "Ocean Glow",
    "cyber-arena": "Cyber Arena"
  };
  [...themeSelect.options].forEach((option) => {
    option.textContent = themeOptionMap[option.value] || option.textContent;
  });

  renderAchievements();
}

function applyProfileToUi() {
  highScoreEl.textContent = `${profile.highScore}`;
  finalHighScoreEl.textContent = `${profile.highScore}`;
  menuHighScoreEl.textContent = `${profile.highScore}`;
  coinsEl.textContent = `${profile.coins}`;
  menuCoinsEl.textContent = `${profile.coins}`;
  soundToggle.checked = profile.soundEnabled;
  themeSelect.value = profile.theme;
  cameraSelect.value = profile.cameraMode;
  languageSelect.value = profile.language;
  sensitivityInput.value = `${profile.sensitivity}`;
  sensitivityValue.textContent = `${profile.sensitivity.toFixed(1)}x`;
  document.documentElement.setAttribute("data-theme", profile.theme);
  applyTranslations();
  updatePowerUpShopUi();
}

function achievementLabel(achievement) {
  const value = t(profile.language, achievement.key);
  return value === achievement.key ? achievement.fallback : value;
}

function renderAchievements() {
  achievementListEl.innerHTML = "";
  ACHIEVEMENTS.forEach((achievement) => {
    const unlocked = Boolean(profile.achievements[achievement.id]);
    const li = document.createElement("li");
    li.className = `achievement ${unlocked ? "done" : "todo"}`;
    li.textContent = `${t(profile.language, unlocked ? "unlocked" : "locked")} - ${achievementLabel(achievement)}`;
    achievementListEl.appendChild(li);
  });
}

function persistProfile(patch = {}) {
  profile = saveProfile({ ...profile, ...patch });
  applyProfileToUi();
  renderAchievements();
}

function showToast(message) {
  achievementToastEl.textContent = message;
  achievementToastEl.classList.remove("hidden");
  achievementToastEl.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    achievementToastEl.classList.remove("show");
    achievementToastEl.classList.add("hidden");
  }, 1900);
}

function showAchievementToast(name) {
  showToast(`${t(profile.language, "achievementUnlocked")}: ${name}`);
}

function addCoins(amount, messageKey, vars = {}) {
  const coins = Math.max(0, Number(profile.coins) + Number(amount));
  persistProfile({ coins });
  if (messageKey) {
    showToast(t(profile.language, messageKey, vars));
  }
}

function canClaimDailyReward() {
  const today = new Date().toISOString().slice(0, 10);
  return profile.rewards.lastDailyClaimAt !== today;
}

function claimDailyReward() {
  if (!canClaimDailyReward()) {
    showToast(t(profile.language, "dailyClaimed"));
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  addCoins(COIN_REWARD_DAILY, "dailySuccess");
  persistProfile({
    rewards: {
      ...profile.rewards,
      lastDailyClaimAt: today
    }
  });
}

async function claimAdReward() {
  if (!ads.isAvailable) {
    showToast(t(profile.language, "adMissingPlugin"));
    return;
  }

  const result = await ads.showRewarded();
  if (result.ok && result.rewarded) {
    addCoins(COIN_REWARD_AD, "rewardFromAd");
    persistProfile({
      rewards: {
        ...profile.rewards,
        rewardedAdsWatched: (profile.rewards.rewardedAdsWatched || 0) + 1
      }
    });
    return;
  }

  if (result.reason === "not-ready") {
    showToast(t(profile.language, "adNotReady"));
    return;
  }

  showToast(t(profile.language, "adNotReady"));
}

const game = new SnakeGame({
  canvas,
  scoreEl,
  levelEl,
  highScoreEl,
  finalScoreEl,
  finalHighScoreEl,
  touchPad,
  settings: {
    soundEnabled: profile.soundEnabled,
    sensitivity: profile.sensitivity,
    theme: profile.theme,
    cameraMode: profile.cameraMode
  },
  onProgress: ({ score, level }) => {
    const nextAchievements = { ...profile.achievements };
    let changed = false;

    ACHIEVEMENTS.forEach((achievement) => {
      if (!nextAchievements[achievement.id] && achievement.rule({ score, level })) {
        nextAchievements[achievement.id] = true;
        changed = true;
        showAchievementToast(achievementLabel(achievement));
        addCoins(achievement.reward, null);
      }
    });

    if (level > lastAwardedLevel) {
      const levelsGained = level - lastAwardedLevel;
      const reward = levelsGained * COIN_REWARD_PER_LEVEL;
      addCoins(reward, "rewardFromLevel", { value: reward });
      persistProfile({
        rewards: {
          ...profile.rewards,
          totalLevelRewards: (profile.rewards.totalLevelRewards || 0) + reward
        }
      });
      lastAwardedLevel = level;
    }

    if (changed) {
      persistProfile({ achievements: nextAchievements });
    }
  },
  onGameOver: ({ score, highScore }) => {
    if (highScore > profile.highScore) {
      persistProfile({ highScore });
    }
    finalScoreEl.textContent = `${score}`;
    finalHighScoreEl.textContent = `${Math.max(highScore, profile.highScore)}`;
    showOverlay(gameoverMenuEl);
  },
  onLifeUsed: (remainingLives) => {
    showToast(t(profile.language, "lifeUsed"));
    livesCountEl.textContent = `${remainingLives}`;
  }
});

function showOverlay(activeOverlay) {
  [startMenuEl, pauseMenuEl, gameoverMenuEl].forEach((el) => {
    if (el === activeOverlay) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });
}

function hideOverlays() {
  [startMenuEl, pauseMenuEl, gameoverMenuEl].forEach((el) => el.classList.add("hidden"));
}

function toggleSettings() {
  settingsPanelEl.classList.toggle("hidden");
}

function closeSettings() {
  settingsPanelEl.classList.add("hidden");
}

function startRunFromUi() {
  persistProfile({
    soundEnabled: soundToggle.checked,
    sensitivity: Number(sensitivityInput.value),
    theme: themeSelect.value,
    language: languageSelect.value,
    cameraMode: cameraSelect.value
  });

  lastAwardedLevel = 1;
  game.setPlayerProfile(profile);
  game.livesEl = livesCountEl;
  game.startRun(pendingExtraLives);
  pendingExtraLives = 0;
  updatePowerUpShopUi();
  hideOverlays();
}

startBtn.addEventListener("click", startRunFromUi);

resumeBtn.addEventListener("click", () => {
  game.resume();
  hideOverlays();
});

restartBtn.addEventListener("click", startRunFromUi);
playAgainBtn.addEventListener("click", startRunFromUi);

dailyRewardBtn.addEventListener("click", claimDailyReward);
rewardAdBtn.addEventListener("click", claimAdReward);
buyLifeBtn.addEventListener("click", buyExtraLife);

pauseBtn.addEventListener("click", () => {
  if (game.togglePause()) {
    showOverlay(pauseMenuEl);
  } else {
    hideOverlays();
  }
});

[settingsBtn, menuSettingsBtn, gameoverSettingsBtn].forEach((btn) => {
  btn.addEventListener("click", toggleSettings);
});

saveProfileBtn.addEventListener("click", () => {
  persistProfile({
    soundEnabled: soundToggle.checked,
    sensitivity: Number(sensitivityInput.value),
    theme: themeSelect.value,
    language: languageSelect.value,
    cameraMode: cameraSelect.value
  });
  game.setPlayerProfile(profile);
  closeSettings();
});

closeSettingsBtn.addEventListener("click", closeSettings);

sensitivityInput.addEventListener("input", () => {
  sensitivityValue.textContent = `${Number(sensitivityInput.value).toFixed(1)}x`;
  game.updateSettings({ sensitivity: Number(sensitivityInput.value) });
});

soundToggle.addEventListener("change", () => {
  game.updateSettings({ soundEnabled: soundToggle.checked });
});

themeSelect.addEventListener("change", () => {
  const theme = themeSelect.value;
  document.documentElement.setAttribute("data-theme", theme);
  game.updateSettings({ theme });
});

cameraSelect.addEventListener("change", () => {
  game.updateSettings({ cameraMode: cameraSelect.value });
});

languageSelect.addEventListener("change", () => {
  persistProfile({ language: languageSelect.value });
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const state = game.getState();
    if (state !== "playing" && state !== "paused") return;
    if (game.togglePause()) {
      showOverlay(pauseMenuEl);
    } else {
      hideOverlays();
    }
  }
});

async function initAds() {
  const result = await ads.init();
  if (!result.ok) return;
  await ads.showBanner();
}

applyProfileToUi();
renderAchievements();
showOverlay(startMenuEl);
game.setPlayerProfile(profile);
game.livesEl = livesCountEl;
game.boot();
game.loadSoundtracks();
initAds();
