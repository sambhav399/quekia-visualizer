// File: components/ClubVisualizer.jsx
// Requirements: react, @react-three/fiber, three, @react-three/drei, @react-three/postprocessing
// Optional: framer-motion for UI transitions
//
// Props:
// - analyserNodeRef: React.RefObject<AnalyserNode>
// - currentDataRef: React.MutableRefObject<Uint8Array | Float32Array | null>
// - bars?: number (default 64)
// - smoothing?: number (0..1, default 0.7) applied to internal EMA for visuals
// - paused?: boolean (default false)
//
// This component renders:
// 1) Beat-pulsing shader sphere (reacts to bass & global amplitude)
// 2) Log-spaced frequency bars using InstancedMesh (GPU-friendly)
// 3) Floating particles that swirl with treble energy
// 4) Postprocessing bloom + subtle glitch on strong beats
//
// It consumes *your existing* analyserNodeRef and/or currentDataRef (frequency data).
// If both are present, analyserNodeRef is used to pull fresh data each frame; otherwise it will
// read whatever you place into currentDataRef.current (e.g., via your own render loop).

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Instances,
  Instance,
  Stars,
  Environment,
} from '@react-three/drei';
import { EffectComposer, Bloom, Glitch } from '@react-three/postprocessing';
import KaleidoscopeLayer from './KaleidoscopeLayer';

// ------------------------
// Utility: simple clamp/map
// ------------------------
const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------
// Hook: derive audio features each frame
// ------------------------
function useAudioFeatures({
  analyserNodeRef,
  currentDataRef,
  bars = 64,
  smoothing = 0.7,
}) {
  const fftRef = useRef(null);
  const lastBeatAt = useRef(0);
  const beatHold = 120; // ms hold after a beat
  const tPrev = useRef(performance.now());

  // EMA trackers
  const ema = useRef({
    amp: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    centroid: 0,
  });

  // rolling variance approx for beat detection
  const varState = useRef({ avg: 0, m2: 0, n: 0 });

  const bandIdxCache = useMemo(() => {
    // Build log-spaced index mapping for N visual bars
    const a = [];
    const FFT_SIZE = analyserNodeRef?.current?.fftSize || 1024; // fallback
    const nyquist = 22050; // typical, not exact but fine for mapping
    const maxBin = FFT_SIZE / 2;
    const fMin = 20,
      fMax = 16000;
    for (let i = 0; i < bars; i++) {
      const t = i / (bars - 1);
      const f = fMin * Math.pow(fMax / fMin, t);
      const bin = Math.round((f / nyquist) * maxBin);
      a.push(clamp(bin, 1, maxBin - 1));
    }
    return a;
  }, [bars, analyserNodeRef]);

  const featuresRef = useRef({
    amplitude: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    centroid: 0,
    beat: 0,
    kick: 0,
    snare: 0,
    barsArray: new Array(bars).fill(0),
    raw: null,
  });

  useFrame(() => {
    const analyser = analyserNodeRef?.current || null;
    let data;

    if (analyser && analyser.frequencyBinCount) {
      const binCount = analyser.frequencyBinCount;
      if (!fftRef.current || fftRef.current.length !== binCount) {
        fftRef.current = new Uint8Array(binCount);
      }
      analyser.getByteFrequencyData(fftRef.current);
      data = fftRef.current;
    } else if (currentDataRef?.current) {
      data = currentDataRef.current;
    } else {
      return; // nothing to analyze yet
    }

    // Compute normalized magnitudes 0..1
    const magnitudes = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) magnitudes[i] = data[i] / 255;

    const n = magnitudes.length;
    const nyquist = 22050; // approx for centroid weighting; good enough visually

    // Split bands (rough): bass < 200 Hz, mid 200-2000 Hz, treble > 2k Hz
    const bassEnd = Math.floor(n * (200 / nyquist));
    const midEnd = Math.floor(n * (2000 / nyquist));

    const sum = magnitudes.reduce((a, b) => a + b, 0);
    const amp = sum / n; // simple RMS-ish proxy

    let bass = 0,
      mid = 0,
      treble = 0;
    for (let i = 0; i < n; i++) {
      const v = magnitudes[i];
      if (i < bassEnd) bass += v;
      else if (i < midEnd) mid += v;
      else treble += v;
    }
    bass = (bass / Math.max(1, bassEnd)) * 1.8;
    mid = (mid / Math.max(1, midEnd - bassEnd)) * 1.6;
    treble = (treble / Math.max(1, n - midEnd)) * 1.6;

    // Spectral centroid approx
    let wsum = 0,
      vsum = 0;
    for (let i = 0; i < n; i++) {
      const freq = (i / n) * nyquist;
      const v = magnitudes[i];
      wsum += freq * v;
      vsum += v;
    }
    const centroid = vsum > 0 ? wsum / vsum : 0;
    const centroidNorm = clamp((centroid - 500) / (8000 - 500));

    // Bars visualization sampling
    const barsArray = featuresRef.current.barsArray;
    for (let i = 0; i < barsArray.length; i++) {
      const idx = bandIdxCache[i];
      const v = magnitudes[idx] || 0;
      // apply smoothing (EMA)
      barsArray[i] = lerp(barsArray[i], v, 1 - smoothing);
    }

    // EMA smoothing for macro features
    ema.current.amp = lerp(ema.current.amp, amp, 1 - smoothing);
    ema.current.bass = lerp(ema.current.bass, bass, 1 - smoothing);
    ema.current.mid = lerp(ema.current.mid, mid, 1 - smoothing);
    ema.current.treble = lerp(ema.current.treble, treble, 1 - smoothing);
    ema.current.centroid = lerp(
      ema.current.centroid,
      centroidNorm,
      1 - smoothing
    );

    // Beat detection (very light): compare bass energy to rolling mean+std
    const now = performance.now();
    const b = clamp(bass);
    const s = varState.current;
    // Welford's online variance
    s.n += 1;
    const delta = b - s.avg;
    s.avg += delta / s.n;
    s.m2 += delta * (b - s.avg);
    const variance = s.n > 1 ? s.m2 / (s.n - 1) : 0.001;
    const std = Math.sqrt(variance) + 0.0001;

    let beat = 0;
    const isBeat = b > s.avg + 1.0 * std && now - lastBeatAt.current > beatHold;
    if (isBeat) {
      lastBeatAt.current = now;
      beat = 1;
    } else {
      // short decay 0..1 based on time since last beat
      const dt = (now - lastBeatAt.current) / beatHold;
      beat = clamp(1 - dt);
    }

    // Kick vs Snare hints (rough): kick dominated by bass; snare mid spike
    const kick = clamp(bass * 0.9 - mid * 0.3);
    const snare = clamp(mid * 0.9 - bass * 0.2);

    featuresRef.current = {
      amplitude: ema.current.amp,
      bass: ema.current.bass,
      mid: ema.current.mid,
      treble: ema.current.treble,
      centroid: ema.current.centroid,
      beat,
      kick,
      snare,
      barsArray,
      raw: magnitudes,
    };
  });

  return featuresRef;
}

