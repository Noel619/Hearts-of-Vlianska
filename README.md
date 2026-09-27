# Hearts of Vlianska

Juego de gran estrategia en el navegador, al estilo de *Hearts of Iron IV*, ambientado en el metro de Vlianska: un universo postapocalíptico a lo *Metro 2033*.

Enero de 2033. Veinte años después de las bombas, ocho facciones se reparten las dieciséis estaciones del metro. Eliges una y la gobiernas: leyes, enfoques nacionales, investigación, industria, comercio, diplomacia y guerra túnel a túnel.

## Contenido

- **8 facciones jugables**, cada una con su propio árbol de enfoques nacionales (373 enfoques en total, entre 40 y 52 por facción, organizados en ramas), líder, espíritus nacionales y objetivos:
  Unión de Estaciones, Seguidores de Rusia, Levantamiento Popular, Stantsiya Staraya, Saqueadores de Vhlainska, Chernovodskaya, Califato de Izumrudnaya y República del Norte.
  Cada árbol plantea dilemas propios: el Califato puede seguir con la guerra santa, negociar con el Levantamiento (comida a cambio de comisarios y soberanía) o abrir sus puertas; el Levantamiento decide quién sucede a Morozov y si asfixia Mertvaya o se la gana; los Seguidores eligen entre los magnates y los obreros de la Gran Forja…
- **Mapa por provincias**: estaciones y tramos de túnel (líneas principales, túneles peligrosos, auxiliares, estrechos y derrumbes), con niebla de guerra y modos de mapa (político, diplomático, terreno, peligro mutante y suministro).
- **Política**: poder político, estabilidad, apoyo a la guerra, 7 ideologías con popularidad y cambios de gobierno, 18 leyes en 4 grupos, 34 asesores, sucesiones de líderes.
- **Investigación**: 76 tecnologías en 6 ramas, con penalización por adelantarse a su año.
- **Economía**: talleres civiles y militares, cola de construcción, líneas de producción con eficiencia, recursos (chatarra, pólvora, combustible), comida y hambrunas, comercio entre facciones.
- **Ejército**: plantillas y diseñador de unidades, reclutamiento, suministro, desgaste y peligro mutante. En combate cuentan el ancho del frente, los relevos desde la reserva (los morteros disparan desde atrás), el flanqueo al atacar desde varios túneles, la cobertura de barricadas, estaciones y atrincheramiento, la defensa frente a la ruptura y el blindaje. Las unidades que defienden pueden replegarse.
- **Diplomacia**: justificación de guerra, tensión del metro, alianzas, pactos de no agresión, acceso militar, garantías, embargos, capitulación, anexión y protectorados.
- **Eventos y decisiones**: 75 eventos y 30 decisiones (expediciones a la superficie, batidas contra mutantes, excavar derrumbes, recolonizar Tenevskaya, convoyes a la Esmeralda, desviar las caravanas rusas…).
- **Ocupación y revueltas**: las estaciones conquistadas pueden sublevarse y resucitar a su antigua facción.
- **IA** para todas las facciones: enfoques (que eligen según la situación), investigación, leyes, construcción, producción, comercio, diplomacia y operaciones militares. La IA guarnece todas sus estaciones amenazadas, repliega a las unidades superadas y solo ataca con superioridad local, reuniendo tropas y atacando desde varios túneles.
- Guardado y carga (con autoguardado mensual), crónica del metro, guía de juego y atajos de teclado. Se puede jugar con ratón o en pantalla táctil.

## Gráficos y sonido

Todo el apartado visual y sonoro se genera por código en el navegador: el juego no incluye ni una imagen ni un archivo de audio (solo las fuentes tipográficas).

