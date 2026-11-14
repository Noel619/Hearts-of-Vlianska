import { describe, expect, it } from 'vitest';
import { FrameLimiter, PRESET_IDS, VIDEO_PRESETS, currentPreset, mapQuality } from '../src/ui/video';

describe('vídeo y rendimiento', () => {
  it('reconoce cada preajuste y detecta los valores personalizados', () => {
    for (const id of PRESET_IDS) expect(currentPreset({ ...VIDEO_PRESETS[id].values, showFps: true })).toBe(id);
    expect(currentPreset({ ...VIDEO_PRESETS.alta.values, particles: 0, showFps: false })).toBeNull();
  });

  it('los preajustes van de menos a más calidad', () => {
    const [baja, media, alta] = PRESET_IDS.map((id) => VIDEO_PRESETS[id].values);
    expect(baja.resolution).toBeLessThan(media.resolution);
    expect(media.resolution).toBeLessThan(alta.resolution);
    expect(baja.particles).toBeLessThan(media.particles);
    expect(media.particles).toBeLessThan(alta.particles);
    expect(mapQuality(baja)).toEqual({ lights: false, particles: 0, tunnelDetail: false, postfx: false });
  });

  it('el límite de fotogramas descarta los sobrantes', () => {
    const count = (fps: number, hz: number) => {
      const limiter = new FrameLimiter();
      let drawn = 0;
      for (let i = 0; i < hz * 4; i++) if (limiter.ready((i * 1000) / hz, fps)) drawn++;
      return drawn / 4;
    };
    expect(count(0, 60)).toBe(60);
    expect(count(60, 60)).toBe(60);
    expect(count(30, 60)).toBe(30);
    expect(count(60, 144)).toBeCloseTo(60, -1);
    expect(count(30, 144)).toBeCloseTo(30, -1);
  });
});
