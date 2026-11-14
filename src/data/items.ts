// Objetos del juego: recursos, comida, medicina, munición, armas, armaduras y
// objetos de la historia. Los precios base están en cartuchos de grado militar.

import { GAS_DENSE } from './gases';
import type { Hat, Look, Mask } from './looks';

export type ItemKind = 'recurso' | 'comida' | 'medicina' | 'municion' | 'arma' | 'armadura' | 'herramienta' | 'varios' | 'clave';
export type WeaponClass = 'filo' | 'contundente' | 'asta' | 'pistola' | 'fusil' | 'escopeta' | 'pesada';
export type ArmorSlot = 'cabeza' | 'cara' | 'torso' | 'manos' | 'piernas' | 'pies' | 'mochila';
export type EquipSlot = 'arma' | 'arma2' | ArmorSlot | 'luz';

/** Todos los huecos de ropa y armadura, de la cabeza a los pies. */
export const ARMOR_SLOTS: readonly ArmorSlot[] = ['cabeza', 'cara', 'torso', 'manos', 'piernas', 'pies', 'mochila'];

export interface WeaponDef {
  cls: WeaponClass;
  /** Cómo se sujeta (animación). */
  hold: 'una' | 'dos' | 'fusil' | 'pistola';
  /** Daño: corte, contusión y perforación. */
  cut: number;
  blunt: number;
  pierce: number;
  /** Alcance cuerpo a cuerpo (m). */
  reach: number;
  /** Duración de un ataque (s). */
  speed: number;
  /** Solo armas de fuego. */
  ranged?: {
    ammo: 'balas' | 'cartuchosEscopeta' | 'aire';
    range: number;
    /** Dispersión base (radianes); menos es mejor. */
    spread: number;
    /** Segundos entre disparos. */
    rof: number;
    mag: number;
    reload: number;
    /** Radio al que se oye el disparo (m). */
    noise: number;
    pellets?: number;
  };
  /** Bonificación a la defensa (parada). */
  parry: number;
}

export interface ArmorDef {
  slot: ArmorSlot;
  /** Partes del cuerpo cubiertas: 0 cabeza, 1 pecho, 2 abdomen, 3-4 brazos, 5-6 piernas. */
  cover: number[];
  cut: number;
  blunt: number;
  pierce: number;
  /** Cambios de aspecto al llevarla. */
  look?: Partial<Look>;
  /**
   * Máscara con filtro: densidad de gas (0..1) que deja fuera por completo
   * mientras el filtro puesto aguante. La antigás, todo; el respirador, el
   * gas ligero (del denso deja pasar lo que sobra).
   */
  filter?: number;
  /** Capacidad de carga adicional (kg). */
  carry?: number;
  /** Penalización al sigilo y a la esquiva (0..1). */
  bulk?: number;
  /** Botas: más (o menos) velocidad al correr (fracción). */
  speed?: number;
  /** Botas: pisada silenciosa, ayuda al sigilo (0..1). */
  quiet?: number;
  /** Guantes: trabajo de manos más rápido (o más lento) en obras y talleres (fracción). */
  work?: number;
  /** Guantes: mejor agarre, puntos de ataque cuerpo a cuerpo. */
  grip?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  kind: ItemKind;
  /** Peso por unidad (kg). */
  w: number;
  /** Precio base. */
  price: number;
  /** Tamaño máximo de la pila. */
  stack: number;
  /** Modelo 3D (id del kit de armas/objetos). */
  model?: string;
  /** Color del icono si no tiene modelo propio. */
  tint?: number;
  weapon?: WeaponDef;
  armor?: ArmorDef;
  /** Nutrición que aporta. */
  food?: number;
  /** Curación: puntos por uso y si corta la hemorragia. */
  med?: { heal: number; bleed: boolean; skill: number };
  /** Fuente de luz en la mano o en la cabeza. */
  light?: boolean;
  /** Bonificaciones de herramienta. */
  tool?: { skill: string; bonus: number };
  /** Robado o ilegal en ciertas estaciones. */
  contraband?: boolean;
  /** Comida que se estropea: días que aguanta fresca (sin esto, no se pudre). */
  spoil?: number;
  /** Prótesis: el miembro que sustituye. */
  pros?: 'brazo' | 'pierna';
  /** Material con que se repara (si no, se deduce de la clase de objeto). */
  fix?: string;
}