- **Mapa animado en canvas**: el subsuelo visto en planta, con roca, vetas y humedad, el trazado fantasma de la ciudad en superficie y el río. Los túneles tienen vías, traviesas, tuberías y cables con el color de su dueño; cada estación es un andén pintado con tiendas, hogueras, vagones y detalles propios (el hospital de Nadezhdy, la fábrica de Industrialnaya, el mercado de Staraya, los ventiladores de Kholodnogo Vozduha…). Hay luces que parpadean, humo, brasas, polvo, ojos de mutantes en la oscuridad, frentes con alambradas, niebla de guerra, y batallas con fogonazos, trazadoras y explosiones. Las unidades son soldados animados con el uniforme de cada facción (o draisinas blindadas y stalkers con farol) que avanzan por los túneles.
- **Retratos pintados** de líderes y asesores, **emblemas** de metal esmaltado, **medallas** para enfoques, tecnologías, decisiones y espíritus nacionales, y **texturas** de acero, hormigón y papel para la interfaz.
- **Ilustraciones de eventos**: escenas en perspectiva (túneles de tubbing, andenes, la superficie nevada) con siluetas a contraluz, fuego y humo, teñidas con los colores de las facciones implicadas.
- **Menú animado**: una noche en el andén, con un guitarrista junto a la hoguera.
- **Música generativa** que nunca se repite igual: canción de andén con guitarra y bayán en el menú, y ambientes de paz, tensión y guerra que cambian según la situación. Los instrumentos se sintetizan con Web Audio (guitarra por Karplus-Strong, bayán, cuerdas, campanas FM, taikos, metales).
- **Ambiente y efectos**: aire en los túneles, goteos, crujidos, aullidos lejanos, tiroteos cuando hay batallas a la vista, telégrafo de eventos, sirena de guerra, fanfarrias… Los volúmenes se ajustan en *Ajustes*; la tecla `M` silencia.

El código está en `src/gfx` (gráficos) y `src/audio` (sonido). Abriendo la página con `#lab` al final de la dirección se ve un laboratorio con todos los sprites generados.

## Cómo se juega

| Tecla | Acción |
| --- | --- |
| `Espacio` | Pausa / reanudar |
| `1`–`5` | Velocidad |
| `G` `F` `I` | Gobierno · Enfoque nacional · Investigación |
| `D` `C` | Diplomacia · Comercio |
| `B` `P` | Construcción · Producción |
| `E` `X` `L` | Ejército · Decisiones · Registro |
| `M` | Silenciar / activar el sonido |
| Clic derecho | Mover las unidades seleccionadas |
| Rueda / pellizco | Zoom |

Ganas si controlas 11 de las 16 estaciones; pierdes si tu facción desaparece. La guía completa está en el menú, en «Cómo jugar».

## Ejecutarlo

Hace falta [Node.js](https://nodejs.org/) 20.19 o superior.

```bash
npm install
npm run dev          # servidor de desarrollo en http://localhost:5173
npm test             # pruebas del motor, del contenido, del combate, de la IA y de los enfoques
npm run build        # versión de producción en dist/
npm run build:single # un único archivo dist-single/index.html que se abre con doble clic
```

`npm run sim` lanza una partida entre IA durante varios años y muestra la evolución de cada facción (`YEARS=5 SEED=42 npm run sim` para cambiar la duración o la semilla).

## Estructura

```
src/
  data/     contenido: mapa, facciones, líderes, leyes, tecnologías, enfoques, eventos, decisiones, crónica
  game/     motor: estado, reloj, economía, investigación, política, diplomacia, combate, IA, guardado
  gfx/      gráficos procedurales: mapa en canvas, andenes, unidades, retratos, emblemas, medallas, escenas
  audio/    sonido sintetizado: motor Web Audio, instrumentos, música generativa, ambiente y efectos
  ui/       interfaz en React: paneles, árboles de enfoques y tecnologías, menús
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

Inspirado en *Hearts of Iron IV* (Paradox Interactive) y en la saga *Metro 2033* (Dmitry Glukhovsky). Fuentes: Big Shoulders Stencil, PT Sans y PT Mono (SIL Open Font License). Iconos: trazos de [Lucide](https://lucide.dev) (ISC), dibujados y estampados por código.
