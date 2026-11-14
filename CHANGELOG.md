# Cambios

## 0.5 beta

Comienzos que cuentan la verdad, órdenes que obedecen al instante y un golpe de gracia que no perdona.

### Órdenes

- **Cambiar de rumbo en el acto.** Con alguien en marcha, un segundo clic derecho en otro sitio le hace girar enseguida. Antes terminaba el camino viejo y, al llegar, daba la orden nueva por cumplida. Una orden sin Mayús borra también las encadenadas.

### Rematar

- **El golpe de gracia es una orden propia, rápida y sin vuelta atrás.** Quien remata se coloca junto a la cabeza o el pecho del caído y acaba en un momento según lo que lleve: un tiro a quemarropa inclinado sobre él (gasta una bala, del cargador o metida a mano), una puñalada de rodillas, un golpe hacia el suelo con hacha, maza, tubo o culata, o, sin arma, estrangularlo con las dos manos (tarda más cuanta menos fuerza). Antes era una pelea normal contra alguien en el suelo: golpes a brazos y piernas al azar, a culatazos aunque se llevara un fusil, y podía tardar muchísimo.
- Lo hace el más cercano de los seleccionados; el menú dice cómo («Un tiro de gracia», «Sin arma: con las manos») o si es un asesinato. Rematar a quien no es enemigo es un crimen grave.
- **Sangre por sangre.** Quien ha perdido a alguien de los suyos a vuestras manos no hace prisioneros: remata a los vuestros cuando caen. Los cazarrecompensas, que cobran por traeros vivos, y los hambrientos, que solo quieren comida, no.
- Si el caído se levanta antes del golpe, vuelve a ser una pelea.

### Las fieras y sus presas

- **Arrastrar de verdad.** El skrebun agarra al caído de un tobillo con los dientes y tira de espaldas, a tirones, con la cabeza baja y las patas afianzadas; la marcha hacia atrás no patina. El cuerpo va boca arriba, con la pierna en alto hasta la boca de la fiera, la otra a rastras y los brazos por encima de la cabeza, sacudiéndose con cada tirón. El glubinnik y el sheptun lo llevan del tobillo con la mano, a su espalda. Antes el cuerpo iba empujado delante del hocico, tieso y sin que nada lo sujetara.
- **Comerse a alguien no lleva minutos.** Con el hocico sobre su pecho, desgarra a cada mordisco y lo mata en unos segundos (varias fieras, antes). Antes roían brazos y piernas durante minutos sin que pasara nada.

### Comienzos

- **Cada comienzo empieza donde dice**: los refugiados en el suelo del andén de Tsentral'naya, el cartero en el caravasar de Staraya, los colonos en el Cruce Oriental, los stalkers en su base de Severnyy, los de la Hermandad en la guarida del Tuerto, los veteranos al pie de la escalera del pozo de Kholodnogo Vozduha y los vecinos de la Esmeralda en los baños de las abluciones.
- **Hijos de Vhlainska**: seguís siendo hermanos, así que las bandas de la Hermandad ya no os cobran peaje (os paraban nada más empezar, dentro de vuestra propia estación). Si os pillan robando a la Hermandad o atacando a uno de los suyos, sois traidores. Staraya paga por vuestras cabezas y la llave de los almacenes de Tenevskaya está en el botín del Tuerto, junto a su guarida.
- **Veteranos del sur**: Mostovaya no tiene salida a la superficie, así que ahora bajan por el pozo de Kholodnogo Vozduha, el acceso más cercano a Chernovodskaya. Son desertores de la junta, llevan máscaras con los filtros casi agotados y una treintena de balas de verdad (antes, con los cargadores llenos, más de setenta).
- **El hambre de la Esmeralda**: las barricadas del Levantamiento disparan a quien sale (antes se podía salir andando por Vysotnaya). La galería tapiada sale de la propia Izumrudnaya.
- **Stalkers del Norte**: el Hospital de la Esperanza paga de verdad mejor las glándulas de skrebun.
- **Nadie**: el texto cuenta lo que lleváis (antes hablaba de «un cuchillo» y había también un tubo).
- **Primeros pasos propios de cada comienzo**: el cartero vuelve a Tsentral'naya y busca la carta; los colonos levantan el campamento y entran en Tenevskaya; los stalkers suben a la superficie, cazan un skrebun y venden su glándula en Nadezhdy; los de la Hermandad cogen la llave sin que les vean; los veteranos comen, se curan y consiguen munición; los de la Esmeralda buscan la galería y la abren.
- **Cómo están las cosas**: el menú y el informe de bajada dicen quién os quiere, quién os dispara nada más veros, quién paga por vuestras cabezas y si venís heridos o con hambre, calculado de la propia partida.
- La estación donde empezáis ya no se anuncia con «Has llegado a…».

