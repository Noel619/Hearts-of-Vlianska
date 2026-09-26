import type { IdeologyDef, IdeologyId, ModifierKey } from '../game/types';

export const IDEOLOGIES: Record<IdeologyId, IdeologyDef> = {
  democracia: {
    id: 'democracia',
    name: 'Democracia',
    adjective: 'democrático',
    color: '#5b95d6',
    desc: 'Consejos cívicos elegidos por los habitantes de cada estación. Estables, pero lentos para ir a la guerra.',
    modifiers: { estabilidad: 0.05, justificacion: 0.3 },
    canJustifyAtTension: 0.5,
  },
  comunismo: {
    id: 'comunismo',
    name: 'Comunismo',
    adjective: 'comunista',
    color: '#c8342b',
    desc: 'El poder para los consejos obreros y la revolución exportada al resto del metro.',
    modifiers: { apoyoGuerra: 0.05, manoObra: 0.05 },
    canJustifyAtTension: 0.25,
  },
  autocracia: {
    id: 'autocracia',
    name: 'Autocracia',
    adjective: 'autocrático',
    color: '#9a9180',
    desc: 'Juntas militares, gobiernos de emergencia y hombres fuertes. Orden por encima de todo.',
    modifiers: { ppDiario: 0.2 },
    canJustifyAtTension: 0,
  },
  nacionalismo: {
    id: 'nacionalismo',
    name: 'Ultranacionalismo',
    adjective: 'ultranacionalista',
    color: '#8a6232',
    desc: 'La vieja Rusia renacerá bajo tierra. Un solo pueblo, un solo líder, un solo metro.',
    modifiers: { apoyoGuerra: 0.1, justificacion: -0.25 },
    canJustifyAtTension: 0,
  },
  oligarquia: {
    id: 'oligarquia',
    name: 'Oligarquía mercantil',
    adjective: 'mercantil',
    color: '#d9a932',
    desc: 'Gobiernan los que tienen más cartuchos. Todo tiene un precio, incluida la paz.',
    modifiers: { produccionCivil: 0.05 },
    canJustifyAtTension: 0.35,
  },
  teocracia: {
    id: 'teocracia',
    name: 'Teocracia',
    adjective: 'teocrático',
    color: '#27a07d',
    desc: 'La fe como ley. Sus fieles resisten lo que ningún otro soportaría.',
    modifiers: { apoyoGuerra: 0.1, estabilidad: 0.05, investigacion: -0.1 },
    canJustifyAtTension: 0,
  },
  anarquia: {
    id: 'anarquia',
    name: 'Anarquía',
    adjective: 'anarquista',
    color: '#e0662f',
    desc: 'Sin amos ni leyes. Solo la banda, el botín y la oscuridad de los túneles.',
    modifiers: { apoyoGuerra: 0.05, estabilidad: -0.1, ataqueAuxiliar: 0.1 },
    canJustifyAtTension: 0,
  },
};

export const IDEOLOGY_IDS = Object.keys(IDEOLOGIES) as IdeologyId[];

export const POP_KEYS: Record<IdeologyId, ModifierKey> = {
  democracia: 'popDemocracia',
  comunismo: 'popComunismo',
  autocracia: 'popAutocracia',
  nacionalismo: 'popNacionalismo',
  oligarquia: 'popOligarquia',
  teocracia: 'popTeocracia',
  anarquia: 'popAnarquia',
};
