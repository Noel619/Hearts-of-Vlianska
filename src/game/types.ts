// Tipos centrales del motor de Hearts of Vlianska.
// Todo el estado de la partida es un objeto JSON serializable (GameState).

export type FactionId = 'UNI' | 'SDR' | 'LEV' | 'STA' | 'VHL' | 'CHE' | 'CAL' | 'NOR';
export const FACTION_IDS: FactionId[] = ['UNI', 'SDR', 'LEV', 'STA', 'VHL', 'CHE', 'CAL', 'NOR'];

export type IdeologyId =
  | 'democracia'
  | 'comunismo'
  | 'autocracia'
  | 'nacionalismo'
  | 'oligarquia'
  | 'teocracia'
  | 'anarquia';

export type ResourceId = 'chatarra' | 'polvora' | 'combustible';
export const RESOURCE_IDS: ResourceId[] = ['chatarra', 'polvora', 'combustible'];

export type EquipmentId = 'armas' | 'apoyo' | 'morteros' | 'lanzallamas' | 'draisinas';
export const EQUIPMENT_IDS: EquipmentId[] = ['armas', 'apoyo', 'morteros', 'lanzallamas', 'draisinas'];

export type StationBuilding = 'civil' | 'militar' | 'granja' | 'infraestructura';
export type BuildingId = StationBuilding | 'fortificacion';

export type Terrain =
  | 'estacion'
  | 'linea'
  | 'tunel'
  | 'peligroso'
  | 'auxiliar'
  | 'auxiliarPeligroso'
  | 'estrecho'
  | 'derrumbe';

export type TechCategory = 'armamento' | 'apoyo' | 'vehiculos' | 'industria' | 'supervivencia' | 'doctrina';
export type LawGroup = 'economia' | 'reclutamiento' | 'comercio' | 'raciones';
export type Difficulty = 'facil' | 'normal' | 'dificil';

export type ModifierKey =
  | 'ppDiario'
  | 'estabilidad'
  | 'apoyoGuerra'
  | 'produccionMilitar'
  | 'produccionCivil'
  | 'construccion'
  | 'eficienciaMax'
  | 'eficienciaGanancia'
  | 'bienesConsumo'
  | 'investigacion'
  | 'reclutables'
  | 'manoObra'
  | 'entrenamiento'
  | 'ataque'
  | 'defensa'
  | 'ruptura'
  | 'organizacion'
  | 'recuperacionOrg'
  | 'atricion'
  | 'movimiento'
  | 'alimentos'
  | 'consumoAlimentos'
  | 'recursos'
  | 'costeLeyes'
  | 'costeAsesores'
  | 'costeDecisiones'
  | 'justificacion'
  | 'crecimientoPoblacion'
  | 'tension'
  | 'fortificacion'
  | 'peligroMutante'
  | 'ataquePeligroso'
  | 'ataqueAuxiliar'
  | 'defensaEstacion'
  | 'civExtra'
  | 'milExtra'
  | 'reforzar'
  | 'rendicion'
  | 'rangoSuministro'
  | 'enfoque'
  | 'expediciones'
  | 'saqueo'
  | 'popDemocracia'
  | 'popComunismo'
  | 'popAutocracia'
  | 'popNacionalismo'
  | 'popOligarquia'
  | 'popTeocracia'
  | 'popAnarquia';

export type Modifiers = Partial<Record<ModifierKey, number>>;

// ---------------------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------------------

export interface ProvinceDef {
  id: string;
  name: string;
  kind: 'estacion' | 'cruce' | 'tramo';
  terrain: Terrain;
  x: number;
  y: number;
  tunnel?: string;
  underRiver?: boolean;
  baseDanger: number;
}

export interface StationDef {
  id: string;
  name: string;
  shortName: string;
  desc: string;
  population: number;
  slots: number;
  buildings: Record<StationBuilding, number>;
  fort: number;
  resources: Record<ResourceId, number>;
  victoryPoints: number;
  owner: FactionId | null;
  cores: FactionId[];
  claims?: FactionId[];
  feature?: { name: string; desc: string; modifiers: Modifiers };
  surface?: boolean;
}

export interface EdgeDef {
  id: string;
  a: string;
  b: string;
  terrain: Terrain;
  line?: 'verde' | 'roja' | 'azul';
  points: [number, number][];
  length: number;
  latent?: boolean;
  tunnel: string;
}

// ---------------------------------------------------------------------------
// Efectos y condiciones (DSL de contenido)
// ---------------------------------------------------------------------------

