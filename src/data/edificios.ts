// Lo que el jugador puede construir, las recetas de cada taller y el árbol
// de investigación. Los nombres de las técnicas son los de la historia.

import type { SkillId } from './skills';
import type { PropLight } from '../world/props';

export type BuildCat = 'Refugio' | 'Supervivencia' | 'Almacén' | 'Industria' | 'Defensa' | 'Luz';

export interface BuildDef {
  id: string;
  name: string;
  desc: string;
  cat: BuildCat;
  /** Huella: medio largo (X local) y medio fondo (Z local). */
  hx: number;
  hz: number;
  tall?: boolean;
  /** Portón: lo cruzan los tuyos. */
  gate?: boolean;
  /** No bloquea el paso (alfombras, sacos de dormir). */
  flat?: boolean;
  cost: [string, number][];
  /** Trabajo de obra (segundos con ingeniería 0). */
  work: number;
  hp: number;
  tech?: string;
  /** Pieza del kit que lo representa y su variante. */
  prop: string;
  variant?: number;
  beds?: number;
  /** Multiplicador de curación de sus camas. */
  heal?: number;
  /** Capacidad de almacén (kg). */
  store?: number;
  light?: PropLight;
  /** Consumo (+) o producción (-) de energía. */
  power?: number;
  recipes?: string[];
  skill?: SkillId;
  anim?: 'martillo' | 'operar' | 'cocinar' | 'rebuscar' | 'escribir' | 'pico';
  /** Cultivo: lo que da, cuánto, cada cuánto (s) y qué consume por ciclo. */
  farm?: { out: [string, number][]; time: number; needs?: [string, number][] };
  /** Produce sin atención (colector de agua). */
  passive?: { out: [string, number]; time: number };
  research?: boolean;
  slow?: boolean;
  /** Atrae caravanas. */
  trade?: boolean;
  radio?: boolean;
}

