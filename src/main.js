import "./style.css";
import { SnakeGame } from "./game/SnakeGame.js";
import { loadProfile, saveProfile } from "./game/profileStore.js";

const ACHIEVEMENTS = [
  { id: "score20", name: "Hungry Rookie", rule: (ctx) => ctx.score >= 20 },
  { id: "level5", name: "Pattern Master", rule: (ctx) => ctx.level >= 5 },
  { id: "streak30", name: "No-Collision Streak", rule: (ctx) => ctx.score >= 30 }
];

const canvas = document.getElementById("game-canvas");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
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

const soundToggle = document.getElementById("sound-toggle");
const themeSelect = document.getElementById("theme-select");
const sensitivityInput = document.getElementById("sensitivity");
const sensitivityValue = document.getElementById("sensitivity-value");
const touchPad = document.getElementById("touch-pad");

let profile = loadProfile();
let toastTimer = null;

function applyProfileToUi() {
  highScoreEl.textContent = `${profile.highScore}`;
  finalHighScoreEl.textContent = `${profile.highScore}`;
  menuHighScoreEl.textContent = `${profile.highScore}`;
  soundToggle.checked = profile.soundEnabled;
  themeSelect.value = profile.theme;
  sensitivityInput.value = `${profile.sensitivity}`;
  sensitivityValue.textContent = `${profile.sensitivity.toFixed(1)}x`;
  document.documentElement.setAttribute("data-theme", profile.theme);
}

function renderAchievements() {
  achievementListEl.innerHTML = "";
  ACHIEVEMENTS.forEach((achievement) => {
    const unlocked = Boolean(profile.achievements[achievement.id]);
    const li = document.createElement("li");
    li.className = `achievement ${unlocked ? "done" : "todo"}`;
    li.textContent = `${unlocked ? "Unlocked" : "Locked"} - ${achievement.name}`;
    achievementListEl.appendChild(li);
  });
}

function persistProfile(patch = {}) {
  profile = saveProfile({ ...profile, ...patch });
  applyProfileToUi();
  renderAchievements();
}

function showAchievementToast(name) {
  achievementToastEl.textContent = `Achievement Unlocked: ${name}`;
  achievementToastEl.classList.remove("hidden");
  achievementToastEl.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    achievementToastEl.classList.remove("show");
    achievementToastEl.classList.add("hidden");
  }, 1700);
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
    theme: profile.theme
  },
  onProgress: ({ score, level }) => {
    const nextAchievements = { ...profile.achievements };
    let changed = false;

    ACHIEVEMENTS.forEach((achievement) => {
      if (!nextAchievements[achievement.id] && achievement.rule({ score, level })) {
        nextAchievements[achievement.id] = true;
        changed = true;
        showAchievementToast(achievement.name);
      }
    });

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

startBtn.addEventListener("click", () => {
  persistProfile({
    soundEnabled: soundToggle.checked,
    sensitivity: Number(sensitivityInput.value),
    theme: themeSelect.value
  });
  game.setPlayerProfile(profile);
  game.startRun();
  hideOverlays();
});

resumeBtn.addEventListener("click", () => {
  game.resume();
  hideOverlays();
});

restartBtn.addEventListener("click", () => {
  game.startRun();
  hideOverlays();
});

playAgainBtn.addEventListener("click", () => {
  game.startRun();
  hideOverlays();
});

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
    theme: themeSelect.value
  });
  game.setPlayerProfile(profile);
});

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

applyProfileToUi();
renderAchievements();
showOverlay(startMenuEl);
game.setPlayerProfile(profile);
game.boot();