export type Target = FactionId | 'FROM' | 'TARGET' | 'ROOT';
export type StationRef = string; // id de estación, 'CAPITAL' o 'TARGET'

export type Condition =
  | { c: 'hasFocus'; id: string }
  | { c: 'hasTech'; id: string }
  | { c: 'hasFlag'; id: string }
  | { c: 'hasGlobalFlag'; id: string }
  | { c: 'hasSpirit'; id: string }
  | { c: 'atWar' }
  | { c: 'atWarWith'; target: Target }
  | { c: 'controls'; station: StationRef }
  | { c: 'owns'; station: StationRef }
  | { c: 'stationFree'; station: string }
  | { c: 'exists'; target: Target }
  | { c: 'isFaction'; id: FactionId }
  | { c: 'isPlayer' }
  | { c: 'stability'; min?: number; max?: number }
  | { c: 'warSupport'; min?: number; max?: number }
  | { c: 'pp'; min: number }
  | { c: 'manpower'; min: number }
  | { c: 'ideology'; id: IdeologyId }
  | { c: 'targetIdeology'; target: Target; id: IdeologyId }
  | { c: 'popularity'; id: IdeologyId; min?: number; max?: number }
  | { c: 'targetPopularity'; target: Target; id: IdeologyId; min?: number }
  | { c: 'date'; after?: string; before?: string }
  | { c: 'month'; in: number[] }
  | { c: 'tension'; min?: number; max?: number }
  | { c: 'inPactWith'; target: Target }
  | { c: 'inPact' }
  | { c: 'isPactLeader' }
  | { c: 'relation'; target: Target; min?: number; max?: number }
  | { c: 'stations'; min?: number; max?: number }
  | { c: 'units'; min?: number; max?: number }
  | { c: 'food'; min?: number; max?: number }
  | { c: 'foodBalance'; min?: number; max?: number }
  | { c: 'edgeOpen'; province: string }
  | { c: 'hasNap'; target: Target }
  | { c: 'hasAccess'; target: Target }
  | { c: 'embargoes'; target: Target }
  | { c: 'isSubject' }
  | { c: 'subjectOf'; target: Target }
  | { c: 'provinceDanger'; province: string; max?: number; min?: number }
  | { c: 'strongerThan'; target: Target; ratio?: number }
  | { c: 'hasWargoal'; target: Target }
  | { c: 'surrender'; min?: number }
  | { c: 'and'; list: Condition[] }
  | { c: 'or'; list: Condition[] }
  | { c: 'not'; cond: Condition }
  | { c: 'scoped'; target: Target; cond: Condition };

export type Effect =
  | { t: 'pp'; v: number }
  | { t: 'stability'; v: number }
  | { t: 'warSupport'; v: number }
  | { t: 'population'; station: StationRef; v: number }
  | { t: 'addSpirit'; id: string; days?: number }
  | { t: 'removeSpirit'; id: string }
  | { t: 'building'; station: StationRef; b: BuildingId; v: number }
  | { t: 'slots'; station: StationRef; v: number }
  | { t: 'resource'; station: StationRef; res: ResourceId; v: number }
  | { t: 'stock'; eq: EquipmentId; v: number }
  | { t: 'food'; v: number }
  | { t: 'researchSlot'; v: number }
  | { t: 'researchBonus'; cat: TechCategory; v: number; uses?: number; label?: string }
  | { t: 'tech'; id: string }
  | { t: 'claim'; station: StationRef }
  | { t: 'core'; station: StationRef }
  | { t: 'wargoal'; target: Target }
  | { t: 'declareWar'; target: Target }
  | { t: 'relation'; target: Target; v: number; mutual?: boolean }
  | { t: 'popularity'; id: IdeologyId; v: number }
  | { t: 'setIdeology'; id: IdeologyId; leader?: string }
  | { t: 'setLeader'; leader: string }
  | { t: 'flag'; id: string; v?: number }
  | { t: 'clearFlag'; id: string }
  | { t: 'globalFlag'; id: string }
  | { t: 'event'; id: string; target?: Target; days?: number }
  | { t: 'unit'; template: string; station: StationRef; count?: number; name?: string }
  | { t: 'template'; id: string }
  | { t: 'tension'; v: number }
  | { t: 'unlockDecision'; id: string }
  | { t: 'annex'; target: Target }
  | { t: 'makeSubject'; target: Target }
  | { t: 'releaseSubject'; target: Target }
  | { t: 'createPact'; name: string }
  | { t: 'joinPact'; target: Target }
  | { t: 'addToPact'; target: Target }
  | { t: 'leavePact' }
  | { t: 'nap'; target: Target; days?: number }
  | { t: 'access'; target: Target }
  | { t: 'revokeAccess'; target: Target }
  | { t: 'guarantee'; target: Target }
  | { t: 'removeGuarantee'; target: Target }
  | { t: 'embargo'; target: Target }
  | { t: 'liftEmbargo'; target: Target }
  | { t: 'whitePeace'; target: Target }
  | { t: 'danger'; province: string; v: number }
  | { t: 'dangerAll'; v: number }
  | { t: 'clearCollapse'; province: string }
  | { t: 'openEdge'; edge: string }
  | { t: 'transferStation'; station: StationRef; to: Target }
  | { t: 'fortAround'; station: StationRef; v: number }
  | { t: 'manpowerBonus'; v: number }
  | { t: 'unitsHeal'; v: number }
  | { t: 'withdrawUnits'; from: StationRef }
  | { t: 'log'; text: string }
  | { t: 'if'; cond: Condition; then: Effect[]; else?: Effect[] }
  | { t: 'random'; chance: number; then: Effect[]; else?: Effect[] }
  | { t: 'scoped'; target: Target; effects: Effect[] }
  | { t: 'custom'; id: string; desc: string; arg?: string | number };