const B: BuildDef[] = [
  // --- Refugio
  { id: 'saco', name: 'Jergón', desc: 'Mantas sobre el suelo. Dormir cura más deprisa.', cat: 'Refugio', hx: 0.95, hz: 0.45, flat: true, cost: [['tela', 3]], work: 8, hp: 20, prop: 'cama', variant: 1, beds: 1, heal: 1 },
  { id: 'tiendaJ', name: 'Tienda de campaña', desc: 'Lona y palos: dos camas a cubierto.', cat: 'Refugio', hx: 1.45, hz: 1.2, tall: true, cost: [['tela', 8], ['tablones', 4]], work: 30, hp: 60, prop: 'tienda', beds: 2, heal: 1.3 },
  { id: 'barraconJ', name: 'Barracón', desc: 'Chapa y tablones. Cuatro literas y sitio para guardar cosas.', cat: 'Refugio', hx: 1.9, hz: 1.5, tall: true, cost: [['chatarra', 20], ['tablones', 12], ['piezas', 6]], work: 90, hp: 220, tech: 'construccion', prop: 'barracon', beds: 4, heal: 1.5, store: 60 },
  { id: 'camillaJ', name: 'Camilla médica', desc: 'Una cama limpia y un gotero: los heridos se recuperan mucho antes.', cat: 'Refugio', hx: 1.0, hz: 0.45, cost: [['tela', 6], ['piezas', 4], ['tablones', 4]], work: 40, hp: 40, tech: 'medicina1', prop: 'camilla', beds: 1, heal: 2.6 },
  { id: 'hogueraJ', name: 'Hoguera', desc: 'Luz, calor y un sitio donde asar carne.', cat: 'Refugio', hx: 0.62, hz: 0.62, cost: [['chatarra', 2], ['tablones', 3]], work: 10, hp: 30, prop: 'hoguera', light: { color: 0xff8a3c, intensity: 1.25, radius: 14, y: 0.7, flicker: 1, kind: 'fire' }, recipes: ['asar'], skill: 'cocina', anim: 'cocinar' },
  // --- Supervivencia
  { id: 'bancalJ', name: 'Bancal de hongos', desc: 'Cajones de tierra y estiércol. Cada ciclo da hongos; necesita agua.', cat: 'Supervivencia', hx: 1.5, hz: 0.6, cost: [['tablones', 6], ['chatarra', 4]], work: 35, hp: 40, prop: 'bancal', skill: 'cultivo', anim: 'rebuscar', farm: { out: [['hongos', 7]], time: 420, needs: [['agua', 1]] } },
  { id: 'corralJ', name: 'Corral de cerdos', desc: 'Comen de todo y se reproducen rápido. Dan carne y cuero.', cat: 'Supervivencia', hx: 2.0, hz: 1.5, cost: [['tablones', 10], ['chatarra', 6]], work: 60, hp: 80, tech: 'cerdos', prop: 'corral', skill: 'cultivo', anim: 'rebuscar', farm: { out: [['carne', 5], ['cuero', 1]], time: 900, needs: [['hongos', 4]] } },
  { id: 'colectorJ', name: 'Colector de filtraciones', desc: 'Recoge y filtra el agua que rezuma de la bóveda.', cat: 'Supervivencia', hx: 1.1, hz: 1.1, tall: true, cost: [['chatarra', 8], ['tela', 2], ['piezas', 2]], work: 45, hp: 80, prop: 'deposito', store: 40, passive: { out: ['agua', 1], time: 110 } },
  { id: 'cocinaJ', name: 'Cocina de campaña', desc: 'Una estufa de bidón y una olla: comida caliente.', cat: 'Supervivencia', hx: 0.5, hz: 0.5, cost: [['chatarra', 10], ['piezas', 4]], work: 40, hp: 60, prop: 'olla', light: { color: 0xff8a3c, intensity: 0.6, radius: 9, y: 0.4, flicker: 1, kind: 'fire' }, recipes: ['guiso', 'asar', 'secar', 'te'], skill: 'cocina', anim: 'cocinar' },
  { id: 'hidroJ', name: 'Cultivo hidropónico', desc: 'Lámparas y agua con nutrientes: el doble de comida en el mismo sitio. Necesita energía.', cat: 'Supervivencia', hx: 1.4, hz: 0.5, tall: true, cost: [['piezas', 10], ['componentes', 4], ['acero', 2]], work: 90, hp: 60, tech: 'hidroponia', prop: 'hidroponico', power: 2, skill: 'cultivo', anim: 'rebuscar', farm: { out: [['hongos', 16]], time: 420, needs: [['agua', 2]] }, light: { color: 0xd070ff, intensity: 0.5, radius: 8, y: 1.6, kind: 'glow' } },
  // --- Almacén
  { id: 'cajonJ', name: 'Cajones de almacenaje', desc: 'Donde tu gente deja y coge los materiales.', cat: 'Almacén', hx: 1.0, hz: 0.75, tall: true, cost: [['tablones', 6], ['piezas', 2]], work: 25, hp: 100, prop: 'cajas', variant: 1, store: 220 },
  { id: 'estanteJ', name: 'Estantería', desc: 'Más sitio para guardar cosas pequeñas.', cat: 'Almacén', hx: 0.9, hz: 0.25, tall: true, cost: [['tablones', 5], ['chatarra', 3]], work: 20, hp: 50, prop: 'estanteria', store: 90 },
  { id: 'puestoJ', name: 'Puesto de comercio', desc: 'Un mostrador a la vista: las caravanas que pasen pararán a comerciar.', cat: 'Almacén', hx: 1.3, hz: 0.75, cost: [['tablones', 10], ['tela', 6]], work: 50, hp: 60, prop: 'puesto', variant: 1, trade: true },
  // --- Industria
  { id: 'desguaceJ', name: 'Mesa de desguace', desc: 'Convierte la chatarra en piezas aprovechables.', cat: 'Industria', hx: 0.95, hz: 0.42, cost: [['tablones', 6], ['chatarra', 6]], work: 35, hp: 60, prop: 'bancoTrabajo', variant: 0, recipes: ['piezas', 'tablonesR'], skill: 'chatarreria', anim: 'martillo' },
  { id: 'investJ', name: 'Mesa de estudio', desc: 'Libros, planos y una lámpara. Aquí se investiga.', cat: 'Industria', hx: 0.7, hz: 0.4, cost: [['tablones', 8], ['piezas', 4]], work: 40, hp: 40, prop: 'mesa', variant: 1, research: true, skill: 'ciencia', anim: 'escribir', light: { color: 0xffd9a0, intensity: 0.4, radius: 6, y: 1.1 } },
  { id: 'fraguaJ', name: 'Fragua', desc: 'Funde raíles y chatarra en planchas de acero.', cat: 'Industria', hx: 0.8, hz: 0.7, cost: [['chatarra', 20], ['piezas', 8]], work: 80, hp: 150, tech: 'fundicion', prop: 'fragua', recipes: ['acero'], skill: 'armeria', anim: 'martillo', light: { color: 0xff6a20, intensity: 0.8, radius: 9, y: 0.9, flicker: 1, kind: 'fire' } },
  { id: 'armeroJ', name: 'Banco de armero', desc: 'Tornillo, limas y paciencia: armas y blindajes.', cat: 'Industria', hx: 0.95, hz: 0.42, cost: [['tablones', 8], ['piezas', 10], ['acero', 2]], work: 70, hp: 80, tech: 'armas1', prop: 'bancoTrabajo', variant: 1, recipes: ['cuchillo', 'machete', 'lanza', 'fusilTunel', 'escopeta', 'neumatico', 'carabina', 'casco', 'chalecoPlacas', 'petoCuero', 'chaleco', 'mochila'], skill: 'armeria', anim: 'martillo' },
  { id: 'prensaJ', name: 'Prensa de munición', desc: 'Casquillos recuperados, pólvora y plomo fundido.', cat: 'Industria', hx: 0.95, hz: 0.42, cost: [['piezas', 10], ['acero', 1], ['tablones', 4]], work: 60, hp: 60, tech: 'municion', prop: 'bancoTrabajo', variant: 2, recipes: ['balas', 'cartuchosEscopeta'], skill: 'armeria', anim: 'operar' },
  { id: 'laboJ', name: 'Laboratorio', desc: 'Matraces, ácido de batería y mucho cuidado.', cat: 'Industria', hx: 0.95, hz: 0.42, cost: [['piezas', 8], ['componentes', 2], ['tablones', 6]], work: 70, hp: 50, tech: 'quimica', prop: 'bancoTrabajo', variant: 2, recipes: ['polvora', 'vendas', 'botiquin', 'antibioticos', 'filtros', 'mascaraGas'], skill: 'medicina', anim: 'operar' },
  { id: 'alambiqueJ', name: 'Alambique', desc: 'Destila samogón… y con otra receta, combustible.', cat: 'Industria', hx: 1.1, hz: 1.1, tall: true, cost: [['chatarra', 14], ['piezas', 8], ['acero', 1]], work: 80, hp: 80, tech: 'destilacion', prop: 'deposito', variant: 1, recipes: ['combustible', 'samogon'], skill: 'cocina', anim: 'operar' },
  { id: 'generadorJ', name: 'Generador', desc: 'Un diésel restaurado. Da energía mientras tenga combustible.', cat: 'Industria', hx: 0.85, hz: 0.5, cost: [['piezas', 12], ['componentes', 4], ['acero', 2]], work: 100, hp: 120, tech: 'generadores', prop: 'generador', power: -8, store: 20 },
  { id: 'radioJ', name: 'Emisora de radio', desc: 'Una antena hasta la superficie y una pregunta: ¿queda alguien ahí fuera?', cat: 'Industria', hx: 0.7, hz: 0.4, cost: [['componentes', 10], ['radioPiezas', 2], ['acero', 4]], work: 160, hp: 50, tech: 'radio', prop: 'radio', power: 3, radio: true, skill: 'ciencia', anim: 'operar' },
  // --- Defensa
  { id: 'sacosJ', name: 'Parapeto de sacos', desc: 'Sacos terreros hasta el pecho.', cat: 'Defensa', hx: 1.15, hz: 0.38, cost: [['tela', 4], ['chatarra', 2]], work: 20, hp: 150, prop: 'sacos' },
  { id: 'muroJ', name: 'Muro de chapa', desc: 'Planchas soldadas sobre un armazón. Corta el paso y las balas.', cat: 'Defensa', hx: 1.5, hz: 0.25, tall: true, cost: [['chatarra', 10], ['piezas', 3]], work: 45, hp: 400, tech: 'construccion', prop: 'muroChapa' },
  { id: 'portonJ', name: 'Portón', desc: 'Tu gente lo cruza; los demás tendrán que echarlo abajo.', cat: 'Defensa', hx: 1.5, hz: 0.3, tall: true, gate: true, cost: [['chatarra', 14], ['piezas', 8], ['tablones', 6]], work: 70, hp: 500, tech: 'construccion', prop: 'portonChapa' },
  { id: 'alambradaJ', name: 'Alambrada', desc: 'Caballos de Frisia con espino. Frena a quien la cruza.', cat: 'Defensa', hx: 1.3, hz: 0.5, slow: true, cost: [['chatarra', 6], ['piezas', 2]], work: 25, hp: 80, prop: 'alambrada' },
  // --- Luz
  { id: 'bidonJ', name: 'Bidón de fuego', desc: 'Luz y calor sin cables.', cat: 'Luz', hx: 0.42, hz: 0.42, cost: [['chatarra', 4], ['tablones', 2]], work: 12, hp: 60, prop: 'bidonFuego', light: { color: 0xff8a3c, intensity: 1.0, radius: 12, y: 1.15, flicker: 1, kind: 'fire' } },
  { id: 'farolaJ', name: 'Farola', desc: 'Dos focos en un poste. Necesita energía.', cat: 'Luz', hx: 0.2, hz: 0.2, cost: [['chatarra', 4], ['componentes', 1]], work: 25, hp: 40, tech: 'generadores', prop: 'farola', power: 1, light: { color: 0xffd9a0, intensity: 1.15, radius: 17, y: 3.3 } },
  { id: 'focoJ', name: 'Proyector', desc: 'Un foco potente sobre trípode. Nada se acerca sin ser visto.', cat: 'Luz', hx: 0.5, hz: 0.5, cost: [['piezas', 6], ['componentes', 3]], work: 35, hp: 40, tech: 'generadores', prop: 'foco', power: 2, light: { color: 0xcfe4ff, intensity: 1.6, radius: 24, y: 2.4, kind: 'spot' } },
];

