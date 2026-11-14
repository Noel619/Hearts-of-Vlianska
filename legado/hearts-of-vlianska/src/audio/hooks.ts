// Conecta el sonido con la interfaz y con la partida: clics, paneles,
// ambiente según la pantalla, música según la situación y efectos cuando
// ocurren cosas (eventos, enfoques, investigación, guerras, batallas...).
import type { FactionId, GameState } from '../game/types';
import { isAtWar } from '../game/helpers';
import { mapActivity } from '../ui/map/MapView';
import { nav, store, ui } from '../ui/store';
import { audio, type Mood } from './index';
import { isDesktopApp } from '../ui/video';

interface Snapshot {
  hour: number;
  player: FactionId | null;
  events: number;
  focus: number;
  techs: number;
  builds: number;
  units: number;
  stations: number;
  wars: string;
  battles: number;
  over: boolean;
}

function snapshot(s: GameState | null): Snapshot | null {
  if (!s || !s.player) return null;
  const f = s.player;
  const c = s.countries[f];
  let stations = 0;
  for (const st of Object.values(s.stations)) if (st.owner === f) stations++;
  let units = 0;
  for (const u of Object.values(s.units)) if (u.owner === f) units++;
  let battles = 0;
  for (const b of Object.values(s.battles)) if (b.attackerSide === f || b.defenderSide === f) battles++;
  return {
    hour: s.hour,
    player: f,
    events: s.playerEvents.length,
    focus: c.focus.done.length,
    techs: c.research.done.length,
    builds: c.construction.length,
    units,
    stations,
    wars: s.wars
      .filter((w) => w.attackers.includes(f) || w.defenders.includes(f))
      .map((w) => w.id)
      .join(','),
    battles,
    over: !!s.gameOver,
  };
}

function gameMood(s: GameState): Mood {
  const f = s.player;
  if (!f) return 'peace';
  if (isAtWar(s, f)) return 'war';
  const threatened = Object.values(s.countries).some((c) => c.wargoals.some((w) => w.target === f));
  if (threatened || s.tension >= 0.55) return 'tension';
  return 'peace';
}

let installed = false;

export function installAudio() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const applyVolumes = () => {
    const s = store.settings;
    audio.setVolumes({ master: s.volMaster, music: s.volMusic, ambience: s.volAmbience, sfx: s.volSfx, muted: s.muted });
  };
  applyVolumes();

  // El navegador solo deja sonar tras un gesto del usuario; la versión de escritorio, desde el principio.
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  if (isDesktopApp()) unlock();

  // Clics y hover de la interfaz
  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as Element | null)?.closest?.('button, select, input[type="checkbox"], input[type="range"], .setup-faction');
      if (!el || (el as HTMLButtonElement).disabled) return;
      if (el.closest('.map-wrap')) return;
      if (el.classList.contains('primary')) audio.play('confirm');
      else if (el.classList.contains('event-option')) audio.play('confirm');
      else audio.play('click');
    },
    true,
  );
  let lastHover: Element | null = null;
  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType === 'touch') return;
      const el = (e.target as Element | null)?.closest?.('.btn, .rail-btn, .focus-node, .tech-node, .tech-tab, .setup-faction, .event-option');
      if (el && el !== lastHover && !(el as HTMLButtonElement).disabled) audio.play('hover', 0.06);
      lastHover = el ?? null;
    },
    true,
  );
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm' && !(e.target as Element | null)?.closest?.('input, textarea, select')) {
      store.updateSettings({ muted: !store.settings.muted });
    }
  });

  // Paneles y árboles
  let prevUi = ui.get();
  ui.subscribe(() => {
    const u = ui.get();
    if (u.panel !== prevUi.panel) audio.play(u.panel ? 'open' : 'close');
    if (u.overlay !== prevUi.overlay) audio.play(u.overlay ? 'page' : 'close');
    if (u.menuOpen !== prevUi.menuOpen && u.menuOpen) audio.play('open');
    if (u.selectedUnits.length && u.selectedUnits.join() !== prevUi.selectedUnits.join()) audio.play('select');
    if (u.mapMode !== prevUi.mapMode) audio.play('tick');
    prevUi = u;
  });

  // Pantallas: música y ambiente
  const applyScreen = () => {
    const screen = nav.get().screen;
    if (screen === 'game' && store.state?.player) {
      audio.setAmbience('game');
      audio.setMood(gameMood(store.state));
    } else {
      audio.setAmbience('menu');
      audio.setMood('menu');
    }
  };
  applyScreen();
  nav.subscribe(applyScreen);

  // La partida: se comparan instantáneas para detectar sucesos
  let prev = snapshot(store.state);
  let prevSpeed = store.speed;
  let prevSettings = store.settings;
  let moodCheck = 0;
  store.subscribe(() => {
    if (store.settings !== prevSettings) {
      prevSettings = store.settings;
      applyVolumes();
    }
    if (store.speed !== prevSpeed) {
      audio.play(store.speed === 0 ? 'pause' : 'tick');
      prevSpeed = store.speed;
    }
    const s = store.state;
    const cur = snapshot(s);
    if (!cur || !s || nav.get().screen !== 'game') {
      prev = cur;
      return;
    }
    if (prev && prev.player === cur.player && cur.hour >= prev.hour) {
      if (cur.events > prev.events) audio.play('event', 0.8);
      if (cur.focus > prev.focus) audio.stinger('focus');
      if (cur.techs > prev.techs) audio.stinger('research');
      if (cur.builds < prev.builds && cur.hour > prev.hour) audio.play('build', 0.5);
      if (cur.units > prev.units && cur.hour > prev.hour) audio.play('recruit', 1);
      if (cur.stations > prev.stations) audio.stinger('capture');
      if (cur.stations < prev.stations) audio.stinger('loss');
      if (cur.wars.length > prev.wars.length || (cur.wars && !prev.wars)) {
        audio.stinger('war');
        audio.play('siren', 5);
      } else if (!cur.wars && prev.wars) audio.stinger('peace');
      if (cur.battles > prev.battles) audio.play('battle', 1.5);
      if (cur.over && !prev.over) audio.stinger(s.gameOver?.victory ? 'victory' : 'defeat');
    }
    prev = cur;
    // La música cambia como mucho una vez por segundo real
    const now = performance.now();
    if (now - moodCheck > 1000) {
      moodCheck = now;
      audio.setMood(gameMood(s));
      audio.setIntensity(Math.min(1, cur.battles / 3 + mapActivity.battle * 0.5));
    }
  });

  // Tiroteos lejanos según las batallas visibles en el mapa
  window.setInterval(() => {
    audio.setBattle(nav.get().screen === 'game' ? mapActivity.battle : 0);
  }, 400);
}
