# Cambios

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
