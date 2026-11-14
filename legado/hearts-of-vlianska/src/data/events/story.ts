// Eventos de historia y de situación.
//
// No hay eventos al azar: cada uno llega por algo que ha pasado.
// - Historia: consecuencias de los caminos del árbol de enfoques. El enfoque programa el evento
//   unas semanas después ({ t: 'event', id, days }) y la elección cambia el rumbo de la facción.
// - Situación: la capital perdida, el hambre o una guerra que se alarga. Llegan cuando se dan
//   esas condiciones y no se repiten hasta pasados unos meses.
import type { Condition, EventDef, SpiritDef } from '../../game/types';

const HAS = (id: string): Condition => ({ c: 'hasSpirit', id });

export const STORY_SPIRITS: SpiritDef[] = [
  // ------------------------------------------------------------------ Situación
  {
    id: 'resistencia_capital',
    name: 'Ni un paso atrás',
    desc: 'Hemos perdido la capital, no la guerra. Cada andén se defenderá como si fuera el último.',
    icon: 'Flag',
    modifiers: { defensa: 0.1, ataque: 0.05, reclutables: 0.02, estabilidad: -0.03 },
  },
  {
    id: 'requisas',
    name: 'Requisas',
    desc: 'Las patrullas registran cada casa en busca de comida escondida.',
    icon: 'Soup',
    negative: true,
    modifiers: { estabilidad: -0.05, consumoAlimentos: -0.1 },
  },
  {
    id: 'ejercito_hambriento',
    name: 'Media ración en el frente',
    desc: 'Los soldados comen la mitad para que los niños coman algo.',
    icon: 'Soup',
    negative: true,
    modifiers: { organizacion: -0.15, recuperacionOrg: -0.2 },
  },
  {
    id: 'movilizacion_total',
    name: 'Movilización total',
    desc: 'Todo para el frente: talleres, raciones y cada hombre capaz de sostener un fusil.',
    icon: 'Swords',
    modifiers: { reclutables: 0.03, produccionMilitar: 0.1, bienesConsumo: -0.05, estabilidad: -0.08 },
  },
  {
    id: 'promesa_paz',
    name: 'La promesa de paz',
    desc: 'El gobierno ha prometido una paz honrosa. La gente aguanta porque espera que cumpla.',
    icon: 'HeartHandshake',
    modifiers: { estabilidad: 0.05, apoyoGuerra: -0.1, ppDiario: 0.2 },
  },
  // ------------------------------------------------------------------ Unión
  {
    id: 'uni_excepcion_indefinida',
    name: 'La excepción permanente',
    desc: 'Tribunales militares, prensa censurada y toque de queda. Nadie discute; nadie propone.',
    icon: 'Gavel',
    modifiers: { estabilidad: 0.04, apoyoGuerra: 0.08, costeLeyes: -0.2, investigacion: -0.05, popAutocracia: 0.02 },
  },
  {
    id: 'uni_promesa_cumplida',
    name: 'La palabra de Volkov',
    desc: 'La Unión cumple lo que promete. Los diputados trabajan y los andenes confían.',
    icon: 'Vote',
    modifiers: { ppDiario: 0.3, estabilidad: 0.04, popDemocracia: 0.02 },
  },
  {
    id: 'uni_tributo_staraya',
    name: 'El peaje de Staraya',
    desc: "La mitad de lo que se cobra en la Encrucijada viaja a Tsentral'naya.",
    icon: 'Coins',
    modifiers: { civExtra: 1.5 },
  },
  {
    id: 'sta_peaje_expoliado',
    name: 'El expolio de la Unión',
    desc: "Los consejeros de Tsentral'naya se quedan con la mitad del peaje. En el Consejo Mercantil ya se habla de buscar otros protectores.",
    icon: 'HandCoins',
    negative: true,
    modifiers: { civExtra: -1, estabilidad: -0.04 },
  },
  // ------------------------------------------------------------------ Seguidores
  {
    id: 'sdr_ejercito_purgado',
    name: 'Un ejército purgado',
    desc: 'Los oficiales más capaces están en los calabozos de la Oficina. Los que quedan obedecen... y poco más.',
    icon: 'ShieldAlert',
    negative: true,
    modifiers: { organizacion: -0.12, entrenamiento: -0.1, estabilidad: 0.05 },
  },
  {
    id: 'sdr_generales_intocables',
    name: 'Los generales intocables',
    desc: 'El Estado Mayor quedó fuera de la purga. Mandan bien... y cada vez mandan más.',
    icon: 'Medal',
    modifiers: { ataque: 0.05, defensa: 0.05, ppDiario: -0.2 },
  },
  {
    id: 'sdr_guardias_fabrica',
    name: 'Guardias de fábrica',
    desc: 'Cada magnate tiene su propia guardia armada. La producción está protegida; la lealtad, no tanto.',
    icon: 'Factory',
    modifiers: { produccionMilitar: 0.1, reclutables: 0.01, estabilidad: -0.04, popOligarquia: 0.02 },
  },
  {
    id: 'sdr_terror',
    name: 'El terror',
    desc: 'Tras el atentado, cualquiera puede ser un traidor. Las detenciones se cuentan por cientos.',
    icon: 'Skull',
    modifiers: { estabilidad: 0.08, ppDiario: -0.2, investigacion: -0.1 },
  },
  // ------------------------------------------------------------------ Levantamiento
  {
    id: 'lev_granjas_colectivas',
    name: 'Las granjas colectivas',
    desc: 'Tras un invierno de hambre, las brigadas han aprendido a cultivar juntas.',
    icon: 'Sprout',
    modifiers: { alimentos: 0.15, manoObra: -0.05 },
  },
  {
    id: 'lev_huertas_familiares',
    name: 'Las huertas familiares',
    desc: 'Cada familia cultiva lo suyo y vende lo que le sobra. No es muy revolucionario, pero se come.',
    icon: 'Sprout',
    modifiers: { alimentos: 0.05, estabilidad: 0.03, popComunismo: -0.01 },
  },
  {
    id: 'lev_carceles',
    name: 'Las cárceles de la revolución',
    desc: 'Los anarquistas de Rassvetnaya están presos. Nadie más se atreve a imprimir nada.',
    icon: 'Lock',
    modifiers: { estabilidad: 0.03, ppDiario: -0.15, investigacion: -0.05 },
  },
  {
    id: 'lev_debate_abierto',
    name: 'El debate abierto',
    desc: 'En el Consejo se discute a gritos. De tanto discutir, a veces salen buenas ideas.',
    icon: 'Megaphone',
    modifiers: { investigacion: 0.08, ppDiario: 0.15 },
  },
  // ------------------------------------------------------------------ Vhlainska
  {
    id: 'vhl_lugartenientes',
    name: 'Los lugartenientes',
    desc: 'Cada lugarteniente manda en su túnel y se queda su parte. El rey reina; los demás, roban.',
    icon: 'Crown',
    modifiers: { saqueo: 0.2, estabilidad: -0.05 },
  },
  // ------------------------------------------------------------------ Chernovodskaya
  {
    id: 'che_memoria_2031',
    name: 'La memoria de 2031',
    desc: "Todo el metro sabe ya quién voló el túnel sur. Chernovodskaya no olvida.",
    icon: 'Flame',
    modifiers: { apoyoGuerra: 0.1, ataque: 0.05 },
  },
  // ------------------------------------------------------------------ Norte
  {
    id: 'nor_bunker',
    name: 'El búnker del norte',
    desc: 'Comercio y ayuda mutua con los supervivientes del búnker militar de la superficie.',
    icon: 'Radio',
    modifiers: { civExtra: 1, investigacion: 0.05 },
  },
  {
    id: 'nor_generador',
    name: 'El generador del búnker',
    desc: 'Un generador de verdad alimenta los talleres del Terminal. Nadie pregunta cómo lo conseguimos.',
    icon: 'Zap',
    modifiers: { produccionCivil: 0.1, produccionMilitar: 0.05 },
  },
];

