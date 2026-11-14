# Sombras de Vlianska

RPG de escuadra y supervivencia en mundo abierto, en 3D, ambientado en el metro de Vlianska.

**Versión 0.3 (beta).** El juego se puede jugar de principio a fin: todos los hilos de la trama se pueden cerrar y la emisora de onda corta lleva al final abierto. Los cambios de cada versión están en [`CHANGELOG.md`](CHANGELOG.md).

Enero de 2033. Veinte años después de las bombas, ocho facciones se reparten las dieciséis estaciones del metro. Tú no eres ninguna de ellas: empiezas con un puñado de supervivientes, un cuchillo y sesenta cartuchos, y nadie te espera ni te debe nada. Comercia, rebusca chatarra, caza lo que vive en los túneles, contrata gente en las cantinas y levanta tu propia estación donde nadie mande.

Este repositorio contenía antes *Hearts of Vlianska* (gran estrategia en 2D). El juego nuevo parte de la misma historia, que se conserva íntegra en [`docs/historia/`](docs/historia/): crónica, facciones, líderes, estaciones, túneles, sucesos y tecnología.

## Qué hay dentro

- **El metro entero, de una pieza.** Las 16 estaciones y los 24 cruces del plano original, unidos por más de nueve kilómetros de túneles que se recorren a pie y sin pantallas de carga. Cada estación es un asentamiento distinto: el Gran Mercado de Tsentral'naya alrededor del edificio quemado del gobierno, los pozos de aire frío de Kholodnogo Vozduha, las escaleras mecánicas de Severnyy hacia la superficie, las granjas de Rassvetnaya, el manantial esmeralda de Izumrudnaya, el trono del Tuerto en Vhlainska… y Tenevskaya, a oscuras, con sus almacenes intactos.
- **Escuadra, no héroe.** Hasta doce personas (veinte con estructura de mando) a las que das órdenes en tiempo real con pausa. Veintidós habilidades que suben con el uso (el atletismo, corriendo; la fuerza, también cargando peso); siete partes del cuerpo con su propia salud; heridas que sangran hasta que alguien las venda; inconscientes a los que se puede cargar, curar, saquear o rematar. Se puede cambiar el nombre a cualquiera y despedir a quien sobre.
- **Gas en los túneles.** Cinco bolsas de gas en los túneles y salas más peligrosos, marcadas en el mapa. Sin máscara quema el pecho, hace toser y delata; quien cae dentro se asfixia si nadie lo saca. La máscara antigás lo deja fuera mientras aguanta el filtro; el respirador, solo el gas ligero. El equipo pesado estorba al sigilo y a la esquiva.
- **Ocho facciones y sus figuras.** Reputación con cada una, patrullas, caravanas, bandas, recompensas, guardias que recuerdan los robos. Volkov, Bessmertny, Orlova, Morozov, el Tuerto Rybak, Baghdadi, Voronov y Lebedeva están en sus estaciones.
- **Economía.** Cartuchos por moneda, tiendas con existencias y dinero limitados, precios distintos en cada estación, mercado negro, peajes («cinco túneles, cinco peajes»), médicos y gente de alquiler.
- **Tu propia base.** Tiendas, barracones, bancales de hongos, corrales, colectores de agua, talleres, fragua, armero, laboratorio, generador, muros, portones y alambradas. Recetas, almacenes, energía, turnos de trabajo automáticos, asaltos a la base y un árbol de investigación con las técnicas de la historia.
- **Hilos de la trama.** La carta perdida de Bessmertny, el embargo de Mertvaya y la Galería Olvidada, el derrumbe del Túnel Sur, las cabezas con precio, los almacenes blindados de Tenevskaya y una emisora de onda corta que quizá alcance más allá de Vlianska. La pantalla de hilos (`J`) dice en qué punto está cada uno y qué se puede hacer; quien empieza tiene unos primeros pasos a la vista.
- **Personajes que se mueven como personas.** Los pies se plantan en el suelo y no patinan: cada paso apoya el talón, rueda y despega sobre la punta, y las piernas se doblan por cinemática inversa, así que se puede embestir, agacharse o recular sin que los pies resbalen. Quien espera cambia el peso de pierna, respira, mira alrededor y a veces se rasca la nuca o se estira; en una pelea mira al enemigo y abre los pies; al caer, primero ceden las rodillas. Todos se dibujan entre los pasos de la simulación, así que se mueven sin tirones a cualquier frecuencia de pantalla.
- **Cuerpos y caras con forma.** Anatomía (pecho, espalda, hombros), caras con ojos, párpados, nariz, labios y orejas, pelo con su nacimiento, barbas, botas con suela y tacón, y ropa con botones, bolsillos, solapas y cremalleras.
- **Bestias con su propio cuerpo.** Ratas, skrebuns y cerdos tienen esqueleto de cuadrúpedo con patas de tres segmentos y cola articulada; pasan del paso al trote y al galope, saltan sobre la presa y caen de costado al morir. El glubinnik y el sheptun se mueven cada uno a su manera.
- **Armas que se empuñan de verdad.** Las manos tienen dedos y cierran el puño; fusiles, hachas y lanzas se sujetan a dos manos con cinemática inversa: la culata va al hombro al apuntar, el arma se lleva terciada al andar y se cuelga a la espalda o al cinto cuando las manos están ocupadas.
- **Interfaz con sprites.** Cada objeto tiene su propio dibujo, cada personaje un retrato generado a partir de su aspecto, cada facción su emblema y cada obra una miniatura de su modelo 3D. Paneles de chapa remachada, muñeco de salud por partes del cuerpo e iconos propios para cada orden.
- **Todo generado por código.** Geometría, texturas, personajes con esqueleto, animación, sprites, música, ambiente y efectos de sonido se sintetizan o se dibujan en el propio código: el repositorio no contiene ni un solo archivo de imagen, modelo o audio.

