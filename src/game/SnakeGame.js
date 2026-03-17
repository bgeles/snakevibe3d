import * as THREE from "three";
import { DIR, GRID_SIZE, LEVEL_UP_EVERY, MIN_SPEED_MS, OPPOSITE_DIR, SETTINGS_LIMITS, START_SPEED_MS } from "./config.js";
import { LEVEL_PATTERNS } from "./levelPatterns.js";
import { DEFAULT_THEME, THEMES } from "./themes.js";

const CELL = 1;
const MIN = -Math.floor(GRID_SIZE / 2);
const MAX = MIN + GRID_SIZE - 1;
const CAMERA_VIEW_SIZE = GRID_SIZE + 6;

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
    onGameOver
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

    this.settings = {
      soundEnabled: Boolean(settings.soundEnabled),
      sensitivity: this.clamp(Number(settings.sensitivity) || 1, SETTINGS_LIMITS.MIN_SENSITIVITY, SETTINGS_LIMITS.MAX_SENSITIVITY),
      theme: THEMES[settings.theme] ? settings.theme : DEFAULT_THEME
    };

    this.playerProfile = {
      highScore: 0,
      theme: this.settings.theme
    };

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x100421, 16, 52);

    // Orthographic top-down camera keeps stable framing on mobile aspect ratios.
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 160);
    this.camera.position.set(0, 40, 0.01);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);

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
    this.food = { x: 0, z: 0 };
    this.foodMesh = null;
    this.foodHalo = null;

    this.score = 0;
    this.level = 1;
    this.speedMs = START_SPEED_MS;
    this.loopStarted = false;

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
  }

  getState() {
    return this.state;
  }

  startRun() {
    this.score = 0;
    this.level = 1;
    this.speedMs = START_SPEED_MS;
    this.state = "playing";

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

    this.setObstaclesForLevel(this.level);
    this.spawnFood();
    this.renderSnake(true);
    this.updateHud();
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
      emissiveIntensity: 0.36,
      metalness: 0.08,
      roughness: 0.72
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
    this.scene.fog = new THREE.Fog(theme.fog, 14, 58);

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

    if (this.foodMesh) {
      this.foodMesh.material.color.setHex(theme.food);
      this.foodMesh.material.emissive.setHex(theme.foodEmissive);
    }
    if (this.foodHalo) {
      this.foodHalo.material.color.setHex(theme.halo);
    }

    this.recolorAmbientParticles();
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

  spawnFood() {
    while (true) {
      const x = Math.floor(Math.random() * GRID_SIZE) + MIN;
      const z = Math.floor(Math.random() * GRID_SIZE) + MIN;
      const blockedBySnake = this.snake.some((s) => s.x === x && s.z === z);
      const blockedByObstacle = this.obstacles.some((o) => o.x === x && o.z === z);
      if (!blockedBySnake && !blockedByObstacle) {
        this.food = { x, z };
        break;
      }
    }

    if (!this.foodMesh) {
      const mat = new THREE.MeshStandardMaterial({
        color: this.currentTheme.food,
        emissive: this.currentTheme.foodEmissive,
        emissiveIntensity: 1.25,
        metalness: 0.2,
        roughness: 0.3
      });
      this.foodMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.44, 0), mat);
      this.foodHalo = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.08, 12, 24),
        new THREE.MeshBasicMaterial({ color: this.currentTheme.halo, transparent: true, opacity: 0.56 })
      );
      this.foodHalo.rotation.x = Math.PI / 2;
      this.scene.add(this.foodMesh, this.foodHalo);
    }

    const px = this.food.x * CELL;
    const pz = this.food.z * CELL;
    this.foodMesh.position.set(px, 0.6, pz);
    this.foodHalo.position.set(px, 0.16, pz);
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
        (this.food.x === pos.x && this.food.z === pos.z);
      if (blocked) return;

      this.obstacles.push(pos);
      const useA = (i + level) % 2 === 0;
      const tone = useA ? this.currentTheme.obstacleA : this.currentTheme.obstacleB;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: tone, emissive: tone, emissiveIntensity: 0.46, roughness: 0.45, metalness: 0.14 })
      );
      mesh.position.set(pos.x * CELL, 0.52, pos.z * CELL);
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

  pickSnakeColor() {
    const palette = this.currentTheme.snakeNeons;
    return palette[Math.floor(Math.random() * palette.length)] || 0x7dff87;
  }

  createEatParticles(origin) {
    const count = 34;
    for (let i = 0; i < count; i += 1) {
      const color = i % 2 === 0 ? this.currentTheme.halo : this.currentTheme.follow;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
      );
      mesh.position.copy(origin);
      this.scene.add(mesh);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.36,
        Math.random() * 0.38,
        (Math.random() - 0.5) * 0.36
      );
      this.particles.push({ mesh, velocity, life: 0.7 + Math.random() * 0.5, drag: 0.96 });
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

  playTone(frequency, ms) {
    if (!this.settings.soundEnabled) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    const audioCtx = this.audioCtx || new Ctx();
    this.audioCtx = audioCtx;

    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = frequency;
    osc.type = "triangle";
    gain.gain.value = 0.07;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000);
  }

  gameOver() {
    this.state = "gameover";
    this.playTone(150, 300);

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

    if (hitWall || hitSelf || hitObstacle) {
      this.gameOver();
      return;
    }

    this.snake.unshift(next);
    this.segmentColors.unshift(this.pickSnakeColor());

    const ateFood = next.x === this.food.x && next.z === this.food.z;
    if (ateFood) {
      this.score += 1;
      this.playTone(560 + this.level * 12, 85);
      this.createEatParticles(new THREE.Vector3(next.x * CELL, 0.5, next.z * CELL));
      this.spawnFood();

      const expectedLevel = Math.floor(this.score / LEVEL_UP_EVERY) + 1;
      if (expectedLevel > this.level) {
        this.level = expectedLevel;
        this.speedMs = Math.max(MIN_SPEED_MS, START_SPEED_MS - (this.level - 1) * 7);
        this.setObstaclesForLevel(this.level);
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
    const wave = Math.sin(nowMs * 0.0016) * 0.22;
    this.keyLight.intensity = 1.35 + wave * 0.3;
    this.rimLight.intensity = 0.9 - wave * 0.25;

    this.ambientParticles.forEach((p, idx) => {
      p.mesh.position.addScaledVector(p.drift, delta * 20);
      p.mesh.position.y += Math.sin(nowMs * 0.001 + p.phase + idx * 0.1) * 0.0018;

      if (p.mesh.position.x < MIN) p.mesh.position.x = MAX;
      if (p.mesh.position.x > MAX) p.mesh.position.x = MIN;
      if (p.mesh.position.z < MIN) p.mesh.position.z = MAX;
      if (p.mesh.position.z > MAX) p.mesh.position.z = MIN;
    });

    if (this.foodMesh && this.foodHalo) {
      this.foodMesh.rotation.y += delta * 3.2;
      this.foodMesh.rotation.x += delta * 1.9;
      this.foodMesh.position.y = 0.55 + Math.sin(nowMs * 0.005) * 0.13;

      this.foodHalo.rotation.z += delta * 1.1;
      this.foodHalo.material.opacity = 0.45 + Math.sin(nowMs * 0.006) * 0.17;
    }

    if (this.snake.length) {
      const head = this.snake[0];
      this.followLight.position.set(head.x * CELL, 1.3, head.z * CELL);
    }

    if (this.gridHelper?.material) {
      this.gridHelper.material.opacity = 0.2 + Math.abs(Math.sin(nowMs * 0.0012)) * 0.12;
    }
  }

  updateHud() {
    this.scoreEl.textContent = `${this.score}`;
    this.levelEl.textContent = `${this.level}`;
    this.highScoreEl.textContent = `${this.playerProfile.highScore}`;
  }

  resize() {
    const viewport = window.visualViewport;
    const width = Math.max(Math.floor(viewport ? viewport.width : window.innerWidth), 1);
    const height = Math.max(Math.floor(viewport ? viewport.height : window.innerHeight), 1);
    const aspect = width / height;

    let halfW = CAMERA_VIEW_SIZE / 2;
    let halfH = CAMERA_VIEW_SIZE / 2;

    if (aspect >= 1) {
      halfW *= aspect;
    } else {
      halfH /= aspect;
    }

    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.renderer.setSize(width, height, false);
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
