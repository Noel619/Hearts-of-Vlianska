// Tipos básicos compartidos por los datos del juego.

/** Las ocho facciones del metro en 2033. */
export type FactionId = 'UNI' | 'SDR' | 'LEV' | 'STA' | 'VHL' | 'CHE' | 'CAL' | 'NOR';

/**
 * Bandos de la simulación: las ocho facciones de la historia más
 * JUG (la escuadra del jugador), LIB (gente libre: buhoneros, vagabundos,
 * refugiados) y MUT (las criaturas de los túneles).
 */
export type SideId = FactionId | 'JUG' | 'LIB' | 'MUT';

/** Tipos de túnel del plano original. */
export type Terrain = 'linea' | 'tunel' | 'peligroso' | 'auxiliar' | 'auxiliarPeligroso' | 'estrecho' | 'derrumbe';