// ---------------------------------------------------------------------------
// Definiciones de contenido
// ---------------------------------------------------------------------------

export interface PortraitParams {
  skin: number; // 0..4
  hair: 'none' | 'short' | 'long' | 'buzz' | 'bun';
  hairColor: number; // 0..5
  facial?: 'none' | 'mustache' | 'beard' | 'fullbeard' | 'stubble';
  hat?: 'none' | 'ushanka' | 'cap' | 'beret' | 'helmet' | 'hood' | 'bandana' | 'gasmask' | 'kufi';
  outfit: 'military' | 'coat' | 'suit' | 'rags' | 'robe' | 'leather';
  glasses?: boolean;
  scar?: boolean;
  eyepatch?: boolean;
  medals?: boolean;
  accent: string;
  age?: 'young' | 'adult' | 'old';
  female?: boolean;
}

export interface IdeologyDef {
  id: IdeologyId;
  name: string;
  adjective: string;
  color: string;
  desc: string;
  modifiers: Modifiers;
  canJustifyAtTension: number;
}

export interface TraitDef {
  id: string;
  name: string;
  desc: string;
  modifiers: Modifiers;
}

export interface LeaderDef {
  id: string;
  name: string;
  title: string;
  faction: FactionId;
  ideology: IdeologyId;
  traits: string[];
  portrait: PortraitParams;
  bio: string;
}

export interface FactionDef {
  id: FactionId;
  name: string;
  shortName: string;
  adjective: string;
  color: string;
  colorDark: string;
  capital: string;
  leader: string;
  ideology: IdeologyId;
  popularity: Record<IdeologyId, number>;
  government: string;
  difficulty: 'Fácil' | 'Normal' | 'Difícil' | 'Muy difícil';
  summary: string;
  lore: string[];
  goals: string[];
  stability: number;
  warSupport: number;
  pp: number;
  laws: Record<LawGroup, string>;
  spirits: string[];
  techs: string[];
  researchSlots: number;
  stockpile: Record<EquipmentId, number>;
  food: number;
  templates: TemplateDef[];
  units: { template: string; province: string; count?: number }[];
  production: { equipment: EquipmentId; factories: number }[];
  relations: Partial<Record<FactionId, number>>;
  aiTargets: { target: FactionId; weight: number }[];
  aiFriends: FactionId[];
  unitNames: string;
}

export interface TemplateDef {
  id: string;
  name: string;
  line: string[];
  support: string[];
}

export interface BattalionDef {
  id: string;
  name: string;
  short: string;
  desc: string;
  support: boolean;
  men: number;
  width: number;
  org: number;
  hp: number;
  soft: number;
  hard: number;
  def: number;
  brk: number;
  armor: number;
  pierce: number;
  hardness: number;
  speed: number;
  equipment: Partial<Record<EquipmentId, number>>;
  tech?: string;
  noAuxiliary?: boolean;
  special?: {
    attritionReduction?: number;
    fortBonus?: number;
    casualtyReduction?: number;
    dangerAttack?: number;
    antiFort?: number;
    vision?: number;
    reinforce?: number;
    excavation?: number;
  };
}

export interface EquipmentDef {
  id: EquipmentId;
  name: string;
  desc: string;
  cost: number;
  resources: Partial<Record<ResourceId, number>>;
  levels: string[]; // nombres de modelos por nivel
}