## Jugar

**Sin instalar nada:** descarga [`docs/jugar/Sombras-de-Vlianska.html`](docs/jugar/Sombras-de-Vlianska.html) y ábrelo con doble clic. Es el juego entero en un solo archivo y funciona sin internet. Los pasos, con ayuda por si algo falla, están en [`docs/jugar/`](docs/jugar/README.md).

Para trabajar con el código:

```bash
npm install
npm run dev          # servidor de desarrollo en http://localhost:5173
npm run build        # web estática en dist/
npm run build:single # dist-single/index.html: un único archivo que se abre con doble clic
npm run build:jugar  # lo mismo, copiado a docs/jugar/ para quien solo quiere jugar
```

Hace falta un navegador con WebGL 2. La partida se guarda en el almacenamiento local del navegador (autoguardado cada minuto, `F5`/`F9` y tres huecos).

### Controles

Estas son las teclas de siempre; todas, salvo `Esc` y las combinaciones con `Ctrl`, `Alt` y `Mayús`, se pueden cambiar en *Ajustes → Teclas*.

| Tecla | Acción |
| --- | --- |
| Clic izquierdo | Seleccionar a alguien de tu escuadra (arrastra para elegir a varios; Mayús para añadir) |
| Clic derecho | En el suelo: ir. Sobre algo o alguien: menú de acciones. Sobre un enemigo: atacar |
| Mayús + clic derecho | Encadenar órdenes |
| `W` `A` `S` `D` | Mover la cámara |
| `Q` / `E` | Girar la cámara (o arrastra con el botón central o el derecho) |
| Rueda | Acercar y alejar |
| Espacio | Pausa |
| `1` `2` `3` `4` | Velocidad del tiempo |
| Tab | Siguiente miembro de la escuadra |
| `F` | Centrar la cámara en el seleccionado |
| `L` · `C` · `H` | Linterna · Sigilo · Mantener posición |
| `X` | Cancelar órdenes |
| `B` · `I` · `M` · `G` · `K` · `J` | Construir · Estudio · Mapa · Facciones · Crónica · Hilos |
| `R` | Girar la obra antes de colocarla |
| `F5` / `F9` | Guardado y carga rápidos |
| `Ctrl` + `1`…`4` · `Alt` + `1`…`4` | Guardar un grupo de la escuadra · volver a seleccionarlo |
| `Ctrl` + `A` | Seleccionar a toda la escuadra |

