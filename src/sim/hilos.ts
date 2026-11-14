// Hilos de la trama y primeros pasos: qué hay que hacer en el metro y en qué
// punto está cada cosa. Es una lectura del estado de la partida (no guarda
// nada), así que sirve igual para partidas nuevas y cargadas.

import { BUILDS } from '../data/edificios';
import { SCENARIO_BY_ID } from '../data/escenarios';
import { ITEMS } from '../data/items';
import { hasTech } from './build';
import { countItem } from './chars';
import { isCivilDefense } from './events';
import { playerBases } from './asaltos';
import { bailCost, captiveText, HUNT_MIN } from './derrota';
import { FACTION_LORE } from '../data/historia/facciones';
import type { FactionId } from '../data/tipos';
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

interface StepDef {
  title: string;
  hint: string;
  done: (sim: Sim) => boolean;
}

/** Algún almacén blindado de Tenevskaya abierto. */
const vaultOpen = (sim: Sim) => sim.state.containers.some((c) => isCivilDefense(c) && c.opened);
const carrying = (sim: Sim, id: string) => sim.players.some((q) => countItem(q, id) > 0);
/** Camas en la base principal. */
function bedsAtBase(sim: Sim): number {
  const main = playerBases(sim)[0];
  if (!main) return 0;
  return sim.state.buildings.filter((b) => main.ids.includes(b.id) && b.prog >= 1).reduce((a, b) => a + (BUILDS[b.def].beds ?? 0), 0);
}
/** Balas que lleva la escuadra, contando las de los cargadores. */
function bullets(sim: Sim): number {
  let n = 0;
  for (const c of sim.players) {
    n += countItem(c, 'balas');
    const w = c.eq.arma;
    if (w && ITEMS[w.id]?.weapon?.ranged?.ammo === 'balas') n += w.mag ?? 0;
  }
  return n;
}

/**
 * Catálogo de primeros pasos. Cada comienzo elige los suyos y en qué orden
 * (data/escenarios.ts): los que enseñan a jugar y los de su propia historia.
 */
