# Legado

Aquí se guardan juegos anteriores del repositorio, completos y con su historia, para que nada del trabajo hecho se pierda. No forman parte de *Sombras de Vlianska*: no se compilan ni se prueban con él.

## Hearts of Vlianska (gran estrategia en 2D)

[`hearts-of-vlianska/`](hearts-of-vlianska/) es el juego que había en este repositorio antes de *Sombras de Vlianska*: gran estrategia por provincias al estilo de *Hearts of Iron IV*, con las ocho facciones del metro, árboles de enfoques, investigación, economía, diplomacia y guerra túnel a túnel. Está en su última versión (la de la rama `claude/quirky-hopper-u99ztm`): frente realista con cercos y reconquista, nuevo modelo de combate, árboles de enfoques rehechos, eventos de historia, la colonia de arañas de Tenevskaya y la versión de escritorio para Windows, Linux y macOS.

Se arranca desde su carpeta, con sus propias dependencias:

```bash
cd legado/hearts-of-vlianska
npm install
npm run dev          # servidor de desarrollo
npm test             # sus pruebas
npm run build:single # dist-single/index.html: un único archivo que se abre con doble clic
npm run desktop      # versión de escritorio (descarga Electron)
```

Su README cuenta todo lo demás.
