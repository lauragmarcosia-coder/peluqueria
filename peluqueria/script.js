/* ============================================
   Formulario de cita - Peluquería canina
   Sin backend: valida y muestra confirmación.
   ============================================ */
(function () {
  'use strict';

  var formulario = document.getElementById('formulario');
  var aviso = document.getElementById('aviso');

  if (!formulario || !aviso) return;

  var CAMPOS = [
    { id: 'nombre',   mensaje: 'Escribe tu nombre.' },
    { id: 'telefono', mensaje: 'Indica un teléfono de contacto.' },
    { id: 'mascota',  mensaje: 'Dinos cómo se llama tu perro.' },
    { id: 'servicio', mensaje: 'Elige el servicio que necesitas.' }
  ];

  function campoDe(id) {
    return document.getElementById(id);
  }

  // Devuelve el valor limpio (sin espacios) de un campo
  function valorDe(id) {
    var campo = campoDe(id);
    return campo ? String(campo.value || '').trim() : '';
  }

  function marcarError(campo, mensaje) {
    var contenedor = campo.closest('.campo');
    if (!contenedor) return;

    contenedor.classList.add('error');

    var avisoCampo = contenedor.querySelector('.error-msg');
    if (!avisoCampo) {
      avisoCampo = document.createElement('span');
      avisoCampo.className = 'error-msg';
      contenedor.appendChild(avisoCampo);
    }
    avisoCampo.textContent = mensaje;
  }

  function limpiarError(campo) {
    var contenedor = campo.closest('.campo');
    if (contenedor) contenedor.classList.remove('error');
  }

  function validar() {
    var errores = [];

    CAMPOS.forEach(function (item) {
      var campo = campoDe(item.id);
      if (!campo) return;

      var valor = valorDe(item.id);

      if (!valor) {
        marcarError(campo, item.mensaje);
        errores.push(item.mensaje);
        return;
      }

      limpiarError(campo);

      if (item.id === 'telefono' && valor.replace(/\D/g, '').length < 9) {
        marcarError(campo, 'El teléfono debe tener al menos 9 dígitos.');
        errores.push('Teléfono no válido.');
      }
    });

    return errores;
  }

  function mostrarAviso(texto, tipo) {
    aviso.textContent = texto;
    aviso.className = 'aviso ' + tipo;
    aviso.hidden = false;
  }

  formulario.addEventListener('submit', function (evento) {
    evento.preventDefault();

    var errores = validar();

    if (errores.length > 0) {
      mostrarAviso(
        'Revisa los campos marcados: ' + errores[0],
        'error'
      );
      var primero = formulario.querySelector('.campo.error input, .campo.error select, .campo.error textarea');
      if (primero) primero.focus();
      return;
    }

    var nombre = valorDe('nombre');
    var mascota = valorDe('mascota');
    var servicio = valorDe('servicio');
    var comentarios = valorDe('comentarios');

    var texto = '¡Gracias, ' + nombre + '! Hemos recibido tu solicitud para ' +
      mascota + ' (' + servicio + '). Te llamamos en breve para confirmar la cita.';

    if (comentarios) {
      texto += ' Hemos tomado nota de tus comentarios.';
    }

    mostrarAviso(texto, 'ok');

    formulario.reset();
    CAMPOS.forEach(function (item) {
      var campo = campoDe(item.id);
      if (campo) limpiarError(campo);
    });
  });

  // Quita el estado de error en cuanto el usuario corrige el campo
  CAMPOS.forEach(function (item) {
    var campo = campoDe(item.id);
    if (!campo) return;
    campo.addEventListener('input', function () { limpiarError(campo); });
    campo.addEventListener('change', function () { limpiarError(campo); });
  });
})();
