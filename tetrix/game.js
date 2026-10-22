
'use strict';

/* ============================================================
   TETRIX - Juego completo en JavaScript puro (sin librerias)
   ============================================================ */

// ---------- Configuracion ----------
const COLS = 10;
const ROWS = 20;
const CELL = 30;              // tamano de cada celda en pixeles

const SHAPES = {
  I: { color: '#22d3ee', cells: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
  J: { color: '#3b82f6', cells: [[1,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
  L: { color: '#f97316', cells: [[0,0,0,1],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
  O: { color: '#facc15', cells: [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]] },
  S: { color: '#22c55e', cells: [[0,0,1,1],[0,1,1,0],[0,0,0,0],[0,0,0,0]] },
  T: { color: '#a855f7', cells: [[0,1,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]] },
  Z: { color: '#ef4444', cells: [[1,1,0,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]] },
};

const KEYS = Object.keys(SHAPES);

// ---------- Estado ----------
let board = [];              // tablero: ROWS x COLS (null = vacio)
let current = null;          // pieza activa { type, matrix, x, y }
let nextQueue = [];          // proximas piezas
let holdType = null;         // pieza reservada
let canHold = true;

let score = 0;
let lines = 0;
let level = 1;

let dropTimer = 0;
let lastTime = 0;
let state = 'idle';          // idle | playing | paused | over
let soundOn = true;
let audioCtx = null;

// ---------- Elementos DOM ----------
const boardCanvas = document.getElementById('board');
const ctx = boardCanvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const startBtn = document.getElementById('start-btn');

// ============================================================
// LOGICA DEL JUEGO
// ============================================================

function createBoard() {
  const b = [];
  for (let y = 0; y < ROWS; y++) {
    b.push(new Array(COLS).fill(null));
  }
  return b;
}

/** Generador 7-bag: todas las piezas aparecen una vez por ciclo */
function refillBag() {
  const bag = KEYS.slice();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function nextType() {
  if (nextQueue.length <= 3) {
    nextQueue = nextQueue.concat(refillBag());
  }
  return nextQueue.shift();
}

function newPiece(type) {
  const matrix = SHAPES[type].cells.map(function (r) { return r.slice(); });
  // Centra la pieza segun las columnas que realmente ocupa
  let minX = 4, maxX = -1;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if (matrix[y][x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  const width = maxX - minX + 1;
  const startCol = Math.floor((COLS - width) / 2);
  return {
    type: type,
    matrix: matrix,
    x: startCol - minX,
    y: -1
  };
}

function spawnPiece() {
  current = newPiece(nextType());
  if (collides(current.matrix, current.x, current.y)) {
    endGame();
    return false;
  }
  return true;
}

/** Rota la matriz 4x4 de la pieza */
function rotateMatrix(matrix, dir) {
  const out = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if (matrix[y][x]) {
        if (dir > 0) out[x][3 - y] = 1;
        else out[3 - x][y] = 1;
      }
    }
  }
  return out;
}

/** Comprueba si la pieza choca con los bordes o con bloques */
function collides(matrix, offsetX, offsetY) {
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if (!matrix[y][x]) continue;
      const nx = offsetX + x;
      const ny = offsetY + y;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function mergePiece() {
  const color = SHAPES[current.type].color;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if (!current.matrix[y][x]) continue;
      const ny = current.y + y;
      const nx = current.x + x;
      if (ny >= 0) board[ny][nx] = color;
    }
  }
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0 && cleared < 4; y--) {
    if (board[y].every(function (c) { return c !== null; })) {
      board.splice(y, 1);
      board.unshift(new Array(COLS).fill(null));
      cleared++;
      y++;
    }
  }
  return cleared;
}

function lockPiece() {
  mergePiece();
  playSound('lock');

  const cleared = clearLines();
  if (cleared > 0) {
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared] * level;
    playSound(cleared === 4 ? 'tetris' : 'line');
    level = Math.floor(lines / 10) + 1;
  } else {
    score += 10;
  }

  canHold = true;
  updateStats();

  if (!spawnPiece()) return;
  drawNext();
}

function move(dx) {
  if (state !== 'playing') return;
  if (!collides(current.matrix, current.x + dx, current.y)) {
    current.x += dx;
    playSound('move');
  }
}

function softDrop() {
  if (state !== 'playing') return;
  if (!collides(current.matrix, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateStats();
  } else {
    lockPiece();
  }
}

function hardDrop() {
  if (state !== 'playing') return;
  let distance = 0;
  while (!collides(current.matrix, current.x, current.y + 1)) {
    current.y++;
    distance++;
  }
  score += distance * 2;
  playSound('drop');
  lockPiece();
}

function rotate(dir) {
  if (state !== 'playing') return;
  const rotated = rotateMatrix(current.matrix, dir);
  const kicks = [0, -1, 1, -2, 2];   // wall kick
  for (let i = 0; i < kicks.length; i++) {
    const k = kicks[i];
    if (!collides(rotated, current.x + k, current.y)) {
      current.matrix = rotated;
      current.x += k;
      playSound('rotate');
      return;
    }
  }
}

function holdPiece() {
  if (state !== 'playing' || !canHold) return;
  canHold = false;
  const previous = holdType;
  holdType = current.type;
  if (previous) {
    current = newPiece(previous);
    if (collides(current.matrix, current.x, current.y)) endGame();
  } else {
    spawnPiece();
  }
  drawHold();
  playSound('rotate');
}

function getDropInterval() {
  return Math.max(80, 800 - (level - 1) * 70);
}

function updateStats() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function endGame() {
  state = 'over';
  playSound('over');
  overlayTitle.textContent = 'FIN';
  overlayText.textContent = 'Puntuacion: ' + score + ' - Lineas: ' + lines;
  startBtn.textContent = 'JUGAR DE NUEVO';
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    overlayTitle.textContent = 'PAUSA';
    overlayText.textContent = 'Pulsa CONTINUAR para seguir';
    startBtn.textContent = 'CONTINUAR';
    overlay.classList.remove('hidden');
  } else if (state === 'paused') {
    state = 'playing';
    lastTime = performance.now();
    overlay.classList.add('hidden');
  }
}

function startGame() {
  board = createBoard();
  nextQueue = [];
  holdType = null;
  canHold = true;
  score = 0;
  lines = 0;
  level = 1;
  dropTimer = 0;
  lastTime = performance.now();
  state = 'playing';
  updateStats();
  spawnPiece();
  drawNext();
  drawHold();
  overlay.classList.add('hidden');
  initAudio();
}

// ============================================================
// DIBUJO
// ============================================================

/** Dibuja una celda con borde y brillo */
function drawCell(g, px, py, color, size) {
  const s = size || CELL;
  g.save();
  g.fillStyle = color;
  g.fillRect(px + 1, py + 1, s - 2, s - 2);
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.fillRect(px + 1, py + 1, s - 2, 5);
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(px + 1, py + s - 6, s - 2, 5);
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = 1;
  g.strokeRect(px + 1.5, py + 1.5, s - 3, s - 3);
  g.restore();
}

/** Dibuja la rejilla de fondo */
function drawGrid() {
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < COLS; x++) {
    ctx.moveTo(x * CELL + 0.5, 0);
    ctx.lineTo(x * CELL + 0.5, ROWS * CELL);
  }
  for (let y = 1; y < ROWS; y++) {
    ctx.moveTo(0, y * CELL + 0.5);
    ctx.lineTo(COLS * CELL, y * CELL + 0.5);
  }
  ctx.stroke();
}

function drawBoard() {
  ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

  const grad = ctx.createLinearGradient(0, 0, 0, boardCanvas.height);
  grad.addColorStop(0, '#0a0c18');
  grad.addColorStop(1, '#05060d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  drawGrid();

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]) drawCell(ctx, x * CELL, y * CELL, board[y][x]);
    }
  }

  if (current) {
    const color = SHAPES[current.type].color;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (!current.matrix[y][x]) continue;
        const py = (current.y + y) * CELL;
        if (current.y + y >= 0) {
          drawCell(ctx, (current.x + x) * CELL, py, color);
        }
      }
    }
  }
}

