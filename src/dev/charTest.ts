// Escena de prueba de personajes para el visor (?view&chars).
import * as THREE from 'three';
import { DEFAULT_LOOK, HAIR_COLORS, SKIN_TONES, type Look } from '../data/looks';
import { HumanView } from '../render/chars/humanView';
import type { AnimInput } from '../render/chars/anim';
import type { LightField } from '../world/lights';

interface Case {
  look: Partial<Look>;
  weapon?: string;
  back?: string;
  anim?: Partial<AnimInput>;
  attackLoop?: boolean;
}

const L = (o: Partial<Look>): Partial<Look> => o;

export const TEST_CASES: Case[] = [
  { look: L({ top: 'guerrera', topColor: 0x2f4263, pantsColor: 0x232a38, hat: 'casco', hatColor: 0x3a4a66, vest: 0x1e2430, pouches: true, armband: 0x2f62d8 }), weapon: 'ak', anim: { hold: 'fusil', work: 'guardia' } },
  { look: L({ top: 'chaqueton', topColor: 0x4a5a3a, pantsColor: 0x3a3f2e, hat: 'ushanka', hatColor: 0x4a4436, armband: 0x3f8f3a, facial: 'barba3', build: 0.5 }), weapon: 'fusilTunel', anim: { hold: 'fusil', aim: 1 } },
  { look: L({ top: 'chaqueton', topColor: 0x6a5238, pantsColor: 0x3c3a34, hat: 'gorra', hatColor: 0x7a2a24, armband: 0xb3202c, facial: 'bigote' }), weapon: 'cerrojo', anim: { hold: 'fusil', speed: 1.4 } },
  { look: L({ top: 'abrigo', topColor: 0x5a4632, pantsColor: 0x2e2a26, scarf: 0xe39b2d, hat: 'ushanka', hatColor: 0x3a2e24, glasses: true, age: 2, facial: 'barba', build: 0.8 }), anim: { work: 'hablar' } },
  { look: L({ top: 'cuero', topColor: 0x2e2622, pantsColor: 0x3a342c, hat: 'panuelo', hatColor: 0xe8572a, mask: 'panuelo', scarf: 0x8a3a1c, shoulderPads: 0x3a3a3a, bandolier: true, eyepatch: true }), weapon: 'machete', anim: { hold: 'una' }, attackLoop: true },
  { look: L({ top: 'guerrera', topColor: 0x5a5066, pantsColor: 0x3a3440, hat: 'plato', hatColor: 0x4a3f5a, medals: true, facial: 'bigote', age: 2 }), weapon: 'pistola', anim: { hold: 'pistola', aim: 1 } },
  { look: L({ top: 'tunica', topColor: 0xd8d2bc, pantsColor: 0x6a6456, hat: 'kufi', hatColor: 0xe8e4d8, facial: 'barbaLarga', skin: SKIN_TONES[3], hairColor: HAIR_COLORS[0] }), anim: { pose: 'arrodillado', work: 'rezar' } },
  { look: L({ top: 'tunica', topColor: 0x1f6e58, pantsColor: 0x3a3a34, hat: 'panuelo', hatColor: 0x1f9e7a, mask: 'panuelo', scarf: 0x1f9e7a, vest: 0x3a3428, skin: SKIN_TONES[2] }), weapon: 'lanza', anim: { hold: 'dos' }, attackLoop: true },
  { look: L({ top: 'mono', topColor: 0x6a5f44, pantsColor: 0x6a5f44, hat: 'capucha', hatColor: 0x4a4a3c, mask: 'antigas', backpack: 0x4a4636, gloves: 0x1a1a1a, kneePads: 0x2a2a2a }), weapon: 'escopeta', anim: { hold: 'pistola', speed: 4.6 } },
  { look: L({ top: 'abrigo', topColor: 0xd8d8d0, pantsColor: 0x4a4a48, female: true, hair: 'mono', hairColor: HAIR_COLORS[2], mask: 'respirador', build: -0.4, height: 0.94 }), anim: { pose: 'arrodillado', work: 'vendar' } },
  { look: L({ top: 'harapos', topColor: 0x6a5c4c, pantsColor: 0x4a4238, hair: 'largo', facial: 'barba', build: -0.6, age: 2 }), anim: { pose: 'sentadoSuelo', work: 'calentarse' } },
  { look: L({ top: 'camisa', topColor: 0x8a8272, pantsColor: 0x3a4250, female: true, hair: 'largo', hairColor: HAIR_COLORS[5], height: 0.95, build: -0.3 }), weapon: 'guitarra', anim: { pose: 'sentado', work: 'guitarra' } },
  { look: L({ top: 'mono', topColor: 0x3d5674, pantsColor: 0x3d5674, hat: 'gorra', hatColor: 0x2a2a2a, gloves: 0x5a4a30, build: 0.6 }), weapon: 'martillo', anim: { work: 'martillo' } },
  { look: L({ top: 'traje', topColor: 0x2a2c34, pantsColor: 0x24262c, glasses: true, hair: 'corto', hairColor: HAIR_COLORS[4], age: 2 }), anim: { pose: 'ko' } },
  { look: L({ top: 'chaqueton', topColor: 0x54584a, pantsColor: 0x2e3030, hat: 'pasamontanas', hatColor: 0x1e1e1e, vest: 0x2e3326, vestPlates: true, pouches: true, backpack: 0x3a3c30, kneePads: 0x222222, gloves: 0x111111 }), weapon: 'carabina', back: 'pala', anim: { hold: 'fusil', sneak: true, speed: 1.0 } },
  { look: L({ top: 'cuero', topColor: 0x4a3626, pantsColor: 0x35302a, hat: 'boina', hatColor: 0x5a1e1a, female: true, hair: 'corto', hairColor: HAIR_COLORS[0], scar: true }), weapon: 'hacha', anim: { hold: 'dos' }, attackLoop: true },
];

