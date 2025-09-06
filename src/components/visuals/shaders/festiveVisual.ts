export const VertexShader = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}
`;

export const FragmentShader = `
precision highp float;
varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uMod;
uniform float uIntensity;
uniform float uScale;
uniform float uExpansion;
uniform float uStrobe;
uniform float uZoom;

#define PI 3.141592654
#define TAU (2.0*PI)
#define ROT(a) mat2(cos(a), sin(a), -sin(a), cos(a))

const int max_iter = 5;

vec2 mod2(inout vec2 p, vec2 size) {
  vec2 c = floor((p + size*0.5)/size);
  p = mod(p + size*0.5,size) - size*0.5;
  return c;
}

float hash(vec2 co) {
  return fract(sin(dot(co.xy ,vec2(12.9898,58.233))) * 13758.5453);
}

float box(vec2 p, vec2 b) {
  vec2 d = abs(p)-b;
  return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

float pmin(float a, float b, float k) {
  float h = clamp(0.5+0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

float pabs(float a, float k) {
  return -pmin(a, -a, k);
}

vec2 toPolar(vec2 p) {
  return vec2(length(p), atan(p.y, p.x));
}

vec2 toRect(vec2 p) {
  return vec2(p.x*cos(p.y), p.x*sin(p.y));
}

float modMirror1(inout float p, float size) {
  float halfsize = size*0.5;
  float c = floor((p + halfsize)/size);
  p = mod(p + halfsize,size) - halfsize;
  p *= mod(c, 2.0)*2.0 - 1.0;
  return c;
}

float smoothKaleidoscope(inout vec2 p, float sm, float rep) {
  vec2 hp = p;
  vec2 hpp = toPolar(hp);
  float rn = modMirror1(hpp.y, TAU/rep);
  float sa = PI/rep - pabs(PI/rep - abs(hpp.y), sm);
  hpp.y = sign(hpp.y)*(sa);
  hp = toRect(hpp);
  p = hp;
  return rn;
}

float shape(vec2 p) {
  const float amp = 10.0;
  p += amp*sin(vec2(1.0, sqrt(0.5))*0.026*uTime*TAU/amp);
  vec2 cp = p;
  vec2 np = round(p);
  cp -= np;
  float h0 = hash(np+123.4);
  if (h0 > 0.5) cp = vec2(-cp.y, cp.x);
  vec2 cp0 = cp; cp0 -= -0.5;
  float d0 = (length(cp0)-0.5);
  vec2 cp1 = cp; cp1 -= 0.5;
  float d1 = (length(cp1)-0.5);
  float d = d0;
  d = min(d, d1);
  d = abs(d)-0.125;
  return d;
}

vec2 df(vec2 p, out int ii, out bool inside) {
  float sz = 0.9;
  vec2 pp = p;
  float r = 0.0;
  ii = max_iter;
  for (int i=0; i<max_iter; ++i) {
    pp = p;
    vec2 nn = mod2(pp, vec2(sz));
    vec2 cp = nn * sz;

    float base = uExpansion * uMod;
    float cellDist = length(cp);
    vec2 cellDir = (cellDist > 0.0001) ? cp / cellDist : vec2(0.0);

    float levelWeight = sz / 0.9;

    float wobble = 0.1 * sin(uTime * 6.0 + cellDist * 8.0);
    float dispAmt = base * levelWeight * (0.25 + 1.6 * pow(cellDist, 0.6)) + wobble * base * 0.5;

    vec2 disp = cellDir * dispAmt;

    pp -= disp;
    cp -= disp;

    float d = shape(cp);
    r = sz * 0.5;
    if (abs(d) > 0.5 * sz * sqrt(2.0)) {
      ii = i;
      inside = d < 0.0;
      break;
    }
    sz /= 3.0;
  }
  float aa = 0.25 * sz;
  float d0 = box(pp, vec2(r - aa)) - aa;
  float d1 = length(pp);
  return vec2(d0, d1);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
  vec2 q = fragCoord / uResolution.xy;
  vec2 p = -1.0 + 2.0 * q;
  vec2 pp = p;
  p.x *= uResolution.x / uResolution.y;
  float aa = 4.0 / uResolution.y;
  vec2 op = p;

  const float ZOOM_STRENGTH = 1.2;

  float zoomDrive = uZoom * uMod;
  float zoomWobble = 0.06 * sin(uTime * 8.0) * uZoom;
  float zoomAmt = zoomDrive * ZOOM_STRENGTH + zoomWobble;

  zoomAmt = clamp(zoomAmt, -0.9, 4.0);
  float zoomScale = 1.0 / (1.0 + zoomAmt);
  p *= zoomScale;

  mat2 rot = ROT(0.0125 * uTime);

  p *= rot;
  smoothKaleidoscope(p, 0.025, 34.0);
  p *= ROT(0.25 * length(op));
  p *= transpose(rot);

  int i;
  bool inside;
  vec2 d2 = df(p, i, inside);
  float ii = float(i) / float(max_iter);
  vec3 col = vec3(0.0);
  vec3 rgb = 0.5 * (1.0 + cos(0.5 * uTime - 0.5 * PI * length(p) + vec3(0.0, 1.0, 2.0) + PI * ii + (inside ? (2.0 * (dot(p,pp) + 1.0)) : 0.0)));
  rgb += 0.0025 / max(d2.y, 0.005);
  col = mix(col, rgb, smoothstep(0.0, -aa, d2.x));
  col -= vec3(0.25) * (length(op) + 0.0);
  col *= smoothstep(1.5, 0.5, length(pp));
  col = sqrt(max(col, vec3(0.0)));

  float duck = mix(1.0, 0.25, clamp(uStrobe, 0.0, 1.0));
  col *= mix(0.8, 1.8, clamp(uIntensity * (0.25 + uMod * 0.75), 0.0, 1.0)) * duck;

  fragColor = vec4(col, 1.0);
}

void main() {
  vec2 fragCoord = vUv * uResolution.xy;
  mainImage(gl_FragColor, fragCoord);
}
`;
