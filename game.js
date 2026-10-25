
"use strict";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start");

const CELL = 40;
const COLS = 20;
const ROWS = 12;
const SAVE_KEY = "portal-shift-save";
const SAVE_VERSION = 1;

const player = { x: 60, y: 60, size: 24, speed: 190 };
const portal = { x: 740, y: 420, size: 30 };

const keys = Object.create(null);
const crystals = [];
const walls = [];

let score = 0;
let level = 1;
let bestScore = 0;
let running = false;
let paused = false;
let saveReady = false;
let lastTime = 0;
let saveQueue = Promise.resolve();
let lastSubmittedScore = -1;
let animationScheduled = false;
let finishingLevel = false;

// Telefon joystigi yo'nalishi: -1 dan 1 gacha.
const joystick = { x: 0, y: 0 };

const levels = [
  [
    [4, 1], [4, 2], [4, 3], [4, 4],
    [8, 7], [9, 7], [10, 7],
    [13, 2], [13, 3], [13, 4],
    [16, 7], [16, 8], [16, 9]
  ],
  [
    [3, 2], [4, 2], [5, 2],
    [7, 4], [7, 5], [7, 6],
    [10, 2], [11, 2], [12, 2],
    [12, 7], [13, 7], [14, 7],
    [17, 3], [17, 4], [17, 5]
  ],
  [
    [3, 3], [3, 4], [3, 5],
    [6, 7], [7, 7], [8, 7],
    [10, 2], [10, 3], [10, 4],
    [13, 5], [14, 5], [15, 5],
    [17, 7], [17, 8], [17, 9]
  ]
];

// --------------------------------------------
// YORDAMCHI FUNKSIYALAR
// --------------------------------------------

function overlaps(a, b) {
  return (
    a.x < b.x + b.size &&
    a.x + a.size > b.x &&
    a.y < b.y + b.size &&
    a.y + a.size > b.y
  );
}

function updateHUD() {
  scoreEl.textContent = String(score);
  levelEl.textContent = String(level);
}