export function addCharTest(scene: THREE.Scene, field: LightField, cx: number, cz: number, y: number, yaw: number) {
  const views: { v: HumanView; c: Case; t: number }[] = [];
  const cols = 8;
  TEST_CASES.forEach((c, i) => {
    const look: Look = { ...DEFAULT_LOOK, seed: i * 17 + 3, ...c.look };
    const v = new HumanView(look);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const lx = (col - (cols - 1) / 2) * 1.5;
    const lz = row * 2.4 - 1.2;
    // Ejes de pantalla: derecha y hacia la cámara
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const x = cx + rx * lx + fx * lz;
    const z = cz + rz * lx + fz * lz;
    // Mirando a la cámara
    v.place(x, y, z, Math.atan2(fz, fx));
    v.aimYaw = Math.atan2(fz, fx);
    Object.assign(v.input, c.anim ?? {});
    v.setWeapon(c.weapon ?? null);
    v.setBack(c.back ?? null);
    scene.add(v.group);
    views.push({ v, c, t: i * 0.37 });
  });
  const out = new Float32Array(6);
  const key = new THREE.PointLight(0xffd2a0, 60, 26, 1.6);
  key.position.set(cx + Math.sin(yaw) * 6, y + 5, cz + Math.cos(yaw) * 6);
  scene.add(key);
  return (dt: number) => {
    for (const e of views) {
      e.t += dt;
      const inp = e.v.input;
      if (e.c.attackLoop) {
        const cyc = e.t % 1.6;
        if (cyc < 0.95) {
          inp.attack = inp.hold === 'dos' ? (Math.floor(e.t / 1.6) % 2 ? 'golpe' : 'estocada') : Math.floor(e.t / 1.6) % 2 ? 'tajo' : 'estocada';
          inp.attackT = cyc / 0.95;
        } else inp.attack = null;
      }
      if (inp.aim > 0) {
        const cyc = e.t % 1.2;
        inp.sinceFire = cyc;
      }
      const p = e.v.group.position;
      field.sample(p.x, p.y + 1.2, p.z, 0, 1, 0, false, out);
      e.v.setProbe(out[0], out[1], out[2], out[3], out[4], out[5]);
      e.v.update(dt);
    }
  };
}
