# TETRIX

Juego de Tetris completo en JavaScript puro, sin librerias externas.
Funciona abriendo `index.html` en cualquier navegador moderno.

## Archivos

| Archivo | Descripcion |
|---------|-------------|
| `index.html` | Estructura de la pagina y el overlay |
| `style.css` | Estilos, tema oscuro y responsive |
| `game.js` | Logica del juego, dibujo en canvas y sonido |
| `_test.js` | 35 tests unitarios de la logica |
| `_e2e.js` | 73 tests de integracion HTML/CSS/JS |

## Como jugar

Abre `index.html` en el navegador y pulsa **INICIAR**.

### Controles de teclado

| Tecla | Accion |
|-------|--------|
| `←` `→` | Mover la pieza a izquierda / derecha |
| `↓` | Caida suave (suma puntos) |
| `↑` o `X` | Rotar (horario) |
| `Z` | Rotar (antihorario) |
| `Espacio` | Caida rapida |
| `C` | Reservar pieza (hold) |
| `P` | Pausa |
| `R` | Reiniciar |

En movil aparece un mando tactil en pantalla.

## Reglas

- Tablero de 10 x 20 celdas.
- 7 piezas (I, J, L, O, S, T, Z) con generador **7-bag**: todas aparecen
  una vez por ciclo, en orden aleatorio.
- Rotacion con **wall kick**: la pieza se desplaza automaticamente para
  no chocar al girar pegada a una pared.
- Puntuacion: 1 linea = 100, 2 = 300, 3 = 500, 4 (tetris) = 800,
  multiplicado por el nivel. Caida rapida = 2 puntos por fila.
- El nivel sube cada 10 lineas y la velocidad aumenta
  (de 800 ms a 80 ms por fila).
- Fin de partida cuando la pieza nueva no cabe.

## Sonido

Efectos generados con la Web Audio API (sin ficheros de audio).
Se pueden activar o desactivar con el boton **SONIDO**.

## Ejecutar los tests

```bash
node _test.js    # 35 tests de logica
node _e2e.js     # 73 tests de integracion
```

> Nota: los tests usan `node` desde `C:\Program Files\nodejs\node.exe`
> si no esta en el PATH.
