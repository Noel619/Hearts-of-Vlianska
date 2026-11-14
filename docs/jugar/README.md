# Cómo abrir el juego

El juego entero está en un solo archivo: **[`Sombras-de-Vlianska.html`](Sombras-de-Vlianska.html)**.
Se abre con doble clic, como cualquier documento. No hay que instalar nada y funciona sin internet.

## 1. Descarga el archivo

Elige **una** de estas dos maneras.

**A. Solo el juego (lo más rápido)**

1. Entra en el archivo [`Sombras-de-Vlianska.html`](Sombras-de-Vlianska.html) aquí en GitHub.
2. Arriba a la derecha de la vista del archivo, pulsa el botón de descarga (**Download raw file**, el icono de la flecha hacia abajo).
3. El archivo queda en tu carpeta de *Descargas*.

**B. Todo el proyecto en un ZIP**

1. En la página principal del repositorio, pulsa el botón verde **Code** y luego **Download ZIP**.
2. Busca el ZIP en *Descargas*, haz clic derecho sobre él y elige **Extraer todo** (en Mac basta con doble clic).
   No abras el juego desde dentro del ZIP sin extraerlo: se abriría, pero las partidas podrían perderse.
3. Dentro de la carpeta extraída, entra en `docs` → `jugar`.

> Si en GitHub no ves la carpeta `docs/jugar`, estás en otra rama. Cambia de rama con el selector que hay arriba a la izquierda, encima de la lista de archivos.

## 2. Ábrelo

Haz **doble clic** en `Sombras-de-Vlianska.html`. Se abre en tu navegador y aparece el menú del juego. Pulsa **Nueva partida** y elige un comienzo; «Nadie» o «La saca de correo» son buenos para empezar.

Si el doble clic lo abre con otro programa (un editor de texto, por ejemplo), haz clic derecho sobre el archivo → **Abrir con** → **Google Chrome**, **Microsoft Edge** o **Firefox**.

Truco: arrastra el archivo al escritorio, o crea un acceso directo, y tendrás el juego siempre a mano.

## Partidas guardadas

- El juego se guarda solo cada minuto. `F5` guarda y `F9` carga cuando quieras, y en el menú hay tres huecos de guardado.
- Las partidas se guardan **dentro del navegador**, no en el archivo. Si abres el juego con otro navegador no verás las partidas guardadas en el primero, así que usa siempre el mismo. Por si acaso, no muevas el archivo de carpeta después de empezar.
- Borrar los datos de navegación (*cookies y datos de sitios*) también borra las partidas.

## Si algo falla

| Qué pasa | Qué hacer |
| --- | --- |
| La pantalla se queda negra o sale un aviso de WebGL | El juego necesita **WebGL 2**. Actualiza el navegador y comprueba que la *aceleración por hardware* esté activada (Chrome/Edge: *Configuración → Sistema*). Puedes comprobarlo en [get.webgl.org/webgl2](https://get.webgl.org/webgl2/). |
| Va muy lento | En **Ajustes → Gráficos** elige calidad **Baja**, guarda la partida y vuelve a abrir el archivo (el cambio se nota al recargar). Cierra otras pestañas y, en portátiles, enchufa el cargador. |
| No suena nada | Haz clic una vez dentro del juego: los navegadores no dejan sonar nada hasta que tocas la página. Revisa también el volumen en **Ajustes**. |
| Se ve el código en lugar del juego | Se abrió como texto. Usa **Abrir con** y elige un navegador (ver arriba). |

Las teclas están en el menú del juego, en **Cómo se juega**, y en la tabla de controles del [README principal](../../README.md#controles).

---

### Para quien toca el código

Este archivo se genera; no se edita a mano. Después de cambiar el juego, vuelve a crearlo con:

```bash
npm run build:jugar
```

Ese comando compila la versión de un solo archivo (`npm run build:single`) y la copia aquí.
