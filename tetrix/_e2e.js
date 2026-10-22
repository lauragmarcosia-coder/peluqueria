// Test E2E: verifica que el HTML y el JS son consistentes y
// simula una partida completa con el DOM real del index.html
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const css  = fs.readFileSync(path.join(dir, 'style.css'), 'utf8');
const js   = fs.readFileSync(path.join(dir, 'game.js'), 'utf8');

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log('  OK   ' + n); } else { fail++; console.log('  FAIL ' + n); } };

console.log('\n=== TETRIX: Test E2E ===\n');

console.log('-- HTML --');
check('declara <!DOCTYPE html>', html.startsWith('<!DOCTYPE html>'));
check('charset UTF-8', /charset="UTF-8"/.test(html));
check('viewport movil', /name="viewport"/.test(html));
check('carga style.css', html.includes('style.css'));
check('carga game.js', html.includes('game.js'));
check('title Tetrix', /<title>Tetrix<\/title>/.test(html));
check('no usa CDN externos', !/https?:\/\//.test(html));

const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const required = ['board','next-canvas','hold-canvas','score','lines','level','overlay','overlay-title','overlay-text','start-btn','btn-start','btn-pause','btn-sound'];
for (const id of required) check('HTML tiene id="' + id + '"', ids.includes(id));

const usedIds = [...js.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]);
for (const id of new Set(usedIds)) check('JS busca id="' + id + '" que existe en HTML', ids.includes(id));

console.log('\n-- CSS --');
check('CSS define .overlay', css.includes('.overlay'));
check('CSS define .overlay.hidden', css.includes('.overlay.hidden'));
check('CSS define .touch-pad', css.includes('.touch-pad'));
check('CSS responsive', css.includes('@media'));
check('CSS define .game-wrapper', css.includes('.game-wrapper'));
check('CSS define .frame', css.includes('.frame'));
check('CSS define .box', css.includes('.box'));
check('CSS define .score', css.includes('.score'));
check('CSS define #board', css.includes('#board'));
check('CSS define #next-canvas', css.includes('#next-canvas'));
check('CSS define #hold-canvas', css.includes('#hold-canvas'));

console.log('\n-- Estructura del HTML --');
const openDiv = (html.match(/<div/g)||[]).length;
const closeDiv = (html.match(/<\/div>/g)||[]).length;
check('divs balanceados (' + openDiv + '/' + closeDiv + ')', openDiv === closeDiv);
const openC = (html.match(/<canvas/g)||[]).length;
const closeC = (html.match(/<\/canvas>/g)||[]).length;
check('canvas balanceados (' + openC + ')', openC === closeC && openC === 3);

console.log('\n-- Canvas y controles --');
check('board es 300x600 (10x20 celdas de 30px)',
  /id="board"[^>]*width="300"[^>]*height="600"/.test(html));
check('6 botones tactiles',
  (html.match(/class="touch-pad"[\s\S]*?<\/div>/)||[''])[0].split('data-key').length - 1 === 6);
check('boton overlay tiene id start-btn', /id="start-btn"/.test(html));

console.log('\n-- Partida completa simulada --');
function fakeCtx() {
  const noop = () => {};
  return new Proxy({}, { get(t,p){ if(p==='createLinearGradient') return ()=>({addColorStop:noop}); if(p in t) return t[p]; return noop; }, set(t,p,v){t[p]=v;return true;} });
}
const els = {};
const mk = id => ({ id, width:300, height:600, textContent:'', dataset:{}, classList:{add:()=>{},remove:()=>{},contains:()=>false}, getContext:()=>fakeCtx(), addEventListener:()=>{}, querySelectorAll:()=>[] });
let frames = 0;
const sandbox = {
  console, Math, Date, JSON, setTimeout,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => { frames++; return frames; },
  document: { getElementById: id => (els[id] = els[id] || mk(id)), addEventListener:()=>{}, querySelectorAll:()=>[] },
  window: {}
};
sandbox.globalThis = sandbox;
const EXPORT = `
globalThis.__api = {
  get board(){return board}, set board(v){board=v},
  get current(){return current}, set current(v){current=v},
  get nextQueue(){return nextQueue}, set nextQueue(v){nextQueue=v},
  get score(){return score}, set score(v){score=v},
  get lines(){return lines}, set lines(v){lines=v},
  get level(){return level}, set level(v){level=v},
  get state(){return state}, set state(v){state=v},
  get holdType(){return holdType}, set holdType(v){holdType=v},
  SHAPES, createBoard, spawnPiece, collides, clearLines, lockPiece, move, softDrop,
  hardDrop, rotate, holdPiece, getDropInterval, startGame, togglePause,
  endGame, drawBoard, drawNext, drawHold, update, updateStats, newPiece
};`;
const c = vm.createContext(sandbox);
vm.runInContext(js + EXPORT, c, { filename: 'game.js' });
const g = c.__api;