export const BUILDS: Record<string, BuildDef> = Object.fromEntries(B.map((b) => [b.id, b]));
export const BUILD_LIST = B;
export const BUILD_CATS: BuildCat[] = ['Refugio', 'Supervivencia', 'Almacén', 'Industria', 'Defensa', 'Luz'];

// --- Recetas ------------------------------------------------------------------

export interface Recipe {
  id: string;
  name: string;
  in: [string, number][];
  out: [string, number];
  /** Segundos de trabajo con habilidad 0. */
  time: number;
  tech?: string;
}

const R: Recipe[] = [
  { id: 'piezas', name: 'Piezas metálicas', in: [['chatarra', 3]], out: ['piezas', 1], time: 14 },
  { id: 'tablonesR', name: 'Tablones (de traviesas)', in: [['chatarra', 2]], out: ['tablones', 1], time: 12 },
  { id: 'acero', name: 'Plancha de acero', in: [['chatarra', 6], ['combustible', 1]], out: ['acero', 2], time: 40 },
  { id: 'asar', name: 'Carne asada', in: [['carne', 1]], out: ['carneAsada', 1], time: 10 },
  { id: 'guiso', name: 'Guiso de hongos', in: [['hongos', 2], ['agua', 1]], out: ['guiso', 1], time: 16 },
  { id: 'secar', name: 'Hongos secos', in: [['hongos', 2]], out: ['hongosSecos', 2], time: 14 },
  { id: 'te', name: 'Té de hongos', in: [['hongos', 1], ['agua', 1]], out: ['te', 2], time: 8 },
  { id: 'balas', name: 'Munición recargada', in: [['piezas', 1], ['polvora', 1]], out: ['balas', 14], time: 20 },
  { id: 'cartuchosEscopeta', name: 'Cartuchos de escopeta', in: [['piezas', 1], ['polvora', 1]], out: ['cartuchosEscopeta', 6], time: 20 },
  { id: 'polvora', name: 'Pólvora', in: [['salitre', 2]], out: ['polvora', 1], time: 24 },
  { id: 'vendas', name: 'Vendas', in: [['tela', 1]], out: ['vendas', 2], time: 10, tech: 'medicina1' },
  { id: 'botiquin', name: 'Botiquín', in: [['tela', 2], ['samogon', 1]], out: ['botiquin', 1], time: 30, tech: 'medicina1' },
  { id: 'antibioticos', name: 'Antibióticos', in: [['hongos', 6], ['agua', 2]], out: ['antibioticos', 1], time: 70, tech: 'antibioticos' },
  { id: 'filtros', name: 'Filtros de máscara', in: [['tela', 1], ['chatarra', 1]], out: ['filtros', 2], time: 18, tech: 'mascaras' },
  { id: 'mascaraGas', name: 'Máscara antigás', in: [['cuero', 2], ['piezas', 2], ['filtros', 1]], out: ['mascaraGas', 1], time: 60, tech: 'mascaras' },
  { id: 'combustible', name: 'Combustible', in: [['carne', 2], ['hongos', 2]], out: ['combustible', 1], time: 36 },
  { id: 'samogon', name: 'Samogón', in: [['hongos', 3], ['agua', 1]], out: ['samogon', 1], time: 30 },
  { id: 'cuchillo', name: 'Cuchillo', in: [['piezas', 2]], out: ['cuchillo', 1], time: 25 },
  { id: 'machete', name: 'Machete', in: [['acero', 1], ['piezas', 1]], out: ['machete', 1], time: 45 },
  { id: 'lanza', name: 'Lanza de bayoneta', in: [['piezas', 3], ['tablones', 1]], out: ['lanza', 1], time: 35 },
  { id: 'fusilTunel', name: 'Fusil del túnel', in: [['acero', 2], ['piezas', 6], ['tablones', 1]], out: ['fusilTunel', 1], time: 120 },
  { id: 'escopeta', name: 'Recortada', in: [['acero', 2], ['piezas', 4], ['tablones', 1]], out: ['escopeta', 1], time: 100 },
  { id: 'neumatico', name: 'Fusil neumático', in: [['acero', 2], ['piezas', 8], ['componentes', 1]], out: ['neumatico', 1], time: 160, tech: 'neumaticas' },
  { id: 'carabina', name: 'Carabina de grado militar', in: [['acero', 5], ['piezas', 12], ['componentes', 2]], out: ['carabina', 1], time: 300, tech: 'armas2' },
  { id: 'casco', name: 'Casco de acero', in: [['acero', 2], ['cuero', 1]], out: ['casco', 1], time: 70, tech: 'blindaje' },
  { id: 'chalecoPlacas', name: 'Chaleco de placas', in: [['acero', 4], ['tela', 3], ['cuero', 2]], out: ['chalecoPlacas', 1], time: 150, tech: 'blindaje' },
  { id: 'petoCuero', name: 'Peto de cuero', in: [['cuero', 5], ['piezas', 1]], out: ['petoCuero', 1], time: 80 },
  { id: 'chaleco', name: 'Chaleco de carga', in: [['tela', 5], ['piezas', 1]], out: ['chaleco', 1], time: 50 },
  { id: 'mochila', name: 'Mochila', in: [['tela', 4], ['cuero', 1]], out: ['mochila', 1], time: 45 },
];
export const RECIPES: Record<string, Recipe> = Object.fromEntries(R.map((r) => [r.id, r]));