function showOverlay(title, message, buttonText) {
  overlayTitle.textContent = title;
  overlayText.textContent = message;
  startBtn.textContent = buttonText;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function clearInput() {
  for (const key in keys) {
    keys[key] = false;
  }

  joystick.x = 0;
  joystick.y = 0;
}

function getSaveData() {
  return JSON.stringify({
    version: SAVE_VERSION,
    score: Math.floor(score),
    level: Math.floor(level),
    bestScore: Math.floor(bestScore)
  });
}

// --------------------------------------------
// DARAJANI QURISH
// --------------------------------------------

function randomEmptyCell() {
  for (let i = 0; i < 500; i++) {
    const x = Math.floor(Math.random() * COLS) * CELL;
    const y = Math.floor(Math.random() * ROWS) * CELL;

    const candidate = {
      x: x + 10,
      y: y + 10,
      size: 20
    };

    if (candidate.x < 90 && candidate.y < 90) continue;
    if (overlaps(candidate, portal)) continue;
    if (walls.some(w => overlaps(candidate, w))) continue;
    if (crystals.some(c => overlaps(candidate, c))) continue;

    return candidate;
  }

  return { x: 360, y: 220, size: 20 };
}

function buildLevel() {
  walls.length = 0;
  crystals.length = 0;

  const layout = levels[(level - 1) % levels.length];

  for (const [col, row] of layout) {
    walls.push({
      x: col * CELL,
      y: row * CELL,
      size: CELL
    });
  }

  player.x = 60;
  player.y = 60;

  portal.x = 740;
  portal.y = 420;

  for (let i = 0; i < 6; i++) {
    crystals.push(randomEmptyCell());
  }

  updateHUD();
}

// --------------------------------------------
// HARAKAT VA DEVORLAR
// --------------------------------------------

function movePlayer(dx, dy) {
  const nextX = Math.max(
    0,
    Math.min(canvas.width - player.size, player.x + dx)
  );

  const nextY = Math.max(
    0,
    Math.min(canvas.height - player.size, player.y + dy)
  );

  const horizontal = { ...player, x: nextX };

  if (!walls.some(w => overlaps(horizontal, w))) {
    player.x = nextX;
  }

  const vertical = { ...player, y: nextY };

  if (!walls.some(w => overlaps(vertical, w))) {
    player.y = nextY;
  }
}

// --------------------------------------------
// CHIZISH
// --------------------------------------------

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#171c30";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#242c45";
  ctx.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += CELL) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += CELL) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  for (const wall of walls) {
    ctx.fillStyle = "#343c59";
    ctx.fillRect(
      wall.x + 2, wall.y + 2,
      wall.size - 4, wall.size - 4
    );

    ctx.strokeStyle = "#5b6b93";
    ctx.strokeRect(
      wall.x + 4, wall.y + 4,
      wall.size - 8, wall.size - 8
    );
  }

  ctx.save();
  ctx.shadowBlur = 22;
  ctx.shadowColor = "#bb70ff";
  ctx.strokeStyle = "#bb70ff";
  ctx.lineWidth = 5;

  ctx.beginPath();
  ctx.arc(
    portal.x + portal.size / 2,
    portal.y + portal.size / 2,
    portal.size / 2,
    0,
    Math.PI * 2
  );
  ctx.stroke();
  ctx.restore();

  for (const crystal of crystals) {
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#65f6e5";
    ctx.fillStyle = "#65f6e5";

    ctx.beginPath();
    ctx.moveTo(crystal.x + crystal.size / 2, crystal.y);
    ctx.lineTo(crystal.x + crystal.size, crystal.y + crystal.size / 2);
    ctx.lineTo(crystal.x + crystal.size / 2, crystal.y + crystal.size);
    ctx.lineTo(crystal.x, crystal.y + crystal.size / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = "#ff71b8";
  ctx.fillStyle = "#ff71b8";
  ctx.fillRect(player.x, player.y, player.size, player.size);
  ctx.restore();
}

// --------------------------------------------
// YOUTUBE CLOUD SAVE
// --------------------------------------------

async function loadProgress() {
  const gameAPI = window.ytgame?.game;

  if (gameAPI && typeof gameAPI.loadData === "function") {
    try {
      const data = await gameAPI.loadData();

      if (typeof data === "string" && data.length > 0) {
        const saved = JSON.parse(data);

        if (
          saved.version === SAVE_VERSION &&
          Number.isSafeInteger(saved.score) &&
          Number.isSafeInteger(saved.level) &&
          Number.isSafeInteger(saved.bestScore) &&
          saved.score >= 0 &&
          saved.level >= 1 &&
          saved.bestScore >= 0
        ) {
          score = saved.score;
          level = saved.level;
          bestScore = saved.bestScore;
        }
      }

      saveReady = true;
      console.info("Cloud save yuklandi.");
      return;
    } catch (error) {
      console.warn("Cloud save yuklanmadi:", error);
      saveReady = false;
      return;
    }
  }

  // Oddiy brauzerda mahalliy saqlash.
  if (!window.ytgame?.IN_PLAYABLES_ENV) {
    try {
      const data = localStorage.getItem(SAVE_KEY);

      if (data) {
        const saved = JSON.parse(data);

        if (
          Number.isSafeInteger(saved.score) &&
          Number.isSafeInteger(saved.level) &&
          Number.isSafeInteger(saved.bestScore) &&
          saved.score >= 0 &&
          saved.level >= 1 &&
          saved.bestScore >= 0
        ) {
          score = saved.score;
          level = saved.level;
          bestScore = saved.bestScore;
        }
      }
    } catch (error) {
      console.warn("Mahalliy save yuklanmadi:", error);
    }

    saveReady = true;
    return;
  }

  saveReady = false;
}

function saveProgress() {
  if (!saveReady) return saveQueue;

  const data = getSaveData();

  if (data.length > 10000) {
    console.error("Saqlanadigan ma'lumot juda katta.");
    return saveQueue;
  }

  if (window.ytgame?.IN_PLAYABLES_ENV) {
    const saveData = window.ytgame.game?.saveData;

    if (typeof saveData !== "function") {
      console.warn("Cloud save API mavjud emas.");
      return saveQueue;
    }

    saveQueue = saveQueue
      .catch(() => {})
      .then(() => saveData.call(window.ytgame.game, data))
      .catch(error => {
        console.warn("Cloud save xatosi:", error);
      });

    return saveQueue;
  }

  try {
    localStorage.setItem(SAVE_KEY, data);
  } catch (error) {
    console.warn("Mahalliy saqlash xatosi:", error);
  }

  return Promise.resolve();
}

// --------------------------------------------
// NATIJANI YUBORISH
// --------------------------------------------

async function submitBestScore() {
  const engagement = window.ytgame?.engagement;

  if (!engagement || typeof engagement.sendScore !== "function") {
    return;
  }

  const value = Math.floor(bestScore);

  if (!Number.isSafeInteger(value) || value < 0) return;
  if (value === lastSubmittedScore) return;

  try {
    await engagement.sendScore({ value });
    lastSubmittedScore = value;
    console.info("Eng yaxshi natija yuborildi:", value);
  } catch (error) {
    console.warn("Natija yuborilmadi:", error);
  }
}

// --------------------------------------------
// BOSQICH TUGASHI
// --------------------------------------------

async function finishLevel() {
  if (!running || finishingLevel) return;

  finishingLevel = true;
  running = false;
  clearInput();

  score += 100;
  bestScore = Math.max(bestScore, score);
  updateHUD();

  await Promise.allSettled([
    saveProgress(),
    submitBestScore()
  ]);

  showOverlay(
    "LEVEL COMPLATED!",
    `SCORE: ${score}. READY FOR NEXT LEVEL?`,
    "NEXT LEVEL"
  );

  startBtn.onclick = () => {
    if (!saveReady) return;

    level++;
    finishingLevel = false;
    buildLevel();
    hideOverlay();

    running = true;
    paused = false;
    lastTime = performance.now();

    startBtn.onclick = startGame;
  };
}

function startGame() {
  if (!saveReady) {
    showOverlay(
      "WAIT",
      "GAME LOADING",
      "WAIT"
    );
    return;
  }

  if (crystals.length === 0) {
    buildLevel();
  }

  finishingLevel = false;
  clearInput();
  hideOverlay();

  paused = false;
  running = true;
  lastTime = performance.now();
}

// --------------------------------------------
// YANGILASH
// --------------------------------------------

function update(delta) {
  if (!running || paused) return;

  let dx = 0;
  let dy = 0;

  // Kompyuter klaviaturasi.
  if (keys.ArrowLeft || keys.a) dx--;
  if (keys.ArrowRight || keys.d) dx++;
  if (keys.ArrowUp || keys.w) dy--;
  if (keys.ArrowDown || keys.s) dy++;

  // Telefon joystigi.
  dx += joystick.x;
  dy += joystick.y;

  // Tezlik diagonal harakatda oshib ketmasin.
  const length = Math.hypot(dx, dy);

  if (length > 1) {
    dx /= length;
    dy /= length;
  }

  movePlayer(
    dx * player.speed * delta,
    dy * player.speed * delta
  );

  let collected = false;

  for (let i = crystals.length - 1; i >= 0; i--) {
    if (overlaps(player, crystals[i])) {
      crystals.splice(i, 1);
      score += 10;
      collected = true;
    }
  }

  if (collected) {
    bestScore = Math.max(bestScore, score);
    updateHUD();
    void saveProgress();
  }

  if (crystals.length === 0 && overlaps(player, portal)) {
    void finishLevel();
  }
}

// --------------------------------------------
// O'YIN SIKLI
// --------------------------------------------

function loop(now) {
  const delta = Math.min((now - lastTime) / 1000 || 0, 0.04);
  lastTime = now;

  update(delta);
  draw();

  requestAnimationFrame(loop);
}

// --------------------------------------------
// KLAVIATURA
// --------------------------------------------

window.addEventListener("keydown", event => {
  const key = event.key.length === 1
    ? event.key.toLowerCase()
    : event.key;

  const controlledKeys = [
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "w", "a", "s", "d", " "
  ];

  if (controlledKeys.includes(key)) {
    event.preventDefault();
  }

  keys[key] = true;
});

window.addEventListener("keyup", event => {
  const key = event.key.length === 1
    ? event.key.toLowerCase()
    : event.key;

  keys[key] = false;
});

window.addEventListener("blur", clearInput);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearInput();
});

