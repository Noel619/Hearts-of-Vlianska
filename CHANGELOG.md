# Cambios

## 0.5 beta

Llega el primer suceso de la historia: el Asedio de Mertvaya.

### Primer suceso: el Asedio de Mertvaya

- **El día 6 se sabe.** En Vysotnaya, frente al Túnel de Mertvaya, el Consejo Revolucionario reúne la 2.ª Brigada Roja (un comisario, cuatro de tropa de choque, once fusileros y dos zapadores) para acabar con el Califato de Izumrudnaya tras cuatro años de embargo. Una ventana lo cuenta y la partida se detiene; la pantalla de hilos lleva la cuenta atrás y el mapa marca dónde está la brigada.
- **Diez días para impedirlo.** El asalto no llega en cualquiera de estos casos:
  - Anatoli Belov, el estratega del asedio, muere, acaba lejos de Stalingradskaya o queda preso en tu base.
  - Baghdadi cae preso o muerto: el imán Karimov toma el mando, pide negociar y el Califato y el Levantamiento firman una tregua.
  - Convencéis a Morozov de que el cerco hará el trabajo sin sangre (hace falta reputación 30 con el Levantamiento).
  - La brigada queda deshecha en su campamento.
- **El día 16, si nada lo ha impedido, la brigada cruza el túnel** y asalta Mertvaya. Se la puede emboscar por el camino.
- **La batalla.** Si tu gente está cerca, se libra de verdad, soldado a soldado. Si no, se decide por las fuerzas de cada bando: la veteranía de la brigada contra la guardia atrincherada del Califato. La defensa aguanta más si alguien avisó al comandante al-Harbi y menos cuanto más hambre pasa; la comida que entra por la Galería Olvidada o de contrabando le da fuerzas. Mueren soldados de los dos bandos y también civiles, y Baghdadi y al-Harbi pueden caer.
- **Tomar partido.** Se pueden ofrecer las armas a la brigada (a Morozov, a Belov o a un oficial del Levantamiento) o al Califato (a Baghdadi, a al-Harbi, a Karimov o a sus oficiales). Quien lucha en el bando ganador cobra y gana reputación.
- **Si cae Mertvaya**, pasa a ser una estación del Levantamiento:
  - Baghdadi y al-Harbi mueren o van presos a Stalingradskaya; Baghdadi, a juicio.
  - Karimov pacta para que los civiles vivan.
  - El contrabandista Aliyev se esfuma por una de sus grietas.
  - Los esclavos del manantial salen libres.
  - Se acaba el embargo: la comida vuelve a su precio.
  - Los vecinos de Izumrudnaya siguen siendo los de siempre, con su túnica, bajo la bandera roja.
- **Si resiste**, la brigada se retira dejando atrás a sus muertos y el cerco sigue.
- En una partida guardada antes del suceso, los diez días empiezan a contar al cargarla.

### Desarrollo

- Las figuras de la historia que mueren, por la causa que sea, ya no reaparecen.
- Pruebas del suceso (`tests/asedio.test.ts`): el calendario, cada forma de impedirlo, la marcha, la batalla vista y sin ver, la conquista y el rechazo.

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

### Desarrollo

- Pruebas nuevas de la derrota, el equipo y las bases (`tests/derrota.test.ts`, `tests/equipo.test.ts`, `tests/bases.test.ts`) y mallas con todas las combinaciones de miembros perdidos y prótesis.
- La partida larga del banco de equilibrio cuenta presos, mancos y cojos, obras y el tipo de cada asalto y visita.

## 0.3 beta

Animaciones y modelos 3D nuevos para las personas y para las bestias de los túneles, estaciones con forma propia y, por fin, una salida al exterior.

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

### Estaciones con forma