export interface SpiritDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  modifiers: Modifiers;
  negative?: boolean;
}

export interface LawDef {
  id: string;
  group: LawGroup;
  name: string;
  desc: string;
  cost: number;
  order: number;
  value?: number; // porcentaje de reclutables, bienes de consumo o exportación
  modifiers: Modifiers;
  available?: Condition;
}

export interface AdvisorDef {
  id: string;
  name: string;
  role: string;
  slot: 'politico' | 'militar';
  faction?: FactionId;
  cost: number;
  desc: string;
  modifiers: Modifiers;
  portrait: PortraitParams;
  available?: Condition;
  ideology?: IdeologyId;
}

export interface TechDef {
  id: string;
  name: string;
  desc: string;
  cat: TechCategory;
  year: number;
  cost: number;
  x: number;
  y: number;
  icon: string;
  prereq?: string[];
  exclusive?: string[];
  modifiers?: Modifiers;
  effects?: Effect[];
  unlocks?: { battalions?: string[]; equipment?: { id: EquipmentId; level: number }; lineSlots?: number; supportSlots?: number };
}

export interface FocusDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  x: number;
  y: number;
  cost?: number;
  prereq?: string[][];
  exclusive?: string[];
  available?: Condition;
  bypass?: Condition;
  effects: Effect[];
  ai?: number;
}

export interface FocusTreeDef {
  faction: FactionId;
  name: string;
  focuses: FocusDef[];
}

export interface EventOption {
  name: string;
  effects: Effect[];
  ai?: number;
  available?: Condition;
}

export interface EventDef {
  id: string;
  title: string;
  desc: string;
  picture: string;
  factions?: FactionId[];
  trigger?: Condition;
  mtth?: number;
  once?: boolean;
  news?: boolean;
  triggeredOnly?: boolean;
  options: EventOption[];
}

export interface DecisionDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  category: string;
  factions?: FactionId[];
  unlockedBy?: string;
  visible?: Condition;
  available?: Condition;
  cost?: { pp?: number; manpower?: number; food?: number; armas?: number };
  days?: number;
  cooldown?: number;
  once?: boolean;
  targets?: 'dangerProvince' | 'collapse' | 'neighbor' | 'raidTarget' | 'ownedNonCore' | 'abandoned';
  effects: Effect[];
  completeEffects?: Effect[];
  ai?: number;
}

// ---------------------------------------------------------------------------
// Estado en tiempo de ejecución
// ---------------------------------------------------------------------------

export interface ProvinceState {
  controller: FactionId | null;
  fort: number;
  danger: number;
  collapsed: boolean;
  floodedUntil?: number;
  suppressedUntil?: number;
}

export interface StationState {
  owner: FactionId | null;
  population: number;
  buildings: Record<StationBuilding, number>;
  resources: Record<ResourceId, number>;
  cores: FactionId[];
  claims: FactionId[];
  slots: number;
  ownedSince: number;
}

export interface ResearchBonus {
  id: string;
  cat: TechCategory;
  v: number;
  uses: number;
  label: string;
}

export interface ProductionLine {
  id: string;
  equipment: EquipmentId;
  factories: number;
  efficiency: number;
}

export interface ConstructionItem {
  id: string;
  building: BuildingId;
  location: string; // estación o provincia (fortificación)
  progress: number;
}

export interface TradeDeal {
  id: string;
  partner: FactionId;
  resource: ResourceId | 'alimentos';
  amount: number;
}

export interface Template extends TemplateDef {
  custom?: boolean;
}

export interface RecruitItem {
  id: string;
  template: string;
  station: string;
  progress: number;
  men: number;
}

export interface WarGoal {
  target: FactionId;
  progress: number;
  ready: boolean;
  expires?: number;
}

export interface ActiveDecision {
  id: string;
  target?: string;
  until: number;
  manpower?: number;
}

export interface PendingEvent {
  uid: string;
  id: string;
  from?: FactionId;
  target?: string;
  hour: number;
  vars?: Record<string, string>;
}

export interface CountryDerived {
  ppGain: number;
  stability: number;
  warSupport: number;
  civTotal: number;
  civConsumer: number;
  civTrade: number;
  civAvailable: number;
  milTotal: number;
  milAssigned: number;
  manpowerMax: number;
  manpowerUsed: number;
  manpowerAvailable: number;
  foodProd: number;
  foodCons: number;
  foodTrade: number;
  famine: number;
  resources: Record<ResourceId, { produced: number; imported: number; exported: number; used: number; available: number }>;
  resourceRatio: Record<ResourceId, number>;
  population: number;
  researchSpeed: number;
  surrenderLimit: number;
  equipmentNeed: Record<EquipmentId, number>;
}

