// Facciones del metro de Vlianska en enero de 2033.
// Los textos (resumen, historia, objetivos y relaciones) son los de la historia original.
import type { FactionId } from '../tipos';

export interface FactionLore {
  id: FactionId;
  name: string;
  shortName: string;
  adjective: string;
  color: string;
  colorDark: string;
  capital: string;
  leader: string;
  government: string;
  ideology: string;
  summary: string;
  lore: string[];
  goals: string[];
  /** Relaciones iniciales con las demás facciones (-100 a 100). */
  relations: Partial<Record<FactionId, number>>;
}

export const FACTION_LORE: Record<FactionId, FactionLore> = {
  UNI: {
    id: "UNI",
    name: "Unión de Estaciones",
    shortName: "la Unión",
    adjective: "unionista",
    color: "#2f62d8",
    colorDark: "#15306e",
    capital: "TSE",
    leader: "volkov",
    government: "Presidencia centralizada",
    ideology: "autocracia",
    summary: "La antigua policía del metro, debilitada por la guerra y el invierno. Volkov quiere recuperar su gloria: centralizar, rearmarse y volver a imponer el orden.",
    lore: [
      "En 2021, los gobiernos cívico-militares del Corredor Longitudinal Severo-Chernovodska celebraron la Conferencia de Zvezdnaya para comerciar entre sí. En 2026 aquel acuerdo se había convertido en la Unión de Estaciones, la principal potencia del metro.",
      "El invierno de 2029 golpeó a las estaciones centrales. Chernovodskaya se quejó de que la Unión le sacaba los recursos para cubrir sus pérdidas; el Norte la apoyó y en 2030 estalló la guerra. En 2031 el Norte negoció su independencia y la junta de Chernovodskaya voló el túnel sur antes de rendirse.",
      "Ese mismo año asumió Vadim Volkov. Su diagnóstico es claro: nada habría pasado con un control más férreo. Zvezdnaya y Mostovaya han perdido su autonomía y, desde 2032, brigadas de la Unión protegen Stantsiya Staraya por el Acuerdo de Libre Paso Comercial y Defensa.",
      "A principios de 2033, Bessmertny envió a Volkov una carta exigiendo la retirada de esas tropas. La carta nunca llegó. Nadie sabe por qué.",
    ],
    goals: ["Recuperar el Norte y Chernovodskaya","Defender Staraya frente a los Seguidores","Volver a ser la policía del metro"],
    relations: {"STA":60,"NOR":-10,"CHE":-60,"SDR":-15,"LEV":-10,"VHL":-40,"CAL":-20},
  },
  SDR: {
    id: "SDR",
    name: "Seguidores de Rusia",
    shortName: "los Seguidores",
    adjective: "seguidor",
    color: "#3f8f3a",
    colorDark: "#1d4a1b",
    capital: "KHO",
    leader: "bessmertny",
    government: "Dictadura ultranacionalista",
    ideology: "nacionalismo",
    summary: "La facción más joven y la de mayor industria. Gracias al Pacto de Hierro con Industrialnaya, Bessmertny quiere dominar el Sector Este: Staraya y Vhlainska.",
    lore: [
      "Dimitry Bessmertny dirigía una pequeña milicia en Stantsiya Kholodnogo Vozduha. En 2029, tras unas elecciones fraudulentas y una corrupción desbordada, tomó el poder por la fuerza y convirtió la estación en una potencia militar que pronto anexionó a sus vecinas.",
      "El Pacto de Hierro le entregó Industrialnaya, la Fábrica del Metro: munición, equipo pesado y armamento improvisado. Los magnates industriales obtuvieron privilegios y preferencia comercial; Bessmertny, la mayor economía del metro en menos de cuatro años.",
      "Para proteger esa industria cerró la economía al exterior: los productos baratos de la República y la Unión no arruinarán sus talleres.",
      "Ahora, embriagado por sus conquistas, mira al Sector Este. Staraya, \"sucias ratas que cobran peajes excesivos\", y Vhlainska, \"ratas inmundas\" que asaltan sus caravanas. En privado no odia a la Unión: vivió allí seis años.",
    ],
    goals: ["Conquistar Stantsiya Staraya","Aplastar a los saqueadores de Vhlainska","Dominar el Sector Este"],
    relations: {"STA":-50,"VHL":-60,"UNI":-5,"LEV":-30,"NOR":0,"CHE":5,"CAL":-10},
  },
  LEV: {
    id: "LEV",
    name: "Levantamiento Popular",
    shortName: "el Levantamiento",
    adjective: "revolucionario",
    color: "#b3202c",
    colorDark: "#5a0f15",
    capital: "STL",
    leader: "morozov",
    government: "Consejo Revolucionario",
    ideology: "comunismo",
    summary: "Una revolución ordenada y paciente. Controla toda la Variante Perimetral salvo Mertvaya, a la que asfixia con un embargo desde 2029. Su objetivo: expandir la revolución.",
    lore: [
      "Cuando cayó el gobierno ruso, Stalingradskaya se organizó por votación. Con los años desarrolló una estructura comunista que no se volvió totalitaria: un gobierno por y para la gente que quiere llevar la revolución al resto del metro.",
      "En 2023, Morozov Zver, estudioso y general del ejército ruso que había defendido la estación de varios asedios, se convirtió en presidente del Consejo Revolucionario.",
      "Sus guerras son lentas y bien planificadas: encierran al enemigo con embargos antes de atacar. Rassvetnaya cayó a inicios de 2024; Vysotnaya, a finales de 2028.",
      "En 2033 no hay rebeliones, ni hambre, ni desesperación. Solo Mertvaya resiste, aislada, mientras sus habitantes mueren de hambre y enfermedades.",
    ],
    goals: ["Tomar Mertvaya","Exportar la revolución al Norte y al centro","Mantener la estabilidad"],
    relations: {"CAL":-90,"UNI":-15,"NOR":10,"SDR":-35,"STA":0,"VHL":-20,"CHE":0},
  },
  STA: {
    id: "STA",
    name: "Stantsiya Staraya",
    shortName: "Staraya",
    adjective: "de Staraya",
    color: "#e39b2d",
    colorDark: "#7a4d0c",
    capital: "STA",
    leader: "orlova",
    government: "Consejo Mercantil",
    ideology: "oligarquia",
    summary: "La Encrucijada: cinco túneles, cinco peajes. Rica, poco armada y rodeada de enemigos. Depende de mercenarios y de las brigadas de la Unión.",
    lore: [
      "Staraya, \"la vieja\", es la estación más antigua de Vlianska y su mayor cruce. Cuando cayó el gobierno, los comerciantes del mercado formaron el Consejo Mercantil y empezaron a cobrar peaje a cada caravana que cruzaba sus andenes.",
      "Neutral por conveniencia, próspera y débil militarmente, Staraya siempre ha preferido pagar a luchar. Los bandidos de Vhlainska asaltan sus caravanas; los Seguidores de Rusia odian sus peajes.",
      "En 2032 firmó con la Unión el Acuerdo de Libre Paso Comercial y Defensa: paso libre para las caravanas unionistas a cambio de brigadas y armas. Ahora esas brigadas acampan en sus andenes, y Bessmertny exige que se vayan.",
    ],
    goals: ["Sobrevivir entre la Unión y los Seguidores","Acabar con los saqueadores","Mantener el control del peaje"],
    relations: {"UNI":50,"SDR":-30,"VHL":-70,"LEV":5,"NOR":10,"CHE":0,"CAL":0},
  },
  VHL: {
    id: "VHL",
    name: "Saqueadores de Vhlainska",
    shortName: "los Saqueadores",
    adjective: "saqueador",
    color: "#e8572a",
    colorDark: "#6e2210",
    capital: "VHL",
    leader: "rybak",
    government: "Hermandad de bandas",
    ideology: "anarquia",
    summary: "Una estación de bandidos que vive de asaltar caravanas. Pocos, mal armados y odiados por todos, pero dueños de los túneles peligrosos del este.",
    lore: [
      "Vhlainska era una estación obrera que todos abandonaron durante los años del caos. Sin comida ni ayuda, sus habitantes aprendieron a sobrevivir de la única manera posible: asaltando las caravanas que cruzan los túneles del este.",
      "Hoy la gobierna la Hermandad, una alianza de bandas unida por el cabecilla más temido de todas: Grigori \"el Tuerto\" Rybak.",
      "Staraya pide protección a la Unión por sus asaltos y los Seguidores de Rusia gastan fortunas escoltando caravanas. Todos quieren ver arder Vhlainska. Pocos se atreven a entrar en sus túneles.",
    ],
    goals: ["Sobrevivir","Saquear a los vecinos","Tomar Tenevskaya o Staraya"],
    relations: {"STA":-60,"SDR":-50,"UNI":-30,"LEV":-10,"NOR":0,"CHE":0,"CAL":10},
  },
  CHE: {
    id: "CHE",
    name: "Chernovodskaya",
    shortName: "Chernovodskaya",
    adjective: "chernovodskiano",
    color: "#8e3bbf",
    colorDark: "#43175e",
    capital: "CHE",
    leader: "voronov",
    government: "Junta militar",
    ideology: "autocracia",
    summary: "Una junta militar arruinada y totalmente aislada: su único túnel está volado. Primero hay que reconstruir; después, reabrir el paso... y ajustar cuentas con la Unión.",
    lore: [
      "Chernovodskaya formaba parte del Corredor Longitudinal y de la Unión, gestionada por una junta militar. Tras el invierno de 2029 denunció que la Unión extraía sus recursos para cubrir sus propias pérdidas: más un lastre que un aliado.",
      "Con el apoyo del Norte, la presión desembocó en guerra en 2030. Las estaciones centrales, las más ricas de la Unión, aguantaron. A mediados de 2031 Chernovodskaya estaba a punto de caer.",
      "La junta tomó una decisión desesperada para no perder el poder: voló el túnel que la unía con Mostovaya. Chernovodskaya ganó su independencia y lo perdió todo lo demás.",
    ],
    goals: ["Reconstruir la estación","Reabrir el túnel sur","Vengarse de la Unión o hacer las paces"],
    relations: {"UNI":-80,"NOR":40,"SDR":0,"LEV":0,"STA":0,"VHL":0,"CAL":0},
  },
  CAL: {
    id: "CAL",
    name: "Califato de Izumrudnaya",
    shortName: "el Califato",
    adjective: "del Califato",
    color: "#1f9e7a",
    colorDark: "#0c4a39",
    capital: "MER",
    leader: "baghdadi",
    government: "Califato teocrático",
    ideology: "teocracia",
    summary: "Una estación-fortaleza asediada y hambrienta. El embargo del Levantamiento la asfixia desde 2029. Resistir, romper el cerco o cambiar de rumbo.",
    lore: [
      "Durante los primeros años del gobierno ruso, muchos musulmanes fueron recluidos en Izumrudnaya, unos por decisión propia y otros enviados por el gobierno. Cuando este cayó, se formó una junta cívica que los dejaba fuera del gobierno de la estación.",
      "Se rebelaron. La guerra civil fue atroz y su cabecilla, Mohhammed Baghdadi, dirigió los peores crímenes contra la población rusa y ucraniana de la estación. Vysotnaya, entonces una junta civil, intervino; la guerra acabó en tablas y Baghdadi proclamó el Califato.",
      "Desde 2029 el embargo del Levantamiento aísla por completo a Mertvaya, \"la Muerta\", como la llaman en el frente. Su gente muere de hambre y de enfermedad. No todos en la estación comparten el fanatismo de su califa.",
    ],
    goals: ["Resistir el asedio","Romper el embargo","Elegir entre la guerra santa y la moderación"],
    relations: {"LEV":-100,"UNI":0,"VHL":10,"SDR":-10,"STA":0,"NOR":-10,"CHE":0},
  },
  NOR: {
    id: "NOR",
    name: "República del Norte",
    shortName: "la República",
    adjective: "norteño",
    color: "#b08948",
    colorDark: "#5a4420",
    capital: "UBE",
    leader: "lebedeva",
    government: "República parlamentaria",
    ideology: "democracia",
    summary: "Severnyy Terminal y Ubezhishche Nadezhdy se independizaron de la Unión en 2031. Tienen el mejor hospital del metro y la salida a la superficie, pero están entre dos gigantes.",
    lore: [
      "Severnyy Terminal y Ubezhishche Nadezhdy fueron parte del Corredor Longitudinal y de la Unión de Estaciones. Sufrían graves problemas de seguridad: los túneles del norte son de los más peligrosos del metro.",
      "En 2030 apoyaron las reclamaciones de Chernovodskaya contra la Unión. Mientras el sur se desangraba, la presidenta Irina Lebedeva negoció en 2031 un acuerdo que les dio la independencia a cambio de un tributo.",
      "Hoy la República del Norte es la única democracia del metro. Al sur, el Levantamiento agita a sus obreros; al este, Volkov no ha renunciado a recuperar lo que considera suyo.",
    ],
    goals: ["Mantener la independencia","Explorar la superficie","Elegir aliados: la Unión, el Levantamiento o nadie"],
    relations: {"CHE":40,"UNI":-20,"LEV":5,"SDR":0,"STA":10,"VHL":0,"CAL":-10},
  },
};

export const FACTION_IDS = Object.keys(FACTION_LORE) as FactionId[];
