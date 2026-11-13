// Teclas configurables: intercambio sin dejar acciones huérfanas, teclas
// reservadas, guardado tolerante a datos rotos y nombres legibles.
import { afterEach, describe, expect, it } from 'vitest';
import { KEY_ACTIONS, actionFor, keyFor, keyLabel, keyProblem, keysCustomized, loadKeys, resetKeys, setKey, withKeys } from '../src/game/keys';

afterEach(() => resetKeys());

describe('teclas', () => {
  it('empiezan siendo las de siempre, sin repetirse', () => {
    resetKeys();
    expect(keysCustomized()).toBe(false);
    const codes = KEY_ACTIONS.map((a) => keyFor(a.id));
    expect(new Set(codes).size).toBe(codes.length);
    expect(actionFor('KeyM')).toBe('mapa');
    expect(actionFor('Space')).toBe('pausa');
  });

  it('una tecla libre se asigna sin más', () => {
    expect(setKey('mapa', 'KeyN')).toBeNull();
    expect(keyFor('mapa')).toBe('KeyN');
    expect(actionFor('KeyN')).toBe('mapa');
    expect(actionFor('KeyM')).toBeNull();
    expect(keysCustomized()).toBe(true);
  });

  it('una tecla ocupada se intercambia: ninguna acción se queda sin tecla', () => {
    const swapped = setKey('mapa', 'KeyB');
    expect(swapped).toBe('construir');
    expect(keyFor('mapa')).toBe('KeyB');
    expect(keyFor('construir')).toBe('KeyM');
    for (const a of KEY_ACTIONS) expect(keyFor(a.id), a.id).toBeTruthy();
  });

  it('Esc y las teclas de modificador no se pueden asignar', () => {
    expect(keyProblem('Escape')).toMatch(/Esc/);
    expect(keyProblem('ShiftLeft')).toBeTruthy();
    expect(setKey('pausa', 'Escape')).toBeNull();
    expect(keyFor('pausa')).toBe('Space');
  });

  it('un guardado roto o con choques se arregla al cargar', () => {
    loadKeys('{esto no es json');
    expect(keysCustomized()).toBe(false);
    // Acción desconocida, tecla reservada y dos acciones con la misma tecla
    loadKeys(JSON.stringify({ volar: 'KeyV', pausa: 'Escape', mapa: 'KeyN', hilos: 'KeyN' }));
    expect(keyFor('pausa')).toBe('Space');
    const codes = KEY_ACTIONS.map((a) => keyFor(a.id));
    expect(new Set(codes).size).toBe(codes.length);
    expect(keyFor('hilos')).toBe('KeyN');
  });

  it('las teclas se nombran como en el teclado', () => {
    expect(keyLabel('KeyB')).toBe('B');
    expect(keyLabel('Digit3')).toBe('3');
    expect(keyLabel('Space')).toBe('Espacio');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('F5')).toBe('F5');
    setKey('construir', 'KeyU');
    expect(withKeys('Pulsa {tecla:construir} para construir')).toBe('Pulsa U para construir');
  });
});
