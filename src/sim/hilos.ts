// Hilos de la trama y primeros pasos: qué hay que hacer en el metro y en qué
// punto está cada cosa. Es una lectura del estado de la partida (no guarda
// nada), así que sirve igual para partidas nuevas y cargadas.

import { BUILDS } from '../data/edificios';
import { hasTech } from './build';
import { countItem } from './chars';
import { isCivilDefense } from './events';
import type { Sim } from './sim';

export type ThreadState = 'pendiente' | 'en curso' | 'hecho';

export interface Thread {
  id: string;
  title: string;
  /** Sprite de objeto que lo representa. */
  sprite: string;
  state: ThreadState;
  /** Qué se sabe y qué ha pasado. */
  text: string;
  /** Qué se puede hacer ahora (vacío si está cerrado). */
  hint: string;
  /** Avance 0..1 cuando tiene sentido medirlo. */
  progress?: number;
}

export interface Step {
  id: string;
  title: string;
  hint: string;
  done: boolean;
}

/** Los primeros pasos de una escuadra recién llegada. */
export function firstSteps(sim: Sim): Step[] {
  const st = sim.state;
  const f = st.flags;
  return [
    { id: 'hablar', title: 'Habla con alguien', hint: 'Selecciona a uno de los tuyos y haz clic derecho sobre cualquier persona: «Hablar».', done: !!f.tHablar },
    { id: 'comercio', title: 'Compra o vende algo', hint: 'Los comerciantes están en los puestos de los andenes. Habla con uno y elige «Comerciar».', done: !!f.tComercio || st.stats.earned > 0 },
    { id: 'chatarra', title: 'Desguaza chatarra', hint: 'Clic derecho sobre un montón de chatarra de los túneles: «Desguazar». Es la materia prima de todo.', done: !!f.tChatarra },
    { id: 'construir', title: 'Levanta tu primera obra', hint: 'Pulsa B, elige un jergón o una hoguera y colócalo en un túnel o cruce sin dueño.', done: st.stats.built > 0 || st.buildings.some((b) => b.prog >= 1) },
    { id: 'estudio', title: 'Investiga una técnica', hint: 'Construye una mesa de estudio, elige qué estudiar (I) y pon a alguien a trabajar en ella.', done: st.tech.done.length > 0 },
    { id: 'recluta', title: 'Contrata a alguien', hint: 'En las cantinas hay gente que se alquila: habla con ellos y paga lo que piden.', done: !!f.tRecluta },
  ];
}

