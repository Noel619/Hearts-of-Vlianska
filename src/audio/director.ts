// Director de sonido de la partida: decide la música y el ambiente según
// dónde mira el jugador y qué le ocurre a su gente, y coloca en el estéreo
// los efectos que emite el mundo.
import type { Game } from '../game/game';
import { hostile } from '../sim/combat';
import { stationAt } from '../sim/world';
import { F_WATER } from '../world/grid';
import { audio, type AmbienceKind, type Mood, type Sfx } from './index';
import { SFX_LEVEL } from './sfx';

/** Alcance (m) de los sonidos fuertes; el resto se oye a la mitad. */
const LOUD = new Set(['tiro', 'escopeta', 'alarma', 'rugido']);

export function attachAudio(game: Game): () => void {
  let mood: Mood = 'tunel';
  let candidate: Mood = 'tunel';
  let since = 0;
  let calm = 0;
  let lastPlace = '';

  game.onSound = (k, x, z, v = 1) => {
    if (!(k in SFX_LEVEL)) return;
    const name = k as Sfx;
    if (!Number.isFinite(x)) {
      audio.play(name);
      return;
    }
    const rig = game.rig;
    const d = Math.hypot(x - rig.tx, z - rig.tz);
    const range = LOUD.has(k) ? 120 : 55;
    const g = Math.max(0, 1 - d / range);
    if (g < 0.03) return;
    const p = game.project(x, 1, z);
    const pan = Math.max(-1, Math.min(1, (p.x / Math.max(1, window.innerWidth)) * 2 - 1)) * 0.85;
    const zoom = 1 / (1 + rig.dist / 110);
    audio.play(name, { pan: p.ok ? pan : 0, gain: g * g * v * zoom * 1.35 }, LOUD.has(k) ? 0.05 : 0.07);
  };

  const tick = () => {
    if (!game.running) return;
    const sim = game.sim;
    const world = sim.world;
    const cx = game.rig.tx;
    const cz = game.rig.tz;
    const players = sim.players.filter((c) => c.st === 'ok');
    // Combate y amenazas alrededor de la escuadra
    let fight = 0;
    let threat = 0;
    for (const c of players) {
      if (c.target) fight++;
      sim.forNear(c.x, c.z, 26, (o) => {
        if (o.player || o.st !== 'ok') return;
        const t = o.target ? sim.char(o.target) : null;
        if (t?.player) fight++;
        else if (hostile(sim, o, c)) threat++;
      });
    }
    // Lugar bajo la cámara
    const f = stationAt(world, cx, cz, 4);
    const owner = f ? (sim.state.stations[f.id]?.owner ?? null) : null;
    let amb: AmbienceKind = 'tunel';
    let base: Mood = 'tunel';
    if (f && owner) {
      amb = 'estacion';
      base = 'estacion';
    } else if (f) amb = 'peligro';
    else {
      const { sdf, owner: own, regions, nodeById } = world.layout;
      const i = Math.max(0, Math.min(sdf.w - 1, Math.round((cx - sdf.ox) / sdf.cell)));
      const j = Math.max(0, Math.min(sdf.h - 1, Math.round((cz - sdf.oz) / sdf.cell)));
      const reg = regions[own[j * sdf.w + i]];
      if (reg) {
        const theme = reg.kind === 'node' ? nodeById[reg.ref]?.room.theme : '';
        if (reg.terrain === 'peligroso' || reg.terrain === 'auxiliarPeligroso' || reg.terrain === 'derrumbe' || theme === 'cueva' || theme === 'nido' || theme === 'inundado' || theme === 'anden') amb = 'peligro';
      }
      if (world.gas.at(cx, cz) > 0.05) amb = 'peligro';
    }
    const want: Mood = fight > 0 ? 'combate' : threat > 0 ? 'tension' : base;
    const now = performance.now() / 1000;
    if (want !== candidate) {
      candidate = want;
      since = now;
    }
    if (want === 'combate') calm = now;
    // El combate entra al instante y tarda en irse; lo demás espera a asentarse
    const hold = mood === 'combate' ? 6 : 2.5;
    if (candidate !== mood && (candidate === 'combate' || (now - since > hold && now - calm > (mood === 'combate' ? 6 : 0)))) {
      mood = candidate;
      audio.setMood(mood);
    }
    audio.setIntensity(Math.min(1, fight / 6));
    audio.setAmbience(amb);
    // Fuego y agua cerca de la cámara
    let fire = 0;
    for (const l of world.field.near(cx, cz)) {
      if (l.kind !== 'fire' || l.off) continue;
      const d = Math.hypot(l.x - cx, l.z - cz);
      if (d < 16) fire += 1 - d / 16;
    }
    let wet = 0;
    for (let a = 0; a < 8; a++) if (world.nav.flagAt(cx + Math.cos(a * 0.785) * 5, cz + Math.sin(a * 0.785) * 5) & F_WATER) wet += 0.125;
    audio.setSurroundings(Math.min(1, fire * 0.6), wet);
    // Llegada a una estación nueva
    const place = f?.id ?? '';
    if (place && place !== lastPlace && owner && lastPlace !== '') audio.stinger('llegada');
    if (place) lastPlace = place;
    else if (!f) lastPlace = lastPlace || ' ';
  };
  const id = window.setInterval(tick, 300);
  audio.setMood(mood);
  audio.setAmbience('tunel');
  return () => {
    window.clearInterval(id);
    game.onSound = null;
  };
}