const D: ItemDef[] = [];
const add = (d: ItemDef) => D.push(d);
const res = (id: string, name: string, desc: string, w: number, price: number, tint: number, stack = 50) => add({ id, name, desc, kind: 'recurso', w, price, stack, tint });

// --- Recursos ---------------------------------------------------------------
res('chatarra', 'Chatarra', 'Hierros, cables y piezas rotas. La materia prima del metro.', 1.2, 2, 0x7a5a40);
res('piezas', 'Piezas metálicas', 'Tornillos, muelles y chapas enderezadas, listas para usar.', 0.8, 7, 0x8a8f96);
res('acero', 'Planchas de acero', 'Raíles fundidos y laminados. Para armas, blindajes y estructuras.', 2.5, 22, 0x5b6066, 30);
res('tablones', 'Tablones', 'Madera de traviesas y de palés.', 1.5, 4, 0x8a6a44);
res('tela', 'Tela', 'Lona, mantas y ropa vieja.', 0.4, 6, 0x9a8c6a);
res('cuero', 'Cuero', 'Piel curtida de cerdo… o de algo peor.', 0.6, 12, 0x5a3d28);
res('componentes', 'Componentes eléctricos', 'Bobinas, válvulas y cable de cobre rescatados de la superficie.', 0.3, 28, 0x9a5a34, 30);
res('salitre', 'Salitre', 'Costras blancas de las paredes húmedas y de los corrales. Base de la pólvora.', 0.5, 5, 0xd8d4c4);
res('polvora', 'Pólvora', 'Pólvora casera. Mejor no fumar cerca.', 0.4, 16, 0x2a2a2a);
res('combustible', 'Combustible', 'Diésel destilado de aceites y grasas.', 1.0, 14, 0x6a5a1a, 30);
res('agua', 'Agua limpia', 'Filtrada con arena y carbón.', 1.0, 2, 0x4a8ab0, 30);
res('filtros', 'Filtros de máscara', 'Sin filtro, una máscara antigás es solo una careta.', 0.2, 18, 0x4a5236, 20);
res('libros', 'Libros de antes', 'Química, mecánica, medicina. El saber de un mundo muerto.', 0.6, 60, 0x7a3a2a, 10);
res('planos', 'Planos técnicos', 'Planos de ingeniería del metro y de sus máquinas.', 0.1, 140, 0x3a5a8a, 10);

