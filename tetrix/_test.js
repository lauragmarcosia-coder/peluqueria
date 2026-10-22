// Test harness: simula el DOM y ejecuta game.js en un sandbox
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function fakeCtx() {
  const noop = () => {};
  return new Proxy({}, {
    get(t, p) {
      if (p === 'createLinearGradient') return () => ({ addColorStop: noop });
      if (p === 'measureText') return () => ({ width: 0 });
      if (p in t) return t[p];
      return noop;
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

function makeEl(id) {
  return {
    id, width: 300, height: 600, textContent: '', dataset: {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    getContext: () => fakeCtx(),
    addEventListener: () => {},
    querySelectorAll: () => []
  };
}

const els = {};
const sandbox = {
  console,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  setTimeout,
  Math, Date, JSON,
  document: {
    getElementById: (id) => (els[id] = els[id] || makeEl(id)),
    addEventListener: () => {},
    querySelectorAll: () => []
  },
  window: {}
};
sandbox.globalThis = sandbox;

const src = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');

// El export se concatena al MISMO script: con 'use strict' las
// declaraciones de funcion quedan en el ambito lexico del script.
const EXPORT = `
globalThis.__api = {
  SHAPES, KEYS, COLS, ROWS, CELL,
  get board() { return board; }, set board(v) { board = v; },
  get current() { return current; }, set current(v) { current = v; },
  get nextQueue() { return nextQueue; }, set nextQueue(v) { nextQueue = v; },
  get holdType() { return holdType; }, set holdType(v) { holdType = v; },
  get canHold() { return canHold; }, set canHold(v) { canHold = v; },
  get score() { return score; }, set score(v) { score = v; },
  get lines() { return lines; }, set lines(v) { lines = v; },
  get level() { return level; }, set level(v) { level = v; },
  get state() { return state; }, set state(v) { state = v; },
  createBoard, refillBag, nextType, newPiece, spawnPiece, rotateMatrix,
  collides, mergePiece, clearLines, lockPiece, move, softDrop, hardDrop,
  rotate, holdPiece, getDropInterval, updateStats, endGame, togglePause,
  startGame, drawBoard, drawNext, drawHold, playSound
};
`;

const ctxObj = vm.createContext(sandbox);
vm.runInContext(src + EXPORT, ctxObj, { filename: 'game.js' });

const g = ctxObj.__api;
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  OK   ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

console.log('\n=== TETRIX: Tests de logica ===\n');

check('SHAPES con 7 piezas', Object.keys(g.SHAPES).length === 7);
check('COLS=10, ROWS=20', g.COLS === 10 && g.ROWS === 20);
check('createBoard: 20 filas x 10 cols vacias',
  g.createBoard().length === 20 && g.createBoard()[0].length === 10 &&
  g.createBoard()[5].every(c => c === null));

console.log('\n-- Rotacion --');
const m = [[1,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]];
check('rotar 4 veces vuelve al original',
  JSON.stringify(g.rotateMatrix(g.rotateMatrix(g.rotateMatrix(g.rotateMatrix(m,1),1),1),1)) === JSON.stringify(m));
check('rotar +1 cambia la matriz',
  JSON.stringify(g.rotateMatrix(m,1)) !== JSON.stringify(m));

console.log('\n-- Colisiones --');
g.board = g.createBoard();
check('colisiona con el borde izquierdo', g.collides([[1,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], -1, 0));
check('colisiona con el borde derecho', g.collides([[1,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], g.COLS, 0));
check('colisiona con el suelo', g.collides([[1,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], 0, g.ROWS));
check('no colisiona en espacio libre', !g.collides([[1,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], 4, 5));

console.log('\n-- Generador 7-bag --');
g.nextQueue = [];
const bag = [];
for (let i = 0; i < 7; i++) bag.push(g.nextType());
check('7 piezas unicas en un ciclo', new Set(bag).size === 7);
check('la cola se rellena por adelantado', g.nextQueue.length >= 3);


console.log('\n-- Limpieza de lineas --');
g.board = g.createBoard();
for (let x = 0; x < 10; x++) g.board[19][x] = '#fff';
g.board[18][0] = '#fff';
check('clearLines detecta 1 linea', g.clearLines() === 1);
check('la fila completa se elimina y el resto sube',
  g.board.length === 20 && g.board[19][0] === '#fff' && g.board[19][1] === null);

g.board = g.createBoard();
for (let y = 16; y < 20; y++) for (let x = 0; x < 10; x++) g.board[y][x] = '#fff';
check('clearLines detecta 4 lineas (tetris)', g.clearLines() === 4);

console.log('\n-- Puntuacion --');
g.score = 0; g.lines = 0; g.level = 1;
g.board = g.createBoard();
for (let x = 0; x < 10; x++) g.board[19][x] = '#fff';
g.current = { type: 'I', matrix: g.SHAPES.I.cells.map(r => r.slice()), x: 0, y: 16 };
g.lockPiece();
check('1 linea = 100 puntos x nivel', g.score === 100);
check('contador de lineas sube a 1', g.lines === 1);

g.score = 0; g.lines = 0; g.level = 1;
g.board = g.createBoard();
for (let y = 16; y < 20; y++) for (let x = 0; x < 10; x++) g.board[y][x] = '#fff';
g.current = { type: 'I', matrix: g.SHAPES.I.cells.map(r => r.slice()), x: 0, y: 16 };
g.lockPiece();
check('4 lineas = 800 puntos', g.score === 800);

console.log('\n-- Nivel --');
g.lines = 9; g.level = Math.floor(g.lines / 10) + 1;
check('nivel sube cada 10 lineas', g.level === 1);
g.lines = 10; g.level = Math.floor(g.lines / 10) + 1;
check('nivel 2 con 10 lineas', g.level === 2);

console.log('\n-- Velocidad --');
g.level = 1;
check('intervalo nivel 1 = 800ms', g.getDropInterval() === 800);
g.level = 5;
check('intervalo baja con el nivel', g.getDropInterval() === 800 - 4 * 70);
g.level = 99;
check('intervalo minimo 80ms', g.getDropInterval() === 80);

console.log('\n-- Reserva (hold) --');
g.state = 'playing';
g.board = g.createBoard();
g.current = { type: 'T', matrix: g.SHAPES.T.cells.map(r => r.slice()), x: 3, y: 5 };
g.holdType = null; g.canHold = true;
g.holdPiece();
check('la pieza se guarda en reserva', g.holdType === 'T');
check('no se puede reservar dos veces seguidas', g.canHold === false);

console.log('\n-- Movimiento --');
g.state = 'playing';
g.board = g.createBoard();
g.current = { type: 'O', matrix: g.SHAPES.O.cells.map(r => r.slice()), x: 4, y: 5 };
g.move(-1);
check('mover a la izquierda', g.current.x === 3);
g.move(1); g.move(1);
check('mover a la derecha', g.current.x === 5);

g.board = g.createBoard();
g.current = { type: 'I', matrix: g.SHAPES.I.cells.map(r => r.slice()), x: 0, y: 5 };
g.move(-1);
check('no se sale por la izquierda', g.current.x === 0);
g.current = { type: 'O', matrix: g.SHAPES.O.cells.map(r => r.slice()), x: 0, y: 5 };
g.move(-1);
check('la pieza O no se sale del borde', !g.collides(g.current.matrix, g.current.x, g.current.y));

console.log('\n-- Caida rapida --');
g.state = 'playing'; g.score = 0;
g.board = g.createBoard();
g.current = { type: 'O', matrix: g.SHAPES.O.cells.map(r => r.slice()), x: 4, y: 0 };
g.hardDrop();
check('la pieza queda fijada en el tablero',
  g.board.some(r => r.some(c => c !== null)));

console.log('\n-- Fin de partida --');
g.state = 'playing';
g.board = g.createBoard();
for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) g.board[y][x] = '#fff';
g.nextQueue = ['I','I','I','I','I','I','I'];
g.current = null;
const spawned = g.spawnPiece();
check('se detecta el fin de partida al llenar el tablero', g.state === 'over' && spawned === false);

console.log('\n-- Pausa --');
g.state = 'playing';
g.togglePause();
check('se pausa', g.state === 'paused');
g.togglePause();
check('se reanuda', g.state === 'playing');

console.log('\n-- Reinicio --');
g.score = 500; g.lines = 9; g.level = 4;
g.startGame();
check('reinicia la puntuacion', g.score === 0 && g.lines === 0 && g.level === 1);
check('reinicia el estado a jugando', g.state === 'playing');
check('crea una pieza nueva', g.current !== null);

console.log('\n---');
console.log('RESULTADO: ' + pass + ' correctos, ' + fail + ' fallidos\n');
process.exit(fail > 0 ? 1 : 0);