check('el bucle de animacion se registra', frames > 0);
check('el tablero se inicializa a 20x10', g.board.length === 20 && g.board[0].length === 10);
check('drawBoard no lanza error', (() => { try { g.drawBoard(); return true; } catch(e) { return false; } })());
check('drawNext no lanza error', (() => { try { g.drawNext(); return true; } catch(e) { return false; } })());
check('drawHold no lanza error', (() => { try { g.drawHold(); return true; } catch(e) { return false; } })());
check('update no lanza error', (() => { try { g.update(1000); return true; } catch(e) { return false; } })());

g.startGame();
check('el juego arranca en estado playing', g.state === 'playing');
check('se crea una pieza al arrancar', g.current !== null);
check('la pieza aparece en el tablero (dentro de los limites)',
  g.current.x >= -1 && g.current.x <= 8);

// Simula 50 caidas rapidas
let errores = 0;
for (let i = 0; i < 50; i++) {
  try { g.hardDrop(); } catch (e) { errores++; }
}
check('50 caidas rapidas sin errores', errores === 0);
check('el marcador es un numero valido (no NaN)', !isNaN(g.score) && isFinite(g.score));
check('el marcador es > 0', g.score > 0);
check('el estado sigue siendo coherente', ['playing','over'].includes(g.state));

// Verifica que el marcador del DOM se actualiza
check('el DOM muestra la puntuacion', String(els['score'].textContent) === String(g.score));
check('el DOM muestra las lineas', String(els['lines'].textContent) === String(g.lines));
check('el DOM muestra el nivel', String(els['level'].textContent) === String(g.level));

// Pausa
g.startGame();
g.togglePause();
check('la pausa detiene el juego', g.state === 'paused');
g.togglePause();
check('el juego se reanuda', g.state === 'playing');

// Reinicio
g.startGame();
check('el reinicio pone la puntuacion a 0', g.score === 0 && g.lines === 0 && g.level === 1);
check('el reinicio limpia el tablero', g.board.every(r => r.every(c2 => c2 === null)));

// Colision: pieza contra la pared derecha
// La pieza O ocupa 2 columnas: pegada a la derecha valida es x=7 (cols 8-9)
g.current = { type: 'O', matrix: g.SHAPES.O.cells.map(r => r.slice()), x: 7, y: 5 };
check('la pieza O pegada a la derecha es valida', !g.collides(g.current.matrix, g.current.x, g.current.y));
g.move(1);
check('la pieza no atraviesa la pared derecha', g.current.x === 7);
// La pieza I ocupa las columnas +1,+2,+3 de su matriz 4x4
g.current = { type: 'I', matrix: g.SHAPES.I.cells.map(r => r.slice()), x: 5, y: 5 };
g.move(1);
check('la pieza I se mueve una columna', g.current.x === 6);
g.current = { type: 'I', matrix: g.SHAPES.I.cells.map(r => r.slice()), x: 6, y: 5 };
g.move(1);
check('la pieza I no cruza la pared derecha', g.current.x === 6);

console.log('\n---');
console.log('RESULTADO E2E: ' + pass + ' correctos, ' + fail + ' fallidos\n');
process.exit(fail > 0 ? 1 : 0);