### Desarrollo

- Pruebas nuevas: `tests/ordenes.test.ts` (cambiar de rumbo, encadenar), `tests/remate.test.ts` (cada forma de rematar, asesinato, venganza, fieras que comen y arrastran) y `tests/comienzos.test.ts` (cada comienzo empieza donde dice, con lo que dice, sin peajes absurdos y con un informe que coincide con la partida); pruebas de animación del arrastrado, la marcha hacia atrás y el comer.

## 0.4 beta

Caer tiene consecuencias, las heridas dejan marca, el equipo se gasta y las bases son más que un campamento. También llegan a esta versión las estaciones con forma y la superficie.

### Lo que pasa cuando caes

- **Los saqueadores despojan a los caídos**: se llevan el arma, las mejores piezas de armadura y lo que más vale de la mochila. Lo robado viaja con la banda; si vuelve a casa, acaba en su depósito (el de Vhlainska, en el botín de la Hermandad), de donde se puede recuperar.
- **Cárceles de verdad.** Con la cabeza a precio, los guardias y las patrullas se llevan a hombros a los tuyos que caen hasta sus calabozos: la comisaría de Tsentral'naya (la Unión), los calabozos de Rubezh (los Seguidores) y los de la junta de Chernovodskaya. Allí les quitan todo al depósito de decomisos, les vendan y cumplen condena (de uno a cinco días, según lo que se debía). La cárcel salda la deuda. Staraya y la República del Norte no tienen calabozos: multan y sueltan.
- **Esclavitud y trabajos forzados.** Los de Vhlainska encierran a sus esclavos en las jaulas y los sacan a trabajar de día; el Califato los encadena junto al manantial; el Levantamiento manda a reeducarse a las granjas de Rassvetnaya. El trabajo forzado endurece (fuerza y aguante).
- **Fugas y rescates.** Un preso puede forzar los grilletes cuando ningún guardia mira (la cerradura, la luz, el sigilo y hacia dónde mira el guardia cuentan); si le pillan, paliza y más condena. Un compañero puede forzárselos desde fuera, aunque si le ven es un delito. Quien escapa queda marcado un tiempo y la recompensa sube.
- **Fianzas y rescates por las buenas.** Con un oficial o un guardia de quien lo tiene preso se paga la fianza (y se recupera lo decomisado) o se compra la libertad de un esclavo.
- **Las fieras se comen a los caídos.** Las ratas roen a quien cae donde cae (si no hay luz); los skrebuns y otras bestias grandes lo arrastran por el suelo hasta su nido. Cada mordisco desgarra brazos y piernas, que pueden perderse.
- **Cazarrecompensas.** Cuando una facción paga 60 cartuchos o más por vuestras cabezas, cada día o dos sale una partida de cazarrecompensas que os sigue el rastro, os tumba y os lleva a la cárcel de quien paga (o se cobra la deuda de vuestra bolsa).
- **Saldar la deuda.** La recompensa se paga hablando con un oficial o un guardia de esa facción, o en Staraya, que arregla cuentas con todo el metro a cambio de una comisión.

### Heridas que no se curan

- **Miembros perdidos.** Un brazo o una pierna destrozados pueden perderse de un tajo, de un balazo o entre las fauces de una fiera. El muñón sangra a chorros hasta que se venda; lo que empuñaba esa mano cae al suelo.
- Sin brazo derecho no se empuña un arma; sin uno de los dos, nada de armas de dos manos. Sin una pierna (y sin prótesis) se va a gatas. Los brazos que faltan, o los de acero, trabajan más despacio.
- **Prótesis.** Brazos y piernas ortopédicos que se compran a los médicos o se fabrican en el nuevo **banco de prótesis** (técnica «Prótesis caseras»). Se ponen usándolas desde el inventario; rinden según su calidad, se abollan con los golpes y se reparan.
- **Cojera crónica.** Una pierna destrozada puede dejar cojera para siempre: corre menos y se ve al andar. Solo la arreglan en el quirófano del Hospital de la Esperanza (Ubezhishche Nadezhdy).
- En el modelo 3D se ven el muñón vendado bajo la manga o la pernera, la garra de acero y la pierna ortopédica con su taco de goma; en el muñeco de salud, el miembro que falta y la prótesis.

