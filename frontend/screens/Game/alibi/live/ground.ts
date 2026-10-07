/* Lebendiger Kartenboden (WebGL2): Wasser fließt und glitzert, Bäume und Weizen wiegen sich im Wind (Böen ziehen
 * über die Karte), Licht je Akt (Abend, Mitternacht, Morgengrauen) mit warmen Lichtinseln an den Orten,
 * Glühwürmchen, die vor dem Finger fliehen, Wellenringe beim Tippen aufs Wasser.
 * Masken: map/village.mask.png (R Wasser, G Baumkronen, B Weizen), erzeugt von scripts/game-art/process.py. */

const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uMap;
uniform sampler2D uMask;
uniform float uT;
uniform float uAct;
uniform vec4 uLights[10];
uniform int uNL;
uniform vec3 uTap;
uniform float uMotion;

float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  vec2 uv = vUv;
  float T = uT;
  vec4 m = texture(uMask, uv);
  // Wind: Böenfront wandert schräg über die Karte
  vec2 wdir = normalize(vec2(1.0, 0.35));
  float front = fract(T * 0.043);
  float gust = exp(-pow(dot(uv, wdir) * 0.85 - (front * 1.7 - 0.35), 2.0) / 0.014);
  float wind = (0.35 + 0.65 * gust) * uMotion;
  vec2 off = vec2(0.0);
  // Baumkronen schwanken (jede Krone etwas anders)
  off += vec2(sin(T * 1.9 + uv.y * 31.0 + uv.x * 7.0), cos(T * 1.6 + uv.x * 27.0)) * 0.0017 * wind * m.g;
  // Weizen: Wellen laufen mit dem Wind
  float wave = sin(dot(uv, wdir) * 75.0 - T * 2.7) * 0.5 + 0.5;
  off += wdir * 0.0013 * m.b * wave * wind;
  // Wasser fließt
  vec2 flow = vec2(noise(uv * 38.0 + vec2(T * 0.35, T * 0.12)), noise(uv * 38.0 + vec2(-T * 0.2, T * 0.3) + 7.0)) - 0.5;
  off += flow * 0.0045 * m.r * uMotion;
  // Wellenring beim Tippen
  float age = T - uTap.z;
  float dTap = distance(uv, uTap.xy);
  float rad = age * 0.11;
  float ring = age < 2.6 ? sin((dTap - rad) * 170.0) * exp(-age * 1.5) * smoothstep(0.09, 0.0, abs(dTap - rad)) : 0.0;
  off += (uv - uTap.xy) / max(dTap, 1e-3) * ring * 0.003 * (0.25 + m.r);
  vec3 c = texture(uMap, uv + off).rgb;
  c *= 1.0 + m.b * (wave - 0.5) * 0.12 * wind;
  float glint = pow(noise(uv * 130.0 + vec2(T * 0.8, -T * 0.5)), 16.0) * m.r;

  // Licht je Akt (stufenlos überblendet)
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 eve = c * vec3(1.06, 0.86, 0.76) + vec3(0.07, 0.02, 0.05);
  eve = mix(eve, vec3(lum) * vec3(1.0, 0.72, 0.68), 0.14);
  vec3 night = mix(c * vec3(0.28, 0.34, 0.6), vec3(lum) * vec3(0.2, 0.26, 0.5), 0.42);
  vec3 dawn = c * vec3(1.02, 0.94, 0.96) + vec3(0.05, 0.03, 0.06);
  vec3 day = c;
  float a0 = clamp(1.0 - abs(uAct - 0.0), 0.0, 1.0);
  float a1 = clamp(1.0 - abs(uAct - 1.0), 0.0, 1.0);
  float a2 = clamp(1.0 - abs(uAct - 2.0), 0.0, 1.0);
  float a3 = clamp(1.0 - abs(uAct - 3.0), 0.0, 1.0);
  vec3 col = eve * a0 + night * a1 + dawn * a2 + day * a3;

  // Lichtinseln: Laternen und Fenster der Orte (flackern mit unregelmäßigen Perioden)
  float nightK = a1 + a0 * 0.35 + a2 * 0.08;
  vec3 lights = vec3(0.0);
  for (int i = 0; i < 10; i++) {
    if (i >= uNL) break;
    vec4 L = uLights[i];
    float d = distance(uv, L.xy);
    float fi = float(i);
    float fl = 0.9 + 0.1 * sin(T * (5.3 + fi * 0.71) + fi * 2.0) * sin(T * (3.1 + fi * 0.37));
    lights += vec3(1.0, 0.72, 0.42) * L.w * fl * exp(-d * d / (L.z * L.z));
  }
  col += c * lights * nightK * 1.7 + lights * nightK * 0.05;
  col += glint * (a1 * vec3(0.75, 0.85, 1.0) + a0 * vec3(1.0, 0.82, 0.5) + (a2 + a3) * vec3(1.0, 0.95, 0.92)) * 0.9;
  // Wolkenschatten tagsüber
  float cl = smoothstep(0.45, 0.78, noise(uv * 3.0 + vec2(T * 0.015, T * 0.006)));
  col *= 1.0 - cl * 0.1 * (a0 + a2 + a3);

  // Glühwürmchen (Abend und Nacht), fliehen vor dem Finger
  vec2 gp = uv * 9.0;
  vec2 cell = floor(gp);
  float ff = 0.0;
  vec2 tp = uTap.xy * 9.0;
  float flee = exp(-max(age, 0.0) * 0.5);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cc = cell + vec2(float(i), float(j));
      float r = h21(cc);
      if (r > 0.55) continue;
      vec2 p = cc + 0.5 + 0.33 * vec2(sin(T * (0.4 + r) + r * 20.0), cos(T * (0.33 + r * 0.7) + r * 11.0));
      vec2 dv = p - tp;
      float dd = length(dv);
      p += dv / max(dd, 1e-3) * 0.85 * exp(-dd * dd / 1.3) * flee;
      float blink = 0.5 + 0.5 * sin(T * (1.3 + r * 2.0) + r * 40.0);
      float d = length(gp - p);
      ff += blink * blink * exp(-d * d * 110.0) * 1.3 + blink * exp(-d * d * 9.0) * 0.07;
    }
  }
  col += vec3(1.0, 0.92, 0.45) * ff * (a1 + a0 * 0.6);
  o = vec4(col, 1.0);
}`;

export interface GroundLight {
  x: number; // Prozent
  y: number;
  r: number; // Radius in Prozent
  k: number; // Stärke
}

function shader(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
  return s;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

export class Ground {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private tex: WebGLTexture[] = [];
  ready = false;
  act = 1;
  private lights = new Float32Array(40);
  private nl = 0;
  private tap: [number, number, number] = [-1, -1, -100];
  private maskData: ImageData | null = null;
  motion = 1;

  /** Wirft, wenn WebGL2 fehlt (dann zeigt die Karte das stille Bild). */
  constructor(private canvas: HTMLCanvasElement, mapSrc: string, maskSrc: string, onReady?: () => void) {
    const gl = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: false, alpha: false, preserveDrawingBuffer: false, powerPreference: "low-power" });
    if (!gl) throw new Error("WebGL2 fehlt");
    this.gl = gl;
    const p = gl.createProgram()!;
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
    this.prog = p;
    ["uMap", "uMask", "uT", "uAct", "uLights", "uNL", "uTap", "uMotion"].forEach((n) => (this.u[n] = gl.getUniformLocation(p, n)));
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    Promise.all([loadImage(mapSrc), loadImage(maskSrc)])
      .then(([map, mask]) => {
        this.tex = [this.upload(map, true), this.upload(mask, false)];
        try {
          const c = document.createElement("canvas");
          c.width = 128;
          c.height = 128;
          const g = c.getContext("2d")!;
          g.drawImage(mask, 0, 0, 128, 128);
          this.maskData = g.getImageData(0, 0, 128, 128);
        } catch {
          this.maskData = null;
        }
        this.ready = true;
        onReady?.();
      })
      .catch(() => undefined);
  }

  private upload(im: HTMLImageElement, mip: boolean) {
    const gl = this.gl, t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  /** Liegt (u, v) im Wasser? (aus der Maske, Rotkanal) */
  isWater(u: number, v: number) {
    const d = this.maskData;
    if (!d) return false;
    const x = Math.max(0, Math.min(127, Math.floor(u * 128))), y = Math.max(0, Math.min(127, Math.floor(v * 128)));
    return d.data[(y * 128 + x) * 4] > 110;
  }

  setLights(ls: GroundLight[]) {
    this.lights.fill(0);
    ls.slice(0, 10).forEach((l, i) => this.lights.set([l.x / 100, l.y / 100, l.r / 100, l.k], i * 4));
    this.nl = Math.min(10, ls.length);
  }

  /** Tippen bei (u, v) in 0..1 zur Taktzeit t */
  tapAt(u: number, v: number, t: number) {
    this.tap = [u, v, t];
  }

  resize(w: number, h: number) {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  render(t: number) {
    if (!this.ready) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[0]);
    gl.uniform1i(this.u.uMap, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[1]);
    gl.uniform1i(this.u.uMask, 1);
    gl.uniform1f(this.u.uT, t);
    gl.uniform1f(this.u.uAct, this.act);
    gl.uniform4fv(this.u.uLights, this.lights);
    gl.uniform1i(this.u.uNL, this.nl);
    gl.uniform3f(this.u.uTap, this.tap[0], this.tap[1], this.tap[2]);
    gl.uniform1f(this.u.uMotion, this.motion);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  destroy() {
    const gl = this.gl;
    this.tex.forEach((t) => gl.deleteTexture(t));
    gl.deleteProgram(this.prog);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