// --------------------------------------------
// TELEFON UCHUN JOYSTIK
// --------------------------------------------

function createJoystick() {
  // Takroran joystick yaratib yubormaslik.
  if (document.getElementById("portal-shift-joystick")) return;

  const style = document.createElement("style");

  style.textContent = `
    #portal-shift-joystick {
      position: fixed;
      left: 24px;
      bottom: 24px;
      width: 140px;
      height: 140px;
      border-radius: 50%;
      background: rgba(110, 125, 170, 0.24);
      border: 2px solid rgba(190, 200, 235, 0.48);
      z-index: 99999;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      box-sizing: border-box;
      display: none;
    }

    #portal-shift-joystick .ps-stick {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 58px;
      height: 58px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: rgba(187, 112, 255, 0.92);
      border: 2px solid rgba(255, 255, 255, 0.85);
      box-shadow: 0 0 18px rgba(187, 112, 255, 0.35);
      box-sizing: border-box;
      pointer-events: none;
    }

    @media (hover: none), (pointer: coarse) {
      #portal-shift-joystick {
        display: block;
      }
    }

    @media (max-width: 420px) {
      #portal-shift-joystick {
        width: 120px;
        height: 120px;
        left: 16px;
        bottom: 16px;
      }

      #portal-shift-joystick .ps-stick {
        width: 52px;
        height: 52px;
      }
    }
  `;

  document.head.appendChild(style);

  const base = document.createElement("div");
  base.id = "portal-shift-joystick";
  base.setAttribute("aria-label", "Harakat joystigi");

  const stick = document.createElement("div");
  stick.className = "ps-stick";
  base.appendChild(stick);
  document.body.appendChild(base);

  const maxDistance = 42;
  let pointerId = null;

  function resetJoystick() {
    pointerId = null;
    joystick.x = 0;
    joystick.y = 0;
    stick.style.left = "50%";
    stick.style.top = "50%";
  }

  function moveStick(event) {
    if (pointerId !== event.pointerId) return;

    event.preventDefault();

    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let offsetX = event.clientX - centerX;
    let offsetY = event.clientY - centerY;

    const distance = Math.hypot(offsetX, offsetY);

    if (distance > maxDistance) {
      offsetX = (offsetX / distance) * maxDistance;
      offsetY = (offsetY / distance) * maxDistance;
    }

    joystick.x = offsetX / maxDistance;
    joystick.y = offsetY / maxDistance;

    stick.style.left = `calc(50% + ${offsetX}px)`;
    stick.style.top = `calc(50% + ${offsetY}px)`;
  }

  base.addEventListener("pointerdown", event => {
    event.preventDefault();

    if (pointerId !== null) return;

    pointerId = event.pointerId;

    try {
      base.setPointerCapture(pointerId);
    } catch (_) {
      // Ayrim brauzerlarda pointer capture mavjud bo'lmasligi mumkin.
    }

    moveStick(event);
  });

  base.addEventListener("pointermove", moveStick);

  base.addEventListener("pointerup", event => {
    if (pointerId === event.pointerId) resetJoystick();
  });

  base.addEventListener("pointercancel", resetJoystick);
  base.addEventListener("lostpointercapture", resetJoystick);
}

