// Cómo están las cosas para la escuadra: quién la quiere, quién no, quién paga
// por sus cabezas y qué marcas lleva. Se calcula de la partida (o de los datos
// de un comienzo), así que lo que se cuenta nunca contradice al juego.

import { FACTION_IDS, FACTION_LORE } from '../data/historia/facciones';
import type { FactionId } from '../data/tipos';
import { HUNT_MIN } from './derrota';

export interface Standing {
  rep: Partial<Record<FactionId, number>>;
  bounty?: Partial<Record<FactionId, number>>;
  flags?: Record<string, number>;
  hungry?: boolean;
  hurt?: boolean;
}

export interface StandingLine {
  text: string;
  kind: 'bueno' | 'malo' | 'info';
}

/** «la Unión» → «La Unión»; y si el nombre va en plural («los Seguidores»). */
function who(f: FactionId): { name: string; plural: boolean } {
  const n = FACTION_LORE[f].shortName;
  return { name: n.charAt(0).toUpperCase() + n.slice(1), plural: n.startsWith('los ') };
}

/** Por debajo de esto, sus guardias os disparan al veros (como en combat.hostile). */
const HOSTILE = -50;

export function standingLines(st: Standing): StandingLine[] {
  const out: StandingLine[] = [];
  const flags = st.flags ?? {};
  if (flags.hermano && (st.rep.VHL ?? 0) >= 10) out.push({ text: 'La Hermandad os tiene por suyos: en Vhlainska nadie os toca y sus bandas no os cobran peaje.', kind: 'bueno' });
  for (const f of FACTION_IDS) {
    const r = st.rep[f] ?? 0;
    const { name, plural } = who(f);
    if (f === 'VHL' && flags.hermano && r >= 10) continue;
    if (r <= HOSTILE) out.push({ text: `${name} ${plural ? 'os disparan' : 'os dispara'} nada más veros.`, kind: 'malo' });
    else if (r <= -20) out.push({ text: `${name} no ${plural ? 'os quieren' : 'os quiere'} cerca.`, kind: 'malo' });
    else if (f === 'STA' && r >= 15) out.push({ text: 'En Staraya os conocen: no pagáis peaje.', kind: 'bueno' });
    else if (r >= 15) out.push({ text: `${name} ${plural ? 'os conocen' : 'os conoce'} y os ${plural ? 'tratan' : 'trata'} bien.`, kind: 'bueno' });
  }
  for (const f of FACTION_IDS) {
    const b = st.bounty?.[f] ?? 0;
    if (b <= 0) continue;
    const { name, plural } = who(f);
    out.push({ text: `${name} ${plural ? 'pagan' : 'paga'} ${b} cartuchos por vuestras cabezas${b >= HUNT_MIN ? ': saldrán cazarrecompensas a buscaros' : ''}.`, kind: 'malo' });
  }
  if (st.hungry) out.push({ text: 'Tenéis hambre y no os queda comida.', kind: 'malo' });
  if (st.hurt) out.push({ text: 'Venís heridos: hace falta un médico.', kind: 'malo' });
  if (!out.length) out.push({ text: 'Nadie os conoce todavía: ni amigos ni enemigos.', kind: 'info' });
  return out;
}
