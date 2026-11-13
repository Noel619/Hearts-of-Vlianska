// Los sprites y las empuñaduras cubren todo el catálogo de objetos.
import { describe, expect, it } from 'vitest';
import { ITEM_LIST } from '../src/data/items';
import { heldGrip, hasHeld } from '../src/render/kit/weapons';
import { UI_SPRITES } from '../src/ui/sprites/icons';
import { ITEM_SPRITES } from '../src/ui/sprites/items';

describe('sprites', () => {
  it('cada objeto tiene su propio sprite', () => {
    const missing = ITEM_LIST.filter((d) => !ITEM_SPRITES[d.id]).map((d) => d.id);
    expect(missing).toEqual([]);
    expect(ITEM_SPRITES.cartucho).toBeTruthy();
  });

  it('los sprites son SVG bien formado y no se repiten', () => {
    const seen = new Set<string>();
    for (const [id, body] of [...Object.entries(ITEM_SPRITES), ...Object.entries(UI_SPRITES)]) {
      expect(body.length, id).toBeGreaterThan(40);
      expect(body.includes('NaN') || body.includes('undefined'), id).toBe(false);
      expect((body.match(/<g /g) ?? []).length, id).toBe((body.match(/<\/g>/g) ?? []).length);
      expect(seen.has(body), id).toBe(false);
      seen.add(body);
    }
  });
});

describe('empuñaduras', () => {
  it('toda arma tiene modelo y las de dos manos dicen dónde va la mano de apoyo', () => {
    for (const d of ITEM_LIST) {
      if (!d.weapon) continue;
      expect(hasHeld(d.model ?? ''), d.id).toBe(true);
      const g = heldGrip(d.model!);
      expect(g, d.id).toBeTruthy();
      const gun = !!d.weapon.ranged;
      expect(g!.gun, d.id).toBe(gun);
      if (d.weapon.hold === 'fusil' || d.weapon.hold === 'dos') expect(g!.off, d.id).toBeTruthy();
      if (d.weapon.hold === 'fusil') expect(g!.stock, d.id).toBeGreaterThan(0.2);
    }
  });
});
