/**
 * CosmosOrbit.ts - Orbit math shared by planets, orbit lines and the camera.
 */

export type OrbitConfig = {
  seed: number;
  inclination: number;
  eccentricity: number;
  phase: number;
};

export function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getOrbitConfig(domainId: string): OrbitConfig {
  const seed = hashString(domainId);
  return {
    seed,
    inclination: (((seed % 18) - 9) * Math.PI) / 180,
    eccentricity: 0.82 + ((seed >> 3) % 16) / 100,
    phase: ((seed >> 8) % 628) / 100,
  };
}

/** Ground-plane direction the overview camera looks along (shared with the camera). */
export const SYSTEM_VIEW_AZIMUTH = Math.atan2(16, 30);
const VIEW_AXIS_X = Math.sin(SYSTEM_VIEW_AZIMUTH);
const VIEW_AXIS_Z = Math.cos(SYSTEM_VIEW_AZIMUTH);

export function getOrbitPosition(
  angle: number,
  orbitRadius: number,
  orbitConfig: OrbitConfig,
  stretch = 1
): [number, number, number] {
  let x = Math.cos(angle) * orbitRadius;
  let z = Math.sin(angle) * orbitRadius * orbitConfig.eccentricity;
  const y =
    Math.sin(angle + orbitConfig.phase) *
    orbitRadius *
    Math.sin(orbitConfig.inclination) *
    0.22;
  if (stretch !== 1) {
    const along = x * VIEW_AXIS_X + z * VIEW_AXIS_Z;
    x += (stretch - 1) * along * VIEW_AXIS_X;
    z += (stretch - 1) * along * VIEW_AXIS_Z;
  }
  return [x, y, z];
}

export function getPlanetObliquity(domainId: string): [number, number, number] {
  const seed = hashString(`${domainId}:obliquity`);
  const tiltX = (((seed % 28) + 5) * Math.PI) / 180;
  const tiltZ = ((((seed >> 5) % 18) - 9) * Math.PI) / 180;
  return [tiltX, 0, tiltZ];
}

/** Offset into noise space so every world gets its own continents. */
export function getNoiseSeedOffset(domainId: string): [number, number, number] {
  const seed = hashString(`${domainId}:terrain`);
  return [((seed % 97) / 97) * 40 + 3, (((seed >> 7) % 89) / 89) * 40 + 3, (((seed >> 14) % 83) / 83) * 40 + 3];
}

export interface OrbitLayout {
  /** Orbit radius multiplier. */
  scale: number;
  /** Stretch along the overview camera's viewing direction. */
  stretch: number;
}

/**
 * A round system only fills the width of a portrait phone. There the orbits
 * move closer together and stretch towards the camera, so the (steeper)
 * overview turns them into tall ellipses that use the screen height.
 */
export function getOrbitLayout(width: number, height: number): OrbitLayout {
  if (width <= 0 || height <= 0) return { scale: 1, stretch: 1 };
  const aspect = width / height;
  if (aspect >= 1.1) return { scale: 1, stretch: 1 };
  const t = Math.min(1, (1.1 - aspect) / 0.5);
  return { scale: 1 - t * 0.28, stretch: 1 + t * 0.65 };
}