/** Los hilos de la historia y el estado de la base. */
export function storyThreads(sim: Sim): Thread[] {
  const st = sim.state;
  const f = st.flags;
  const out: Thread[] = [];

  // --- La carta perdida
  const hasLetter = sim.players.some((q) => countItem(q, 'cartaBessmertny') > 0);
  if (f.cartaEntregada) {
    const how = f.distension
      ? 'Se la entregaste a Volkov. La Unión y los Seguidores vuelven a escribirse: la guerra se aleja.'
      : f.ultimatum
        ? 'Se la devolviste a Bessmertny. Ahora sabe que alguien la escondió, y prepara un ultimátum.'
        : f.cartaStaraya
          ? 'Se la vendiste al Consejo Mercantil de Staraya, que sabe exactamente cuánto vale la paz… y la guerra.'
          : 'La quemaste. Nadie sabrá nunca por qué no llegó.';
    out.push({ id: 'carta', title: 'La carta perdida', sprite: 'cartaBessmertny', state: 'hecho', text: how, hint: '' });
  } else if (hasLetter) {
    out.push({
      id: 'carta',
      title: 'La carta perdida',
      sprite: 'cartaBessmertny',
      state: 'en curso',
      text: 'Tienes la carta lacrada con el tridente verde: la que Bessmertny escribió a Volkov y nunca llegó.',
      hint: 'Llévasela a Volkov (Tsentral’naya), devuélvesela a Bessmertny (Kholodnogo Vozduha), véndesela a Orlova (Staraya)… o quémala.',
    });
  } else {
    out.push({
      id: 'carta',
      title: 'La carta perdida',
      sprite: 'cartaBessmertny',
      state: 'pendiente',
      text: 'Bessmertny escribió a Volkov exigiendo que la Unión se retire de Staraya. La carta nunca llegó, y nadie sabe por qué.',
      hint: 'En Tsentral’naya, un funcionario de correos anda muy callado. Su cajón tiene cerradura.',
    });
  }

  // --- El Tuerto
  if (f.rybakPreso) out.push({ id: 'tuerto', title: 'El Tuerto', sprite: 'machete', state: 'hecho', text: 'Entregaste a Grigori Rybak. Sin su cabecilla, las bandas de Vhlainska se han deshecho.', hint: '' });
  else if (f.muerto_rybak) out.push({ id: 'tuerto', title: 'El Tuerto', sprite: 'machete', state: 'hecho', text: 'Grigori Rybak ha muerto. La Hermandad busca nuevo jefe a cuchilladas.', hint: '' });
  else
    out.push({
      id: 'tuerto',
      title: 'El Tuerto',
      sprite: 'machete',
      state: 'pendiente',
      text: 'Grigori «el Tuerto» Rybak manda en la Hermandad desde su trono de Vhlainska. Sus bandas cobran peaje en medio metro.',
      hint: 'Staraya, la Unión y los Seguidores pagan 600 cartuchos por él vivo: hay que dejarlo inconsciente, cargarlo a hombros y entregarlo a un oficial.',
    });

  // --- El califa
  if (f.baghdadiPreso) out.push({ id: 'califa', title: 'El califa de la Esmeralda', sprite: 'agua', state: 'hecho', text: 'Baghdadi responde ante un tribunal del Levantamiento. El imán Karimov pide el fin del embargo.', hint: '' });
  else if (f.muerto_baghdadi) out.push({ id: 'califa', title: 'El califa de la Esmeralda', sprite: 'agua', state: 'hecho', text: 'Mohhammed Baghdadi ha muerto. Izumrudnaya decide quién ocupa su sitio.', hint: '' });
  else
    out.push({
      id: 'califa',
      title: 'El califa de la Esmeralda',
      sprite: 'agua',
      state: 'pendiente',
      text: 'Mohhammed Baghdadi gobierna Mertvaya con fanatismo mientras su gente pasa hambre tras el cerco.',
      hint: 'El Levantamiento paga 500 cartuchos por llevarlo vivo ante sus oficiales.',
    });

  // --- La Galería Olvidada
  const walls = st.nodes.filter((n) => n.kind === 'muro').length;
  if (f.galeriaOlvidada) out.push({ id: 'galeria', title: 'La Galería Olvidada', sprite: 'pico', state: 'hecho', text: 'Los tabiques han caído: una galería une Mostovaya con Izumrudnaya y el embargo ya no es total. La comida vuelve a entrar en Mertvaya.', hint: '' });
  else
    out.push({
      id: 'galeria',
      title: 'La Galería Olvidada',
      sprite: 'pico',
      state: walls < 2 ? 'en curso' : 'pendiente',
      text: 'Desde 2029 ni una caravana entra en Mertvaya. Los viejos hablan de una galería soviética tapiada que une Mostovaya con Izumrudnaya.',
      hint: walls < 2 ? 'Un tabique ha caído. Queda otro al fondo de la galería.' : 'Busca los tabiques de ladrillo en los túneles auxiliares de Mostovaya y échalos abajo (clic derecho: «Derribar el muro»). Un pico ayuda.',
      progress: walls < 2 ? 0.5 : 0,
    });

  // --- El túnel sur
  if (f.tunelSur) out.push({ id: 'sur', title: 'El túnel sur', sprite: 'pala', state: 'hecho', text: 'Tras dos años sepultado, el paso entre Mostovaya y Chernovodskaya vuelve a ser transitable.', hint: '' });
  else {
    const n = st.nodes.find((q) => q.place === 'X2');
    const know = hasTech(sim, 'excavacion');
    out.push({
      id: 'sur',
      title: 'El túnel sur',
      sprite: 'pala',
      state: n && n.work < 1500 ? 'en curso' : 'pendiente',
      text: 'En 2031 la junta de Chernovodskaya voló el túnel que la unía con la Unión. Quien lo reabra la tendrá comiendo de su mano… o apuntándole.',
      hint: know ? 'Ya sabéis excavar: llevad gente con picos al derrumbe, al sur de Mostovaya.' : 'Hace falta investigar «Excavación de túneles» antes de tocar un derrumbe.',
      progress: n ? 1 - n.work / 1500 : 0,
    });
  }

  // --- Tenevskaya
  const vaults = st.containers.filter(isCivilDefense);
  const opened = vaults.filter((c) => c.opened).length;
  const key = sim.players.some((q) => countItem(q, 'llaveAlmacen') > 0);
  if (vaults.length) {
    out.push({
      id: 'tenevskaya',
      title: 'Los almacenes de Tenevskaya',
      sprite: 'llaveAlmacen',
      state: opened >= vaults.length ? 'hecho' : opened > 0 || key ? 'en curso' : 'pendiente',
      text:
        opened >= vaults.length
          ? 'Las puertas blindadas de la defensa civil están abiertas. Lo que guardaban ya es vuestro.'
          : 'Nadie sabe qué pasó en Tenevskaya. Pero sus almacenes de la defensa civil siguen intactos tras puertas blindadas.',
      hint:
        opened >= vaults.length
          ? ''
          : key
            ? 'Tenéis la llave de la defensa civil: abre las puertas sin forzarlas.'
            : 'Las cerraduras son duras de forzar. Dicen que la Hermandad le quitó la llave a un oficial y la guarda con su botín, en Vhlainska.',
      progress: opened / vaults.length,
    });
  }

  // --- La emisora
  const radio = st.buildings.find((b) => BUILDS[b.def].radio);
  if (f.senal) out.push({ id: 'radio', title: '¿Queda alguien ahí fuera?', sprite: 'radioPiezas', state: 'hecho', text: '«Aquí Múrmansk. Seguimos vivos.» Hay más supervivientes. Hay esperanza.', hint: '' });
  else
    out.push({
      id: 'radio',
      title: '¿Queda alguien ahí fuera?',
      sprite: 'radioPiezas',
      state: radio ? 'en curso' : hasTech(sim, 'radio') ? 'en curso' : 'pendiente',
      text: 'En el Terminal captaron una voz en la radio. Dicen que venía de Múrmansk. Una emisora de onda corta podría llegar más allá de Vlianska.',
      hint: radio
        ? radio.prog < 1
          ? 'Termina de levantar la emisora.'
          : 'Dale energía a la emisora y pon a alguien a escuchar (clic derecho: «Escuchar la radio»).'
        : hasTech(sim, 'radio')
          ? 'Construye la emisora de radio (Industria). Necesita piezas de radio, componentes, acero y un generador.'
          : 'Investiga «Radio de onda corta». Hacen falta planos técnicos y generadores.',
      progress: radio && radio.prog >= 1 ? radio.craft : 0,
    });

  // --- Una estación propia
  const done = st.buildings.filter((b) => b.prog >= 1);
  const beds = done.reduce((a, b) => a + (BUILDS[b.def].beds ?? 0), 0);
  const squad = sim.players.length;
  const goals: [boolean, string][] = [
    [beds >= squad && beds > 0, 'una cama para cada uno'],
    [done.some((b) => BUILDS[b.def].farm), 'comida propia'],
    [done.some((b) => BUILDS[b.def].research), 'una mesa de estudio'],
    [done.some((b) => (BUILDS[b.def].power ?? 0) < 0), 'electricidad'],
    [done.some((b) => BUILDS[b.def].gate), 'un portón que cerrar'],
    [squad >= 8, 'ocho personas'],
  ];
  const got = goals.filter((g) => g[0]).length;
  out.push({
    id: 'base',
    title: 'Una estación donde nadie mande',
    sprite: 'tablones',
    state: got >= goals.length ? 'hecho' : done.length ? 'en curso' : 'pendiente',
    text: got >= goals.length ? `${st.playerName} tiene estación propia: camas, comida, luz y un portón. Ya no sois nadie.` : 'Nadie os espera ni os debe nada. Levantad vuestra propia estación en un túnel o cruce sin dueño.',
    hint: got >= goals.length ? '' : 'Falta: ' + goals.filter((g) => !g[0]).map((g) => g[1]).join(', ') + '.',
    progress: got / goals.length,
  });
  return out;
}

