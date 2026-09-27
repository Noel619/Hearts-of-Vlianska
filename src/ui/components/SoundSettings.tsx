// Controles de sonido: volúmenes por canal y silencio general.
import { useSyncExternalStore } from 'react';
import { audio } from '../../audio';
import { store, useVersion, type Settings } from '../store';
import { Icon } from './core';

const CHANNELS: { key: keyof Pick<Settings, 'volMaster' | 'volMusic' | 'volAmbience' | 'volSfx'>; label: string; icon: string }[] = [
  { key: 'volMaster', label: 'Volumen general', icon: 'Volume2' },
  { key: 'volMusic', label: 'Música', icon: 'Radio' },
  { key: 'volAmbience', label: 'Ambiente del metro', icon: 'Wind' },
  { key: 'volSfx', label: 'Efectos', icon: 'Zap' },
];

export function useAudioUnlocked() {
  return useSyncExternalStore(
    (fn) => audio.onChange(fn),
    () => audio.unlocked,
  );
}

export function SoundSettings() {
  useVersion();
  const s = store.settings;
  return (
    <div className="sound-settings">
      <div className="tt-sub">Volumen</div>
      {CHANNELS.map((c) => (
        <label key={c.key} className="slider-row">
          <Icon name={c.icon} size={16} className="amber" />
          <span>{c.label}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s[c.key]}
            disabled={s.muted}
            onChange={(e) => store.updateSettings({ [c.key]: Number(e.target.value) } as Partial<Settings>)}
            onPointerUp={() => audio.play('confirm')}
            aria-label={c.label}
          />
          <span className="num dim">{Math.round(s[c.key] * 100)}</span>
        </label>
      ))}
      <label className="toggle">
        <input type="checkbox" checked={s.muted} onChange={(e) => store.updateSettings({ muted: e.target.checked })} />
        Silenciar todo (tecla <span className="kbd">M</span>)
      </label>
    </div>
  );
}

/** Botón de silencio para la barra superior y el menú. */
export function MuteButton({ className }: { className?: string }) {
  useVersion();
  const muted = store.settings.muted;
  return (
    <button
      className={`btn icon ghost ${className ?? ''}`}
      onClick={() => {
        audio.unlock();
        store.updateSettings({ muted: !muted });
      }}
      aria-label={muted ? 'Activar el sonido' : 'Silenciar'}
      title={muted ? 'Activar el sonido (M)' : 'Silenciar (M)'}
    >
      <Icon name={muted ? 'VolumeX' : 'Volume2'} size={20} />
    </button>
  );
}