export const STEPS: Record<string, StepDef> = {
  hablar: { title: 'Habla con alguien', hint: 'Selecciona a uno de los tuyos y haz clic derecho sobre cualquier persona: «Hablar».', done: (sim) => !!sim.state.flags.tHablar },
  comercio: { title: 'Compra o vende algo', hint: 'Los comerciantes están en los puestos de los andenes. Habla con uno y elige «Comerciar».', done: (sim) => !!sim.state.flags.tComercio || sim.state.stats.earned > 0 },
  chatarra: { title: 'Desguaza chatarra', hint: 'Clic derecho sobre un montón de chatarra de los túneles: «Desguazar». Es la materia prima de todo.', done: (sim) => !!sim.state.flags.tChatarra },
  construir: { title: 'Levanta tu primera obra', hint: 'Pulsa {tecla:construir}, elige un jergón o una hoguera y colócalo en un túnel o cruce sin dueño.', done: (sim) => sim.state.stats.built > 0 || sim.state.buildings.some((b) => b.prog >= 1) },
  estudio: { title: 'Investiga una técnica', hint: 'Construye una mesa de estudio, elige qué estudiar ({tecla:investigar}) y pon a alguien a trabajar en ella.', done: (sim) => sim.state.tech.done.length > 0 },
  recluta: { title: 'Contrata a alguien', hint: 'En las cantinas hay gente que se alquila: habla con ellos y paga lo que piden.', done: (sim) => !!sim.state.flags.tRecluta },
  // La saca de correo
  tse: { title: 'Vuelve a Tsentral’naya', hint: 'Por el Túnel del Comercio, que sale de Staraya hacia el oeste. Si te pierdes, abre el mapa ({tecla:mapa}).', done: (sim) => !!sim.state.stations.TSE?.visited },
  carta: { title: 'Encuentra la carta', hint: 'En Correos del metro, en Tsentral’naya, un cajón tiene cerradura. Forzarlo no es delito, pero coger lo que guarda delante de un guardia sí.', done: (sim) => carrying(sim, 'cartaBessmertny') || !!sim.state.flags.cartaEntregada },
  cartaDecidida: { title: 'Decide qué hacer con la carta', hint: 'Llévasela a Volkov, devuélvesela a Bessmertny, véndesela a Orlova… o quémala (pantalla de hilos, {tecla:hilos}).', done: (sim) => !!sim.state.flags.cartaEntregada },
  // Colonos de Tenevskaya
  campamento: { title: 'Levantad el campamento', hint: 'Pulsa {tecla:construir} y levantad aquí mismo, en el cruce, un jergón para cada uno.', done: (sim) => sim.players.length > 0 && bedsAtBase(sim) >= sim.players.length },
  comidaPropia: { title: 'Comida propia', hint: 'Un bancal de hongos o un corral: así no dependéis de lo que traigan las caravanas.', done: (sim) => sim.state.buildings.some((b) => b.prog >= 1 && !!BUILDS[b.def].farm) },
  tenevskaya: { title: 'Entrad en Tenevskaya', hint: 'La estación fantasma, al este del Nudo de Tenevskaya. Llevad luz y no os separéis.', done: (sim) => !!sim.state.stations.TEN?.visited },
  almacen: { title: 'Abrid un almacén de la defensa civil', hint: 'Las puertas blindadas de Tenevskaya: forzarlas cuesta (Cerraduras); con la llave de la defensa civil se abren solas.', done: vaultOpen },
  // Stalkers del Norte
  superficie: { title: 'Subid a la superficie', hint: 'Por las escaleras mecánicas de Severnyy, con la máscara puesta. El respirador no basta arriba: quien lo lleve, que no se quede mucho.', done: (sim) => !!sim.state.flags.tSuperficie },
  botinArriba: { title: 'Bajad algo de arriba', hint: 'Registrad maleteros helados, quioscos, farmacias y pisos del Barrio del Norte: lo que haya lleva veinte años esperando.', done: (sim) => !!sim.state.flags.tBotinSuperficie },
  skrebun: { title: 'Cazad un skrebun', hint: 'Anidan arriba, entre los bloques y en la playa de vías, y en la Galería del Refugio, pasado Nadezhdy.', done: (sim) => !!sim.state.flags.tSkrebun },
  glandula: { title: 'Vended una glándula en Nadezhdy', hint: 'Registrad al skrebun muerto y llevad su glándula a Ubezhishche Nadezhdy: allí la pagan mejor que en ningún sitio.', done: (sim) => !!sim.state.flags.tGlandula },
  // Hijos de Vhlainska
  llave: { title: 'Coged la llave del botín', hint: 'El botín de la Hermandad está junto a la guarida del Tuerto. Que nadie os vea coger nada: en sigilo ({tecla:sigilo}), a oscuras y cuando no miren.', done: (sim) => carrying(sim, 'llaveAlmacen') || vaultOpen(sim) },
  // Veteranos del sur
  comer: { title: 'Comed algo', hint: 'Comprad comida en los puestos (Hablar y comerciar) o pedídsela a quien la tenga. Con hambre no se pelea ni se trabaja.', done: (sim) => sim.players.length > 0 && sim.players.every((c) => c.st === 'muerto' || c.hunger >= 45) },
  curar: { title: 'Que os curen', hint: 'Cualquier médico os atiende por unos cartuchos (Hablar). El mejor hospital del metro está en Ubezhishche Nadezhdy.', done: (sim) => !!sim.state.flags.tCurado },
  municion: { title: 'Conseguid munición', hint: 'Se compra en los puestos de armas (en Industrialnaya, más barata) o se fabrica en una prensa de munición.', done: (sim) => bullets(sim) >= 80 },
  // El hambre de la Esmeralda
  hambreCerco: { title: 'Comed algo', hint: 'En Izumrudnaya la comida vale su peso en balas: vended lo que no os haga falta o traedla de fuera, por la galería. Con hambre no se pelea ni se trabaja.', done: (sim) => sim.players.length > 0 && sim.players.every((c) => c.st === 'muerto' || c.hunger >= 45) },
  muro: { title: 'Encontrad la galería tapiada', hint: 'Sale de Izumrudnaya hacia el este: un túnel viejo que acaba en un tabique de ladrillo.', done: (sim) => !!sim.state.flags.tMuro },
  tabique: { title: 'Echad abajo el primer tabique', hint: 'Clic derecho sobre el muro: «Derribar el muro». Con el pico se va más deprisa.', done: (sim) => sim.state.nodes.filter((n) => n.kind === 'muro').length < 2 || !!sim.state.flags.galeriaOlvidada },
  galeria: { title: 'Abrid la Galería Olvidada', hint: 'Cruzadla deprisa: el aire viciado quema el pecho. Al fondo, otro tabique da a Mostovaya.', done: (sim) => !!sim.state.flags.galeriaOlvidada },
  contrabando: { title: 'Traed comida a Izumrudnaya', hint: 'Vended comida en la estación, tres raciones o más: romper el embargo os hará queridos.', done: (sim) => (sim.state.flags.contrabando ?? 0) >= 3 },
};

