// Guía de juego.
import { useState, type ReactNode } from 'react';
import { Icon, Modal } from '../components/core';

const SECTIONS: { id: string; title: string; icon: string; body: ReactNode }[] = [
  {
    id: 'objetivo',
    title: 'Objetivo',
    icon: 'Flag',
    body: (
      <>
        <p>
          Estamos en enero de 2033, veinte años después de las bombas. Diez mil supervivientes se refugiaron en el metro de Vlianska; hoy ocho facciones se reparten sus
          estaciones. Tú diriges una de ellas.
        </p>
        <p>
          Ganas si controlas <strong>11 de las 16 estaciones</strong>. Pierdes si tu facción desaparece. En enero de 2040 la partida hace balance, aunque puedes seguir
          jugando.
        </p>
        <p>
          El tiempo avanza hora a hora. Pausa con <span className="kbd">Espacio</span> y cambia la velocidad con las teclas <span className="kbd">1</span>–
          <span className="kbd">5</span>.
        </p>
      </>
    ),
  },
  {
    id: 'mapa',
    title: 'El mapa',
    icon: 'Map',
    body: (
      <>
        <p>
          Las <strong>estaciones</strong> son las regiones: tienen población, talleres, granjas, recursos y barricadas. Los <strong>túneles</strong> se dividen en tramos y
          cruces, que son las casillas por las que se mueven los ejércitos y donde se libran las batallas.
        </p>
        <ul>
          <li>
            <strong>Líneas principales</strong>: anchas y rápidas.
          </li>
          <li>
            <strong>Túneles peligrosos</strong> (con franja negra): lentos, con mutantes que desgastan a las tropas y tienden emboscadas. Los stalkers reducen el desgaste.
          </li>
          <li>
            <strong>Túneles auxiliares</strong> (marrones): estrechos, caben pocas tropas en combate y las draisinas no pasan por ellos. Sirven para flanquear.
          </li>
          <li>
            <strong>Derrumbes</strong>: infranqueables. Se pueden excavar con la tecnología de excavación y la decisión correspondiente.
          </li>
          <li>
            <strong>Tenevskaya</strong> está abandonada. Si llevas tropas a la estación, puedes recolonizarla.
          </li>
        </ul>
        <p>Usa los modos de mapa (abajo a la izquierda) para ver facciones, diplomacia, tipos de túnel, peligro mutante o suministro.</p>
      </>
    ),
  },
  {
    id: 'economia',
    title: 'Economía',
    icon: 'Factory',
    body: (
      <>
        <p>
          Los <strong>talleres civiles</strong> construyen edificios y pagan las importaciones; una parte se pierde en bienes de consumo según tu ley económica. Los{' '}
          <strong>talleres militares</strong> fabrican equipo en líneas de producción que ganan eficiencia con el tiempo.
        </p>
        <p>
          Cada línea consume <strong>chatarra, pólvora o combustible</strong>. Si faltan, la producción cae: importa recursos desde el panel de comercio (necesitas una ruta de
          caravanas segura).
        </p>
        <p>
          La <strong>comida</strong> sale de las granjas de hongos y de los cerdos. Si las reservas se acaban llega la hambruna: la población muere y la estabilidad se
          hunde.
        </p>
      </>
    ),
  },
  {
    id: 'politica',
    title: 'Política',
    icon: 'Landmark',
    body: (
      <>
        <p>
          El <strong>poder político</strong> se gasta en leyes, asesores, decisiones y diplomacia. La <strong>estabilidad</strong> afecta a la producción y a las revueltas; el{' '}
          <strong>apoyo a la guerra</strong> desbloquea leyes más duras y retrasa la capitulación.
        </p>
        <p>
          Las <strong>leyes</strong> de reclutamiento determinan cuántos habitantes pueden luchar; las de raciones, cuánta comida consume cada uno.
        </p>
        <p>
          El <strong>enfoque nacional</strong> es el corazón de cada facción: cada árbol cuenta su propia historia y ofrece caminos excluyentes.
        </p>
      </>
    ),
  },
  {
    id: 'ejercito',
    title: 'Ejército y combate',
    icon: 'Swords',
    body: (
      <>
        <p>
          Selecciona tus unidades en el mapa y haz <strong>clic derecho</strong> en el destino (o pulsa «Mover» y elige el destino). Si hay enemigos en la casilla siguiente,
          empieza una batalla.
        </p>
        <ul>
          <li>
            El defensor ocupa la casilla y el atacante empuja desde las vecinas. Cada unidad combate en <strong>una sola batalla</strong>: si atacan la casilla desde la que
            atacas, tus tropas dejan el ataque y se defienden.
          </li>
          <li>
            Cada casilla tiene un <strong>ancho de combate</strong>: en un túnel solo cabe una unidad por bando a la vez. Las demás esperan en la <strong>reserva</strong> y
            relevan a las agotadas, así que tener más tropas permite aguantar o presionar más tiempo. Los morteros disparan también desde la reserva.
          </li>
          <li>
            Atacar desde <strong>varios túneles a la vez</strong> amplía el frente, divide el fuego del defensor y da bonificación de flanqueo: es la mejor forma de tomar una
            estación bien defendida.
          </li>
          <li>
            Los disparos que la <strong>defensa</strong> (al defender) o la <strong>ruptura</strong> (al atacar) de una unidad bloquean le hacen poco daño; los que no bloquea,
            mucho más. Las <strong>barricadas</strong>, las estaciones y el <strong>atrincheramiento</strong> (una unidad quieta se atrinchera en 8 días) reducen el fuego que
            recibe el defensor. Las tropas de asalto, los lanzallamas y las draisinas ayudan a romper esas defensas.
          </li>
          <li>
            La <strong>organización</strong> (barra verde) es la capacidad de seguir luchando; la <strong>fuerza</strong> (barra naranja), los hombres y el equipo. Una unidad
            sin organización se retira; si no puede retirarse porque está rodeada, se rinde.
          </li>
          <li>
            Puedes <strong>replegar</strong> una unidad que está defendiendo dándole otra orden de movimiento: deja de combatir y sale de la casilla. Si el enemigo entra antes
            de que salga, huye con media organización.
          </li>
          <li>
            Las unidades necesitan <strong>suministro</strong>: una estación amiga a pocos tramos. Sin él pierden fuerza cada día y combaten peor.
          </li>
        </ul>
        <p>Diseña tus propias unidades en el panel de ejército con el diseñador de plantillas.</p>
      </>
    ),
  },
  {
    id: 'diplomacia',
    title: 'Diplomacia y guerra',
    icon: 'Handshake',
    body: (
      <>
        <p>
          Para declarar la guerra necesitas <strong>justificarla</strong>. Los gobiernos democráticos y mercantiles solo pueden hacerlo si la <strong>tensión del metro</strong>{' '}
          es alta o si reclaman alguna estación del objetivo.
        </p>
        <p>
          Una facción <strong>capitula</strong> cuando pierde suficientes puntos de victoria. Entonces puedes anexionarla o convertirla en protectorado.
        </p>
        <p>
          Las estaciones conquistadas que no son núcleo rinden la mitad y pueden <strong>sublevarse</strong> y resucitar a su antigua facción. Mantén guarniciones y estabilidad,
          o intégralas con una decisión.
        </p>
      </>
    ),
  },
  {
    id: 'atajos',
    title: 'Atajos de teclado',
    icon: 'Settings',
    body: (
      <table className="table">
        <tbody>
          {[
            ['Espacio', 'Pausa / reanudar'],
            ['1 – 5', 'Velocidad'],
            ['G', 'Gobierno'],
            ['F', 'Enfoque nacional'],
            ['I', 'Investigación'],
            ['D', 'Diplomacia'],
            ['C', 'Comercio'],
            ['B', 'Construcción'],
            ['P', 'Producción'],
            ['E', 'Ejército'],
            ['X', 'Decisiones'],
            ['L', 'Registro'],
            ['M', 'Silenciar / activar el sonido'],
            ['Esc', 'Cerrar / menú'],
            ['Clic derecho', 'Mover unidades'],
            ['Rueda', 'Zoom'],
          ].map(([k, v]) => (
            <tr key={k}>
              <td>
                <span className="kbd">{k}</span>
              </td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  },
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [sec, setSec] = useState(SECTIONS[0].id);
  const cur = SECTIONS.find((s) => s.id === sec)!;
  return (
    <Modal onClose={onClose} wide className="help-modal">
      <header className="modal-head">
        <Icon name="CircleHelp" size={20} className="amber" />
        <h2>Cómo jugar</h2>
        <button className="btn icon ghost" onClick={onClose} aria-label="Cerrar">
          <Icon name="X" size={18} />
        </button>
      </header>
      <div className="help-body">
        <nav className="help-nav">
          {SECTIONS.map((s) => (
            <button key={s.id} className={`help-tab ${s.id === sec ? 'active' : ''}`} onClick={() => setSec(s.id)}>
              <Icon name={s.icon} size={16} /> {s.title}
            </button>
          ))}
        </nav>
        <article className="help-text">
          <h3>{cur.title}</h3>
          {cur.body}
        </article>
      </div>
    </Modal>
  );
}
