/**
 * CosmosShaders.ts - GPU shaders of the evolving Lernkosmos planets.
 *
 * Everything is computed per pixel from 3D noise on the unit sphere, so there
 * are no textures to download or bake on the CPU, no UV seams, and every
 * evolution feature (water level, life, lights, ...) is a uniform that can be
 * animated live while a planet grows.
 */

/** Simplex noise (Ashima Arts / Stefan Gustavson, MIT), fbm, voronoi, hue shift. */
export const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 7; i++) {
    if (i >= octaves) break;
    sum += amp * snoise(p);
    norm += amp;
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amp *= 0.5;
  }
  return sum / norm;
}

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

// x: distance to the nearest cell point, y: second nearest, z: random id of the nearest cell
vec3 voronoi(vec3 x) {
  vec3 n = floor(x);
  vec3 f = fract(x);
  float f1 = 8.0;
  float f2 = 8.0;
  float id = 0.0;
  for (int k = -1; k <= 1; k++) {
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec3 g = vec3(float(i), float(j), float(k));
        vec3 o = hash33(n + g);
        vec3 r = g + o - f;
        float d = dot(r, r);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = o.x;
        } else if (d < f2) {
          f2 = d;
        }
      }
    }
  }
  return vec3(sqrt(f1), sqrt(f2), id);
}

