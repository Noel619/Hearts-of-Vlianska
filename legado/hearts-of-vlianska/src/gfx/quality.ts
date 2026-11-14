// Calidad del dibujo del mapa (Ajustes → Vídeo y rendimiento).

export interface MapQuality {
  /** Luces animadas: faroles, hogueras y parpadeo. Sin ellas, un halo fijo por estación. */
  lights: boolean;
  /** Densidad de partículas (humo, brasas, polvo, trazadoras): 0 = ninguna, 1 = todas. */
  particles: number;
  /** Raíles, traviesas, tuberías y cables de luces en los túneles. */
  tunnelDetail: boolean;
  /** Grano, viñeta, ciudad de superficie, río animado y sombras suaves. */
  postfx: boolean;
}

export const FULL_QUALITY: MapQuality = { lights: true, particles: 1, tunnelDetail: true, postfx: true };
