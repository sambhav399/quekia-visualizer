export const VertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const FragmentShader = `
precision highp float;
varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColor;
uniform float uFlash;
uniform vec2 uCenter;
uniform float uGridPxX;
uniform float uGridPxY;
uniform float uDotPx;
uniform float uBrightness;

float circPx(vec2 pPx, float rPx, float edgePx){
  float len = length(pPx);
  return smoothstep(rPx, rPx - edgePx, len);
}

void main(){
  vec2 uv = vUv;
  vec2 res = uResolution;
  vec2 fragPx = uv * res;

  vec2 cellSize = vec2(uGridPxX, uGridPxY);
  vec2 cellIndex = floor(fragPx / cellSize);
  vec2 cellOriginPx = cellIndex * cellSize;
  vec2 cellCenterPx = cellOriginPx + cellSize * 0.5;
  vec2 localPx = fragPx - cellCenterPx;

  float dotDiameterPx = clamp(uDotPx, 0.0, max(uGridPxX, uGridPxY));
  float baseRadiusPx = 0.5 * dotDiameterPx * uFlash;

  vec2 aspect = vec2(res.x / res.y, 1.0);
  vec2 d = (uv - uCenter) * aspect;
  float dist = length(d);
  float maxDist = length(vec2(0.5 * aspect.x, 0.5 * aspect.y));
  float radial = clamp(dist / maxDist, 0.0, 1.0);

  float dotRadiusPx = baseRadiusPx * radial;

  float edgePx = max(1.0, min(res.x, res.y) * 0.002);
  float rOuter = dotRadiusPx;
  float rInner = dotRadiusPx * 0.6;
  float core = circPx(localPx, rInner, edgePx * 0.8);
  float outer = circPx(localPx, rOuter, edgePx);
  float rim = clamp(outer - core, 0.0, 1.0);

  float intensity = (core * 0.9 + rim * 1.2) * uBrightness * uFlash;

  vec3 col = uColor * intensity;
  float alpha = clamp(intensity, 0.0, 1.0);

  gl_FragColor = vec4(col, alpha);
}
`;