/** Resumen de la partida para el epílogo: una frase por cada cosa que cambió en el metro. */
export function epilogue(sim: Sim): string[] {
  const st = sim.state;
  const f = st.flags;
  const out: string[] = [];
  if (f.distension) out.push('La carta de Bessmertny llegó por fin a Volkov. La Unión y los Seguidores de Rusia negocian en vez de afilar bayonetas.');
  else if (f.ultimatum) out.push('Bessmertny sabe que su carta fue escondida. Su ultimátum ya está en camino, y el este del metro contiene el aliento.');
  else if (f.cartaStaraya) out.push('La carta de Bessmertny duerme en la caja fuerte de Staraya. El Consejo Mercantil decidirá cuándo vale más: en la paz o en la guerra.');
  else if (f.cartaEntregada) out.push('La carta de Bessmertny ardió en una hoguera. La Unión y los Seguidores siguen sin hablarse, y nadie sabrá por qué.');
  else out.push('La carta de Bessmertny sigue perdida. En Kholodnogo Vozduha la paciencia se acaba.');
  if (f.rybakPreso) out.push('El Tuerto está entre rejas y los túneles del este respiran.');
  else if (f.muerto_rybak) out.push('El Tuerto ha muerto, y la Hermandad se desangra buscando heredero.');
  else out.push('El Tuerto sigue en su trono de Vhlainska, cobrando peaje a medio metro.');
  if (f.baghdadiPreso) out.push('Baghdadi espera juicio. En Izumrudnaya, el imán Karimov pide el fin del embargo.');
  else if (f.muerto_baghdadi) out.push('El califa ha muerto. Izumrudnaya reza y espera.');
  if (f.galeriaOlvidada) out.push('La Galería Olvidada rompió el cerco: vuelve a entrar comida en Mertvaya.');
  else out.push('Mertvaya sigue sitiada. El hambre mata allí más que las balas.');
  if (f.tunelSur) out.push('El túnel sur está abierto: Chernovodskaya ya no está sola.');
  const vaults = st.containers.filter(isCivilDefense);
  if (vaults.length && vaults.every((c) => c.opened)) out.push('Los almacenes de Tenevskaya, intactos durante veinte años, cambiaron de dueño.');
  const built = st.buildings.filter((b) => b.prog >= 1).length;
  out.push(`${st.playerName}: ${sim.players.length} ${sim.players.length === 1 ? 'superviviente' : 'supervivientes'}, ${built} ${built === 1 ? 'obra en pie' : 'obras en pie'} y ${sim.day} ${sim.day === 1 ? 'día' : 'días'} bajo tierra.`);
  return out;
}
