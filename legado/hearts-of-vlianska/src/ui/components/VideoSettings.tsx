// Ajustes de vídeo y rendimiento: preajustes de calidad y opciones sueltas.
import { useEffect, useState } from 'react';
import { store, useVersion, type Settings } from '../store';
import {
  FPS_CAPS,
  PARTICLE_LEVELS,
  PRESET_IDS,
  RESOLUTIONS,
  VIDEO_PRESETS,
  currentPreset,
  detectPreset,
  fullscreenSupported,
  isDesktopApp,
  isFullscreen,
  onFullscreenChange,
  setFullscreen,
} from '../video';
import { Icon, Tip } from './core';

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

const TOGGLES: { key: BoolKey; label: string; hint: string }[] = [
  { key: 'lights', label: 'Iluminación animada', hint: 'Faroles, hogueras y luces que parpadean. Sin ella, cada estación tiene un halo fijo.' },
  { key: 'tunnelDetail', label: 'Detalle de los túneles', hint: 'Raíles, traviesas, tuberías y cables de luces al acercar el mapa.' },
  { key: 'postfx', label: 'Postprocesado', hint: 'Grano de la roca, viñeta, calles de la superficie, brillo del río y sombras suaves de las fichas.' },
  { key: 'menuAnimation', label: 'Fondo animado del menú', hint: 'La hoguera y el guitarrista del menú principal. Desactivado, se muestra una imagen fija.' },
  { key: 'uiEffects', label: 'Sombras y desenfoques de la interfaz', hint: 'Sombras de medallas y escudos, y el desenfoque detrás de las ventanas. Lo más caro de pintar en el árbol de enfoques.' },
  { key: 'uiAnimations', label: 'Animaciones de la interfaz', hint: 'Transiciones de paneles y ventanas, y los brillos que laten.' },
  { key: 'showFps', label: 'Mostrar fotogramas por segundo', hint: 'Un contador en la esquina del mapa con los FPS y el tiempo de dibujo de cada fotograma.' },
];

function useFullscreen() {
  const [on, setOn] = useState(isFullscreen);
  useEffect(() => onFullscreenChange(() => setOn(isFullscreen())), []);
  return on;
}

function SelectRow({ icon, label, value, options, onChange }: { icon: string; label: string; value: number; options: { v: number; label: string }[]; onChange: (v: number) => void }) {
  return (
    <label className="select-row">
      <Icon name={icon} size={16} className="amber" />
      <span>{label}</span>
      <select value={String(value)} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((o) => (
          <option key={o.v} value={String(o.v)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function VideoSettings() {
  useVersion();
  const s = store.settings;
  const preset = currentPreset(s);
  const recommended = detectPreset();
  const fullscreen = useFullscreen();
  const set = (patch: Partial<Settings>) => store.updateSettings(patch);
  const native = Math.round((window.devicePixelRatio || 1) * 100);
  const resolutions = RESOLUTIONS.map((r) => (r.v === 2 ? { ...r, label: `Nativa (tu pantalla: ${native} %)` } : r));
  return (
    <div className="video-settings">
      <div className="tt-sub">Calidad gráfica</div>
      <div className="preset-row" role="radiogroup" aria-label="Calidad gráfica">
        {PRESET_IDS.map((id) => (
          <Tip key={id} content={VIDEO_PRESETS[id].desc}>
            <button className={`btn small ${preset === id ? 'primary' : ''}`} role="radio" aria-checked={preset === id} onClick={() => set(VIDEO_PRESETS[id].values)}>
              {VIDEO_PRESETS[id].name}
            </button>
          </Tip>
        ))}
        {!preset && <span className="chip info">Personalizada</span>}
      </div>
      <p className="dim small">
        {preset ? VIDEO_PRESETS[preset].desc : 'Has ajustado las opciones a mano.'} Recomendada para este equipo: <strong>{VIDEO_PRESETS[recommended].name}</strong>.
      </p>

      <SelectRow icon="Monitor" label="Resolución del mapa" value={s.resolution} options={resolutions} onChange={(v) => set({ resolution: v })} />
      <SelectRow icon="Gauge" label="Límite de fotogramas" value={s.fpsCap} options={FPS_CAPS} onChange={(v) => set({ fpsCap: v })} />
      <SelectRow icon="Sparkles" label="Partículas (humo, brasas, disparos)" value={s.particles} options={PARTICLE_LEVELS} onChange={(v) => set({ particles: v })} />

      {TOGGLES.map((t) => (
        <Tip key={t.key} content={t.hint} as="div">
          <label className="toggle">
            <input type="checkbox" checked={s[t.key]} onChange={(e) => set({ [t.key]: e.target.checked } as Partial<Settings>)} />
            {t.label}
          </label>
        </Tip>
      ))}

      {fullscreenSupported() && (
        <label className="toggle">
          <input type="checkbox" checked={fullscreen} onChange={(e) => void setFullscreen(e.target.checked)} />
          Pantalla completa
          {isDesktopApp() && <span className="kbd">F11</span>}
        </label>
      )}
    </div>
  );
}