vec3 hueShift(vec3 color, float angle) {
  const vec3 k = vec3(0.57735);
  float c = cos(angle);
  return color * c + cross(k, color) * sin(angle) + k * dot(k, color) * (1.0 - c);
}
`;

export const SPHERE_VERTEX = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
  vObjPos = normalize(position);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const PLANET_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uSeedOffset;
uniform vec3 uSunPos;
uniform float uBumpScale;
uniform float uDetail;
uniform mat3 uObjectToWorld;

uniform float uForm;
uniform float uAtmosphere;
uniform float uWater;
uniform float uLife;
uniform float uLights;
uniform float uGlow;
uniform float uDim;

uniform vec3 uRockLow;
uniform vec3 uRockHigh;
uniform vec3 uSand;
uniform vec3 uOceanShallow;
uniform vec3 uOceanDeep;
uniform vec3 uLifeA;
uniform vec3 uLifeB;
uniform vec3 uSnow;
uniform vec3 uLightColor;
uniform vec3 uAtmoColor;
uniform vec3 uGlowColor;
uniform float uIce;
uniform float uSeaLevel;
uniform float uSeams;
uniform float uSeamGrid;
uniform float uDunes;
uniform float uIridescence;
uniform float uOceanGlow;
uniform float uHeartbeat;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

${NOISE_GLSL}

float gCraterAmount;

// Terrain height of the unit-sphere point p, shared by colour and relief normal.
float terrain(vec3 p, vec3 warp, int octaves, out float craterShade) {
  vec3 sp = p * 1.6 + uSeedOffset;
  vec3 wp = sp + warp * 0.32;
  float continents = fbm(wp * 0.85, octaves);
  float ridges = 1.0 - abs(snoise(wp * 2.2 + 3.0));
  ridges = ridges * ridges * ridges;
  float h = 0.5 + continents * 0.8;
  h += ridges * 0.2 * smoothstep(0.5, 0.78, h);
  craterShade = 0.0;
  // Young worlds are cratered; water and life smooth the scars away.
  if (gCraterAmount > 0.02) {
    vec3 cv = voronoi(sp * 3.2);
    vec3 cellRand = hash33(vec3(cv.z * 91.7, cv.z * 17.3, cv.z * 53.1));
    // Rims stay inside their voronoi cell, so the height has no seams.
    float radius = mix(0.15, 0.32, cellRand.x);
    float present = step(0.35, cellRand.y);
    float bowl = 1.0 - smoothstep(0.0, radius, cv.x);
    float rim = smoothstep(radius * 0.72, radius, cv.x) * (1.0 - smoothstep(radius, radius * 1.4, cv.x));
    float crater = (-bowl * bowl * 0.11 + rim * 0.04) * present * gCraterAmount;
    h += crater;
    craterShade = crater;
  }
  return h;
}

void main() {
  vec3 p = normalize(vObjPos);
  vec3 sp = p * 1.6 + uSeedOffset;
  float lat = abs(p.y);
  gCraterAmount = (1.0 - uWater * 0.75) * (1.0 - uLife * 0.85);

  // ---------------------------------------------------------------- terrain
  vec3 warp = vec3(snoise(sp * 1.1), snoise(sp * 1.1 + 19.1), snoise(sp * 1.1 + 41.3));
  int octaves = uDetail > 0.5 ? 6 : 4;
  float craterShade;
  float h0 = terrain(p, warp, octaves, craterShade);
  float hills = fbm((sp + warp * 0.32) * 3.4 + 7.0, 3);
  float h = h0 + hills * 0.1;
  if (uDunes > 0.0) {
    float dune = sin(sp.y * 34.0 + sp.x * 7.0 + snoise(sp * 2.6) * 5.0);
    h += uDunes * dune * 0.014 * (1.0 - smoothstep(0.6, 0.85, h));
  }
  h = clamp(h, 0.0, 1.0);

  // ---------------------------------------------------------------- water
  float sea = uSeaLevel * uWater;
  float isOcean = uWater > 0.001 ? 1.0 - smoothstep(sea - 0.006, sea + 0.006, h) : 0.0;
  float depth = clamp((sea - h) / max(sea, 0.05), 0.0, 1.0);
  float landH = clamp((h - sea) / max(1.0 - sea, 0.05), 0.0, 1.0);

  // ---------------------------------------------------------------- land
  float tone = fbm(sp * 7.0 + 13.0, 2) * 0.5 + 0.5;
  vec3 rock = mix(uRockLow, uRockHigh, smoothstep(0.05, 0.95, landH * 0.75 + tone * 0.4));
  rock *= 0.88 + 0.24 * tone;
  rock *= 1.0 + craterShade * 3.0;
  vec3 land = rock;

  float coast = (1.0 - smoothstep(0.0, 0.045, h - sea)) * uWater * (1.0 - isOcean);
  land = mix(land, uSand, coast * 0.85);

  float moisture = fbm(sp * 1.8 + 31.0, 3) * 0.5 + 0.5;
  float fertile = moisture * 0.6 + (1.0 - landH) * 0.35 + (1.0 - lat) * 0.25;
  float lifeEdge = 1.12 - uLife * 0.88;
  float lifeMask = smoothstep(lifeEdge, lifeEdge + 0.12, fertile) * uLife * (1.0 - smoothstep(0.74, 0.94, landH));
  float lifeTone = fbm(sp * 11.0 + 5.0, 2) * 0.5 + 0.5;
  vec3 lifeColor = mix(uLifeA, uLifeB, smoothstep(0.2, 0.85, lifeTone * 0.7 + moisture * 0.55 - 0.2));
  if (uIridescence > 0.0) {
    lifeColor = hueShift(lifeColor, uIridescence * (sp.x * 1.4 + sp.z * 1.1 + uTime * 0.05));
  }
  land = mix(land, lifeColor, lifeMask);

  float iceNoise = snoise(sp * 4.0) * 0.06;
  float polar = uIce > 0.0
    ? smoothstep(0.88 - uIce * 0.2, 0.95 - uIce * 0.2, lat + iceNoise) * uAtmosphere
    : 0.0;
  float peaks = smoothstep(0.86, 0.96, landH + iceNoise) * uAtmosphere * 0.85;
  float snow = max(polar, peaks);
  land = mix(land, uSnow, snow);

  vec3 ocean = mix(uOceanShallow, uOceanDeep, smoothstep(0.0, 0.8, depth));
  ocean = mix(ocean, uSnow, polar * 0.92);

  vec3 albedo = mix(land, ocean, isOcean);

  // ---------------------------------------------------------------- light
  vec3 Ng = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);

  // Relief normal from two neighbour samples on the sphere. (Screen-space
  // derivatives would shade in 2x2 pixel blocks.) Planets that are only a few
  // pixels wide skip it: no shimmer and far less work in the overview.
  vec3 N = Ng;
  float eps = clamp(length(fwidth(p)) * 0.9, 0.0015, 0.05);
  float bumpWeight = 1.0 - smoothstep(0.012, 0.024, eps);
  if (bumpWeight > 0.0) {
    vec3 tangent = normalize(cross(abs(p.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), p));
    vec3 bitangent = cross(p, tangent);
    float ignored;
    float r0 = max(h0, sea);
    float rT = max(terrain(normalize(p + tangent * eps), warp, octaves, ignored), sea);
    float rB = max(terrain(normalize(p + bitangent * eps), warp, octaves, ignored), sea);
    vec3 slope = (tangent * (rT - r0) + bitangent * (rB - r0)) * (uBumpScale * bumpWeight / eps);
    N = normalize(uObjectToWorld * normalize(p - slope));
  }

  float ndl = dot(N, L);
  float ndlG = dot(Ng, L);
  float wrap = clamp((ndl + 0.22) / 1.22, 0.0, 1.0);
  float diffuse = pow(wrap, 1.4);
  vec3 sunColor = mix(vec3(1.0, 0.6, 0.36), vec3(1.0, 0.97, 0.93), smoothstep(-0.05, 0.42, ndlG));
  sunColor = mix(vec3(1.0, 0.96, 0.9), sunColor, uAtmosphere);
  vec3 ambient = vec3(0.05, 0.055, 0.08) + uAtmoColor * 0.06 * uAtmosphere;
  vec3 color = albedo * (sunColor * diffuse * 1.2 + ambient);

  float dayG = smoothstep(-0.1, 0.25, ndlG);
  vec3 H = normalize(L + V);
  float nh = max(dot(Ng, H), 0.0);
  float spec = pow(nh, 110.0) * 1.6 + pow(nh, 16.0) * 0.08;
  color += sunColor * spec * isOcean * (1.0 - polar) * dayG * (1.0 - uOceanGlow);
  float fresnel = pow(1.0 - max(dot(Ng, V), 0.0), 4.0);
  color += uAtmoColor * fresnel * 0.2 * isOcean * uAtmosphere * dayG;

  // ---------------------------------------------------------------- glow
  float night = 1.0 - smoothstep(-0.28, 0.12, ndlG);
  vec3 emissive = vec3(0.0);

  if (uOceanGlow > 0.0) {
    float flow = fbm(sp * 5.0 + vec3(0.0, uTime * 0.05, uTime * 0.02), 3) * 0.5 + 0.5;
    emissive += ocean * isOcean * uOceanGlow * (0.35 + 0.75 * flow) * (0.55 + 0.45 * night);
  }

  if (uSeams > 0.0) {
    float edge;
    float cellId;
    if (uSeamGrid > 0.5) {
      vec3 gp = sp * 5.5;
      vec3 gd = abs(fract(gp + 0.5) - 0.5);
      float lineDist = min(min(gd.x, gd.y), gd.z);
      edge = 1.0 - smoothstep(0.0, 0.035, lineDist);
      cellId = hash33(floor(gp + 0.5)).x;
    } else {
      vec3 sv = voronoi(sp * 4.2);
      edge = 1.0 - smoothstep(0.0, 0.05, sv.y - sv.x);
      cellId = sv.z;
    }
    float onLand = 1.0 - isOcean;
    color *= 1.0 - edge * 0.38 * uSeams * onLand * uForm;
    // ("active" is a reserved word in GLSL ES 3.0)
    float seamOn = clamp(uLife + uWater * 0.35, 0.0, 1.0) * smoothstep(0.25, 0.55, cellId + uLife * 0.4);
    vec3 seamColor = mix(uLifeA, uLifeB, cellId);
    if (uIridescence > 0.0) {
      seamColor = hueShift(seamColor, cellId * 6.28 + uTime * 0.2);
    }
    float pulse = 0.72 + 0.28 * sin(uTime * 1.7 + cellId * 23.0);
    emissive += seamColor * edge * uSeams * onLand * seamOn * pulse * (0.5 + 1.1 * night);
  }

  if (uLights > 0.0) {
    float cells = snoise(sp * 22.0) * 0.5 + 0.5;
    float clusters = smoothstep(0.42, 0.75, moisture + fbm(sp * 3.0 + 50.0, 2) * 0.35);
    float lightMask = smoothstep(0.62, 0.88, cells) * clusters * (1.0 - isOcean) * (1.0 - snow);
    lightMask *= 0.35 + 0.65 * max(lifeMask, coast);
    vec3 lightColor = uLightColor;
    if (uIridescence > 0.0) {
      lightColor = hueShift(lightColor, cells * 9.0 + uTime * 0.3);
    }
    float beat = 1.0;
    if (uHeartbeat > 0.0) {
      float t = mod(uTime, 1.15);
      float b = exp(-t * 9.0) + 0.7 * step(0.24, t) * exp(-(t - 0.24) * 9.0);
      beat = mix(1.0, 0.35 + 1.5 * b, uHeartbeat);
    }
    float twinkle = 0.82 + 0.18 * sin(uTime * 2.6 + cells * 40.0);
    emissive += lightColor * lightMask * uLights * night * 2.6 * beat * twinkle;
  }

  float rim = pow(1.0 - max(dot(Ng, V), 0.0), 2.4);
  emissive += uGlowColor * rim * uGlow;

  color += emissive;
  // A world that is still forming reads as a dim, dusty core.
  color = mix(color * 0.35 + uGlowColor * 0.04, color, uForm);
  // Planets in the background of a focused one step back.
  color *= 1.0 - uDim * 0.72;

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const CLOUD_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uSeedOffset;
uniform vec3 uSunPos;
uniform float uCoverage;
uniform float uOpacity;
uniform vec3 uCloudColor;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

${NOISE_GLSL}

void main() {
  vec3 p = normalize(vObjPos);
  float t = uTime * 0.012;
  float c = cos(t);
  float s = sin(t);
  vec3 q = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z) + uSeedOffset * 1.7;
  vec3 qs = vec3(q.x, q.y * 1.9, q.z);
  vec3 w = vec3(snoise(qs * 1.2 + 4.0), snoise(qs * 1.2 + 9.0), snoise(qs * 1.2 + 17.0));
  float n = fbm(qs * 2.2 + w * 0.55 + vec3(0.0, 0.0, uTime * 0.006), 5) * 0.5 + 0.5;
  float lat = abs(p.y);
  float belt = 0.86 + 0.14 * cos(lat * 9.0);
  float threshold = mix(0.74, 0.46, uCoverage);
  float density = smoothstep(threshold, threshold + 0.14, n * belt);
  float detail = fbm(qs * 8.0 + 3.0, 2) * 0.5 + 0.5;
  density *= 0.72 + 0.28 * detail;

  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - vWorldPos);
  float ndl = dot(N, L);
  float light = clamp((ndl + 0.25) / 1.25, 0.0, 1.0);
  vec3 sunTint = mix(vec3(1.0, 0.62, 0.45), vec3(1.0), smoothstep(-0.05, 0.38, ndl));
  vec3 color = uCloudColor * (sunTint * light * 1.08 + vec3(0.05, 0.055, 0.08));

  gl_FragColor = vec4(color, density * uOpacity * 0.94);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const ATMOSPHERE_VERTEX = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * Analytic limb glow: for every pixel the closest approach of the view ray to
 * the planet centre decides the glow, so the halo is smooth regardless of the
 * shell tessellation and also tints the planet edge (twilight on the terminator).
 */
export const ATMOSPHERE_FRAGMENT = /* glsl */ `
uniform vec3 uCenter;
uniform float uPlanetRadius;
uniform float uShellRadius;
uniform vec3 uSunPos;
uniform vec3 uColor;
uniform float uStrength;
uniform float uAurora;
uniform vec3 uAuroraA;
uniform vec3 uAuroraB;
uniform vec3 uPole;
uniform float uTime;

