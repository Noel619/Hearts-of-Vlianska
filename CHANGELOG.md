# Cambios

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