// --- Comida -------------------------------------------------------------------
// `spoil`: días que aguanta fresca. Lo seco, lo ahumado, las latas y el aguardiente no se pudren.
const food = (id: string, name: string, desc: string, w: number, price: number, nutrition: number, tint: number, spoil?: number) => add({ id, name, desc, kind: 'comida', w, price, stack: 30, food: nutrition, tint, spoil });
food('hongos', 'Hongos', 'La base de la dieta del metro. Crudos saben a tierra. Frescos, se estropean en unos días: se secan para guardarlos.', 0.25, 3, 14, 0xc9b9a0, 4);
food('hongosSecos', 'Hongos secos', 'Duran meses. Saben a cartón.', 0.12, 5, 16, 0x9a8a6a, 60);
food('carne', 'Carne cruda', 'De cerdo, de rata… no preguntes. Se pudre enseguida si no se asa o se ahúma.', 0.5, 6, 12, 0x9a3a34, 2);
food('carneAsada', 'Carne asada', 'Caliente y con grasa. Un lujo.', 0.4, 12, 38, 0x7a4a2a, 3);
food('guiso', 'Guiso de hongos', 'Hongos, grasa de cerdo y lo que hubiera. Llena.', 0.5, 14, 50, 0x8a6a3a, 2.5);
food('conserva', 'Conserva de antes', 'Una lata sin etiqueta de 2012. Sigue buena.', 0.4, 30, 60, 0x8a8f96);
food('te', 'Té de hongos', 'Calienta las manos y engaña al estómago.', 0.3, 4, 6, 0x6a5a2a, 2);
food('cecina', 'Carne ahumada', 'Tiras de carne curadas al humo con salitre. Duras como suela, pero aguantan semanas.', 0.3, 15, 30, 0x5a2a1a, 30);
add({ id: 'samogon', name: 'Samogón', desc: 'Aguardiente de alambique. Se bebe, se vende y desinfecta.', kind: 'comida', w: 0.5, price: 16, stack: 20, food: 4, tint: 0xb8c8c0 });
add({ id: 'podrido', name: 'Comida podrida', desc: 'Lo que queda cuando nadie se lo come a tiempo. No se come, pero los cerdos no le hacen ascos.', kind: 'varios', w: 0.3, price: 0, stack: 50, tint: 0x4a4a28 });

// --- Medicina -------------------------------------------------------------------
add({ id: 'vendas', name: 'Vendas', desc: 'Tela hervida. Cortan la hemorragia.', kind: 'medicina', w: 0.1, price: 8, stack: 30, med: { heal: 6, bleed: true, skill: 0 }, tint: 0xe8e4d8 });
add({ id: 'botiquin', name: 'Botiquín', desc: 'Antiséptico, sutura y morfina. Medicina de verdad.', kind: 'medicina', w: 0.5, price: 55, stack: 10, med: { heal: 30, bleed: true, skill: 15 }, model: 'botiquin' });
add({ id: 'antibioticos', name: 'Antibióticos', desc: 'Moho cultivado en el hospital de Nadezhdy.', kind: 'medicina', w: 0.1, price: 90, stack: 10, med: { heal: 45, bleed: false, skill: 25 }, tint: 0x9ad0a0 });
add({ id: 'protesisBrazo', name: 'Brazo ortopédico', desc: 'Tubo de acero, un muelle y una garra de tres dedos, sujetos al muñón con correas. Agarra un arma, aunque peor que una mano.', kind: 'medicina', w: 2.4, price: 260, stack: 1, pros: 'brazo', fix: 'piezas', tint: 0x8a8f96 });
add({ id: 'protesisPierna', name: 'Pierna ortopédica', desc: 'Un tubo con rodillera y un taco de goma por pie. Se anda y hasta se corre, cojeando.', kind: 'medicina', w: 3.2, price: 220, stack: 1, pros: 'pierna', fix: 'piezas', tint: 0x8a8f96 });

// --- Munición -------------------------------------------------------------------
add({ id: 'balas', name: 'Munición recargada', desc: 'Casquillos recuperados y pólvora casera. Para disparar, no para pagar.', kind: 'municion', w: 0.012, price: 1, stack: 300, tint: 0xa98a3c });
add({ id: 'cartuchosEscopeta', name: 'Cartuchos de escopeta', desc: 'Cartón, perdigones y fe.', kind: 'municion', w: 0.04, price: 2, stack: 100, tint: 0x9a2a22 });

// --- Armas -----------------------------------------------------------------------
const melee = (id: string, name: string, desc: string, cls: WeaponClass, hold: 'una' | 'dos', cut: number, blunt: number, pierce: number, reach: number, speed: number, parry: number, w: number, price: number) =>
  add({ id, name, desc, kind: 'arma', w, price, stack: 1, model: id, weapon: { cls, hold, cut, blunt, pierce, reach, speed, parry } });