### Equipo con calidad y desgaste

- **Cinco grados de calidad**, de chatarra a militar, en armas, armaduras y prótesis: cambian el daño, la puntería, la protección y el precio. La gente del metro va equipada según su oficio y su facción; las tiendas, los almacenes y los arsenales tienen lo suyo.
- **Se gastan con el uso**: las armas al golpear, parar y disparar; las armaduras al parar golpes. Por debajo de la mitad rinden menos; un arma de fuego rota no dispara.
- **Reparación.** La mesa de desguace, el banco de armero y el de prótesis tienen la opción «Reparar»: arreglan lo gastado de los almacenes cercanos y lo que lleve tu gente al lado, gastando piezas, cuero, tela o tablones. Quien sabe poco no lo deja como nuevo.
- Lo que sale de un taller tiene la calidad de la mano de quien lo hace (lo militar, solo con mucha Armería y la técnica de la carabina).
- **Huecos nuevos: manos, piernas y pies**, con guantes de trabajo (se trabaja más deprisa), guantes de cuero (mejor agarre), guanteletes de chapa, pantalón de guata, perneras de cuero, grebas de chapa, botas de trabajo, botas militares (se corre más) y botas de fieltro (silenciosas).

### Bases más profundas

- **Asentamientos y puestos avanzados.** Las obras alejadas forman asentamientos aparte; los asaltos eligen uno (los grandes atraen más) y la pantalla de hilos los enumera.
- **Las obras se dañan y se reparan.** Los asaltantes rompen portones, muros y nidos; los derribados quedan en escombros. Clic derecho: «Reparar» (gasta el material principal de la obra); quien tiene el trabajo «Construir obras» repara solo lo dañado.
- **Nido de ametralladora** (técnica «Nidos de ametralladora»): dispara solo hacia delante mientras alguien lo sirva, con las balas de su almacén o de quien lo maneja; se puede asignar como guardia fija.
- **Asaltos variados.** Además de la Hermandad y las jaurías: expediciones de castigo de las facciones con las que estáis en guerra (o a las que les negasteis el tributo) y gente hambrienta que viene a por la comida en los inviernos crudos y las fiebres. Rompen obras y saquean los almacenes, y se retiran cuando van cargados.
- **Visitas de las facciones vecinas.** Cada pocos días, recaudadores que piden tributo «por la protección» (pagar, pagar la mitad o negarse y esperar el castigo) o inspecciones que buscan lo robado a esa facción y lo prohibido (dejar registrar o sobornar). Si no hay nadie en la base, se cobran del almacén.
- **Escuadras propias.** «+ Nueva escuadra» separa a los seleccionados en un grupo que va por su cuenta; pestañas para verlas y cambiar de una a otra, y selector de escuadra en la ficha.
- **La comida se estropea.** Hongos frescos, carne y guisos se pudren en pocos días; lo seco, lo ahumado, las latas y el samogón aguantan. Se come primero lo que está a punto de pasarse. La **despensa** (técnica «Conservación de alimentos») la hace durar el triple, y la **carne ahumada** (en la hoguera o la cocina) aguanta semanas. La comida podrida no se come, pero los cerdos del corral sí.

### El metro

- **Estaciones con forma**: naves de pilones o de columnas, salas anejas (calabozos, jaulas, hospitales, talleres, consejos…), vestíbulos y escaleras mecánicas.
- **La superficie**: las escaleras de Severnyy, la rampa de Industrialnaya y el pozo de Kholodnogo Vozduha suben a un barrio en ruinas con su luz del día, su noche, su niebla y su nieve, y con botín que nadie ha bajado en veinte años. El aire de arriba pide máscara.

### Desarrollo

