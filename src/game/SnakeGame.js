import * as THREE from "three";
import { DIR, FOOD_SCALING, GRID_SIZE, INVINCIBILITY_MS, LEVEL_UP_EVERY, MIN_SNAKE_LENGTH, MIN_SPEED_MS, OPPOSITE_DIR, SETTINGS_LIMITS, SHRINK_AMOUNT, SHRINK_BONUS, SOUNDTRACK_MAP, START_SPEED_MS } from "./config.js";
import { LEVEL_PATTERNS } from "./levelPatterns.js";
import { DEFAULT_THEME, THEMES } from "./themes.js";

const CELL = 1;
const MIN = -Math.floor(GRID_SIZE / 2);
const MAX = MIN + GRID_SIZE - 1;
const CAMERA_FOV = 52;

export class SnakeGame {
  constructor({
    canvas,
    scoreEl,
    levelEl,
    highScoreEl,
    finalScoreEl,
    finalHighScoreEl,
    touchPad,
    settings,
    onProgress,
    onGameOver,
    onLifeUsed
  }) {
    this.canvas = canvas;
    this.scoreEl = scoreEl;
    this.levelEl = levelEl;
    this.highScoreEl = highScoreEl;
    this.finalScoreEl = finalScoreEl;
    this.finalHighScoreEl = finalHighScoreEl;
    this.touchPad = touchPad;
    this.onProgress = onProgress;
    this.onGameOver = onGameOver;
    this.onLifeUsed = onLifeUsed;

    this.settings = {
      soundEnabled: Boolean(settings.soundEnabled),
      sensitivity: this.clamp(Number(settings.sensitivity) || 1, SETTINGS_LIMITS.MIN_SENSITIVITY, SETTINGS_LIMITS.MAX_SENSITIVITY),
      theme: THEMES[settings.theme] ? settings.theme : DEFAULT_THEME,
      cameraMode: settings.cameraMode === "arcade" ? "arcade" : "cinematic"
    };

    this.playerProfile = {
      highScore: 0,
      theme: this.settings.theme
    };

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x100421, 16, 52);

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 220);
    this.camera.position.set(0, 22, 20);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.lastOrbitAngle = 0;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.clock = new THREE.Clock();
    this.lastTickMs = 0;

    this.state = "menu";
    this.snake = [];
    this.snakeMeshes = [];
    this.segmentColors = [];
    this.obstacles = [];
    this.obstacleMeshes = [];
    this.particles = [];
    this.ambientParticles = [];

    this.direction = DIR.RIGHT;
    this.nextDirection = DIR.RIGHT;
    this.foods = [];
    this.foodMeshes = [];
    this.foodHalos = [];

    this.score = 0;
    this.level = 1;
    this.speedMs = START_SPEED_MS;
    this.loopStarted = false;
    this.cameraShake = 0;
    this.musicNodes = null;

    // v4: soundtrack buffers
    this.soundtrackBuffers = [];
    this.currentTrackIndex = -1;

    // v4: extra lives
    this.extraLives = 0;
    this.invincibleUntil = 0;
    this.livesEl = null;

    this.setupWorld();
    this.setupEvents();
    this.updateHud();
  }

  boot() {
    if (this.loopStarted) return;
    this.loopStarted = true;
    this.clock.start();
    this.lastTickMs = performance.now();
    this.loop();
  }

  setPlayerProfile(profile) {
    this.playerProfile = {
      highScore: Math.max(0, Number(profile.highScore) || 0),
      theme: THEMES[profile.theme] ? profile.theme : DEFAULT_THEME
    };

    this.updateSettings({
      soundEnabled: profile.soundEnabled,
      sensitivity: profile.sensitivity,
      theme: profile.theme
    });
    this.updateHud();
  }

  updateSettings(patch) {
    if (typeof patch.soundEnabled === "boolean") {
      this.settings.soundEnabled = patch.soundEnabled;
      if (!patch.soundEnabled) this.stopMusic();
      else if (this.state === "playing" && !this.musicNodes) this.startMusic();
    }
    if (typeof patch.sensitivity === "number") {
      this.settings.sensitivity = this.clamp(
        patch.sensitivity,
        SETTINGS_LIMITS.MIN_SENSITIVITY,
        SETTINGS_LIMITS.MAX_SENSITIVITY
      );
    }
    if (typeof patch.theme === "string" && THEMES[patch.theme]) {
      this.settings.theme = patch.theme;
      this.applyTheme();
      this.recolorSnake();
      this.recolorObstacles();
    }
    if (typeof patch.cameraMode === "string") {
      this.settings.cameraMode = patch.cameraMode === "arcade" ? "arcade" : "cinematic";
    }
  }

  getState() {
    return this.state;
  }

  startRun(extraLives = 0) {
    this.score = 0;
    this.level = 1;
    this.speedMs = START_SPEED_MS;
    this.state = "playing";
    this.extraLives = Math.max(0, Math.min(3, extraLives));
    this.invincibleUntil = 0;

    this.direction = DIR.RIGHT;
    this.nextDirection = DIR.RIGHT;

    this.snake = [
      { x: -2, z: 0 },
      { x: -3, z: 0 },
      { x: -4, z: 0 }
    ];
    this.segmentColors = this.snake.map(() => this.pickSnakeColor());

    this.snakeMeshes.forEach((m) => this.scene.remove(m));
    this.obstacleMeshes.forEach((m) => this.scene.remove(m));
    this.particles.forEach((p) => this.scene.remove(p.mesh));

    this.snakeMeshes = [];
    this.obstacles = [];
    this.obstacleMeshes = [];
    this.particles = [];

    this.clearAllFoods();
    this.setObstaclesForLevel(this.level);
    this.spawnFoods();
    this.renderSnake(true);
    this.updateHud();
    this.stopMusic();
    this.startMusic();
  }

  resume() {
    if (this.state === "paused") {
      this.state = "playing";
      this.lastTickMs = performance.now();
    }
  }

  pause() {
    if (this.state === "playing") {
      this.state = "paused";
      return true;
    }
    return false;
  }

  togglePause() {
    if (this.state === "playing") {
      this.pause();
      return true;
    }
    if (this.state === "paused") {
      this.resume();
      return false;
    }
    return false;
  }

  setupWorld() {
    this.currentTheme = THEMES[this.settings.theme] || THEMES[DEFAULT_THEME];

    this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    this.keyLight.position.set(8, 14, 7);
    this.rimLight = new THREE.DirectionalLight(0xffffff, 1);
    this.rimLight.position.set(-8, 10, -9);
    this.followLight = new THREE.PointLight(0xffffff, 1.8, 9, 1.2);
    this.followLight.position.set(0, 1.3, 0);

    const floorGeo = new THREE.PlaneGeometry(GRID_SIZE * CELL, GRID_SIZE * CELL, GRID_SIZE, GRID_SIZE);
    this.floorMat = new THREE.MeshStandardMaterial({
      emissiveIntensity: 0.55,
      metalness: 0.22,
      roughness: 0.55
    });
    this.floor = new THREE.Mesh(floorGeo, this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;

    this.gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0xffffff, 0xffffff);
    this.gridHelper.position.y = 0.02;
    this.gridHelper.material.opacity = 0.25;
    this.gridHelper.material.transparent = true;

    this.scene.add(this.ambient, this.keyLight, this.rimLight, this.followLight, this.floor, this.gridHelper);
    this.createAmbientParticles();
    this.applyTheme();
    this.resize();
  }

  applyTheme() {
    const theme = THEMES[this.settings.theme] || THEMES[DEFAULT_THEME];
    this.currentTheme = theme;

    this.scene.background = new THREE.Color(theme.sceneBg);
    this.scene.fog = new THREE.Fog(theme.sceneBg, 20, 80);

    this.ambient.color.setHex(theme.ambient);
    this.keyLight.color.setHex(theme.key);
    this.rimLight.color.setHex(theme.rim);
    this.followLight.color.setHex(theme.follow);

    const floorTexture = this.createFloorTexture(theme);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(4, 4);
    this.floorMat.map = floorTexture;
    this.floorMat.emissive = new THREE.Color().setHSL(
      theme.floorNeon[0] / 360,
      theme.floorNeon[1] / 100,
      theme.floorNeon[2] / 100
    );
    this.floorMat.needsUpdate = true;

    this.gridHelper.material.color.setHex(theme.rim);

    this.foods.forEach((food, i) => {
      const isGrowth = food.type === "growth";
      if (this.foodMeshes[i]) {
        this.foodMeshes[i].material.color.setHex(isGrowth ? theme.food : theme.shrinkFood);
        this.foodMeshes[i].material.emissive.setHex(isGrowth ? theme.foodEmissive : theme.shrinkEmissive);
      }
      if (this.foodHalos[i]) {
        this.foodHalos[i].material.color.setHex(isGrowth ? theme.halo : theme.shrinkHalo);
      }
    });

    this.recolorAmbientParticles();
    this.updateCamera(0);
  }

  recolorAmbientParticles() {
    this.ambientParticles.forEach((p, idx) => {
      p.mesh.material.color.setHex(idx % 2 ? this.currentTheme.ambientA : this.currentTheme.ambientB);
    });
  }

  recolorSnake() {
    this.segmentColors = this.segmentColors.map(() => this.pickSnakeColor());
    this.renderSnake(false);
  }

  recolorObstacles() {
    this.obstacleMeshes.forEach((mesh, i) => {
      const t = (i + this.level) % 2;
      const color = t ? this.currentTheme.obstacleA : this.currentTheme.obstacleB;
      mesh.material.color.setHex(color);
      mesh.material.emissive.setHex(color);
      mesh.material.emissiveIntensity = 0.45;
    });
  }

  setupEvents() {
    window.addEventListener("resize", () => this.resize());
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => this.resize());
      window.visualViewport.addEventListener("scroll", () => this.resize());
    }

    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      const map = {
        arrowup: DIR.UP,
        arrowdown: DIR.DOWN,
        arrowleft: DIR.LEFT,
        arrowright: DIR.RIGHT,
        w: DIR.UP,
        s: DIR.DOWN,
        a: DIR.LEFT,
        d: DIR.RIGHT
      };
      if (map[key]) this.setDirection(map[key]);
    });

    this.touchPad.querySelectorAll("button[data-turn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const turn = btn.getAttribute("data-turn");
        if (turn === "left") this.turnLeft();
        if (turn === "right") this.turnRight();
      });
    });
  }

  turnLeft() {
    const current = this.nextDirection;
    if (current === DIR.UP) this.setDirection(DIR.LEFT);
    if (current === DIR.LEFT) this.setDirection(DIR.DOWN);
    if (current === DIR.DOWN) this.setDirection(DIR.RIGHT);
    if (current === DIR.RIGHT) this.setDirection(DIR.UP);
  }

  turnRight() {
    const current = this.nextDirection;
    if (current === DIR.UP) this.setDirection(DIR.RIGHT);
    if (current === DIR.RIGHT) this.setDirection(DIR.DOWN);
    if (current === DIR.DOWN) this.setDirection(DIR.LEFT);
    if (current === DIR.LEFT) this.setDirection(DIR.UP);
  }

  setDirection(dir) {
    if (this.state !== "playing") return;
    if (OPPOSITE_DIR.get(this.direction) !== dir) {
      this.nextDirection = dir;
    }
  }

  clearAllFoods() {
    this.foodMeshes.forEach((m) => this.scene.remove(m));
    this.foodHalos.forEach((m) => this.scene.remove(m));
    this.foods = [];
    this.foodMeshes = [];
    this.foodHalos = [];
  }

  getFoodScaling() {
    const idx = Math.min(this.level - 1, FOOD_SCALING.length - 1);
    return FOOD_SCALING[idx];
  }

  spawnFoods() {
    this.clearAllFoods();
    const scaling = this.getFoodScaling();
    for (let i = 0; i < scaling.growth; i++) {
      this.spawnSingleFood("growth");
    }
    for (let i = 0; i < scaling.shrink; i++) {
      this.spawnSingleFood("shrink");
    }
  }

  spawnSingleFood(type) {
    let x, z;
    for (let attempts = 0; attempts < 500; attempts++) {
      x = Math.floor(Math.random() * GRID_SIZE) + MIN;
      z = Math.floor(Math.random() * GRID_SIZE) + MIN;
      const blockedBySnake = this.snake.some((s) => s.x === x && s.z === z);
      const blockedByObstacle = this.obstacles.some((o) => o.x === x && o.z === z);
      const blockedByFood = this.foods.some((f) => f.x === x && f.z === z);
      if (!blockedBySnake && !blockedByObstacle && !blockedByFood) break;
    }

    const food = { x, z, type };
    this.foods.push(food);

    const isGrowth = type === "growth";
    const color = isGrowth ? this.currentTheme.food : this.currentTheme.shrinkFood;
    const emissive = isGrowth ? this.currentTheme.foodEmissive : this.currentTheme.shrinkEmissive;
    const haloColor = isGrowth ? this.currentTheme.halo : this.currentTheme.shrinkHalo;

    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: 1.25,
      metalness: 0.2,
      roughness: 0.3
    });

    const geo = isGrowth
      ? new THREE.IcosahedronGeometry(0.44, 0)
      : new THREE.OctahedronGeometry(0.32, 0);

    const mesh = new THREE.Mesh(geo, mat);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(isGrowth ? 0.75 : 0.55, 0.08, 12, 24),
      new THREE.MeshBasicMaterial({ color: haloColor, transparent: true, opacity: 0.56 })
    );
    halo.rotation.x = Math.PI / 2;

    const px = x * CELL;
    const pz = z * CELL;
    mesh.position.set(px, 0.6, pz);
    halo.position.set(px, 0.16, pz);

    if (!isGrowth) {
      mesh.scale.setScalar(0.75);
    }

    this.scene.add(mesh, halo);
    this.foodMeshes.push(mesh);
    this.foodHalos.push(halo);
  }

  respawnSingleFood(index) {
    const oldFood = this.foods[index];
    const type = oldFood.type;

    // Remove old meshes
    this.scene.remove(this.foodMeshes[index]);
    this.scene.remove(this.foodHalos[index]);
    this.foods.splice(index, 1);
    this.foodMeshes.splice(index, 1);
    this.foodHalos.splice(index, 1);

    this.spawnSingleFood(type);
  }

  setObstaclesForLevel(level) {
    this.obstacles = [];
    this.obstacleMeshes.forEach((m) => this.scene.remove(m));
    this.obstacleMeshes = [];

    if (level <= 1) return;

    const index = ((level - 2) % (LEVEL_PATTERNS.length - 1)) + 1;
    const pattern = LEVEL_PATTERNS[index];
    const transformed = this.transformPattern(pattern, level);

    transformed.forEach((pos, i) => {
      const blocked =
        this.snake.some((s) => s.x === pos.x && s.z === pos.z) ||
        this.foods.some((f) => f.x === pos.x && f.z === pos.z);
      if (blocked) return;

      this.obstacles.push(pos);
      const useA = (i + level) % 2 === 0;
      const tone = useA ? this.currentTheme.obstacleA : this.currentTheme.obstacleB;
      const bh = level >= 8 ? 1.8 : level >= 5 ? 1.4 : 1.0;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, bh, 0.92),
        new THREE.MeshStandardMaterial({ color: tone, emissive: tone, emissiveIntensity: 0.65, roughness: 0.28, metalness: 0.28 })
      );
      mesh.position.set(pos.x * CELL, bh * 0.5, pos.z * CELL);
      this.obstacleMeshes.push(mesh);
      this.scene.add(mesh);
    });
  }

  transformPattern(pattern, level) {
    const rotation = level % 4;
    const offsetX = level % 2 === 0 ? 0 : 1;
    const offsetZ = level % 3 === 0 ? -1 : 0;

    return pattern
      .map((p) => {
        let x = p.x;
        let z = p.z;

        if (rotation === 1) {
          [x, z] = [-z, x];
        } else if (rotation === 2) {
          [x, z] = [-x, -z];
        } else if (rotation === 3) {
          [x, z] = [z, -x];
        }

        return { x: x + offsetX, z: z + offsetZ };
      })
      .filter((p) => p.x >= MIN && p.x <= MAX && p.z >= MIN && p.z <= MAX);
  }

  renderSnake(rebuild = false) {
    if (rebuild) {
      this.snake.forEach(() => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.92, 0.92, 0.92),
          new THREE.MeshStandardMaterial({
            color: this.pickSnakeColor(),
            emissive: this.pickSnakeColor(),
            emissiveIntensity: 0.75,
            roughness: 0.3,
            metalness: 0.15
          })
        );
        this.scene.add(mesh);
        this.snakeMeshes.push(mesh);
      });
    }

    while (this.snakeMeshes.length < this.snake.length) {
      const tone = this.pickSnakeColor();
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 0.92, 0.92),
        new THREE.MeshStandardMaterial({
          color: tone,
          emissive: tone,
          emissiveIntensity: 0.75,
          roughness: 0.3,
          metalness: 0.15
        })
      );
      this.scene.add(mesh);
      this.snakeMeshes.push(mesh);
    }

    for (let i = this.snake.length; i < this.snakeMeshes.length; i += 1) {
      this.snakeMeshes[i].visible = false;
    }

    this.snake.forEach((segment, i) => {
      const mesh = this.snakeMeshes[i];
      mesh.visible = true;
      mesh.position.set(segment.x * CELL, 0.5, segment.z * CELL);

      const tone = this.segmentColors[i] || this.pickSnakeColor();
      mesh.material.color.setHex(tone);
      mesh.material.emissive.setHex(tone);
      mesh.material.emissiveIntensity = i === 0 ? 0.95 : 0.72;
      if (i === 0) {
        mesh.scale.setScalar(1.04);
      } else {
        mesh.scale.setScalar(1);
      }
    });
  }

  createLevelUpVfx(origin) {
    const cols = [this.currentTheme.halo, this.currentTheme.rim, this.currentTheme.food];
    for (let i = 0; i < 80; i += 1) {
      const color = cols[i % cols.length];
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.07 + Math.random() * 0.12, 6, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
      );
      mesh.position.copy(origin);
      this.scene.add(mesh);
      const angle = (i / 80) * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.9;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * r,
        Math.random() * 1.1 + 0.3,
        Math.sin(angle) * r
      );
      this.particles.push({ mesh, velocity, life: 1.1 + Math.random() * 0.7, drag: 0.94 });
    }
  }

  createDeathExplosion(origin) {
    const cols = [this.currentTheme.food, this.currentTheme.halo, this.currentTheme.follow, 0xff2200];
    for (let i = 0; i < 110; i += 1) {
      const color = cols[i % cols.length];
      const size = 0.05 + Math.random() * 0.2;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 6, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
      );
      mesh.position.copy(origin);
      this.scene.add(mesh);
      const angle = Math.random() * Math.PI * 2;
      const elev = Math.random() * Math.PI * 0.55;
      const speed = 0.2 + Math.random() * 1.1;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * Math.cos(elev) * speed,
        Math.sin(elev) * speed + 0.2,
        Math.sin(angle) * Math.cos(elev) * speed
      );
      this.particles.push({ mesh, velocity, life: 0.9 + Math.random() * 1.2, drag: 0.9 });
    }
  }

  pickSnakeColor() {
    const palette = this.currentTheme.snakeNeons;
    return palette[Math.floor(Math.random() * palette.length)] || 0x7dff87;
  }

  createEatParticles(origin) {
    const cols = [this.currentTheme.halo, this.currentTheme.follow, this.currentTheme.food];
    for (let i = 0; i < 56; i += 1) {
      const color = cols[i % cols.length];
      const size = 0.06 + Math.random() * 0.12;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 6, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
      );
      mesh.position.copy(origin);
      this.scene.add(mesh);
      const angle = (i / 56) * Math.PI * 2;
      const speed = 0.15 + Math.random() * 0.55;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.random() * 0.65 + 0.1,
        Math.sin(angle) * speed
      );
      this.particles.push({ mesh, velocity, life: 0.55 + Math.random() * 0.7, drag: 0.92 });
    }
    for (let i = 0; i < 20; i += 1) {
      const color = i % 2 === 0 ? this.currentTheme.halo : this.currentTheme.food;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 5, 5),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
      );
      mesh.position.copy(origin);
      this.scene.add(mesh);
      const angle = (i / 20) * Math.PI * 2;
      const velocity = new THREE.Vector3(Math.cos(angle) * 0.65, 0.05, Math.sin(angle) * 0.65);
      this.particles.push({ mesh, velocity, life: 0.45 + Math.random() * 0.25, drag: 0.87 });
    }
  }

  createTrailParticle() {
    if (!this.snake.length || this.state !== "playing") return;
    const tail = this.snake[this.snake.length - 1];
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 6),
      new THREE.MeshBasicMaterial({ color: this.currentTheme.trail, transparent: true, opacity: 0.42 })
    );
    mesh.position.set(tail.x * CELL, 0.35, tail.z * CELL);
    this.scene.add(mesh);
    this.particles.push({
      mesh,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.06, 0.06, (Math.random() - 0.5) * 0.06),
      life: 0.45,
      drag: 0.9
    });
  }

  createAmbientParticles() {
    for (let i = 0; i < 90; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 + Math.random() * 0.05, 6, 6),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? this.currentTheme.ambientA : this.currentTheme.ambientB,
          transparent: true,
          opacity: 0.2 + Math.random() * 0.25
        })
      );
      mesh.position.set(
        MIN + Math.random() * GRID_SIZE,
        0.5 + Math.random() * 2,
        MIN + Math.random() * GRID_SIZE
      );
      this.ambientParticles.push({
        mesh,
        drift: new THREE.Vector3((Math.random() - 0.5) * 0.04, Math.random() * 0.01, (Math.random() - 0.5) * 0.04),
        phase: Math.random() * Math.PI * 2
      });
      this.scene.add(mesh);
    }
  }

  playTone(frequency, ms, type = "triangle", vol = 0.07) {
    if (!this.settings.soundEnabled) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!this.audioCtx) this.audioCtx = new Ctx();
    const ctx = this.audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const dur = ms / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + Math.min(0.02, dur * 0.15));
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  playEatSound() {
    const base = 460 + this.level * 18;
    this.playTone(base, 70, "triangle", 0.08);
    setTimeout(() => this.playTone(base * 1.25, 70, "triangle", 0.07), 65);
    setTimeout(() => this.playTone(base * 1.5, 90, "sine", 0.06), 130);
  }

  playLevelUpSound() {
    [1, 1.26, 1.5, 2].forEach((r, i) => {
      setTimeout(() => this.playTone(440 * r, 160, "triangle", 0.1), i * 95);
    });
  }

  playDeathSound() {
    [280, 200, 140, 90].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 170, "sawtooth", 0.09), i * 105);
    });
  }

  playShrinkSound() {
    const base = 320 - this.level * 8;
    this.playTone(base, 90, "sawtooth", 0.07);
    setTimeout(() => this.playTone(base * 0.8, 80, "sawtooth", 0.06), 70);
  }

  playLifeUseSound() {
    [520, 440, 520, 660].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 120, "triangle", 0.1), i * 80);
    });
  }

  getTrackIndexForLevel(level) {
    for (let i = 0; i < SOUNDTRACK_MAP.length; i++) {
      if (level <= SOUNDTRACK_MAP[i].maxLevel) return i;
    }
    return SOUNDTRACK_MAP.length - 1;
  }

  async loadSoundtracks() {
    if (this.soundtrackBuffers.length > 0) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!this.audioCtx) this.audioCtx = new Ctx();
    const ctx = this.audioCtx;

    const buffers = await Promise.all(
      SOUNDTRACK_MAP.map(async (entry) => {
        try {
          const res = await fetch(entry.file);
          if (!res.ok) return null;
          const arrayBuf = await res.arrayBuffer();
          return await ctx.decodeAudioData(arrayBuf);
        } catch {
          return null;
        }
      })
    );
    this.soundtrackBuffers = buffers;
  }

  startMusic() {
    if (!this.settings.soundEnabled) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || this.musicNodes) return;
    if (!this.audioCtx) this.audioCtx = new Ctx();
    const ctx = this.audioCtx;
    if (ctx.state === "suspended") ctx.resume();

    const trackIndex = this.getTrackIndexForLevel(this.level);
    const buffer = this.soundtrackBuffers[trackIndex];

    if (buffer) {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 1.5);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      this.musicNodes = { source, gain, type: "buffer" };
      this.currentTrackIndex = trackIndex;
    } else {
      // Fallback: oscillator-based music (original)
      const master = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2.5);
      master.connect(ctx.destination);
      const freqs = [55, 82.5, 110, 165];
      const oscs = freqs.map((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i % 2 === 0 ? "sine" : "triangle";
        osc.frequency.value = freq;
        osc.detune.value = i * 6 - 8;
        g.gain.value = 1 / freqs.length;
        osc.connect(g);
        g.connect(master);
        osc.start();
        return osc;
      });
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.14;
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain);
      lfoGain.connect(master.gain);
      lfo.start();
      this.musicNodes = { master, oscs, lfo, type: "oscillator" };
      this.currentTrackIndex = trackIndex;
    }
  }

  crossfadeTrack(newTrackIndex) {
    if (newTrackIndex === this.currentTrackIndex) return;
    if (!this.musicNodes || !this.audioCtx) return;

    const buffer = this.soundtrackBuffers[newTrackIndex];
    if (!buffer) return;

    const ctx = this.audioCtx;
    const fadeTime = 1.5;
    const now = ctx.currentTime;

    // Fade out current
    if (this.musicNodes.type === "buffer") {
      const old = this.musicNodes;
      try { old.gain.gain.linearRampToValueAtTime(0, now + fadeTime); } catch {}
      setTimeout(() => { try { old.source.stop(); } catch {} }, fadeTime * 1000 + 100);
    } else {
      this.stopMusic();
    }

    // Fade in new
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + fadeTime);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    this.musicNodes = { source, gain, type: "buffer" };
    this.currentTrackIndex = newTrackIndex;
  }

  stopMusic() {
    if (!this.musicNodes) return;
    const t = this.audioCtx ? this.audioCtx.currentTime + 0.5 : 0;
    if (this.musicNodes.type === "buffer") {
      const { source, gain } = this.musicNodes;
      try { gain.gain.linearRampToValueAtTime(0, t); } catch {}
      setTimeout(() => {
        try { source.stop(); } catch {}
        try { gain.disconnect(); } catch {}
      }, 600);
    } else {
      const { master, oscs, lfo } = this.musicNodes;
      try { master.gain.linearRampToValueAtTime(0, t); } catch {}
      setTimeout(() => {
        oscs.forEach(o => { try { o.stop(); } catch {} });
        try { lfo.stop(); } catch {}
        try { master.disconnect(); } catch {}
      }, 600);
    }
    this.musicNodes = null;
    this.currentTrackIndex = -1;
  }

  gameOver() {
    this.state = "gameover";
    this.stopMusic();
    this.playDeathSound();
    this.cameraShake = 0.85;
    if (this.snake.length) {
      const h = this.snake[0];
      this.createDeathExplosion(new THREE.Vector3(h.x * CELL, 0.5, h.z * CELL));
    }

    const highScore = Math.max(this.playerProfile.highScore, this.score);
    this.playerProfile.highScore = highScore;

    this.highScoreEl.textContent = `${highScore}`;
    this.finalScoreEl.textContent = `${this.score}`;
    this.finalHighScoreEl.textContent = `${highScore}`;

    if (this.onGameOver) {
      this.onGameOver({
        score: this.score,
        highScore
      });
    }
  }

  useExtraLife(headPos) {
    this.extraLives--;
    this.invincibleUntil = performance.now() + INVINCIBILITY_MS;
    this.playLifeUseSound();
    this.cameraShake = 0.35;

    // Remove last segments as penalty
    const removeCount = Math.min(3, this.snake.length - MIN_SNAKE_LENGTH);
    for (let i = 0; i < removeCount; i++) {
      this.snake.pop();
      this.segmentColors.pop();
    }

    this.createEatParticles(new THREE.Vector3(headPos.x * CELL, 0.5, headPos.z * CELL));
    this.updateHud();
  }

  updateLogic() {
    if (this.state !== "playing") return;

    this.direction = this.nextDirection;
    const head = this.snake[0];
    const next = {
      x: head.x + this.direction.x,
      z: head.z + this.direction.z
    };

    const hitWall = next.x < MIN || next.x > MAX || next.z < MIN || next.z > MAX;
    const hitSelf = this.snake.some((s) => s.x === next.x && s.z === next.z);
    const hitObstacle = this.obstacles.some((o) => o.x === next.x && o.z === next.z);

    const isInvincible = performance.now() < this.invincibleUntil;

    if ((hitWall || hitSelf || hitObstacle) && !isInvincible) {
      if (this.extraLives > 0) {
        this.useExtraLife(head);
        if (this.onLifeUsed) this.onLifeUsed(this.extraLives);
        return;
      }
      this.gameOver();
      return;
    }

    // Skip movement if invincible and would hit
    if ((hitWall || hitSelf || hitObstacle) && isInvincible) {
      return;
    }

    this.snake.unshift(next);
    this.segmentColors.unshift(this.pickSnakeColor());

    // Check collision with all foods
    let ateIndex = -1;
    for (let i = 0; i < this.foods.length; i++) {
      if (next.x === this.foods[i].x && next.z === this.foods[i].z) {
        ateIndex = i;
        break;
      }
    }

    if (ateIndex >= 0) {
      const food = this.foods[ateIndex];
      if (food.type === "growth") {
        this.score += 1;
        this.playEatSound();
      } else {
        // shrink
        this.score += SHRINK_BONUS;
        this.playShrinkSound();
        // Remove segments from tail
        const removeCount = Math.min(SHRINK_AMOUNT, this.snake.length - MIN_SNAKE_LENGTH);
        for (let i = 0; i < removeCount; i++) {
          this.snake.pop();
          this.segmentColors.pop();
        }
      }

      this.cameraShake = 0.1;
      this.createEatParticles(new THREE.Vector3(next.x * CELL, 0.5, next.z * CELL));
      this.respawnSingleFood(ateIndex);

      const expectedLevel = Math.floor(this.score / LEVEL_UP_EVERY) + 1;
      if (expectedLevel > this.level) {
        this.level = expectedLevel;
        this.speedMs = Math.max(MIN_SPEED_MS, START_SPEED_MS - (this.level - 1) * 11);
        this.setObstaclesForLevel(this.level);
        this.playLevelUpSound();
        this.createLevelUpVfx(new THREE.Vector3(next.x * CELL, 0.5, next.z * CELL));
        this.cameraShake = 0.22;

        // Re-spawn all foods with new scaling
        this.spawnFoods();

        // Check if soundtrack should change
        const newTrackIdx = this.getTrackIndexForLevel(this.level);
        if (newTrackIdx !== this.currentTrackIndex) {
          this.crossfadeTrack(newTrackIdx);
        }
      }
    } else {
      this.snake.pop();
      this.segmentColors.pop();
      this.createTrailParticle();
    }

    this.updateHud();
    this.renderSnake();

    if (this.onProgress) {
      this.onProgress({ score: this.score, level: this.level });
    }
  }

  updateParticles(delta) {
    this.particles = this.particles.filter((p) => {
      p.life -= delta;
      p.mesh.position.addScaledVector(p.velocity, delta * 17);
      p.velocity.multiplyScalar(p.drag);
      p.velocity.y -= delta * 0.12;
      p.mesh.material.opacity = Math.max(0, p.life * 1.1);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        return false;
      }
      return true;
    });
  }

  updateAmbientVfx(delta, nowMs) {
    const wave = Math.sin(nowMs * 0.0016) * 0.28;
    this.keyLight.intensity = 1.7 + wave * 0.55;
    this.rimLight.intensity = 1.25 - wave * 0.4;

    this.ambientParticles.forEach((p, idx) => {
      p.mesh.position.addScaledVector(p.drift, delta * 20);
      p.mesh.position.y += Math.sin(nowMs * 0.001 + p.phase + idx * 0.1) * 0.0018;

      if (p.mesh.position.x < MIN) p.mesh.position.x = MAX;
      if (p.mesh.position.x > MAX) p.mesh.position.x = MIN;
      if (p.mesh.position.z < MIN) p.mesh.position.z = MAX;
      if (p.mesh.position.z > MAX) p.mesh.position.z = MIN;
    });

    if (this.foodMeshes.length && this.foodHalos.length) {
      this.foodMeshes.forEach((mesh, i) => {
        const isGrowth = this.foods[i] && this.foods[i].type === "growth";
        mesh.rotation.y += delta * (isGrowth ? 3.2 : -3.2);
        mesh.rotation.x += delta * (isGrowth ? 1.9 : -1.9);
        mesh.position.y = 0.55 + Math.sin(nowMs * 0.005 + i * 0.7) * 0.13;
      });
      this.foodHalos.forEach((halo, i) => {
        halo.rotation.z += delta * 1.1;
        halo.material.opacity = 0.45 + Math.sin(nowMs * 0.006 + i * 0.5) * 0.17;
      });
    }

    // Invincibility blink effect
    if (performance.now() < this.invincibleUntil && this.snakeMeshes.length) {
      const blink = Math.sin(nowMs * 0.02) > 0;
      this.snakeMeshes.forEach((m) => { if (m.visible) m.material.opacity = blink ? 1 : 0.3; m.material.transparent = true; });
    } else if (this.snakeMeshes.length && this.snakeMeshes[0]?.material?.transparent) {
      this.snakeMeshes.forEach((m) => { m.material.opacity = 1; m.material.transparent = false; });
    }

    if (this.snake.length) {
      const head = this.snake[0];
      this.followLight.position.set(head.x * CELL, 1.3, head.z * CELL);
    }

    if (this.gridHelper?.material) {
      this.gridHelper.material.opacity = 0.18 + Math.abs(Math.sin(nowMs * 0.0012)) * 0.18;
    }

    if (this.obstacleMeshes.length) {
      const pulse = 0.5 + Math.sin(nowMs * 0.003) * 0.35;
      this.obstacleMeshes.forEach((mesh, i) => {
        if (mesh.material) {
          mesh.material.emissiveIntensity = pulse + Math.sin(nowMs * 0.005 + i * 0.9) * 0.18;
        }
      });
    }

    this.updateCamera(delta, nowMs);
  }

  updateCamera(delta = 0, _nowMs = performance.now()) {
    const hasSnake = this.snake.length > 0;
    const head = hasSnake ? this.snake[0] : { x: 0, z: 0 };
    const headWorld = new THREE.Vector3(head.x * CELL, 0, head.z * CELL);

    const sx = this.cameraShake > 0.002 ? (Math.random() - 0.5) * this.cameraShake * 1.5 : 0;
    const sy = this.cameraShake > 0.002 ? (Math.random() - 0.5) * this.cameraShake * 0.6 : 0;
    this.cameraShake = Math.max(0, this.cameraShake - (delta > 0 ? delta * 4.5 : 0));

    if (this.settings.cameraMode === "arcade") {
      // Smooth target follow
      this.cameraTarget.lerp(headWorld, Math.min(1, delta * 7.5 + 0.12));
      
      // Orbital rotation based on snake direction
      const dir = this.direction || DIR.RIGHT;
      let orbitAngle = Math.atan2(dir.z, dir.x);
      
      // Smooth angle interpolation (avoid abrupt jumps)
      if (this.lastOrbitAngle !== undefined) {
        let diff = orbitAngle - this.lastOrbitAngle;
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;
        orbitAngle = this.lastOrbitAngle + diff * Math.min(1, delta * 8);
      }
      this.lastOrbitAngle = orbitAngle;
      
      // Position orbit camera around target
      const orbitDist = 22;
      const orbitHeight = 28;
      const desired = new THREE.Vector3(
        this.cameraTarget.x + Math.cos(orbitAngle) * orbitDist + sx,
        orbitHeight + sy,
        this.cameraTarget.z + Math.sin(orbitAngle) * orbitDist + sy
      );
      
      // Smooth camera lerp
      this.camera.position.lerp(desired, Math.min(1, delta * 6.5 + 0.1));
      this.camera.lookAt(this.cameraTarget);
      return;
    }

    // Isometric follow — fixed diagonal offset, smooth lerp onto snake head
    const ISO_H = 17;
    const ISO_D = 14;
    const lerpT = Math.min(1, delta * 4 + 0.055);
    this.cameraTarget.lerp(headWorld, lerpT);
    const desired = new THREE.Vector3(
      this.cameraTarget.x + ISO_D + sx,
      ISO_H + sy,
      this.cameraTarget.z + ISO_D
    );
    this.camera.position.lerp(desired, lerpT);
    this.camera.lookAt(this.cameraTarget);
  }

  updateHud() {
    this.scoreEl.textContent = `${this.score}`;
    this.levelEl.textContent = `${this.level}`;
    this.highScoreEl.textContent = `${this.playerProfile.highScore}`;
    if (this.livesEl) {
      this.livesEl.textContent = `${this.extraLives}`;
      const container = this.livesEl.closest(".lives-pill");
      if (container) {
        if (this.extraLives > 0) container.classList.remove("hidden");
        else container.classList.add("hidden");
      }
    }
  }

  resize() {
    const viewport = window.visualViewport;
    const width = Math.max(Math.floor(viewport ? viewport.width : window.innerWidth), 1);
    const height = Math.max(Math.floor(viewport ? viewport.height : window.innerHeight), 1);
    const aspect = width / height;

    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.renderer.setSize(width, height, false);
    this.updateCamera(0);
  }

  createFloorTexture(theme) {
    const size = 512;
    const tile = size / 8;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const even = (x + y) % 2 === 0;
        const base = even ? theme.floorDark : theme.floorNeon;
        const hue = base[0];
        const sat = base[1];
        const light = base[2] + (even ? 0 : (x % 2 ? 5 : 0));
        ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
        ctx.fillRect(x * tile, y * tile, tile, tile);
      }
    }

    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = theme.floorLine;
    ctx.strokeStyle = theme.floorLine;
    for (let i = 0; i <= 8; i += 1) {
      const p = i * tile;
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
    }

    return new THREE.CanvasTexture(canvas);
  }

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  loop = () => {
    const delta = this.clock.getDelta();
    const now = performance.now();

    if (this.state === "playing" && now - this.lastTickMs > this.speedMs) {
      this.lastTickMs = now;
      this.updateLogic();
    }

    this.updateParticles(delta);
    this.updateAmbientVfx(delta, now);

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  };
}