melee('cuchillo', 'Cuchillo', 'Corto, rápido y silencioso.', 'filo', 'una', 16, 0, 6, 1.3, 0.75, 0, 0.3, 18);
melee('machete', 'Machete', 'Hoja de ballesta de camión afilada.', 'filo', 'una', 26, 4, 0, 1.6, 0.95, 4, 0.9, 45);
melee('hacha', 'Hacha de bombero', 'Abre puertas y cráneos.', 'filo', 'dos', 34, 12, 0, 1.75, 1.25, 2, 2.2, 70);
melee('tubo', 'Tubo de plomo', 'El arma de quien no tiene otra.', 'contundente', 'una', 0, 18, 0, 1.55, 0.95, 3, 1.4, 6);
melee('llave', 'Llave inglesa', 'Aprieta tuercas y afloja dientes.', 'contundente', 'una', 0, 15, 0, 1.4, 0.85, 2, 1.0, 12);
melee('maza', 'Maza', 'Lenta. Lo que toca, lo rompe.', 'contundente', 'dos', 0, 42, 0, 1.8, 1.5, 0, 5.0, 60);
melee('pala', 'Pala de zapador', 'Cava, corta y golpea.', 'contundente', 'una', 10, 14, 0, 1.55, 0.95, 4, 1.1, 22);
melee('lanza', 'Lanza de bayoneta', 'Una bayoneta atada a un tubo: mantiene las garras lejos.', 'asta', 'dos', 6, 4, 26, 2.4, 1.1, 5, 1.6, 30);
melee('palanca', 'Palanca', 'Para desguazar vagones. También sirve de arma.', 'contundente', 'una', 0, 16, 4, 1.5, 0.95, 3, 1.5, 15);

const gun = (
  id: string,
  name: string,
  desc: string,
  cls: WeaponClass,
  hold: 'fusil' | 'pistola',
  pierce: number,
  r: NonNullable<WeaponDef['ranged']>,
  w: number,
  price: number,
  blunt = 8,
) => add({ id, name, desc, kind: 'arma', w, price, stack: 1, model: id, weapon: { cls, hold, cut: 0, blunt, pierce, reach: 1.3, speed: 1.0, parry: 0, ranged: r } });
gun('pistola', 'Pistola', 'Una Makárov con más años que su dueño.', 'pistola', 'pistola', 24, { ammo: 'balas', range: 22, spread: 0.06, rof: 0.55, mag: 8, reload: 2.2, noise: 55 }, 0.8, 120, 5);
gun('subfusil', 'Subfusil de taller', 'Un tubo, un muelle y mala puntería. Escupe plomo.', 'pistola', 'fusil', 16, { ammo: 'balas', range: 20, spread: 0.09, rof: 0.18, mag: 25, reload: 2.8, noise: 60 }, 2.6, 210, 7);
gun('escopeta', 'Recortada', 'Dos cañones, dos respuestas.', 'escopeta', 'pistola', 13, { ammo: 'cartuchosEscopeta', range: 13, spread: 0.14, rof: 0.8, mag: 2, reload: 2.6, noise: 70, pellets: 6 }, 2.4, 160);
gun('fusilTunel', 'Fusil del túnel', 'Corto, robusto y fácil de fabricar con chatarra.', 'fusil', 'fusil', 30, { ammo: 'balas', range: 30, spread: 0.05, rof: 0.85, mag: 8, reload: 2.6, noise: 65 }, 3.4, 180, 12);
gun('cerrojo', 'Fusil de cerrojo', 'De los abuelos. Lento, largo y certero.', 'fusil', 'fusil', 44, { ammo: 'balas', range: 46, spread: 0.022, rof: 1.6, mag: 5, reload: 3.6, noise: 75 }, 4.0, 320, 14);
gun('ak', 'Kalashnikov restaurado', 'Limpiado y reparado pieza a pieza. Nunca falla.', 'fusil', 'fusil', 30, { ammo: 'balas', range: 36, spread: 0.05, rof: 0.36, mag: 30, reload: 2.6, noise: 75 }, 3.6, 520, 12);
gun('carabina', 'Carabina de grado militar', 'Cañón rectificado y mira. Lo mejor que ha visto el metro desde 2013.', 'fusil', 'fusil', 40, { ammo: 'balas', range: 52, spread: 0.016, rof: 0.5, mag: 20, reload: 2.8, noise: 75 }, 3.8, 950, 12);
gun('neumatico', 'Fusil neumático', 'Aire comprimido y bolas de acero: silencioso y sin pólvora.', 'fusil', 'fusil', 26, { ammo: 'aire', range: 24, spread: 0.04, rof: 1.1, mag: 12, reload: 5, noise: 8 }, 3.2, 380, 9);
gun('ametralladora', 'Ametralladora', 'Rescatada de un arsenal de la defensa civil. Nadie cruza un túnel recto bajo su fuego.', 'pesada', 'fusil', 34, { ammo: 'balas', range: 44, spread: 0.07, rof: 0.11, mag: 100, reload: 6.5, noise: 90 }, 9.5, 1400, 14);