export const STORY_EVENTS: EventDef[] = [
  // ------------------------------------------------------------------ Situación
  {
    id: 'sit_capital_caida',
    title: 'Ha caído [TARGET]',
    desc: '[FROM] ocupa nuestra capital. El gobierno ha huido por los túneles de servicio y los andenes se llenan de refugiados. Lo que decidamos esta noche decidirá si seguimos existiendo.',
    picture: 'Flag',
    triggeredOnly: true,
    options: [
      {
        name: 'Ni un paso atrás: la recuperaremos.',
        effects: [{ t: 'warSupport', v: 0.15 }, { t: 'addSpirit', id: 'resistencia_capital', days: 180 }],
        ai: 3,
      },
      {
        name: 'Negociar: [TARGET] a cambio de la paz.',
        available: { c: 'atWarWith', target: 'FROM' },
        effects: [
          { t: 'transferStation', station: 'TARGET', to: 'FROM' },
          { t: 'whitePeace', target: 'FROM' },
          { t: 'stability', v: -0.1 },
          { t: 'warSupport', v: -0.2 },
        ],
        ai: 1,
        aiIf: [{ cond: { c: 'surrender', min: 0.5 }, factor: 4 }],
      },
    ],
  },
  {
    id: 'sit_hambre',
    title: 'Hambre en los andenes',
    desc: 'Los almacenes están vacíos y lo que producimos no alcanza. Los niños lloran por las noches. Hay que decidir quién come menos.',
    picture: 'Soup',
    trigger: { c: 'and', list: [{ c: 'food', max: 5 }, { c: 'foodBalance', max: -0.5 }] },
    mtth: 4,
    once: false,
    options: [
      {
        name: 'Requisad hasta el último hongo.',
        effects: [{ t: 'food', v: 50 }, { t: 'stability', v: -0.06 }, { t: 'addSpirit', id: 'requisas', days: 120 }],
        ai: 2,
      },
      {
        name: 'Media ración para el ejército.',
        effects: [{ t: 'food', v: 35 }, { t: 'addSpirit', id: 'ejercito_hambriento', days: 90 }],
        ai: 1,
        aiIf: [{ cond: { c: 'atWar' }, factor: 0.2 }],
      },
      {
        name: 'Comprad comida a cualquier precio.',
        available: { c: 'pp', min: 60 },
        effects: [{ t: 'pp', v: -60 }, { t: 'food', v: 45 }],
        ai: 2,
      },
    ],
  },
  {
    id: 'sit_guerra_larga',
    title: 'Un año de guerra',
    desc: 'Hace un año que empezó esta guerra. Las madres de los caídos se reúnen en el andén central; en los talleres, los capataces piden más brazos. Hay que decidir cómo sigue esto.',
    picture: 'Swords',
    trigger: { c: 'and', list: [{ c: 'atWar' }, { c: 'warLength', min: 365 }] },
    mtth: 7,
    once: false,
    cooldown: 365,
    options: [
      {
        name: 'Movilización total: todo para el frente.',
        effects: [{ t: 'addSpirit', id: 'movilizacion_total', days: 365 }, { t: 'warSupport', v: 0.1 }],
        ai: 2,
        aiIf: [{ cond: { c: 'surrender', min: 0.2 }, factor: 2 }],
      },
      {
        name: 'Carteles, altavoces y discursos.',
        available: { c: 'pp', min: 40 },
        effects: [{ t: 'pp', v: -40 }, { t: 'addSpirit', id: 'propaganda', days: 180 }],
        ai: 1,
      },
      {
        name: 'Prometer una paz honrosa.',
        effects: [{ t: 'addSpirit', id: 'promesa_paz', days: 365 }],
        ai: 1,
        aiIf: [{ cond: { c: 'warSupport', max: 0.3 }, factor: 3 }],
      },
    ],
  },
  // ------------------------------------------------------------------ Unión
  {
    id: 'his_uni_excepcion',
    title: 'Seis meses de excepción',
    desc: 'Cuando Volkov proclamó el estado de excepción prometió que duraría "lo que dure el peligro". Han pasado seis meses. Los diputados de la Conferencia piden una fecha; los generales, que no se toque nada.',
    picture: 'Gavel',
    factions: ['UNI'],
    triggeredOnly: true,
    options: [
      {
        name: 'La excepción seguirá hasta la victoria.',
        effects: [{ t: 'addSpirit', id: 'uni_excepcion_indefinida' }, { t: 'popularity', id: 'democracia', v: -12 }, { t: 'popularity', id: 'autocracia', v: 8 }],
        ai: 2,
        aiIf: [{ cond: { c: 'atWar' }, factor: 2 }],
      },
      {
        name: 'Habrá elecciones en otoño, como se prometió.',
        effects: [{ t: 'stability', v: -0.05 }, { t: 'popularity', id: 'democracia', v: 15 }, { t: 'pp', v: 60 }, { t: 'addSpirit', id: 'uni_promesa_cumplida', days: 365 }],
        ai: 1,
        aiIf: [{ cond: { c: 'not', cond: { c: 'atWar' } }, factor: 2 }],
      },
    ],
  },
  {
    id: 'his_uni_peaje_staraya',
    title: 'El peaje de la Encrucijada',
    desc: 'Nuestros consejeros en Staraya lo ven todo: cada caravana, cada cartucho del peaje. Algunos diputados proponen que la Unión se quede con una parte. Al fin y al cabo, nuestras brigadas protegen la Encrucijada.',
    picture: 'HandCoins',
    factions: ['UNI'],
    triggeredOnly: true,
    options: [
      {
        name: 'La mitad del peaje, para la Unión.',
        available: { c: 'exists', target: 'STA' },
        effects: [
          { t: 'addSpirit', id: 'uni_tributo_staraya' },
          { t: 'relation', target: 'STA', v: -30 },
          { t: 'scoped', target: 'STA', effects: [{ t: 'addSpirit', id: 'sta_peaje_expoliado' }, { t: 'stability', v: -0.06 }] },
        ],
        ai: 2,
      },
      {
        name: 'Protección a cambio de lealtad, no de cartuchos.',
        effects: [
          { t: 'pp', v: -25 },
          { t: 'if', cond: { c: 'exists', target: 'STA' }, then: [{ t: 'relation', target: 'STA', v: 25 }, { t: 'scoped', target: 'STA', effects: [{ t: 'flag', id: 'sta_confia_union' }, { t: 'stability', v: 0.03 }] }] },
        ],
        ai: 1,
        aiIf: [{ cond: { c: 'ideology', id: 'democracia' }, factor: 2 }],
      },
    ],
  },
  // ------------------------------------------------------------------ Seguidores
  {
    id: 'his_sdr_purga_generales',
    title: 'La purga llega al Estado Mayor',
    desc: 'La Oficina del Líder ha terminado con los magnates y los agitadores. Ahora pide las listas de los oficiales. En el cuartel de Kholodnogo, los generales se miran unos a otros.',
    picture: 'ShieldAlert',
    factions: ['SDR'],
    triggeredOnly: true,
    options: [
      {
        name: 'Nadie está por encima del Inmortal.',
        effects: [{ t: 'addSpirit', id: 'sdr_ejercito_purgado', days: 365 }, { t: 'popularity', id: 'nacionalismo', v: 5 }],
        ai: 1,
        aiIf: [{ cond: { c: 'not', cond: { c: 'atWar' } }, factor: 2 }],
      },
      {
        name: 'El ejército queda fuera de la purga.',
        effects: [{ t: 'addSpirit', id: 'sdr_generales_intocables' }, { t: 'stability', v: -0.03 }],
        ai: 1,
        aiIf: [{ cond: { c: 'atWar' }, factor: 3 }],
      },
    ],
  },
  {
    id: 'his_sdr_magnates_armas',
    title: 'Los magnates quieren fusiles',
    desc: 'Oleg Zhdanov propone que cada magnate arme su propia guardia de fábrica, "para proteger la producción". Bessmertny sabe lo que significa un ejército que no le debe obediencia a él.',
    picture: 'Factory',
    factions: ['SDR'],
    triggeredOnly: true,
    options: [
      {
        name: 'Que armen a sus guardias.',
        effects: [{ t: 'addSpirit', id: 'sdr_guardias_fabrica' }, { t: 'unit', template: 'sdr_fusileros', station: 'IND', name: 'Guardia de la Forja' }],
        ai: 1,
      },
      {
        name: 'Un solo ejército: el del Inmortal.',
        effects: [
          { t: 'removeSpirit', id: 'sdr_magnates_consejo' },
          { t: 'popularity', id: 'oligarquia', v: -8 },
          { t: 'stability', v: -0.03 },
          { t: 'pp', v: 40 },
        ],
        ai: 1,
        aiIf: [{ cond: { c: 'leader', id: 'bessmertny' }, factor: 1.5 }],
      },
    ],
  },
  {
    id: 'sdr_atentado',
    title: 'Atentado contra el Inmortal',
    desc: 'Una granada rueda por el andén de Kholodnogo durante el desfile en honor del Inmortal. Bessmertny sale ileso, cubierto de sangre ajena. Los culpables llevaban brazaletes... ¿rojos? ¿de los magnates? Nadie lo sabe todavía.',
    picture: 'Bomb',
    factions: ['SDR'],
    triggeredOnly: true,
    options: [
      {
        name: '¡Es inmortal! Que todos lo vean.',
        effects: [{ t: 'warSupport', v: 0.1 }, { t: 'popularity', id: 'nacionalismo', v: 10 }, { t: 'stability', v: -0.03 }],
        ai: 1,
      },
      {
        name: 'Que paguen todos: rojos, magnates y sospechosos.',
        effects: [{ t: 'addSpirit', id: 'sdr_terror', days: 365 }, { t: 'popularity', id: 'comunismo', v: -10 }, { t: 'popularity', id: 'oligarquia', v: -10 }],
        ai: 1,
        aiIf: [{ cond: { c: 'stability', max: 0.4 }, factor: 2 }],
      },
    ],
  },
  // ------------------------------------------------------------------ Levantamiento
  {
    id: 'his_lev_colectivizacion',
    title: 'Hambre en las granjas colectivas',
    desc: 'Las granjas de Rassvetnaya ya son de todos... y nadie quiere trabajarlas de noche. La cosecha de hongos ha caído a la mitad. Los viejos piden recuperar sus huertas.',
    picture: 'Sprout',
    factions: ['LEV'],
    triggeredOnly: true,
    options: [
      {
        name: 'El plan es el plan: brigadas a las granjas.',
        effects: [{ t: 'food', v: -60 }, { t: 'stability', v: -0.05 }, { t: 'addSpirit', id: 'lev_granjas_colectivas' }],
        ai: 2,
        aiIf: [{ cond: { c: 'food', max: 80 }, factor: 0.3 }],
      },
      {
        name: 'Devolved las huertas a las familias.',
        effects: [{ t: 'food', v: 30 }, { t: 'popularity', id: 'comunismo', v: -6 }, { t: 'pp', v: -30 }, { t: 'addSpirit', id: 'lev_huertas_familiares' }],
        ai: 1,
      },
    ],
  },
  {
    id: 'his_lev_anarquistas',
    title: 'Los anarquistas de Rassvetnaya',
    desc: 'El Comisariado de Seguridad ha encontrado una imprenta clandestina en Rassvetnaya. No son espías de Volkov: son anarquistas, veteranos del Levantamiento que acusan al Consejo de traicionar la revolución.',
    picture: 'Megaphone',
    factions: ['LEV'],
    triggeredOnly: true,
    options: [
      {
        name: 'Son contrarrevolucionarios. Detenedlos.',
        effects: [{ t: 'stability', v: 0.04 }, { t: 'popularity', id: 'anarquia', v: -10 }, { t: 'addSpirit', id: 'lev_carceles', days: 365 }],
        ai: 2,
        aiIf: [{ cond: { c: 'hasFocus', id: 'lev_centralismo' }, factor: 2 }],
      },
      {
        name: 'Que defiendan sus ideas en el Consejo.',
        effects: [{ t: 'popularity', id: 'anarquia', v: 8 }, { t: 'stability', v: -0.03 }, { t: 'addSpirit', id: 'lev_debate_abierto', days: 365 }],
        ai: 1,
        aiIf: [{ cond: { c: 'hasFocus', id: 'lev_consejos' }, factor: 3 }],
      },
      {
        name: 'Que sirvan a la revolución en el frente.',
        available: { c: 'atWar' },
        effects: [{ t: 'unit', template: 'lev_milicia', station: 'CAPITAL', name: 'Columna Libertaria' }, { t: 'popularity', id: 'anarquia', v: -3 }],
        ai: 1,
      },
    ],
  },
  // ------------------------------------------------------------------ Staraya
  {
    id: 'his_sta_monopolio',
    title: 'Las caravanas buscan otros túneles',
    desc: 'Desde que cobramos el peaje del monopolio, las caravanas del Levantamiento rodean por las galerías y las de los Seguidores esperan en Rubezh. Se cobra más por caravana, pero pasan la mitad.',
    picture: 'Route',
    factions: ['STA'],
    triggeredOnly: true,
    options: [
      {
        name: 'El monopolio se mantiene: ya volverán.',
        effects: [
          { t: 'addSpirit', id: 'sta_caravanas_desviadas', days: 180 },
          { t: 'pp', v: 40 },
          { t: 'if', cond: { c: 'exists', target: 'SDR' }, then: [{ t: 'relation', target: 'SDR', v: -10 }] },
          { t: 'if', cond: { c: 'exists', target: 'UNI' }, then: [{ t: 'relation', target: 'UNI', v: -10 }] },
        ],
        ai: 1,
      },
      {
        name: 'Volvemos a un peaje justo.',
        effects: [
          { t: 'removeSpirit', id: 'sta_monopolio' },
          { t: 'addSpirit', id: 'sta_peaje_justo' },
          { t: 'stability', v: -0.03 },
          { t: 'if', cond: { c: 'exists', target: 'SDR' }, then: [{ t: 'relation', target: 'SDR', v: 10 }] },
          { t: 'if', cond: { c: 'exists', target: 'UNI' }, then: [{ t: 'relation', target: 'UNI', v: 10 }] },
        ],
        ai: 2,
      },
    ],
  },
  // ------------------------------------------------------------------ Vhlainska
  {
    id: 'his_vhl_lugarteniente',
    title: 'Un lugarteniente conspira',
    desc: '"El Martillo" Sokol, el lugarteniente que más caravanas ha asaltado, dice en voz alta lo que otros piensan: que un rey con cadena de oro no es mejor que un jefe de banda. Tiene cuarenta hombres que le obedecen a él, no a Rybak.',
    picture: 'Skull',
    factions: ['VHL'],
    triggeredOnly: true,
    options: [
      {
        name: 'Colgadlo en el andén, a la vista de todos.',
        effects: [{ t: 'stability', v: 0.06 }, { t: 'warSupport', v: -0.05 }, { t: 'manpowerBonus', v: -8 }],
        ai: 2,
      },
      {
        name: 'Dadle un túnel y su parte del botín.',
        effects: [{ t: 'pp', v: -25 }, { t: 'addSpirit', id: 'vhl_lugartenientes' }],
        ai: 1,
      },
      {
        name: 'Que se lleve a su gente contra Staraya.',
        available: { c: 'exists', target: 'STA' },
        effects: [{ t: 'relation', target: 'STA', v: -20 }, { t: 'stock', eq: 'armas', v: 30 }, { t: 'food', v: 30 }, { t: 'manpowerBonus', v: -4 }],
        ai: 1,
      },
    ],
  },
  // ------------------------------------------------------------------ Chernovodskaya
  {
    id: 'his_che_verdad',
    title: '¿Quién voló el túnel?',
    desc: "Los archivos de la Junta no dejan lugar a dudas: la orden de volar el túnel sur en 2031 salió de Tsentral'naya, firmada por un coronel que hoy asesora a Volkov. Lo que hagamos con esta verdad decidirá nuestra relación con la Unión durante años.",
    picture: 'FileText',
    factions: ['CHE'],
    triggeredOnly: true,
    options: [
      {
        name: 'Publicadlo todo. Que el metro lo sepa.',
        effects: [
          { t: 'addSpirit', id: 'che_memoria_2031' },
          { t: 'popularity', id: 'nacionalismo', v: 8 },
          { t: 'if', cond: { c: 'exists', target: 'UNI' }, then: [{ t: 'relation', target: 'UNI', v: -40 }, { t: 'claim', station: 'MOS' }] },
        ],
        ai: 2,
        aiIf: [{ cond: { c: 'hasFocus', id: 'che_venganza' }, factor: 3 }],
      },
      {
        name: 'Usadlo para negociar con Volkov.',
        available: { c: 'exists', target: 'UNI' },
        effects: [{ t: 'pp', v: 60 }, { t: 'stock', eq: 'armas', v: 40 }, { t: 'relation', target: 'UNI', v: 15 }],
        ai: 1,
        aiIf: [{ cond: { c: 'hasFocus', id: 'che_paz_union' }, factor: 3 }],
      },
      {
        name: 'Enterradlo: la guerra ya se cobró bastante.',
        effects: [{ t: 'stability', v: 0.05 }, { t: 'warSupport', v: -0.1 }, { t: 'if', cond: { c: 'exists', target: 'UNI' }, then: [{ t: 'relation', target: 'UNI', v: 10 }] }],
        ai: 1,
      },
    ],
  },
  // ------------------------------------------------------------------ Norte
  {
    id: 'his_nor_superficie',
    title: 'Luces en la superficie',
    desc: 'Una expedición del Terminal ha encontrado, a tres kilómetros al norte, un búnker militar con luz eléctrica. Dentro viven supervivientes que nunca bajaron al metro. Desconfían de nosotros, pero tienen algo que nos falta: un generador de verdad.',
    picture: 'Radio',
    factions: ['NOR'],
    triggeredOnly: true,
    options: [
      {
        name: 'Ofrecedles un hogar en el Terminal.',
        effects: [{ t: 'population', station: 'CAPITAL', v: 60 }, { t: 'food', v: -30 }, { t: 'researchBonus', cat: 'industria', v: 1, uses: 1, label: 'Ingenieros del búnker' }],
        ai: 1,
      },
      {
        name: 'Un tratado: comercio y ayuda mutua.',
        available: { c: 'pp', min: 30 },
        effects: [{ t: 'pp', v: -30 }, { t: 'addSpirit', id: 'nor_bunker' }],
        ai: 2,
      },
      {
        name: 'Tomad el generador por la fuerza.',
        effects: [{ t: 'manpowerBonus', v: -10 }, { t: 'addSpirit', id: 'nor_generador' }, { t: 'stability', v: -0.04 }, { t: 'popularity', id: 'democracia', v: -8 }],
        ai: 1,
        aiIf: [{ cond: { c: 'not', cond: { c: 'ideology', id: 'democracia' } }, factor: 3 }],
      },
    ],
  },
  // ------------------------------------------------------------------ Califato
  {
    id: 'cal_exigencias',
    title: 'La Comisión exige',
    desc: 'El presidente de la Comisión Mixta llega con una lista: fusiles para las brigadas del Consejo, un comisario en cada taller, los sermones revisados antes del viernes. Técnicamente, es una petición.',
    picture: 'ClipboardList',
    factions: ['CAL'],
    triggeredOnly: true,
    options: [
      {
        name: 'Firmad. No podemos arriesgar los convoyes.',
        available: HAS('cal_comision'),
        effects: [
          { t: 'stock', eq: 'armas', v: -30 },
          { t: 'popularity', id: 'comunismo', v: 8 },
          { t: 'popularity', id: 'teocracia', v: -5 },
          { t: 'stability', v: 0.02 },
          { t: 'relation', target: 'LEV', v: 15 },
        ],
        ai: 3,
      },
      {
        name: 'Esto lo decide la Esmeralda.',
        available: HAS('cal_comision'),
        effects: [{ t: 'relation', target: 'LEV', v: -25 }, { t: 'food', v: -40 }, { t: 'stability', v: -0.03 }, { t: 'warSupport', v: 0.05 }],
        ai: 1,
        aiIf: [{ cond: { c: 'food', min: 80 }, factor: 3 }],
      },
      {
        name: 'Los comisarios ya se han ido: no hay nada que firmar.',
        available: { c: 'not', cond: HAS('cal_comision') },
        effects: [],
        ai: 1,
      },
    ],
  },
  {
    id: 'cal_exigencias_guardia',
    title: 'La Comisión quiere la Guardia',
    desc: 'La Comisión Mixta presenta su propuesta más ambiciosa: la Guardia Esmeralda se integrará en las brigadas del Consejo "para la defensa común". Al-Harbi dice que antes muerto.',
    picture: 'ShieldHalf',
    factions: ['CAL'],
    triggeredOnly: true,
    options: [
      {
        name: 'La Guardia jura lealtad al Consejo.',
        available: HAS('cal_comision'),
        effects: [
          { t: 'removeSpirit', id: 'cal_guardia_esmeralda' },
          { t: 'manpowerBonus', v: -15 },
          { t: 'popularity', id: 'comunismo', v: 10 },
          { t: 'relation', target: 'LEV', v: 30 },
          { t: 'scoped', target: 'LEV', effects: [{ t: 'manpowerBonus', v: 15 }] },
        ],
        ai: 1,
        aiIf: [{ cond: { c: 'leader', id: 'karimov' }, factor: 2 }],
      },
      {
        name: 'La Guardia no se toca.',
        available: HAS('cal_comision'),
        effects: [
          { t: 'relation', target: 'LEV', v: -40 },
          { t: 'stability', v: 0.03 },
          { t: 'warSupport', v: 0.1 },
          // El Consejo ya tiene su pretexto.
          { t: 'scoped', target: 'LEV', effects: [{ t: 'wargoal', target: 'FROM' }] },
        ],
        ai: 1,
        aiIf: [{ cond: { c: 'leader', id: 'alharbi' }, factor: 4 }],
      },
      {
        name: 'Ya no hay comisarios que exijan nada.',
        available: { c: 'not', cond: HAS('cal_comision') },
        effects: [],
        ai: 1,
      },
    ],
  },
];
