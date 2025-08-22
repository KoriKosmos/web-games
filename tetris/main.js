const COLS = 10;
const ROWS = 20;
const SIZE = 30;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');

const holdCanvas = document.getElementById('hold');
const holdCtx = holdCanvas.getContext('2d');

function scaleForHiDPI(c, context) {
  const dpr = window.devicePixelRatio || 1;
  if (dpr !== 1) {
    c.style.width = c.width + 'px';
    c.style.height = c.height + 'px';
    c.width = Math.floor(c.width * dpr);
    c.height = Math.floor(c.height * dpr);
    context.scale(dpr, dpr);
  }
}

scaleForHiDPI(canvas, ctx);
scaleForHiDPI(nextCanvas, nextCtx);
scaleForHiDPI(holdCanvas, holdCtx);

// --- User & High Score ---
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/`;
}

let username = localStorage.getItem('tetris_username');
while (!username) {
  username = prompt('Enter a username:')?.trim();
}
localStorage.setItem('tetris_username', username);

let highScore = parseInt(getCookie('tetris_highscore') || '0', 10);

function loadLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem('tetris_leaderboard')) || [];
  } catch {
    return [];
  }
}

function saveLeaderboard(data) {
  localStorage.setItem('tetris_leaderboard', JSON.stringify(data));
}

function renderLeaderboard(data) {
  const list = document.getElementById('leaderboard');
  list.innerHTML = data.map((e, i) => `<li>${e.name}: ${e.score}</li>`).join('');
}

let leaderboard = loadLeaderboard();
renderLeaderboard(leaderboard);

// --- Scoring ---
let score = 0;
let lines = 0;
let level = 0;
let dropInterval = 800; // ms per row at level 0

function updateSpeed() {
  dropInterval = Math.max(100, 800 - level * 80);
}

const $score = document.getElementById('score');
const $lines = document.getElementById('lines');
const $level = document.getElementById('level');
const $high = document.getElementById('highscore');

function updateHUD() {
  $score.textContent = score;
  $lines.textContent = lines;
  $level.textContent = level;
  $high.textContent = highScore;
}

function addScore(cleared) {
  const table = [0, 100, 300, 500, 800];
  score += table[cleared] * (level + 1);
  lines += cleared;
  const target = (level + 1) * 10;
  if (lines >= target) {
    level++;
    updateSpeed();
  }
  updateHUD();
}

// --- Playfield state ---
const board = Array.from({length: ROWS}, () => Array(COLS).fill(0));

const COLORS = [
  null,
  '#00f0f0',
  '#0000f0',
  '#f0a000',
  '#f0f000',
  '#00f000',
  '#a000f0',
  '#f00000',
];

// --- Gravity timing ---
let lastTime = 0;
let dropCounter = 0;
let lockTimer = 0;
const LOCK_DELAY = 500;

// Draw one cell
function drawCell(x, y, color, context = ctx, size = SIZE) {
  const px = x * size;
  const py = y * size;
  context.fillStyle = color;
  context.fillRect(px, py, size, size);
  context.strokeStyle = '#111';
  context.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
}

// --- Tetromino definitions ---
const SHAPES = {
  I: [[1, 1, 1, 1]],
  J: [[2, 0, 0], [2, 2, 2]],
  L: [[0, 0, 3], [3, 3, 3]],
  O: [[4, 4], [4, 4]],
  S: [[0, 5, 5], [5, 5, 0]],
  T: [[0, 6, 0], [6, 6, 6]],
  Z: [[7, 7, 0], [0, 7, 7]],
};

const JLSTZ_KICKS = {
  0: {
    1: [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '-1': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  },
  1: {
    1: [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '-1': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  },
  2: {
    1: [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '-1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  },
  3: {
    1: [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '-1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  },
};

const I_KICKS = {
  0: {
    1: [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '-1': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  },
  1: {
    1: [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '-1': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  },
  2: {
    1: [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '-1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  },
  3: {
    1: [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '-1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  },
};

function rotate(mat, dir = 1) {
  const h = mat.length, w = mat[0].length;
  const res = Array.from({length: w}, () => Array(h).fill(0));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (dir === 1) res[x][h - 1 - y] = mat[y][x];
      else res[w - 1 - x][y] = mat[y][x];
    }
  }
  return res;
}

// Active piece state and 7-bag queue
let piece = null;
let next = null;
let hold = null;
let holdUsed = false;

let bag = [];

function refillBag() {
  bag = Object.keys(SHAPES);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
}

function getNextPiece() {
  if (!bag.length) refillBag();
  const t = bag.pop();
  return { matrix: SHAPES[t].map(row => row.slice()), type: t };
}

function renderPreview(context, mat, canvas) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!mat) return;
  const offsetX = Math.floor((4 - mat[0].length) / 2);
  const offsetY = Math.floor((4 - mat.length) / 2);
  for (let y = 0; y < mat.length; y++) {
    for (let x = 0; x < mat[y].length; x++) {
      const v = mat[y][x];
      if (!v) continue;
      drawCell(x + offsetX, y + offsetY, COLORS[v], context);
    }
  }
}

function drawMatrix(mat, offX, offY) {
  for (let y = 0; y < mat.length; y++) {
    for (let x = 0; x < mat[y].length; x++) {
      const v = mat[y][x];
      if (!v) continue;
      const gx = offX + x;
      const gy = offY + y;
      if (gy >= 0) {
        drawCell(gx, gy, COLORS[v]);
      }
    }
  }
}

function spawn() {
  const { matrix, type } = next;
  piece = {
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: -1,
    type,
    rot: 0,
  };
  next = getNextPiece();
  renderPreview(nextCtx, next.matrix, nextCanvas);
  holdUsed = false;
  renderPreview(holdCtx, hold ? hold.matrix : null, holdCanvas);
  lockTimer = 0;
  dropCounter = 0;
}

function holdPiece() {
  if (holdUsed) return;
  if (hold) {
    const temp = { matrix: piece.matrix, type: piece.type };
    piece.matrix = hold.matrix;
    piece.type = hold.type;
    piece.x = Math.floor((COLS - piece.matrix[0].length) / 2);
    piece.y = -1;
    hold = temp;
  } else {
    hold = { matrix: piece.matrix, type: piece.type };
    spawn();
  }
  holdUsed = true;
  lockTimer = 0;
  dropCounter = 0;
  renderPreview(holdCtx, hold.matrix, holdCanvas);
  render();
}

function isValidPosition(mat, offX, offY) {
  for (let y = 0; y < mat.length; y++) {
    for (let x = 0; x < mat[y].length; x++) {
      const v = mat[y][x];
      if (!v) continue;
      const gx = offX + x;
      const gy = offY + y;
      if (gx < 0 || gx >= COLS || gy >= ROWS) return false;
      if (gy < 0) continue;
      if (board[gy][gx]) return false;
    }
  }
  return true;
}

function mergePiece() {
  const {matrix, x: offX, y: offY} = piece;
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      const v = matrix[y][x];
      if (!v) continue;
      const gx = offX + x;
      const gy = offY + y;
      if (gy >= 0) board[gy][gx] = v;
    }
  }
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(v => v !== 0)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(0));
      cleared++;
      y++;
    }
  }
  return cleared;
}

function tryMove(dx, dy) {
  const nx = piece.x + dx;
  const ny = piece.y + dy;
  if (isValidPosition(piece.matrix, nx, ny)) {
    piece.x = nx;
    piece.y = ny;
    lockTimer = 0;
    return true;
  }
  return false;
}

function tryRotate(dir = 1) {
  if (piece.type === 'O') return true;
  const rotated = rotate(piece.matrix, dir);
  const oldRot = piece.rot;
  const newRot = (oldRot + (dir === 1 ? 1 : 3)) % 4;
  const table = piece.type === 'I' ? I_KICKS : JLSTZ_KICKS;
  const kicks = table[oldRot][dir === 1 ? 1 : '-1'];
  for (const [kx, ky] of kicks) {
    const nx = piece.x + kx;
    const ny = piece.y + ky;
    if (isValidPosition(rotated, nx, ny)) {
      piece.matrix = rotated;
      piece.x = nx;
      piece.y = ny;
      piece.rot = newRot;
      lockTimer = 0;
      return true;
    }
  }
  return false;
}

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, COLS * SIZE, ROWS * SIZE);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const v = board[y][x];
      if (v) drawCell(x, y, COLORS[v]);
    }
  }
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * SIZE, 0);
    ctx.lineTo(x * SIZE, ROWS * SIZE);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * SIZE);
    ctx.lineTo(COLS * SIZE, y * SIZE);
    ctx.stroke();
  }
  if (piece) {
    drawMatrix(piece.matrix, piece.x, piece.y);
  }
}

function lockPiece() {
  mergePiece();
  const cleared = clearLines();
  if (cleared) addScore(cleared);
  spawn();
  if (!isValidPosition(piece.matrix, piece.x, piece.y)) {
    if (score > highScore) {
      highScore = score;
      setCookie('tetris_highscore', highScore, 365);
    }
    leaderboard.push({ name: username, score });
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 10);
    saveLeaderboard(leaderboard);
    renderLeaderboard(leaderboard);
    alert(`Game over, ${username}! Your score: ${score}`);
    for (let y = 0; y < ROWS; y++) board[y].fill(0);
    score = 0; lines = 0; level = 0;
    updateSpeed();
    updateHUD();
    spawn();
  }
  dropCounter = 0;
  lockTimer = 0;
  render();
}

function drop() {
  tryMove(0, 1);
}

function hardDrop() {
  let distance = 0;
  while (isValidPosition(piece.matrix, piece.x, piece.y + 1)) {
    piece.y++;
    distance++;
  }
  if (distance > 0) {
    score += distance * 2 * (level + 1);
    updateHUD();
  }
  lockPiece();
}

function update(time = 0) {
  const dt = time - lastTime;
  lastTime = time;
  dropCounter += dt;
  if (dropCounter >= dropInterval) {
    drop();
    dropCounter = 0;
  }
  if (horiz !== 0) {
    if (dasTimer < DAS) {
      dasTimer += dt;
    } else {
      arrTimer += dt;
      if (arrTimer >= ARR) {
        tryMove(horiz, 0);
        arrTimer = 0;
      }
    }
  }
  if (keys.down) {
    softTimer += dt;
    if (softTimer >= SOFT) {
      drop();
      softTimer = 0;
    }
  } else {
    softTimer = 0;
  }
  const grounded = !isValidPosition(piece.matrix, piece.x, piece.y + 1);
  if (grounded) {
    lockTimer += dt;
    if (lockTimer >= LOCK_DELAY) {
      lockPiece();
    }
  } else {
    lockTimer = 0;
  }
  render();
  requestAnimationFrame(update);
}

const keys = { left: false, right: false, down: false };
let horiz = 0;
let dasTimer = 0;
let arrTimer = 0;
const DAS = 170;
const ARR = 50;
let softTimer = 0;
const SOFT = 40;

function setHoriz(dir) {
  if (horiz !== dir) {
    horiz = dir;
    dasTimer = 0;
    arrTimer = 0;
    if (dir !== 0) {
      tryMove(dir, 0);
    }
  }
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') {
    if (!keys.left) { keys.left = true; setHoriz(-1); }
    e.preventDefault();
  } else if (e.key === 'ArrowRight') {
    if (!keys.right) { keys.right = true; setHoriz(1); }
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    keys.down = true; e.preventDefault();
  } else if (e.key === 'x' || e.key === 'X') {
    tryRotate(1); e.preventDefault();
  } else if (e.key === 'z' || e.key === 'Z') {
    tryRotate(-1); e.preventDefault();
  } else if (e.code === 'Space') {
    if (!e.repeat) hardDrop();
    e.preventDefault();
  } else if (e.key === 'c' || e.key === 'C' || e.key === 'Shift') {
    holdPiece(); e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') {
    keys.left = false;
    setHoriz(keys.right ? 1 : 0);
  } else if (e.key === 'ArrowRight') {
    keys.right = false;
    setHoriz(keys.left ? -1 : 0);
  } else if (e.key === 'ArrowDown') {
    keys.down = false;
    softTimer = 0;
  }
});

const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnRotate = document.getElementById('btn-rotate');
const btnRotateCCW = document.getElementById('btn-rotate-ccw');
const btnDrop = document.getElementById('btn-drop');
const btnHold = document.getElementById('btn-hold');

if (btnLeft && btnRight && btnRotate && btnRotateCCW && btnDrop && btnHold) {
  function bindButton(el, down, up) {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); down(); });
    el.addEventListener('pointerup', (e) => { e.preventDefault(); if (up) up(); });
    el.addEventListener('pointerleave', () => { if (up) up(); });
  }
  bindButton(btnLeft, () => { keys.left = true; setHoriz(-1); }, () => { keys.left = false; setHoriz(keys.right ? 1 : 0); });
  bindButton(btnRight, () => { keys.right = true; setHoriz(1); }, () => { keys.right = false; setHoriz(keys.left ? -1 : 0); });
  btnRotate.addEventListener('pointerdown', (e) => { e.preventDefault(); tryRotate(1); });
  btnRotateCCW.addEventListener('pointerdown', (e) => { e.preventDefault(); tryRotate(-1); });
  btnDrop.addEventListener('pointerdown', (e) => { e.preventDefault(); hardDrop(); });
  btnHold.addEventListener('pointerdown', (e) => { e.preventDefault(); holdPiece(); });
}

next = getNextPiece();
updateSpeed();
spawn();
updateHUD();
requestAnimationFrame(update);