// --- Herramientas -------------------------------------------------------------------
add({ id: 'pico', name: 'Pico', desc: 'Para abrir derrumbes y arrancar chatarra.', kind: 'herramienta', w: 3, price: 40, stack: 1, model: 'pico', tool: { skill: 'chatarreria', bonus: 0.3 }, weapon: { cls: 'contundente', hold: 'dos', cut: 0, blunt: 20, pierce: 14, reach: 1.7, speed: 1.4, parry: 0 } });
add({ id: 'martillo', name: 'Martillo y herramientas', desc: 'Martillo, alicates y un puñado de clavos.', kind: 'herramienta', w: 1.5, price: 30, stack: 1, model: 'martillo', tool: { skill: 'ingenieria', bonus: 0.25 } });
add({ id: 'ganzuas', name: 'Ganzúas', desc: 'Alambres doblados con paciencia.', kind: 'herramienta', w: 0.1, price: 35, stack: 1, tint: 0x8a8f96, tool: { skill: 'cerraduras', bonus: 0.3 } });
add({ id: 'linterna', name: 'Linterna frontal', desc: 'Una luz en la frente: ves, y te ven.', kind: 'herramienta', w: 0.3, price: 40, stack: 1, light: true, tint: 0xffd9a0 });
add({ id: 'farol', name: 'Farol de queroseno', desc: 'Luz cálida en todas direcciones.', kind: 'herramienta', w: 0.9, price: 25, stack: 1, light: true, model: 'farol' });