- Pruebas nuevas de la derrota, el equipo y las bases (`tests/derrota.test.ts`, `tests/equipo.test.ts`, `tests/bases.test.ts`) y mallas con todas las combinaciones de miembros perdidos y prótesis.
- La partida larga del banco de equilibrio cuenta presos, mancos y cojos, obras y el tipo de cada asalto y visita.

## 0.3 beta

Animaciones y modelos 3D nuevos para las personas y para las bestias de los túneles.

### Movimiento

- **Sin tirones.** La simulación va a 30 pasos por segundo; ahora cada personaje y cada criatura se dibuja entre su posición del paso anterior y la del último, así que avanza y gira con suavidad a 60 Hz o más. Los anillos de selección, las sombras, las barras de vida y las linternas van con el modelo.
- **Pies que no patinan.** Cada pie sigue su trayectoria: apoya el talón, rueda, despega sobre la punta, vuela y vuelve a apoyar. Las piernas se resuelven por cinemática inversa y la cadera baja lo que haga falta para alcanzar, de modo que el paso de la animación coincide con lo que se avanza (menos de un 2 % de resbalón andando, corriendo o agachado; antes los pies se deslizaban sin control). La zancada se mide con la distancia real recorrida, también a velocidad ×2, ×3 y ×4.
- **Andar y correr con peso.** La pelvis gira y se ladea, el pecho compensa, los brazos bracean según lo que lleven en las manos (nada si sujetan un fusil o un farol), el cuerpo se inclina al acelerar y al frenar y se ladea hacia dentro en las curvas. Al correr hay fase de vuelo y los codos se doblan; al girar en el sitio da pasitos. Cargar a alguien acorta el paso; quien cojea arrastra la pierna mala.
- **Reposo vivo.** Quien espera cambia el peso de una pierna a otra, respira (más deprisa y más hondo después de correr) y de vez en cuando mira alrededor, encoge los hombros, se rasca la nuca o se estira.
- **Peleas.** Con un enemigo cerca, la guardia abre los pies; la cabeza y el pecho siguen al enemigo. Los ataques llevan juego de pies (el pie de delante avanza en el golpe, la estocada es una zancada), el tirador planta los pies al apuntar y quien recibe un golpe recula sin que se le muevan los pies.
- **Caer y levantarse.** Al quedar inconsciente o morir de pie ya no se tumba como un tablón: primero ceden las rodillas; quien cae de espaldas se sienta y rueda hacia atrás, quien cae de bruces da con las rodillas y luego con el pecho, y el cuerpo rebota un poco contra el suelo. Al levantarse pasa por una rodilla en tierra.

### Personas

- **Cuerpo nuevo.** Tronco con pecho o busto, omóplatos, glúteos y barriga según la complexión; hombros con trapecio y deltoides en lugar de bolas. Los muslos se tocan por dentro: la entrepierna ya no se ve como un pañal oscuro.
- **Caras.** Mandíbula, barbilla, pómulos, arco de las cejas y cuencas; ojos con su blanco, iris de color, pupila, párpado y pestañas; nariz con caballete y aletas; labios; orejas con concha; arrugas en los viejos. El pasamontañas deja ver los ojos.
- **Pelo y barbas.** El pelo nace donde debe (frente, patillas, nuca): corto, rapado, melena que cae por la espalda, moño, y calva con herradura en los viejos; bajo el sombrero solo asoma por debajo. Barba sobre mandíbula y mejillas que deja ver la boca, barba larga que se afila, bigote.
- **Ropa y botas.** Botones, bolsillos con solapa, solapas, corbata, cremalleras, remiendos, puños, mangas remangadas, bolsillos de muslo y hebillas en el chaleco. Botas con caña de borde vuelto, puntera, tacón, suela y cordones. Las faldas y los abrigos largos siguen a las rodillas.
- Construir un aspecto es más rápido aunque la malla tiene cuatro veces más detalle.

### Bestias