### Comienzos

Siete maneras de bajar al metro, de «Nadie» (tres refugiados en Tsentral'naya) a los veteranos de Chernovodskaya, la partida de stalkers de Severnyy o los colonos que acampan a las puertas de Tenevskaya.

## Estructura del código

```
src/
  core/     matemáticas y números aleatorios con semilla
  data/     historia, facciones, figuras, mapa, objetos, habilidades, obras y comienzos
  world/    trazado del metro, rejilla de navegación, luces y decoración (puro, sin render)
  sim/      simulación: personajes, combate, IA, población, obras, comercio y sucesos
  render/   motor gráfico sobre three.js: mallas del mundo, kit de atrezo, personajes
  game/     une simulación y render: vistas, efectos, cámara, selección y órdenes
  audio/    música generativa, ambiente y efectos con Web Audio
  ui/       interfaz en React: HUD, inventario, comercio, diálogos, mapa y menús
  ui/sprites/  sprites vectoriales: objetos, iconos, retratos y emblemas
  dev/      visor de desarrollo
tests/      pruebas de la simulación y de la partida (Vitest)
tools/      utilidades (plano 2D del trazado, banco de equilibrio)
docs/       la historia completa del universo y, en docs/jugar/, el juego listo para abrir
```

La simulación es determinista, no depende del render y su estado es JSON puro: las pruebas la ejecutan sin navegador.

```bash
npm test             # pruebas
npm run typecheck    # comprobación de tipos
```

### Banco de equilibrio

`tools/balance.ts` mide el juego sin pantalla para ajustar con datos y no a ojo:

```bash
npx tsx tools/balance.ts economia   # rutas de comercio, recetas rentables y lo que no se puede vender
npx tsx tools/balance.ts combate    # peleas típicas repetidas con semillas distintas
npx tsx tools/balance.ts asaltos    # tamaño de los asaltos según el día, la base y la escuadra
npx tsx tools/balance.ts etapas     # asaltos de cada etapa de la partida contra escuadras de esa etapa
npx tsx tools/balance.ts larga 30   # una partida de 30 días con base y asaltos; vigila que nada se desboque
```

### Visor de desarrollo

Con el servidor de desarrollo en marcha:

- `/?view&at=TSE&d=50` recorre el mundo sin partida (`at` admite cualquier estación o cruce; `q=baja|media|alta`).
- `/?view&kit` muestra el catálogo de piezas del atrezo (`kit=tienda,puesto` para elegir cuáles).
- `/?view&chars` añade una fila de personajes de prueba.
- `/?view&poses` es un banco de poses: una fila de personajes con cada arma para revisar cómo la sujetan y cómo se mueven (`poses=listo|apuntar|ataque|marcha|correr|sigilo|reposo|caida|giro|varios|modelos`, `only=ak,hacha`, `pick=0,3`, `t=0.4` para congelar un golpe, `move` para que avancen de verdad y `freeze` para avanzar fotograma a fotograma con `__vl.step`).
- `/?view&criaturas` es el banco de criaturas (`criaturas=todas|marcha|ataque|muerte`, con los mismos parámetros).
- `/?sprites` muestra el catálogo de sprites: objetos, iconos, emblemas y retratos.
- `/?escenario=colonos&seed=7` salta directamente a una partida.

## Créditos

Universo, historia y mapa de Vlianska: **Noel619**.

Tipografías: Big Shoulders Stencil Display, PT Sans, PT Sans Narrow y PT Mono (SIL Open Font License). Motor gráfico: three.js (MIT).