// --- Armaduras y equipo -------------------------------------------------------------------
const armor = (id: string, name: string, desc: string, a: ArmorDef, w: number, price: number, tint = 0x555555) => add({ id, name, desc, kind: 'armadura', w, price, stack: 1, armor: a, tint });
armor('ushanka', 'Ushanka', 'Gorro de piel con orejeras. Abriga más que protege.', { slot: 'cabeza', cover: [0], cut: 0.1, blunt: 0.12, pierce: 0.02, look: { hat: 'ushanka' as Hat, hatColor: 0x4a4436 } }, 0.4, 20, 0x4a4436);
armor('casco', 'Casco de acero', 'Un casco del ejército soviético. Pesa, pero para la metralla.', { slot: 'cabeza', cover: [0], cut: 0.5, blunt: 0.4, pierce: 0.35, look: { hat: 'casco' as Hat, hatColor: 0x4a5236 }, bulk: 0.03 }, 1.3, 110, 0x4a5236);
armor('pasamontanas', 'Pasamontañas', 'Nadie te ve la cara. Eso a veces conviene.', { slot: 'cabeza', cover: [0], cut: 0.08, blunt: 0.05, pierce: 0, look: { hat: 'pasamontanas' as Hat, hatColor: 0x1e1e1e } }, 0.1, 15, 0x1e1e1e);
armor('mascaraGas', 'Máscara antigás', 'Goma, cristales y un filtro. En los túneles con gas es vida o muerte.', { slot: 'cara', cover: [0], cut: 0.06, blunt: 0.06, pierce: 0, look: { mask: 'antigas' as Mask }, filter: 1 }, 0.8, 130, 0x2a2c2a);
armor('respirador', 'Respirador', 'Media máscara con dos filtros. Aguanta el polvo y algo de gas.', { slot: 'cara', cover: [0], cut: 0.02, blunt: 0.02, pierce: 0, look: { mask: 'respirador' as Mask }, filter: GAS_DENSE }, 0.4, 70, 0x3a3a3a);
armor('chaleco', 'Chaleco de carga', 'Lona gruesa con bolsillos. Para una paliza, no una bala.', { slot: 'torso', cover: [1, 2], cut: 0.25, blunt: 0.15, pierce: 0.08, look: { vest: 0x3a3c30, pouches: true } }, 1.5, 80, 0x3a3c30);
armor('chalecoPlacas', 'Chaleco de placas', 'Planchas de vagón cosidas a un chaleco. Para balas… a veces.', { slot: 'torso', cover: [1, 2], cut: 0.6, blunt: 0.4, pierce: 0.5, look: { vest: 0x2e3326, vestPlates: true, pouches: true }, bulk: 0.12 }, 7.5, 420, 0x2e3326);
armor('petoCuero', 'Peto de cuero', 'Cuero de cerdo endurecido con hombreras de neumático.', { slot: 'torso', cover: [1, 2, 3, 4], cut: 0.38, blunt: 0.25, pierce: 0.12, look: { vest: 0x3a2a1e, shoulderPads: 0x1e1e1e }, bulk: 0.04 }, 3.0, 150, 0x3a2a1e);
// Manos, piernas y pies
armor('guantes', 'Guantes de trabajo', 'Lona con la palma de cuero. Las manos duran más y trabajan más deprisa.', { slot: 'manos', cover: [3, 4], cut: 0.06, blunt: 0.05, pierce: 0, look: { gloves: 0x5a4a30 }, work: 0.08 }, 0.2, 18, 0x5a4a30);
armor('guantesCuero', 'Guantes de cuero', 'Cuero de cerdo cosido a mano: el arma no resbala.', { slot: 'manos', cover: [3, 4], cut: 0.16, blunt: 0.12, pierce: 0.03, look: { gloves: 0x2a1c12 }, grip: 3 }, 0.4, 55, 0x2a1c12);
armor('manoplas', 'Guanteletes de chapa', 'Láminas remachadas sobre cuero. Paran un machetazo; atornillar con ellos, no tanto.', { slot: 'manos', cover: [3, 4], cut: 0.4, blunt: 0.28, pierce: 0.18, look: { gloves: 0x4a4f52 }, bulk: 0.03, work: -0.12 }, 1.4, 150, 0x4a4f52);
armor('pantalonGuata', 'Pantalón de guata', 'Acolchado de algodón del ejército. Abriga y amortigua algún golpe.', { slot: 'piernas', cover: [5, 6], cut: 0.12, blunt: 0.15, pierce: 0.03, look: { pantsColor: 0x3d4234 } }, 1.1, 35, 0x3d4234);
armor('perneras', 'Perneras de cuero', 'Cuero endurecido con rodilleras de neumático.', { slot: 'piernas', cover: [5, 6], cut: 0.32, blunt: 0.2, pierce: 0.08, look: { pantsColor: 0x3a2a1e, kneePads: 0x1e1e1e }, bulk: 0.02 }, 2.2, 95, 0x3a2a1e);
armor('grebas', 'Grebas de chapa', 'Chapa de vagón doblada sobre los muslos y las espinillas. Pesan como un muerto.', { slot: 'piernas', cover: [5, 6], cut: 0.55, blunt: 0.38, pierce: 0.36, look: { pantsColor: 0x2e3326, kneePads: 0x4a4f52 }, bulk: 0.06 }, 5.2, 280, 0x4a4f52);
armor('botas', 'Botas de trabajo', 'Suela gruesa y puntera de acero: se corre mejor por las traviesas.', { slot: 'pies', cover: [5, 6], cut: 0.05, blunt: 0.07, pierce: 0.02, look: { bootsColor: 0x3a2a1c }, speed: 0.04 }, 1.2, 40, 0x3a2a1c);
armor('botasMilitares', 'Botas militares', 'Cuero y caña alta de 2012. Las mejores para correr.', { slot: 'pies', cover: [5, 6], cut: 0.1, blunt: 0.1, pierce: 0.04, look: { bootsColor: 0x16130f }, speed: 0.08 }, 1.5, 120, 0x16130f);
armor('valenki', 'Botas de fieltro', 'Fieltro prensado: abrigan y no hacen ruido al pisar.', { slot: 'pies', cover: [5, 6], cut: 0.03, blunt: 0.06, pierce: 0, look: { bootsColor: 0x6a6458 }, quiet: 0.35 }, 0.9, 60, 0x6a6458);
armor('mochila', 'Mochila', 'Lona y correas. Caben muchas cosas.', { slot: 'mochila', cover: [], cut: 0, blunt: 0, pierce: 0, look: { backpack: 0x4a4636 }, carry: 25 }, 1.0, 60, 0x4a4636);
armor('mochilaGrande', 'Mochila de stalker', 'Armazón de aluminio: media casa a la espalda.', { slot: 'mochila', cover: [], cut: 0, blunt: 0, pierce: 0, look: { backpack: 0x3d4a3a }, carry: 50, bulk: 0.06 }, 2.2, 190, 0x3d4a3a);