- **Arquitectura propia en cada estación** (`src/world/arch.ts`): naves de tres bóvedas con pilones macizos (Industrialnaya, Stalingradskaya, Tenevskaya), naves de columnas o de bóveda única, y salas que se abren en los muros con su uso: hospital y quirófano en Nadezhdy, el gobierno de la República del Norte, la nave de los hornos y los talleres de la Fábrica, casamatas y calabozos en Rubezh, los pozos de aire redondos de Kholodnogo Vozduha con sus ventiladores, el caravasar, la aduana y la capilla de Staraya, la Sede de la Unión, la comisaría y correos en Tsentral'naya, la Sala del Consejo, la escuela y la biblioteca de Stalingradskaya, la sala de oración y los baños de Izumrudnaya, la Sala de la Conferencia de Zvezdnaya, las cuevas de la Hermandad en Vhlainska, la galería de las granjas de Rassvetnaya, el arsenal blindado de la Junta…
- **Vestíbulos y escaleras mecánicas** de verdad: carriles con peldaños, balaustradas de madera y farolas de bronce. Las de Severnyy, la rampa de carga de Industrialnaya y la escalera del pozo de Kholodnogo Vozduha suben a la superficie; las de Nadezhdy, Staraya, Tsentral'naya, Rassvetnaya, Zvezdnaya y Mostovaya acaban en puertas herméticas selladas.
- Viviendas con cortina en los arcos entre pilones; en las estaciones de andén central, las salas laterales se abren a nivel de vía con una escalera del andén justo enfrente.
- Cada sala tiene su suelo (baldosa, hormigón o tablones), sus muros (azulejo, ladrillo, hormigón, roca o dovelas), su luz y su mobiliario, con piezas nuevas: torniquetes, taquilla, perchas de máscaras, cortinas, chabolas, pupitres y pizarra, duchas de descontaminación, lavaderos, caja fuerte, bombas de achique, cabrestante, taquillas metálicas, mesas largas, archivadores…
- Los muros siguen la altura del suelo (las escaleras suben de verdad: la rejilla de alturas pasa a 16 bits) y sus remates se recortan donde se encuentran dos muros (pilones y tabiques sin solapes).

### Estaciones organizadas y llenas de gente

- Cada andén se reparte con sentido: cuerpo de guardia y almacenes junto a las bocas, barrio de viviendas hacia los extremos y la calle del mercado en el centro, con guirnaldas de bombillas sobre el pasillo.
- Bloques nuevos de vida diaria: chabolas con tendedero, comedor público, escenario con guitarrista y público, lavaderos y escuela de andén. Las estaciones militares, Vhlainska e Izumrudnaya tienen su propio relleno.
- Hasta sesenta vecinos por estación según su población (antes 26) y rutina de día y de noche: se duerme en camas y viviendas, se cena junto al fuego al caer la tarde y alguno echa la siesta.

### La superficie

- **El barrio norte de Vlianska** (`src/world/surface.ts`): la plaza y la estación de ferrocarril de Severnyy, el Prospekt Severnyy con trolebuses y autobuses varados y las barricadas de 2013, calles en cuadrícula, manzanas de bloques de paneles y de ladrillo con patios, columpios y garajes, la Fábrica con sus chimeneas y su grúa, la playa de vías con vagones congelados, la plaza de las torres de ventilación, parques y ruinas.
- Edificios con fachadas y ventanas, derrumbes que muerden la silueta y escombros a sus pies; los que tapan la vista entre la cámara y lo que miras se rebajan a una planta.
- Al subir, el metro se oculta y llegan la luz del día con sombras, la noche, la niebla y la nieve que cae; la cámara sigue la altura del suelo.
- **El aire de arriba quema**: es una bolsa de gas en toda la superficie (y en la mitad alta de las escaleras). Hace falta máscara antigás con filtros.
- Botín propio de la superficie (pisos, maleteros, quioscos, farmacias y cajas militares), chatarra, nidos de fieras y la guardia de stalkers en las salidas.
- Rutas por las calles unidas a las salidas (más caras que los túneles, para que nadie suba sin querer) y el barrio dibujado en el mapa con sus zonas.

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