export interface AIState {
  strategy: string;
  lastDiplo: number;
  targetWar?: FactionId;
  focusBias?: Record<string, number>;
  rejected: Partial<Record<FactionId, number>>;
}

export interface CountryState {
  id: FactionId;
  alive: boolean;
  capital: string;
  leader: string;
  ideology: IdeologyId;
  popularity: Record<IdeologyId, number>;
  pp: number;
  stabilityBase: number;
  warSupportBase: number;
  laws: Record<LawGroup, string>;
  advisors: string[];
  spirits: { id: string; until?: number }[];
  focus: { current: string | null; progress: number; done: string[] };
  research: { slots: number; active: ({ tech: string; progress: number; bonus?: number } | null)[]; done: string[]; bonuses: ResearchBonus[] };
  stockpile: Record<EquipmentId, number>;
  food: number;
  production: ProductionLine[];
  construction: ConstructionItem[];
  trades: TradeDeal[];
  templates: Template[];
  recruitment: RecruitItem[];
  relations: Partial<Record<FactionId, number>>;
  wargoals: WarGoal[];
  flags: Record<string, number>;
  cooldowns: Record<string, number>;
  activeDecisions: ActiveDecision[];
  unlockedDecisions: string[];
  firedEvents: Record<string, number>;
  surrender: number;
  casualties: number;
  recentLosses: number;
  unitCounter: number;
  manpowerBonus: number;
  overlord?: FactionId;
  derived: CountryDerived;
  ai: AIState;
}

export interface Unit {
  id: string;
  owner: FactionId;
  name: string;
  template: string;
  province: string;
  org: number;
  strength: number;
  path: string[];
  moveProgress: number;
  battle: string | null;
  retreating: boolean;
  outOfSupply: boolean;
  xp: number;
  aiTarget?: string;
}

export interface Battle {
  id: string;
  province: string;
  attackers: string[];
  defenders: string[];
  attackerSide: FactionId;
  defenderSide: FactionId;
  start: number;
  attackerLosses: number;
  defenderLosses: number;
  lastAdvantage: number;
}

export interface War {
  id: string;
  name: string;
  attackers: FactionId[];
  defenders: FactionId[];
  attackerLeader: FactionId;
  defenderLeader: FactionId;
  start: number;
  casualties: Partial<Record<FactionId, number>>;
}

export interface Pact {
  id: string;
  name: string;
  leader: FactionId;
  members: FactionId[];
}

export interface LogEntry {
  hour: number;
  text: string;
  kind: 'info' | 'guerra' | 'diplo' | 'bueno' | 'malo' | 'evento';
  faction?: FactionId;
  province?: string;
}

export interface NewsEntry {
  hour: number;
  title: string;
  text: string;
  picture: string;
}

export interface Notification {
  id: number;
  hour: number;
  text: string;
  kind: LogEntry['kind'];
  province?: string;
}

export interface PeaceOffer {
  uid: string;
  winner: FactionId;
  loser: FactionId;
  stations: string[];
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  hour: number;
  player: FactionId | null;
  difficulty: Difficulty;
  historicalAI: boolean;
  provinces: Record<string, ProvinceState>;
  stations: Record<string, StationState>;
  countries: Record<FactionId, CountryState>;
  units: Record<string, Unit>;
  battles: Record<string, Battle>;
  wars: War[];
  pacts: Pact[];
  naps: { a: FactionId; b: FactionId; until: number }[];
  access: { from: FactionId; to: FactionId }[];
  guarantees: { guarantor: FactionId; target: FactionId }[];
  embargoes: { from: FactionId; to: FactionId }[];
  tension: number;
  openEdges: string[];
  globalFlags: Record<string, number>;
  log: LogEntry[];
  news: NewsEntry[];
  playerEvents: PendingEvent[];
  peaceOffers: PeaceOffer[];
  nextId: number;
  history: { hour: number; data: Partial<Record<FactionId, { stations: number; units: number; mil: number; civ: number; pop: number }>> }[];
  scheduled: { hour: number; country: FactionId; event: string; from?: FactionId; target?: string }[];
  gameOver?: { winner: FactionId | null; reason: string; hour: number; victory: boolean };
  victoryAnnounced?: boolean;
  stats: { battles: number; captures: number };
}