// --- Historia ---------------------------------------------------------------------------
add({ id: 'cartaBessmertny', name: 'Carta con el tridente verde', desc: 'Una carta lacrada de Dimitry Bessmertny para Vadim Volkov. Nunca llegó a su destino.', kind: 'clave', w: 0.05, price: 0, stack: 1, tint: 0x3f8f3a });
add({ id: 'llaveAlmacen', name: 'Llave de la defensa civil', desc: 'Abre las puertas blindadas de los almacenes de Tenevskaya.', kind: 'clave', w: 0.1, price: 0, stack: 1, tint: 0xa98a3c });
add({ id: 'glandula', name: 'Glándula de skrebun', desc: 'Los médicos de Nadezhdy pagan bien por ellas.', kind: 'varios', w: 0.3, price: 35, stack: 20, tint: 0x7a9a4a });
add({ id: 'colmillo', name: 'Colmillos', desc: 'Trofeos de caza. Hay quien los compra.', kind: 'varios', w: 0.1, price: 9, stack: 50, tint: 0xcfc6ae });
add({ id: 'radioPiezas', name: 'Piezas de radio', desc: 'Lámparas y un cristal de cuarzo intactos.', kind: 'varios', w: 0.8, price: 220, stack: 5, tint: 0x9a5a34 });

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(D.map((d) => [d.id, d]));
export const ITEM_LIST = D;

/** Pila de objetos. */
export interface Stack {
  id: string;
  n: number;
  /** Balas en el cargador (armas de fuego). */
  mag?: number;
  /** Robado: no se puede vender donde se robó. */
  hot?: string;
  /** Máscaras: lo que le queda al filtro puesto (segundos de gas denso). */
  fil?: number;
  /** Calidad de armas, armaduras y prótesis (0 chatarra … 4 militar; sin dato, «de taller»). */
  q?: number;
  /** Estado de conservación (0 roto … 1 nuevo; sin dato, nuevo). */
  dur?: number;
  /** Frescura de la comida (0 podrida … 1 recién hecha; sin dato, fresca). */
  fresh?: number;
}