varying vec3 vWorldPos;

${NOISE_GLSL}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorldPos - ro);
  vec3 oc = uCenter - ro;
  float tca = dot(oc, rd);
  vec3 radial = ro + rd * tca - uCenter;
  float d = length(radial);
  float x = d / uPlanetRadius;
  vec3 nr = radial / max(d, 1e-4);
  vec3 L = normalize(uSunPos - uCenter);
  float sunSide = dot(nr, L);
  float day = smoothstep(-0.55, 0.3, sunSide);
  float outer = uShellRadius / uPlanetRadius;

  float glow;
  if (x >= 1.0) {
    glow = exp(-(x - 1.0) * 20.0) * (1.0 - smoothstep(outer - 0.05, outer, x));
  } else {
    glow = 0.035 + pow(x, 9.0) * 0.6;
  }

  vec3 twilight = vec3(1.0, 0.5, 0.28);
  vec3 col = mix(twilight * 1.3, uColor, smoothstep(-0.12, 0.45, sunSide));
  vec3 result = col * glow * (0.07 + 0.93 * day) * uStrength * 1.5;

  if (uAurora > 0.0) {
    float polar = abs(dot(nr, uPole));
    float band = smoothstep(0.5, 0.78, polar) * (1.0 - smoothstep(0.93, 1.0, polar));
    float curtain = snoise(nr * 3.5 + vec3(0.0, uTime * 0.22, uTime * 0.1)) * 0.5 + 0.5;
    float height = x >= 1.0 ? exp(-(x - 1.0) * 14.0) : 0.55 * pow(x, 3.0);
    vec3 auroraColor = mix(uAuroraA, uAuroraB, curtain);
    result += auroraColor * band * curtain * height * uAurora * (0.35 + 0.65 * (1.0 - day)) * 1.1;
  }

  gl_FragColor = vec4(result, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const RING_VERTEX = /* glsl */ `
varying vec3 vWorldPos;
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const RING_FRAGMENT = /* glsl */ `
uniform float uInner;
uniform float uOuter;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;
uniform vec3 uCenter;
uniform float uPlanetRadius;
uniform vec3 uSunPos;
uniform float uSeed;
uniform float uTime;

varying vec3 vWorldPos;
varying vec2 vLocal;

${NOISE_GLSL}

void main() {
  float r = length(vLocal);
  float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
  float bandsA = snoise(vec3(t * 14.0, uSeed, 0.0)) * 0.5 + 0.5;
  float bandsB = snoise(vec3(t * 55.0, uSeed + 7.0, 0.0)) * 0.5 + 0.5;
  float density = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.84, 1.0, t));
  density *= 0.3 + 0.7 * bandsA;
  density *= 0.65 + 0.35 * bandsB;
  density *= smoothstep(0.012, 0.035, abs(t - 0.62));

  vec3 L = normalize(uSunPos - vWorldPos);
  vec3 oc = uCenter - vWorldPos;
  float tca = dot(oc, L);
  float d2 = dot(oc, oc) - tca * tca;
  float r2 = uPlanetRadius * uPlanetRadius;
  float shadow = tca > 0.0 ? smoothstep(r2 * 0.8, r2 * 1.08, d2) : 1.0;

  vec3 color = mix(uColorA, uColorB, bandsB) * (0.22 + 0.9 * shadow);
  float angle = atan(vLocal.y, vLocal.x);
  float sparkle = pow(snoise(vec3(t * 70.0, angle * 24.0, uTime * 0.5)) * 0.5 + 0.5, 14.0) * 3.0;
  color += vec3(1.0, 0.98, 0.92) * sparkle * shadow;

  gl_FragColor = vec4(color, density * uOpacity * 0.82);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const MOON_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uSunPos;
