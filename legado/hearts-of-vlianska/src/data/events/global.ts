// Eventos genéricos del metro y eventos diplomáticos.
import type { EventDef } from '../../game/types';

export const GLOBAL_EVENTS: EventDef[] = [
  // ------------------------------------------------------------------ Historia
  {
    id: 'gen_tunel_sur_abierto',
    title: 'El túnel sur, abierto',
    desc: 'Tras dos años sepultado, el túnel entre Mostovaya y Chernovodskaya vuelve a ser transitable. [FROM] ha retirado los escombros. Lo que venga por ese túnel puede ser comercio... o guerra.',
    picture: 'Pickaxe',
    triggeredOnly: true,
    news: true,
    options: [
      { name: 'Reforzad la guardia del túnel.', effects: [{ t: 'warSupport', v: 0.03 }], ai: 1 },
      { name: 'Enviad un emisario.', effects: [{ t: 'relation', target: 'FROM', v: 15 }], ai: 1 },
    ],
  },
  {
    id: 'gen_caravana_asaltada',
    title: 'Caravana asaltada',
    desc: 'Una de nuestras caravanas ha sido asaltada por [FROM]. Los supervivientes llegan heridos y sin mercancía.',
    picture: 'HandMetal',
    triggeredOnly: true,
    options: [
      { name: 'Esto no quedará así.', effects: [{ t: 'relation', target: 'FROM', v: -10 }, { t: 'warSupport', v: 0.02 }], ai: 1 },
      { name: 'Doblad las escoltas.', effects: [{ t: 'pp', v: -10 }], ai: 1 },
    ],
  },
  {
    id: 'gen_revuelta',
    title: 'Revuelta en [TARGET]',
    desc: 'Los habitantes de [TARGET] nunca aceptaron nuestro gobierno. Esta noche han levantado barricadas y ondean la vieja bandera de [FROM]. Nuestra guarnición espera órdenes.',
    picture: 'Flame',
    triggeredOnly: true,
    options: [
      {
        name: 'Aplastad la revuelta.',
        effects: [
          { t: 'pp', v: -30 },
          { t: 'stability', v: -0.03 },
          {
            t: 'random',
            chance: 0.65,
            then: [{ t: 'custom', id: 'aplastarRevuelta', desc: 'Mueren civiles y soldados, pero la estación sigue siendo nuestra.' }],
            else: [{ t: 'custom', id: 'liberarEstacion', desc: 'La represión fracasa: la estación se libera.' }],
          },
        ],
        available: { c: 'pp', min: 30 },
        ai: 2,
      },
      {
        name: 'Dejadlos marchar.',
        effects: [{ t: 'custom', id: 'liberarEstacion', desc: 'La estación se independiza y su antigua facción renace.' }],
        ai: 1,
      },
    ],
  },
  // ------------------------------------------------------------------ Diplomacia
  {
    id: 'diplo_justificacion',
    title: 'Vientos de guerra',
    desc: 'Nuestros espías informan de que [FROM] está preparando una guerra contra nosotros. Sus tropas se concentran cerca de nuestras fronteras.',
    picture: 'Siren',
    triggeredOnly: true,
    options: [
      { name: 'Preparad las defensas.', effects: [{ t: 'warSupport', v: 0.05 }], ai: 1 },
      { name: 'Buscaremos una salida diplomática.', effects: [{ t: 'relation', target: 'FROM', v: 5 }], ai: 1 },
    ],
  },
  {
    id: 'diplo_guerra_declarada',
    title: '¡Guerra!',
    desc: '[FROM] nos ha declarado la guerra. Sus tropas avanzan por los túneles. Que cada estación prepare sus barricadas.',
    picture: 'Swords',
    triggeredOnly: true,
    options: [{ name: '¡A las armas!', effects: [{ t: 'warSupport', v: 0.03 }], ai: 1 }],
  },
  {
    id: 'diplo_llamada_armas',
    title: 'Llamada a las armas',
    desc: 'Nuestro aliado [FROM] ha entrado en guerra contra [TARGET] y nos pide que cumplamos el pacto.',
    picture: 'Swords',
    triggeredOnly: true,
    options: [
      { name: 'Cumpliremos nuestra palabra.', effects: [{ t: 'custom', id: 'unirseGuerra', desc: 'Entras en la guerra junto a tu aliado.' }], ai: 2 },
      { name: 'Esta guerra no es nuestra.', effects: [{ t: 'relation', target: 'FROM', v: -30 }], ai: 1 },
    ],
  },
  {
    id: 'diplo_propuesta_paz',
    title: 'Propuesta de paz',
    desc: '[FROM] nos propone una paz blanca: cada uno se queda con lo que tenía antes de la guerra.',
    picture: 'Handshake',
    triggeredOnly: true,
    options: [
      { name: 'Aceptamos la paz.', effects: [{ t: 'whitePeace', target: 'FROM' }], ai: 1 },
      { name: 'La guerra continúa.', effects: [{ t: 'warSupport', v: 0.02 }], ai: 1 },
    ],
  },
  {
    id: 'diplo_invitacion_pacto',
    title: 'Propuesta de alianza',
    desc: '[FROM] nos propone una alianza militar: si uno es atacado, el otro acudirá en su defensa.',
    picture: 'Handshake',
    triggeredOnly: true,
    options: [
      { name: 'Aceptamos la alianza.', effects: [{ t: 'joinPact', target: 'FROM' }], available: { c: 'not', cond: { c: 'inPact' } }, ai: 1 },
      { name: 'Rechazamos la propuesta.', effects: [{ t: 'relation', target: 'FROM', v: -10 }], ai: 1 },
    ],
  },
  {
    id: 'diplo_propuesta_nap',
    title: 'Propuesta de no agresión',
    desc: '[FROM] nos propone un pacto de no agresión de dos años.',
    picture: 'Handshake',
    triggeredOnly: true,
    options: [
      { name: 'Firmamos.', effects: [{ t: 'nap', target: 'FROM', days: 730 }], ai: 1 },
      { name: 'No firmaremos nada.', effects: [{ t: 'relation', target: 'FROM', v: -10 }], ai: 1 },
    ],
  },
];