/** Primeros pasos genéricos (partidas sin comienzo conocido). */
const DEFAULT_STEPS = ['hablar', 'comercio', 'chatarra', 'construir', 'estudio', 'recluta'];

/** Los primeros pasos de la escuadra: los de su comienzo, en su orden. */
export function firstSteps(sim: Sim): Step[] {
  const ids = SCENARIO_BY_ID[sim.state.scenario]?.steps ?? DEFAULT_STEPS;
  return ids.filter((id) => STEPS[id]).map((id) => ({ id, title: STEPS[id].title, hint: STEPS[id].hint, done: STEPS[id].done(sim) }));
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
      hint: walls < 2 ? 'Un tabique ha caído. Queda otro al fondo de la galería.' : 'La galería sale de Izumrudnaya hacia el este y llega a Mostovaya, tapiada por los dos extremos. Echad abajo los tabiques (clic derecho: «Derribar el muro»); un pico ayuda. Dentro, el aire está viciado.',
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

  // --- Presos y esclavos de tu gente
  for (const c of st.chars) {
    if (!c.player || !c.captive || c.st === 'muerto') continue;
    const cap = c.captive;
    const slave = cap.kind === 'esclavo';
    out.push({
      id: 'preso' + c.id,
      title: slave ? `${c.name}, esclavo` : `${c.name}, preso`,
      sprite: 'llaveAlmacen',
      state: 'en curso',
      text: `${captiveText(sim, c)}. Lo que llevaba está en el depósito de decomisos${cap.place === 'VHL' ? ' (el botín de la Hermandad)' : ''}.`,
      hint: slave
        ? `Que fuerce los grilletes cuando nadie mire, que un compañero se los fuerce desde fuera o comprad su libertad (${bailCost(sim, c)} cartuchos) a quien manda allí.`
        : `Cumple la condena, pagad la fianza (${bailCost(sim, c)} cartuchos) a un oficial o un guardia de ${FACTION_LORE[cap.by as FactionId]?.shortName ?? 'su bando'}, o que escape: entonces le perseguirán.`,
      progress: cap.pick > 0 ? cap.pick : undefined,
    });
  }

  // --- Precio por vuestras cabezas
  const wanted = (Object.keys(st.bounty) as FactionId[]).filter((k) => st.bounty[k] > 0).sort((a, b) => st.bounty[b] - st.bounty[a]);
  if (wanted.length) {
    const top = st.bounty[wanted[0]];
    out.push({
      id: 'recompensa',
      title: 'Os buscan',
      sprite: 'cartucho',
      state: 'en curso',
      text: `Pagan por vuestras cabezas: ${wanted.map((k) => `${FACTION_LORE[k].shortName} ${st.bounty[k]}`).join(' · ')}. ${top >= 100 ? 'Sus guardias os disparan al veros y se llevan presos a los que caen.' : top >= HUNT_MIN ? 'Hay cazarrecompensas siguiéndoos el rastro.' : 'Con el tiempo se olvida, poco a poco.'}`,
      hint: 'Saldad la deuda hablando con un oficial o un guardia de esa facción, o en Staraya, que arregla cuentas con todos (con comisión).',
    });
  }

  // --- Una estación propia
  const bases = playerBases(sim);
  const main = bases[0];
  const done = main ? st.buildings.filter((b) => main.ids.includes(b.id)) : [];
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
    text:
      (got >= goals.length ? `${st.playerName} tiene estación propia: camas, comida, luz y un portón. Ya no sois nadie.` : 'Nadie os espera ni os debe nada. Levantad vuestra propia estación en un túnel o cruce sin dueño.') +
      (main ? ` Base: ${main.name} (${main.n} obras).` : '') +
      (bases.length > 1 ? ` Puestos avanzados: ${bases.slice(1).map((b) => `${b.name} (${b.n})`).join(', ')}.` : ''),
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