// ------------------------
// Shader: pulse/displace sphere with audio
// ------------------------
const PulseSphereMaterial = ({ uniformsRef }) => {
  const materialRef = useRef();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0 },
      uBeat: { value: 0 },
      uTreble: { value: 0 },
      uCentroid: { value: 0 },
    }),
    []
  );

  useEffect(() => {
    uniformsRef.current = uniforms;
  }, [uniformsRef, uniforms]);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
  });

  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={uniforms}
      vertexShader={`
        uniform float uTime;
        uniform float uAmp;
        uniform float uBeat;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          float n = sin(10.0 * p.x + uTime*2.0) * 0.02 + cos(10.0 * p.y + uTime*1.5) * 0.02;
          float pulse = 0.15 * uBeat + 0.1 * uAmp;
          p += normal * (n + pulse);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `}
      fragmentShader={`
        precision highp float;
        uniform float uAmp;
        uniform float uBeat;
        uniform float uTreble;
        uniform float uCentroid;
        varying vec2 vUv;
        void main() {
          float ring = smoothstep(0.45, 0.0, abs(0.5 - vUv.y));
          float glow = 0.4*uBeat + 0.3*uTreble + 0.2*uAmp;
          vec3 base = mix(vec3(0.08, 0.05, 0.1), vec3(0.8, 0.2, 0.9), uCentroid);
          vec3 col = base + glow * vec3(1.0, 0.7, 1.0);
          gl_FragColor = vec4(col, 1.0);
        }
      `}
      transparent={false}
    />
  );
};

// ------------------------
// Bars (Instanced)
// ------------------------
function FreqBars({ barsArrayRef }) {
  const count = barsArrayRef.current?.barsArray?.length || 64;
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const barsArray = barsArrayRef.current?.barsArray || [];
    if (!ref.current) return; // safety guard
    const n = Math.min(count, barsArray.length);

    for (let i = 0; i < n; i++) {
      const x = (i / n) * 2 - 1; // map to -1..1
      const height = 0.1 + barsArray[i] * 1.8;
      dummy.position.set(x * 6, height * 0.5 - 1.2, -1.5);
      dummy.scale.set(0.08, height, 0.08);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }

    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[null, null, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial metalness={0.1} roughness={0.3} />
    </instancedMesh>
  );
}

