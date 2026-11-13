// Atributos y habilidades. Todas suben con el uso (0-100).

export const SKILLS = {
  fuerza: { name: 'Fuerza', group: 'Atributos', desc: 'Daño contundente y peso que puedes cargar. Sube golpeando y moviéndote con mucho peso encima.' },
  destreza: { name: 'Destreza', group: 'Atributos', desc: 'Velocidad de ataque y daño cortante. Sube peleando con armas ligeras.' },
  aguante: { name: 'Aguante', group: 'Atributos', desc: 'Cuánto castigo soportas antes de caer y lo rápido que te levantas. Sube recibiendo golpes.' },
  percepcion: { name: 'Percepción', group: 'Atributos', desc: 'Distancia a la que detectas a otros y puntería a larga distancia.' },
  ataque: { name: 'Ataque cuerpo a cuerpo', group: 'Combate', desc: 'Probabilidad de superar la defensa del rival.' },
  defensa: { name: 'Defensa', group: 'Combate', desc: 'Probabilidad de parar o desviar un golpe.' },
  filo: { name: 'Armas de filo', group: 'Combate', desc: 'Cuchillos, machetes y hachas.' },
  contundente: { name: 'Armas contundentes', group: 'Combate', desc: 'Tubos, mazas y palas.' },
  asta: { name: 'Armas de asta', group: 'Combate', desc: 'Lanzas y bayonetas.' },
  pelea: { name: 'Pelea', group: 'Combate', desc: 'Puños y patadas.' },
  punteria: { name: 'Puntería', group: 'Combate', desc: 'Precisión con armas de fuego.' },
  esquiva: { name: 'Esquiva', group: 'Combate', desc: 'Evitar golpes sin arma con la que parar. El equipo pesado estorba.' },
  atletismo: { name: 'Atletismo', group: 'Supervivencia', desc: 'Velocidad de carrera. Sube corriendo, y más deprisa si vas cargado.' },
  sigilo: { name: 'Sigilo', group: 'Supervivencia', desc: 'Moverte sin que te vean ni te oigan. El equipo pesado estorba.' },
  medicina: { name: 'Medicina', group: 'Oficios', desc: 'Rapidez y calidad de las curas.' },
  ingenieria: { name: 'Ingeniería', group: 'Oficios', desc: 'Construir, reparar y excavar.' },
  chatarreria: { name: 'Chatarrería', group: 'Oficios', desc: 'Desguazar y rebuscar entre los restos.' },
  cultivo: { name: 'Cultivo', group: 'Oficios', desc: 'Hongos y corrales.' },
  cocina: { name: 'Cocina', group: 'Oficios', desc: 'Convertir hongos y carne en comida de verdad.' },
  armeria: { name: 'Armería', group: 'Oficios', desc: 'Fabricar armas, munición y blindajes.' },
  ciencia: { name: 'Ciencia', group: 'Oficios', desc: 'Velocidad de investigación.' },
  cerraduras: { name: 'Cerraduras', group: 'Oficios', desc: 'Abrir lo que otros cerraron.' },
} as const;

export type SkillId = keyof typeof SKILLS;
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

export const BODY_PARTS = ['Cabeza', 'Pecho', 'Abdomen', 'Brazo izq.', 'Brazo der.', 'Pierna izq.', 'Pierna der.'] as const;
export const PART_MAX = [70, 100, 100, 75, 75, 80, 80];
/** Probabilidad relativa de que un golpe caiga en cada parte. */
export const PART_HIT = [0.12, 0.3, 0.18, 0.1, 0.1, 0.1, 0.1];

/** Experiencia necesaria para subir de nivel n a n+1. */
export function xpForLevel(level: number): number {
  return 6 + level * 1.6 + level * level * 0.035;
}

export function skillWord(v: number): string {
  if (v < 10) return 'Torpe';
  if (v < 25) return 'Novato';
  if (v < 40) return 'Competente';
  if (v < 60) return 'Veterano';
  if (v < 80) return 'Experto';
  return 'Maestro';
}