- **Cuadrúpedos de verdad.** Ratas, skrebuns y cerdos tienen esqueleto propio con patas de tres segmentos (las traseras con corvejón, como un perro) y cola de cuatro huesos.
- **Cada especie con su cuerpo.** La rata, del tamaño de un perro, con el lomo arqueado, el pelo erizado, bigotes, incisivos amarillos, orejas y manos rosadas y la cola anillada. El skrebun, pálido y consumido: costillas marcadas, púas en el espinazo, los labios recogidos sobre dos filas de dientes y garras como hoces. El cerdo, un barril con cerdas, el disco del hocico, orejas caídas, pezuñas partidas y cola rizada.
- **Marcha.** Pasan del paso al trote y al galope con las patas plantadas; al galopar el espinazo se dobla y se estira, en las curvas el cuerpo se arquea y la cola sigue el movimiento como una ola. En reposo olfatean el suelo y miran alrededor; en alerta se agachan con la cabeza baja mirando a la presa.
- **Ataque y muerte.** Se agachan, saltan con las zarpas por delante y muerden; al recibir se encogen hacia un lado; al morir ceden las patas, caen de costado y patalean un momento.
- **Glubinnik y sheptun nuevos.** El glubinnik es una mole encorvada con joroba de placas, boca ancha llena de dientes y brazos larguísimos con tres garras, y camina pesado, bamboleándose. El sheptun es alto, negro y consumido, con costillas, boca abierta, dedos como agujas y jirones, y acecha agazapado sacudiendo la cabeza a tirones.

### Arreglos

- Las mallas con normales nulas (el farol tenía doce) daban NaN en el shader y el resplandor podía dejar toda la pantalla en negro según el ángulo.

### Desarrollo

- Banco de poses con `move` (avanzan de verdad), `freeze` (fotograma a fotograma), `pick` y los presets `correr`, `reposo`, `caida`, `giro` y `modelos`; banco de criaturas `?view&criaturas`.
- Pruebas de mallas válidas, pies que no patinan, poses sin NaN y movimiento continuo entre pasos.

## 0.2 beta

Completa lo que la 0.1 dejaba a medias y equilibra la partida larga con datos medidos (`tools/balance.ts`).

### Gas en los túneles

- **Cinco bolsas de gas** en los túneles y salas peligrosos, con nombre y descripción: la Galería de las Tuberías, La Hondonada (Túnel de la Escarcha), El Aliento de Tenevskaya, el polvo de superficie junto a Severnyy y el aire viciado de la Galería Olvidada. La densidad se desvanece en los bordes y no atraviesa la roca.
- **Sin máscara, el gas quema el pecho**, hace toser (la tos se oye, atrae a las fieras y rompe el sigilo) y acaba tumbando. Quien cae inconsciente dentro se asfixia si nadie lo saca. Las criaturas no lo notan: hay un nido dentro del Aliento.
- **Las máscaras por fin sirven.** La antigás deja fuera todo el gas mientras aguanta el filtro; el respirador, solo el gas ligero. Cada filtro aguanta unas cinco horas de gas denso y se cambia solo por uno de repuesto (tuyo o de un compañero cercano); también a mano, usando un filtro. El filtro gastado viaja con la máscara al quitarla, soltarla, venderla o guardar la partida.
- **La escuadra no se queda a respirarlo**: sin órdenes se aparta del gas (salvo con «mantener posición») y no va a un trabajo fijo dentro sin la protección necesaria.
- Niebla baja animada en 3D, bolsas marcadas en el mapa, aviso en la barra superior, estado «Respira gas», medidor del filtro en la ficha, avisos que no se repiten, tos y cambio de filtro sintetizados.

### Equipo y habilidades

- **El equipo pesado estorba**: el chaleco de placas, el casco y la mochila de stalker hacen que en sigilo te vean desde más lejos y avances más despacio, y restan esquiva. Se ve en cada pieza y en la ficha.
- **El atletismo sube corriendo** (más deprisa si vas cargado) y la **fuerza**, moviéndote con mucho peso encima o con alguien a hombros.
- Las muertes y los desmayos dicen la causa (desangrado, de hambre, asfixiado por el gas).

### Escuadra

- **Cambiar el nombre** a cualquiera de la escuadra (lápiz junto al nombre o doble clic).
- **Despedir**: una confirmación dice adónde irá, qué se lleva puesto (clic en una pieza para que la deje) y qué deja en el suelo para los demás. No se puede despedir a quien está inconsciente ni al último que queda. Quien se va camina hasta la estación habitada más cercana, donde se le puede volver a contratar.
- **Arreglo**: al contratar a alguien de la cantina, su sitio volvía a llenarse con la misma persona (mismo nombre y cara).