// --------------------------------------------
// ESKI DATA-DIR TUGMALARI BO'LSA HAM ISHLAYDI
// --------------------------------------------

document.querySelectorAll("[data-dir]").forEach(button => {
  const direction = button.dataset.dir;

  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    keys[direction] = true;
  });

  const release = event => {
    event.preventDefault();
    keys[direction] = false;
  };

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

// --------------------------------------------
// YOUTUBE PLAYABLES SDK
// --------------------------------------------

function notifyGameReady() {
  const gameAPI = window.ytgame?.game;

  try {
    if (typeof gameAPI?.firstFrameReady === "function") {
      gameAPI.firstFrameReady();
    }

    if (typeof gameAPI?.gameReady === "function") {
      gameAPI.gameReady();
    }
  } catch (error) {
    console.error("SDK ready signali yuborilmadi:", error);
  }
}

function setupLifecycle() {
  const system = window.ytgame?.system;

  try {
    if (typeof system?.onPause === "function") {
      system.onPause(() => {
        paused = true;
        clearInput();
      });
    }

    if (typeof system?.onResume === "function") {
      system.onResume(() => {
        paused = false;
        lastTime = performance.now();
      });
    }
  } catch (error) {
    console.warn("Lifecycle sozlamasi:", error);
  }
}

// --------------------------------------------
// ISHGA TUSHIRISH
// --------------------------------------------

async function initializeGame() {
  // Birinchi kadrni SDK signalidan oldin tayyorlaymiz.
  buildLevel();
  draw();

  createJoystick();
  setupLifecycle();
  notifyGameReady();

  startBtn.disabled = true;

  showOverlay(
    "PORTAL SHIFT",
    "GAME LOADING",
    "WAIT"
  );

  await loadProgress();

  buildLevel();
  draw();

  if (saveReady) {
    showOverlay(
      "READY?",
      "Collect crystals. Reach the portal!",
      "START GAME"
    );

    startBtn.disabled = false;
    startBtn.onclick = startGame;
  } else {
    showOverlay(
      "SAVE PROBLEM",
      "Data failed to load. Please try again..",
      "RETRY"
    );

    startBtn.disabled = false;

    startBtn.onclick = async () => {
      startBtn.disabled = true;

      await loadProgress();
      buildLevel();
      draw();

      if (saveReady) {
        showOverlay(
          "READY?",
          "Collect crystals. Reach the portal!",
          "START GAME"
        );

        startBtn.onclick = startGame;
      }

      startBtn.disabled = false;
    };
  }

  if (!animationScheduled) {
    animationScheduled = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

void initializeGame();
