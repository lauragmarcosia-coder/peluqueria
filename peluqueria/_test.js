/* ============================================
   Test del formulario de cita (sin navegador)
   Ejecutar: node _test.js
   ============================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'script.js'), 'utf8');

let ok = 0;
let fallos = 0;

function check(nombre, condicion) {
  if (condicion) {
    ok++;
    console.log('  OK   ' + nombre);
  } else {
    fallos++;
    console.log('  FAIL ' + nombre);
  }
}

console.log('\n== HTML ==');
check('doctype html', /^<!DOCTYPE html>/i.test(html.trim()));
check('lang es', /<html lang="es">/.test(html));
check('charset UTF-8', /<meta charset="UTF-8">/i.test(html));
check('viewport responsive', /name="viewport"/.test(html));
check('title correcto', /<title>.*Peluquería canina.*<\/title>/.test(html));
check('no hay etiqueta img', !/<img[\s>]/i.test(html));
check('no hay imagen de fondo', !/url\(['"]?.*\.(png|jpg|jpeg|gif|webp|svg)/i.test(html));
check('enlaza style.css', /<link rel="stylesheet" href="style\.css">/.test(html));
check('enlaza script.js', /<script src="script\.js"><\/script>/.test(html));

console.log('\n== Secciones ==');
['servicios', 'horarios', 'contacto', 'inicio'].forEach(function (id) {
  check('seccion #' + id + ' presente', html.indexOf('id="' + id + '"') !== -1);
});
check('6 tarjetas de servicio', (html.match(/class="tarjeta"/g) || []).length === 6);
check('tabla de horarios', /<table class="tabla-horarios">/.test(html));
check('formulario presente', /id="formulario"/.test(html));

console.log('\n== Accesibilidad ==');
check('label nombre', /<label for="nombre">/.test(html));
check('label telefono', /<label for="telefono">/.test(html));
check('label mascota', /<label for="mascota">/.test(html));
check('label servicio', /<label for="servicio">/.test(html));
check('label comentarios', /<label for="comentarios">/.test(html));
check('5 controles con id', (html.match(/<(input|select|textarea)[^>]*id="/g) || []).length === 5);
check('aviso con aria-live', /aria-live="polite"/.test(html));
check('hocico decorativo aria-hidden', /class="hocico" aria-hidden="true"/.test(html));
check('nav etiquetado', /<nav[^>]*aria-label=/.test(html));

console.log('\n== CSS ==');
check('sin url() de imagen', !/url\(['"]?.*\.(png|jpg|jpeg|gif|webp)/i.test(css));
check('media query responsive', /@media \(max-width: 860px\)/.test(css));
check('media query movil', /@media \(max-width: 560px\)/.test(css));
check('estilo .hocico', /\.hocico\s*\{/.test(css));
check('estilo .formulario', /\.formulario\s*\{/.test(css));
check('estilo .aviso.ok', /\.aviso\.ok/.test(css));
check('estilo .campo.error', /\.campo\.error/.test(css));
check('estilo .error-msg', /\.error-msg/.test(css));
check('estilo .precio', /\.precio/.test(css));
check('estilo .cerrado', /\.cerrado/.test(css));
check('reset de caja', /box-sizing:\s*border-box/.test(css));

console.log('\n== Coherencia HTML <-> CSS ==');
['hocico', 'marca', 'menu', 'btn', 'portada', 'entradilla', 'tarjeta-info', 'lista-datos',
 'datos-rapidos', 'rejilla-servicios', 'tarjeta', 'precio', 'seccion', 'seccion-alterna',
 'dos-columnas', 'titulo-seccion', 'subtitulo', 'tabla-horarios', 'lista-puntos',
 'formulario', 'campo', 'campo-ancho', 'opcional', 'error-msg', 'aviso', 'pie',
 'pie-legal', 'contenedor', 'cerrado'].forEach(function (clase) {
  check('clase .' + clase + ' en CSS', css.indexOf('.' + clase) !== -1);
});

console.log('\n== Coherencia HTML <-> JS ==');
['formulario', 'aviso', 'nombre', 'telefono', 'mascota', 'servicio', 'comentarios'].forEach(function (id) {
  check('#' + id + ' referenciado en JS', js.indexOf("'" + id + "'") !== -1 || js.indexOf('"' + id + '"') !== -1);
});
check('JS preventDefault', /preventDefault/.test(js));
check('JS valida campos requeridos', /required/.test(html) && /validar/.test(js));
check('JS muestra confirmacion', /mostrarAviso/.test(js) && /'ok'/.test(js));
check('JS limpia errores al escribir', /addEventListener\('input'/.test(js));
check('JS no usa FormData (testeable sin DOM real)', !/new FormData/.test(js));

console.log('\n== Logica del formulario (DOM simulado) ==');
// Simula el DOM minimo que necesita script.js
class FakeClassList {
  constructor() { this.set = new Set(); }
  add(c) { this.set.add(c); }
  remove(c) { this.set.delete(c); }
  contains(c) { return this.set.has(c); }
}
class FakeElement {
  constructor(id, tag) {
    this.id = id;
    this.tagName = (tag || 'input').toUpperCase();
    this.value = '';
    this.hidden = false;
    this.textContent = '';
    this.className = '';
    this.classList = new FakeClassList();
    this.children = [];
    this.listeners = {};
  }
  appendChild(c) { this.children.push(c); c.parent = this; return c; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  dispatch(t) { (this.listeners[t] || []).forEach(function (fn) { fn({ preventDefault: function () {} }); }); }
  closest(sel) {
    if (sel === '.campo') return this.parent && this.parent.classList ? this.parent : null;
    return null;
  }
  querySelector(sel) {
    if (sel === '.error-msg') {
      return this.children.find(function (c) { return c.className === 'error-msg'; }) || null;
    }
    return null;
  }
  focus() { this.focused = true; }
}

const campos = {
  nombre: new FakeElement('nombre'),
  telefono: new FakeElement('telefono'),
  mascota: new FakeElement('mascota'),
  servicio: new FakeElement('servicio', 'select'),
  comentarios: new FakeElement('comentarios', 'textarea')
};
const avisoEl = new FakeElement('aviso');
avisoEl.hidden = true; // el HTML real lo declara con el atributo hidden
const formEl = new FakeElement('formulario', 'form');
formEl.reset = function () {
  Object.keys(campos).forEach(function (k) { campos[k].value = ''; });
};

// Construye un contenedor .campo por cada campo
Object.keys(campos).forEach(function (k) {
  const cont = new FakeElement('cont-' + k, 'div');
  cont.classList.add('campo');
  campos[k].parent = cont;
  cont.appendChild(campos[k]);
});

global.document = {
  getElementById: function (id) {
    if (id === 'formulario') return formEl;
    if (id === 'aviso') return avisoEl;
    return campos[id] || null;
  },
  createElement: function (tag) { return new FakeElement('nuevo', tag); }
};

eval(js);

check('el script se ejecuta sin errores', true);
check('aviso oculto inicialmente', avisoEl.hidden === true);

formEl.dispatch('submit');
check('envio vacio muestra error', avisoEl.hidden === false && avisoEl.className.indexOf('error') !== -1);
check('marca el campo nombre con error', campos.nombre.parent.classList.contains('error'));
check('crea el mensaje de error', campos.nombre.parent.querySelector('.error-msg') !== null);
check('el mensaje explica que falta el nombre',
  campos.nombre.parent.querySelector('.error-msg').textContent.indexOf('nombre') !== -1);

campos.nombre.value = 'Laura';
campos.telefono.value = '600 123 456';
campos.mascota.value = 'Roco';
campos.servicio.value = 'Baño + corte (32,00 €)';
formEl.dispatch('submit');

check('envio valido muestra exito', avisoEl.className.indexOf('ok') !== -1);
check('el mensaje saluda con el nombre', avisoEl.textContent.indexOf('Laura') !== -1);
check('el mensaje menciona la mascota', avisoEl.textContent.indexOf('Roco') !== -1);
check('el mensaje menciona el servicio', avisoEl.textContent.indexOf('Baño + corte') !== -1);
check('los campos se limpian', campos.nombre.value === '' && campos.servicio.value === '');
check('se quitan los errores', !campos.nombre.parent.classList.contains('error'));

campos.telefono.value = '123';
campos.nombre.value = 'Ana';
campos.mascota.value = 'Can';
campos.servicio.value = 'Corte de uñas (6,00 €)';
formEl.dispatch('submit');
check('telefono corto se rechaza', avisoEl.className.indexOf('error') !== -1);
check('telefono corto marca el campo', campos.telefono.parent.classList.contains('error'));

campos.telefono.value = '600123456';
formEl.dispatch('submit');
check('telefono valido se acepta', avisoEl.className.indexOf('ok') !== -1);

console.log('\nRESULTADO: ' + ok + ' correctos, ' + fallos + ' fallidos');
process.exit(fallos === 0 ? 0 : 1);

check('JS limpia errores al escribir', /addEventListener\('input'/.test(js));