/** Dibuja una pieza centrada en un punto (cx, cy) */
function drawPieceAt(g, type, cx, cy, cell) {
  const matrix = SHAPES[type].cells;
  const color = SHAPES[type].color;
  let minX = 4, maxX = -1, minY = 4, maxY = -1;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if (matrix[y][x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const w = (maxX - minX + 1) * cell;
  const h = (maxY - minY + 1) * cell;
  const ox = cx - w / 2;
  const oy = cy - h / 2;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (matrix[y][x]) {
        drawCell(g, ox + (x - minX) * cell, oy + (y - minY) * cell, color, cell);
      }
    }
  }
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const cell = 26;
  const slot = nextCanvas.height / 3;
  for (let i = 0; i < 3; i++) {
    const type = nextQueue[i];
    if (!type) continue;
    drawPieceAt(nextCtx, type, nextCanvas.width / 2, slot * i + slot / 2, cell);
  }
}

function drawHold() {
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (!holdType) return;
  drawPieceAt(holdCtx, holdType, holdCanvas.width / 2, holdCanvas.height / 2, 24);
}

// ============================================================
// SONIDO (WebAudio, sin ficheros externos)
// ============================================================

function initAudio() {
  if (!soundOn) return;
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* audio no disponible */ }
}

/** Genera un pitido con oscilador */
function beep(freq, duration, type, volume) {
  if (!soundOn) return;
  initAudio();
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume || 0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) { /* ignora errores de audio */ }
}