### Teclas

- **Todas las teclas se pueden cambiar** en *Ajustes → Teclas*. Si eliges una que ya usaba otra acción, intercambian y se avisa; nada se queda sin tecla. Se guardan en el navegador y se pueden restablecer.
- Ayuda, informe de bajada, primeros pasos, botones y avisos muestran siempre la tecla asignada, con el carácter real de tu teclado cuando el navegador lo permite.
- Con `Ctrl` o `Alt` pulsadas la cámara ya no se mueve (`Ctrl+A` la desplazaba a la izquierda).

### Equilibrio

- **Armas de fuego a quemarropa**: quien llevaba un fusil y tenía al enemigo encima no disparaba ni golpeaba; se quedaba quieto. Ahora pelea con la culata. Era la causa de que los tiradores perdieran casi siempre en los túneles.
- **Armas de fuego reequilibradas** para que el precio se corresponda con lo que rinden: pistola, subfusil, recortada, fusil del túnel (ahora con cargador de 8), fusil de cerrojo y neumático rinden más; el Kaláshnikov dispara algo más despacio y sigue siendo el mejor fusil asequible. El blanco de un disparo es el cuerpo con los brazos, no solo el tronco.
- La gente del metro apunta un tercio más despacio que la tuya con cualquier arma (antes era una pausa fija que con un Kaláshnikov la dejaba a la mitad de cadencia y con un fusil de cerrojo casi no se notaba).
- **Asaltos a la base**: el primero llega a partir del día 3; mientras son pocos vienen sin cabecilla, y las jaurías pequeñas son de ratas (los skrebuns, más adelante). Su tamaño crece con las obras, con tu escuadra (cada cual cuenta según lo que sabe pelear: unos colonos novatos no atraen a una banda entera) y con el tiempo, hasta 14 (antes se quedaba en 8 desde el día 20). Desde el día 20 los saqueadores llegan cada vez más curtidos y mejor armados; en la recta final, parte de la banda es tropa de choque con placas y Kaláshnikov.
- **Comercio**: lo que no vale ni un cartucho en una tienda (la munición, por ejemplo) ya no se puede «vender» por nada; se ve atenuado en la lista.

## 0.1 beta

Primera versión que se puede jugar de principio a fin.

### La partida

- **El final se puede alcanzar.** La emisora de radio se opera (clic derecho: «Escuchar la radio»): tras barrer las frecuencias capta la señal de Múrmansk y se muestra un epílogo que cuenta cómo ha quedado el metro. El final es abierto: se puede seguir jugando.
- **Los almacenes de Tenevskaya.** La llave de la defensa civil está en el botín de la Hermandad, en Vhlainska, y abre las puertas blindadas sin forzarlas.
- **La carta perdida** se puede quemar, además de entregarla a Volkov, a Bessmertny o al Consejo Mercantil.
- **Hilos del metro** (`J`): estado de cada hilo de la trama y de tu base, con lo que se sabe y lo que se puede hacer.
- **Primeros pasos**: seis tareas a la vista para quien empieza (hablar, comerciar, desguazar, construir, investigar y contratar). Se pueden ocultar.
- **Informe de bajada** al empezar: quiénes sois, qué lleváis y cómo se manda.

### Interfaz y sprites

- Paneles de chapa remachada, retratos generados a partir del aspecto de cada personaje, emblemas de facción y muñeco de salud por partes del cuerpo.
- Un sprite propio para cada objeto y unos sesenta iconos para órdenes, posturas y menús.
- Miniaturas 3D de cada obra, fichas al pasar el ratón por obras, contenedores, bultos y vetas, y mapa del metro con emblemas.

### Personajes

- Manos con dedos que cierran el puño; fusiles, hachas y lanzas a dos manos con cinemática inversa; culata al hombro al apuntar.
- Las armas se cuelgan a la espalda o al cinto con las manos ocupadas; lo que se suelta se ve en el suelo; linternas y faroles encendidos a la vista.

### Pendiente para próximas versiones

- Consecuencias a largo plazo de la carta (distensión o ultimátum) en las patrullas de la Unión y los Seguidores.