// ------------------------
// Particle field (treble-driven swirl)
// ------------------------
function TrebleParticles({ featuresRef, count = 600 }) {
  const pointsRef = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3 + Math.random() * 6;
      const a = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 2.5;
      arr[i * 3 + 0] = Math.cos(a) * r;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  }, [count]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const treble = featuresRef.current.treble;
    if (pointsRef.current) {
      pointsRef.current.rotation.y = t * (0.05 + treble * 0.5);
      pointsRef.current.rotation.x = Math.sin(t * 0.3) * 0.05;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.04} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ------------------------
// Main scene content
// ------------------------
function Scene({
  analyserNodeRef,
  currentDataRef,
  bars = 64,
  smoothing = 0.7,
  paused = false,
}) {
  const featuresRef = useAudioFeatures({
    analyserNodeRef,
    currentDataRef,
    bars,
    smoothing,
  });
  const uniformsRef = useRef({});
  const sphereRef = useRef();

  useFrame(() => {
    if (paused) return;
    const f = featuresRef.current;
    if (sphereRef.current) {
      const s = 1 + f.amplitude * 0.6 + f.kick * 0.4;
      sphereRef.current.scale.setScalar(
        THREE.MathUtils.lerp(sphereRef.current.scale.x, s, 0.2)
      );
    }
    if (uniformsRef.current.uAmp) {
      uniformsRef.current.uAmp.value = f.amplitude;
      uniformsRef.current.uBeat.value = f.beat;
      uniformsRef.current.uTreble.value = f.treble;
      uniformsRef.current.uCentroid.value = f.centroid;
    }
  });

  return (
    <>
      <KaleidoscopeLayer
        analyserNodeRef={analyserNodeRef}
        currentDataRef={currentDataRef}
        symmetry={12} // try 6, 8, 12
        intensity={1}
        smoothing={0.1}
      />
      {/* Background stars + env for vibe */}
      <color attach="background" args={['#07030a']} />
      <Environment preset="studio" />
      {/* <Stars radius={80} depth={40} count={2000} factor={2} fade /> */}

      {/* Lights */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 6, 2]} intensity={0.8} />

      {/* Centerpiece pulse sphere */}
      {/*<group position={[0, 0.1, 0]}>
        <mesh ref={sphereRef}>
          <icosahedronGeometry args={[1.2, 5]} />
          <PulseSphereMaterial uniformsRef={uniformsRef} />
        </mesh>
      </group>*/}

      {/* Frequency bars */}
      {/*<group position={[0, -0.2, 0]}>
        <FreqBars barsArrayRef={featuresRef} />
      </group>*/}

      {/* Treble particles */}
      <TrebleParticles featuresRef={featuresRef} />

      {/* Camera controls for debugging / VJing */}
      {/*<OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={(2 * Math.PI) / 3}
      />*/}

      {/* Postprocessing */}
      <EffectComposer>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
        />
        {/* Glitch intensity maps to beat */}
        <Glitch
          active={featuresRef.current.beat > 0.5}
          ratio={0.02}
          duration={[0.05, 0.2]}
        />
      </EffectComposer>
    </>
  );
}

// ------------------------
// Exported component
// ------------------------
export default function ClubVisualizer({
  analyserNodeRef,
  currentDataRef,
  bars = 64,
  smoothing = 0.7,
  paused = false,
  className = '',
}) {
  return (
    <div className={`fixed inset-0 ${className}`}>
      <Canvas camera={{ position: [0, 0.6, 5.2], fov: 60 }} dpr={[1, 2]}>
        <Scene
          analyserNodeRef={analyserNodeRef}
          currentDataRef={currentDataRef}
          bars={bars}
          smoothing={smoothing}
          paused={paused}
        />
      </Canvas>
    </div>
  );
}

// ------------------------
// Usage example (in a Next.js page or component):
//
// const analyserNodeRef = useRef(null); // you already have this
// const currentDataRef = useRef(null);   // you already have this (optional)
//
// <ClubVisualizer
//   analyserNodeRef={analyserNodeRef}
//   currentDataRef={currentDataRef}
//   bars={64}
//   smoothing={0.7}
// />
//
// TIP: Ensure your AnalyserNode is configured:
// analyser.fftSize = 1024; // 512..2048 works well
// analyser.smoothingTimeConstant = 0.8; // audio-side smoothing
//
// If you already fill currentDataRef.current each tick with your own FFT, the component will use it automatically.