// --- Investigación ---------------------------------------------------------------

export interface TechDef {
  id: string;
  name: string;
  desc: string;
  /** Puntos de estudio necesarios. */
  cost: number;
  /** Libros o planos que se consumen al empezar. */
  needs?: [string, number][];
  req?: string[];
}

const T: TechDef[] = [
  { id: 'construccion', name: 'Técnicas de construcción', desc: 'Andamios, poleas y cuadrillas organizadas. Permite barracones, muros y portones.', cost: 220 },
  { id: 'hongos2', name: 'Hongos seleccionados', desc: 'Variedades más grandes y resistentes: los bancales rinden la mitad más.', cost: 300 },
  { id: 'cerdos', name: 'Cría de cerdos', desc: 'Cerdos del metro: comen de todo y se reproducen rápido.', cost: 420, req: ['hongos2'] },
  { id: 'agua', name: 'Purificación de agua', desc: 'Filtros de arena y carbón: los colectores dan el doble.', cost: 320 },
  { id: 'medicina1', name: 'Medicina de campaña', desc: 'Antisépticos, suturas y cirugía básica. Camillas, vendas y botiquines.', cost: 340, needs: [['libros', 1]] },
  { id: 'antibioticos', name: 'Antibióticos caseros', desc: 'Cultivos de moho convertidos en medicina.', cost: 900, needs: [['libros', 2]], req: ['medicina1', 'quimica'] },
  { id: 'fundicion', name: 'Fundición de metales', desc: 'Hornos que funden raíles viejos en lingotes. Permite la fragua.', cost: 520 },
  { id: 'herramientas', name: 'Herramientas mejoradas', desc: 'Llaves, limas y tornillos de verdad: se trabaja un cuarto más rápido.', cost: 640, req: ['fundicion'] },
  { id: 'municion', name: 'Munición recargada', desc: 'Casquillos recuperados, pólvora casera y balas fundidas en moldes.', cost: 420 },
  { id: 'quimica', name: 'Química de la pólvora', desc: 'Nitratos de los criaderos y ácidos de las baterías. Permite el laboratorio.', cost: 620, needs: [['libros', 1]], req: ['municion'] },
  { id: 'destilacion', name: 'Destilación de combustible', desc: 'Alambiques que convierten aceites y grasas en diésel.', cost: 520 },
  { id: 'generadores', name: 'Generadores de emergencia', desc: 'Electricidad estable: generador, farolas y proyectores.', cost: 760, needs: [['planos', 1]], req: ['destilacion'] },
  { id: 'hidroponia', name: 'Hidroponía', desc: 'Cultivos bajo lámparas, sin tierra.', cost: 950, needs: [['libros', 2]], req: ['generadores', 'hongos2'] },
  { id: 'armas1', name: 'Fusil del túnel', desc: 'Un diseño propio: corto, robusto y fácil de fabricar con chatarra. Permite el banco de armero.', cost: 640, req: ['fundicion'] },
  { id: 'armas2', name: 'Carabina de grado militar', desc: 'Cañones rectificados y munición de calidad.', cost: 1900, needs: [['planos', 2]], req: ['armas1', 'herramientas'] },
  { id: 'neumaticas', name: 'Armas neumáticas', desc: 'Rifles de aire comprimido: silenciosos y sin gastar pólvora.', cost: 820, needs: [['planos', 1]], req: ['armas1'] },
  { id: 'blindaje', name: 'Escudos balísticos', desc: 'Placas de blindaje de vagón convertidas en cascos y chalecos.', cost: 820, req: ['fundicion'] },
  { id: 'mascaras', name: 'Máscaras antigás y filtros', desc: 'Filtros fabricados en serie. Los túneles contaminados dejan de ser una sentencia.', cost: 700, req: ['quimica'] },
  { id: 'excavacion', name: 'Excavación de túneles', desc: 'Permite despejar derrumbes y abrir galerías tapiadas.', cost: 1000, needs: [['planos', 1]], req: ['construccion', 'herramientas'] },
  { id: 'mando', name: 'Estructura de mando', desc: 'Oficiales y suboficiales: tu escuadra puede crecer hasta veinte personas.', cost: 800 },
  { id: 'radio', name: 'Radio de onda corta', desc: 'Una emisora capaz de llegar más allá de Vlianska.', cost: 1600, needs: [['planos', 2]], req: ['generadores'] },
];
export const TECHS: Record<string, TechDef> = Object.fromEntries(T.map((t) => [t.id, t]));
export const TECH_LIST = T;