uniform float uSeed;
uniform float uGlow;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

${NOISE_GLSL}

void main() {
  vec3 p = normalize(vObjPos) * 2.0 + vec3(uSeed);
  float n = fbm(p * 1.6, 4) * 0.5 + 0.5;
  vec3 cv = voronoi(p * 2.2);
  float crater = 1.0 - smoothstep(0.0, 0.3, cv.x);
  vec3 albedo = mix(vec3(0.42, 0.42, 0.46), vec3(0.86, 0.85, 0.82), n);
  albedo *= 1.0 - crater * crater * 0.35;
  albedo = mix(albedo, albedo * uColor * 1.6, 0.38);

  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float wrap = clamp((dot(N, L) + 0.25) / 1.25, 0.0, 1.0);
  vec3 color = albedo * (pow(wrap, 1.3) * 1.15 + 0.1);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.0);
  color += uColor * rim * (0.55 + uGlow);

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const DUST_VERTEX = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute float aSpeed;
uniform float uTime;
uniform float uPixelRatio;
uniform float uContract;
varying float vAlpha;
varying float vPhase;
void main() {
  float angle = uTime * aSpeed + aPhase;
  float c = cos(angle);
  float s = sin(angle);
  vec3 pos = vec3(c * position.x - s * position.z, position.y, s * position.x + c * position.z);
  pos *= mix(1.0, 0.25, uContract);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uPixelRatio * (26.0 / -mv.z), 1.0, 9.0);
  vAlpha = 0.55 + 0.45 * sin(uTime * 2.2 + aPhase * 7.0);
  vPhase = aPhase;
}
`;

export const DUST_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
varying float vPhase;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  vec3 color = mix(uColor, vec3(1.0, 0.97, 0.9), step(0.82, fract(vPhase * 3.7)) * 0.7);
  gl_FragColor = vec4(color * core * core, core * vAlpha * uOpacity);
  #include <colorspace_fragment>
}
`;
