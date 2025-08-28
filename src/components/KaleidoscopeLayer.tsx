// @ts-nocheck

// KaleidoscopeLayer.tsx
import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

type RefAny = React.RefObject<AnalyserNode | null> | undefined;
type DataRefAny = React.RefObject<Float32Array | Uint8Array | null> | undefined;

type Props = {
  analyserNodeRef?: RefAny;
  currentDataRef?: DataRefAny;
  symmetry?: number; // number of slices in kaleidoscope (6..12 is nice)
  intensity?: number; // visual intensity multiplier
  smoothing?: number; // 0..1 (bigger = smoother/laggier)
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function KaleidoscopeLayer({
  analyserNodeRef,
  currentDataRef,
  symmetry = 8,
  intensity = 1.0,
  smoothing = 0.75,
}: Props) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<any>(null);
  const bufferRef = useRef<Uint8Array | Float32Array | null>(null);
  const prevBass = useRef(0);
  const avgBass = useRef(0);
  const lastBeatAt = useRef(0);
  const beatValue = useRef(0);

  const { viewport, size } = useThree();

  // Build uniforms once
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBass: { value: 0 },
      uBeat: { value: 0 },
      uHue: { value: 0.1 },
      uSymmetry: { value: Math.max(1, symmetry) },
      uIntensity: { value: intensity },
      uAspect: { value: size.width / size.height },
    }),
    // update when symmetry/intensity/size changes
    [symmetry, intensity, size.width, size.height]
  );

  useEffect(() => {
    // keep aspect up-to-date
    if (uniforms.uAspect) uniforms.uAspect.value = size.width / size.height;
  }, [size.width, size.height, uniforms]);

  // Helpful small normalizer that handles Uint8Array (0..255), dB floats (<=0),
  // and normalized floats (0..1).
  function normalizeValue(v: number) {
    if (v >= 0 && v <= 1) return v;
    if (v > 1) return clamp(v / 255, 0, 1); // Uint8
    // v < 0 -> likely dB values (approx -140..0)
    return clamp((v + 140) / 140, 0, 1);
  }

  useFrame((state, dt) => {
    // update time uniform
    if (materialRef.current) materialRef.current.uniforms.uTime.value += dt;

    // Acquire audio data array
    let dataArr: Uint8Array | Float32Array | null = null;
    const analyser = analyserNodeRef?.current ?? null;
    if (analyser && analyser.frequencyBinCount) {
      // ensure buffer
      if (
        !bufferRef.current ||
        (bufferRef.current as Uint8Array).length !== analyser.frequencyBinCount
      ) {
        bufferRef.current = new Uint8Array(analyser.frequencyBinCount);
      }
      // fill byte data (0..255). This is fast and reliable for visuals.
      analyser.getByteFrequencyData(bufferRef.current as Uint8Array);
      dataArr = bufferRef.current as Uint8Array;
    } else if (currentDataRef?.current) {
      dataArr = currentDataRef.current;
    } else {
      return; // nothing to analyze yet
    }

    const n = dataArr.length;
    if (n === 0) return;

    // Nyquist estimate (best-effort)
    const nyquist =
      // prefer audioContext.sampleRate if we can get it from analyser.context
      analyser && (analyser as any).context?.sampleRate
        ? (analyser as any).context.sampleRate / 2
        : 22050;

    // bass cutoff ~200 Hz
    const bassCut = Math.max(2, Math.floor((200 / nyquist) * n));

    // compute simple normalized bass energy
    let bassSum = 0;
    for (let i = 0; i < bassCut; i++) {
      bassSum += normalizeValue((dataArr as any)[i]);
    }
    const bassAvg = bassSum / Math.max(1, bassCut);

    // smooth the bass value (EMA)
    const smoothed = lerp(prevBass.current, bassAvg, 1 - smoothing);
    prevBass.current = smoothed;

    // low-frequency moving average for beat detection
    avgBass.current = lerp(avgBass.current, smoothed, 0.02); // slow average

    // simple beat: transient when current > avg * threshold, with hold to avoid retriggering
    const now = performance.now();
    const threshold = 1.6; // tweakable
    const holdMs = 150;
    let beat = 0;
    if (
      smoothed > avgBass.current * threshold &&
      now - lastBeatAt.current > holdMs
    ) {
      lastBeatAt.current = now;
      beat = 1.0;
      beatValue.current = 1.0;
    } else {
      // quick exponential decay of beat value
      beatValue.current = Math.max(0, beatValue.current - dt * 4.0);
      beat = beatValue.current;
    }

    // push uniforms safely
    if (materialRef.current && materialRef.current.uniforms) {
      materialRef.current.uniforms.uBass.value = smoothed * intensity;
      materialRef.current.uniforms.uBeat.value = beat * intensity;
      // hue variation: use a slow oscillation + bass
      materialRef.current.uniforms.uHue.value =
        (0.2 +
          Math.sin(state.clock.elapsedTime * 0.2) * 0.2 +
          smoothed * 0.25) %
        1.0;
      materialRef.current.uniforms.uSymmetry.value = Math.max(1, symmetry);
      materialRef.current.uniforms.uIntensity.value = intensity;
    }
  });

  // GLSL shader: kaleidoscope + color (HSV -> RGB)
  const fragmentShader = `
    precision highp float;
    uniform float uTime;
    uniform float uBass;
    uniform float uBeat;
    uniform float uHue;
    uniform float uSymmetry;
    uniform float uIntensity;
    uniform float uAspect;
    varying vec2 vUv;
    const float PI = 3.141592653589793;

    // simple HSV to RGB
    vec3 hsv2rgb(vec3 c) {
      vec3 rgb = clamp( abs(mod(c.x*6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0 );
      rgb = rgb*rgb*(3.0-2.0*rgb);
      return c.z * mix(vec3(1.0), rgb, c.y);
    }

    void main() {
      // normalized coordinates centered
      vec2 uv = vUv - 0.5;
      uv.x *= uAspect;

      float r = length(uv);
      float ang = atan(uv.y, uv.x); // -PI..PI

      // apply kaleidoscope symmetry by folding the angle
      float k = max(1.0, floor(uSymmetry + 0.5));
      float twoPiOverK = 2.0 * PI / k;
      float a = mod(ang, twoPiOverK);
      // optionally reflect to create mirror
      a = abs(a - twoPiOverK * 0.5);

      // reconstruct a mirrored coordinate
      vec2 p = vec2(cos(a), sin(a)) * r;

      // build a layered pattern: radial rings + rotating stripes + noise-like interference
      float rings = sin((r * 10.0 - uTime * 2.0) * (1.0 + uBass * 3.0));
      float stripes = sin((a * 6.0) + uTime * 1.6 + uBass * 6.0);
      float interference = sin( (p.x*12.0 + p.y*8.0) + uTime * 2.0 + uBeat * 8.0 );
      float pattern = smoothstep(0.0, 1.0, rings * 0.6 + stripes * 0.4 + interference * 0.25);

      // glow near center boosted by beat
      float glow = exp(-r * 5.0) * (0.6 + uBeat * 1.6);

      // hue rotates slowly + responds to bass
      float hue = fract(uHue + 0.08 * sin(uTime * 0.6) + uBass * 0.25);

      // brightness modulation
      float bright = pow(pattern, 1.2) + glow;
      bright *= (0.6 + uBass * 0.8) * uIntensity;

      // color from hue, saturated by bass & beat
      float sat = 0.6 + uBass * 0.6 + uBeat * 0.4;
      vec3 col = hsv2rgb(vec3(hue, clamp(sat,0.0,1.0), clamp(bright,0.0,1.6)));

      // vignette + subtle contrast
      float vign = smoothstep(0.95, 0.2, r);
      col *= vign;

      // final tone mapping
      col = 1.0 - exp(-col * vec3(1.2,1.0,1.1));
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // create geometry sized to viewport so it fills the screen
  const planeArgs = useMemo(() => {
    // use viewport width / height at z=0 so plane covers the view
    const w = viewport.width;
    const h = viewport.height;
    return [w, h];
  }, [viewport.width, viewport.height]);

  return (
    <mesh
      ref={meshRef}
      position={[0, 0, -0.01]} // slightly behind center so it doesn't z-fight with scene objects
      renderOrder={-1}
    >
      <planeGeometry args={planeArgs} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthWrite={false}
        depthTest={false}
        transparent={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
