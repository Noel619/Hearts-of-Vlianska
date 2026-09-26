# Hearts of Vlianska

Juego de gran estrategia en el navegador, al estilo de *Hearts of Iron IV*, ambientado en el metro de Vlianska: un universo postapocalíptico a lo *Metro 2033*.

Enero de 2033. Veinte años después de las bombas, ocho facciones se reparten las dieciséis estaciones del metro. Eliges una y la gobiernas: leyes, enfoques nacionales, investigación, industria, comercio, diplomacia y guerra túnel a túnel.

## Contenido

- **8 facciones jugables**, cada una con su propio árbol de enfoques nacionales (184 enfoques en total), líder, espíritus nacionales y objetivos:
  Unión de Estaciones, Seguidores de Rusia, Levantamiento Popular, Stantsiya Staraya, Saqueadores de Vhlainska, Chernovodskaya, Califato de Izumrudnaya y República del Norte.
- **Mapa por provincias**: estaciones y tramos de túnel (líneas principales, túneles peligrosos, auxiliares, estrechos y derrumbes), con niebla de guerra y modos de mapa (político, diplomático, terreno, peligro mutante y suministro).
- **Política**: poder político, estabilidad, apoyo a la guerra, 7 ideologías con popularidad y cambios de gobierno, 18 leyes en 4 grupos, 34 asesores, sucesiones de líderes.
- **Investigación**: 76 tecnologías en 6 ramas, con penalización por adelantarse a su año.
- **Economía**: talleres civiles y militares, cola de construcción, líneas de producción con eficiencia, recursos (chatarra, pólvora, combustible), comida y hambrunas, comercio entre facciones.
- **Ejército**: plantillas y diseñador de unidades, reclutamiento, suministro, desgaste, peligro mutante y combate con ancho de frente, reservas, flanqueo, barricadas y blindaje.
- **Diplomacia**: justificación de guerra, tensión del metro, alianzas, pactos de no agresión, acceso militar, garantías, embargos, capitulación, anexión y protectorados.
- **Eventos y decisiones**: 50 eventos y 22 decisiones (expediciones a la superficie, batidas contra mutantes, excavar derrumbes, recolonizar Tenevskaya…).
- **Ocupación y revueltas**: las estaciones conquistadas pueden sublevarse y resucitar a su antigua facción.
- **IA** para todas las facciones: enfoques, investigación, leyes, construcción, producción, comercio, diplomacia y operaciones militares.
- Guardado y carga (con autoguardado mensual), crónica del metro, guía de juego y atajos de teclado. Se puede jugar con ratón o en pantalla táctil.

## Cómo se juega

| Tecla | Acción |
| --- | --- |
| `Espacio` | Pausa / reanudar |
| `1`–`5` | Velocidad |
| `G` `F` `I` | Gobierno · Enfoque nacional · Investigación |
| `D` `C` | Diplomacia · Comercio |
| `B` `P` | Construcción · Producción |
| `E` `X` `L` | Ejército · Decisiones · Registro |
| Clic derecho | Mover las unidades seleccionadas |
| Rueda / pellizco | Zoom |

Ganas si controlas 11 de las 16 estaciones; pierdes si tu facción desaparece. La guía completa está en el menú, en «Cómo jugar».

## Ejecutarlo

Hace falta [Node.js](https://nodejs.org/) 20.19 o superior.

```bash
npm install
npm run dev          # servidor de desarrollo en http://localhost:5173
npm test             # pruebas del motor, del contenido y del combate
npm run build        # versión de producción en dist/
npm run build:single # un único archivo dist-single/index.html que se abre con doble clic
```

`npm run sim` lanza una partida entre IA durante varios años y muestra la evolución de cada facción (`YEARS=5 SEED=42 npm run sim` para cambiar la duración o la semilla).

## Estructura

```
src/
  data/     contenido: mapa, facciones, líderes, leyes, tecnologías, enfoques, eventos, decisiones, crónica
  game/     motor: estado, reloj, economía, investigación, política, diplomacia, combate, IA, guardado
  ui/       interfaz en React: mapa SVG, paneles, árboles de enfoques y tecnologías, menús
tests/      pruebas con Vitest
```

El motor es TypeScript puro y no depende de la interfaz, así que se puede probar y simular sin navegador.

## Editar el contenido

Todo el contenido está en `src/data/` y se describe con un pequeño lenguaje de efectos (`{ t: 'pp', v: 50 }`) y condiciones (`{ c: 'hasFocus', id: '…' }`). Los textos de los tooltips se generan solos a partir de esos efectos.

- **Mapa** (`src/data/map.ts`): estaciones, cruces y túneles. Cada túnel tiene un tipo de terreno. `npm test` comprueba que existen todas las conexiones entre estaciones y que los túneles destruidos siguen cortados.
- **Enfoques** (`src/data/focus/`): un archivo por facción.
- **Eventos y decisiones**: `src/data/events/` y `src/data/decisions.ts`.
- **Crónica**: `src/data/lore.ts`.

Las pruebas de contenido verifican que todas las referencias (enfoques, tecnologías, eventos, espíritus, estaciones…) existen, así que conviene ejecutar `npm test` después de cada cambio.

### Sobre el mapa

Las conexiones entre estaciones siguen la lista del autor. Tenevskaya está abandonada y solo se llega a ella por túneles auxiliares (desde Tsentral'naya, Zvezdnaya y Staraya) o, desde Vhlainska, por un túnel de mantenimiento estrecho que rodea el derrumbe del túnel principal. El túnel entre Mostovaya y Chernovodskaya está destruido. Los túneles auxiliares del dibujo original se unen a las líneas principales en cruces, así que ofrecen rutas indirectas más lentas entre algunas estaciones.

## Créditos

Universo, historia y mapa de Vlianska: Noel619. Algunos detalles de Stantsiya Staraya y de Vhlainska (nombres de líderes y parte de su historia) son inventados para el juego y se pueden cambiar en `src/data/`.

Inspirado en *Hearts of Iron IV* (Paradox Interactive) y en la saga *Metro 2033* (Dmitry Glukhovsky). Fuentes: Big Shoulders Stencil, PT Sans y PT Mono (SIL Open Font License). Iconos: [Lucide](https://lucide.dev) (ISC).