/** Estado propio de un objeto suelto (cargador, filtro, procedencia, calidad, desgaste, frescura) para que viaje con él. */
export function stackState(s: Stack): Partial<Stack> {
  const o: Partial<Stack> = {};
  if (s.mag !== undefined) o.mag = s.mag;
  if (s.hot !== undefined) o.hot = s.hot;
  if (s.fil !== undefined) o.fil = s.fil;
  if (s.q !== undefined) o.q = s.q;
  if (s.dur !== undefined) o.dur = s.dur;
  if (s.fresh !== undefined) o.fresh = s.fresh;
  return o;
}

export function stackWeight(s: Stack): number {
  return (ITEMS[s.id]?.w ?? 0) * s.n;
}

// --- Calidad y desgaste -------------------------------------------------------------

/** Grados de calidad, de lo hecho con restos a lo de fábrica militar. */
export const QUALITY_NAMES = ['Chatarra', 'Casera', 'De taller', 'Buena', 'Militar'] as const;
/** Calidad de lo que no la indica. */
export const QUALITY_DEFAULT = 2;
/** Rendimiento por calidad: daño de las armas, protección de las armaduras y fuerza de las prótesis. */
export const Q_POWER = [0.72, 0.86, 1, 1.12, 1.26];
/** Dispersión de los disparos por calidad (menos es mejor). */
export const Q_SPREAD = [1.4, 1.18, 1, 0.88, 0.76];
/** Precio por calidad. */
export const Q_PRICE = [0.42, 0.7, 1, 1.55, 2.4];
/** Lo que se desgasta por uso según la calidad: lo bueno aguanta más. */
export const Q_WEAR = [1.7, 1.3, 1, 0.78, 0.58];

/** ¿Tiene calidad y se desgasta? (armas, armaduras y prótesis) */
export function hasQuality(def: ItemDef | undefined): boolean {
  return !!def && (!!def.weapon || !!def.armor || !!def.pros);
}

export function qualityOf(s: Stack): number {
  return Math.max(0, Math.min(4, Math.round(s.q ?? QUALITY_DEFAULT)));
}

export function condOf(s: Stack): number {
  return Math.max(0, Math.min(1, s.dur ?? 1));
}

/** Lo que pierde un objeto gastado: nada hasta la mitad; roto, casi la mitad de su rendimiento. */
export function condFactor(dur: number): number {
  return dur >= 0.5 ? 1 : 0.55 + dur * 0.9;
}

/** Rendimiento de un objeto según su calidad y su estado (1 = uno de taller, nuevo). */
export function itemPower(s: Stack): number {
  return Q_POWER[qualityOf(s)] * condFactor(condOf(s));
}

/** Palabra para el estado de conservación. */
export function condWord(dur: number): string {
  if (dur <= 0) return 'Roto';
  if (dur < 0.25) return 'Destrozado';
  if (dur < 0.5) return 'Muy gastado';
  if (dur < 0.8) return 'Gastado';
  if (dur < 0.97) return 'Usado';
  return 'Nuevo';
}

/** Valor de una unidad según su calidad, su estado y su frescura. */
export function unitValue(s: Stack): number {
  const def = ITEMS[s.id];
  if (!def) return 0;
  let v = def.price;
  if (hasQuality(def)) v *= Q_PRICE[qualityOf(s)] * (0.3 + 0.7 * condOf(s));
  if (def.spoil && s.fresh !== undefined) v *= 0.4 + 0.6 * Math.max(0, s.fresh);
  return v;
}

/** Material con que se repara un objeto. */
export function repairMaterial(def: ItemDef): string {
  if (def.fix) return def.fix;
  const a = def.armor;
  if (a) {
    if (a.cut >= 0.38 || a.pierce >= 0.3) return 'piezas';
    if (a.cut >= 0.12 && a.slot !== 'cara') return 'cuero';
    return 'tela';
  }
  if (def.weapon?.cls === 'asta') return 'tablones';
  return 'piezas';
}

/** Palabra para la frescura de la comida. */
export function freshWord(f: number): string {
  if (f > 0.75) return 'Fresca';
  if (f > 0.4) return 'Pasable';
  if (f > 0.15) return 'Pasada';
  return 'A punto de pudrirse';
}