function playSound(kind) {
  switch (kind) {
    case 'move':   beep(320, 0.05, 'square', 0.03); break;
    case 'rotate': beep(440, 0.07, 'square', 0.04); break;
    case 'lock':   beep(160, 0.09, 'triangle', 0.05); break;
    case 'drop':   beep(220, 0.08, 'sawtooth', 0.04); break;
    case 'line':   beep(660, 0.16, 'square', 0.06); break;
    case 'tetris':
      beep(523, 0.12, 'square', 0.06);
      setTimeout(function () { beep(659, 0.12, 'square', 0.06); }, 110);
      setTimeout(function () { beep(784, 0.20, 'square', 0.06); }, 220);
      break;
    case 'over':
      beep(300, 0.20, 'sawtooth', 0.05);
      setTimeout(function () { beep(200, 0.30, 'sawtooth', 0.05); }, 180);
      setTimeout(function () { beep(120, 0.45, 'sawtooth', 0.05); }, 360);
      break;
  }
}

function toggleSound() {
  soundOn = !soundOn;
  document.getElementById('btn-sound').textContent = 'SONIDO: ' + (soundOn ? 'ON' : 'OFF');
  if (soundOn) { initAudio(); playSound('rotate'); }
}

// ============================================================
// BUCLE PRINCIPAL
// ============================================================

function update(time) {
  const now = time || 0;
  const delta = now - lastTime;
  lastTime = now;

  if (state === 'playing') {
    dropTimer += delta;
    if (dropTimer >= getDropInterval()) {
      dropTimer = 0;
      softDrop();
    }
  }

  drawBoard();
  requestAnimationFrame(update);
}

// ============================================================
// CONTROLES
// ============================================================

const KEY_MAP = {
  ArrowLeft:  function () { move(-1); },
  ArrowRight: function () { move(1); },
  ArrowDown:  function () { softDrop(); },
  ArrowUp:    function () { rotate(1); },
  x:          function () { rotate(1); },
  X:          function () { rotate(1); },
  z:          function () { rotate(-1); },
  Z:          function () { rotate(-1); },
  ' ':        function () { hardDrop(); },
  c:          function () { holdPiece(); },
  C:          function () { holdPiece(); },
  p:          function () { togglePause(); },
  P:          function () { togglePause(); },
  r:          function () { startGame(); },
  R:          function () { startGame(); }
};

document.addEventListener('keydown', function (e) {
  if (e.key in KEY_MAP) {
    e.preventDefault();
    KEY_MAP[e.key]();
  }
});

startBtn.addEventListener('click', function () {
  if (state === 'paused') togglePause();
  else startGame();
});

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-pause').addEventListener('click', togglePause);
document.getElementById('btn-sound').addEventListener('click', toggleSound);

document.querySelectorAll('.touch-pad button').forEach(function (btn) {
  const action = btn.dataset.key;
  const handler = function (e) {
    e.preventDefault();
    switch (action) {
      case 'left':   move(-1); break;
      case 'right':  move(1); break;
      case 'down':   softDrop(); break;
      case 'rotate': rotate(1); break;
      case 'drop':   hardDrop(); break;
      case 'hold':   holdPiece(); break;
    }
  };
  btn.addEventListener('touchstart', handler, { passive: false });
  btn.addEventListener('mousedown', handler);
});

// ============================================================
// INICIO
// ============================================================

board = createBoard();
updateStats();
drawBoard();
drawNext();
drawHold();
requestAnimationFrame(update);
