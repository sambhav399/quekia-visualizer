// components/FestivalStage.tsx
import React, {
  Suspense,
  useMemo,
  useRef,
  useEffect,
  useState,
  MutableRefObject,
  RefObject,
} from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import { EffectComposer, Bloom, GodRays } from '@react-three/postprocessing';

export default function FestivalStage() {
  // We store analyser in a ref and also keep state for whether it's ready.
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [analyserReady, setAnalyserReady] = useState(false);

  useEffect(() => {
    let ctx: AudioContext | null = null;
    let mounted = true;
    async function setupAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048; // higher resolution
        src.connect(analyser);
        if (!mounted) return;
        analyserRef.current = analyser;
        setAnalyserReady(true);
      } catch (err) {
        console.error('Audio setup failed', err);
      }
    }
    setupAudio();
    return () => {
      mounted = false;
      analyserRef.current = null;
      if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
    };
  }, []);

  return (
    <div className="w-screen h-screen bg-black">
      <Canvas shadows camera={{ position: [0, 120, 600], fov: 60 }}>
        <Suspense fallback={null}>
          {/* Simple stage floor */}
          <Stage>
            <mesh receiveShadow position={[0, -1, 0]}>
              <boxGeometry args={[10, 1, 10]} />
              {/* single material only */}
              <meshStandardMaterial color={'#111'} />
            </mesh>
          </Stage>

          {/* Pass the analyser ref down */}
          <StageContent analyserRef={analyserRef} />

          {/* Orbit controls for debugging; remove in production */}
          <OrbitControls enablePan enableRotate enableZoom />
        </Suspense>
      </Canvas>
    </div>
  );
}

/* --------------------------- Stage Content ---------------------------- */
/* Everything below expects analyserRef (MutableRefObject) */

function StageContent({ analyserRef }: { analyserRef: MutableRefObject<AnalyserNode | null> }) {
  return (
    <>
      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position-y={-20}>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial color={0x0b0b18} roughness={1} metalness={0} />
      </mesh>

      <ParWall analyserRef={analyserRef} />
      <MovingHeads analyserRef={analyserRef} count={6} />
      <Lasers analyserRef={analyserRef} count={8} />
      <PixelWall analyserRef={analyserRef} cols={18} rows={8} spacing={60} />
      <Blinder analyserRef={analyserRef} />
      <FestivalLights analyserRef={analyserRef} />
      <CameraRig analyserRef={analyserRef} />
    </>
  );
}

/* --------------------------- Utilities ---------------------------- */
/** average helper */
function avg(arr: Uint8Array, s: number, e: number) {
  const end = Math.min(e, arr.length);
  const start = Math.max(0, s);
  let sum = 0;
  for (let i = start; i < end; i++) sum += arr[i];
  return sum / Math.max(1, end - start);
}

/** returns a function that yields smoothed bands each call */
function useBands(analyserRef: MutableRefObject<AnalyserNode | null>) {
  const dataRef = useRef<Uint8Array>(new Uint8Array(0));
  const prev = useRef({ bass: 0, mids: 0, highs: 0 });

  return () => {
    const analyser = analyserRef.current;
    if (!analyser) {
      // graceful decay
      prev.current.bass *= 0.92;
      prev.current.mids *= 0.92;
      prev.current.highs *= 0.92;
      return prev.current;
    }
    if (dataRef.current.length !== analyser.frequencyBinCount) {
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
    }
    analyser.getByteFrequencyData(dataRef.current);
    const d = dataRef.current;
    const bass = avg(d, 0, 48);
    const mids = avg(d, 48, 160);
    const highs = avg(d, 160, d.length);
    const smooth = (old: number, now: number, a = 0.65) => old * a + now * (1 - a);
    prev.current = {
      bass: smooth(prev.current.bass, bass),
      mids: smooth(prev.current.mids, mids),
      highs: smooth(prev.current.highs, highs),
    };
    return prev.current;
  };
}

/* Simple beat detector */
function useBeat(analyserRef: MutableRefObject<AnalyserNode | null>) {
  const getBands = useBands(analyserRef);
  const energyHistory = useRef<number[]>([]);
  const MAX_HIST = 43;
  let hit = 0;
  return () => {
    const { bass } = getBands();
    energyHistory.current.push(bass);
    if (energyHistory.current.length > MAX_HIST) energyHistory.current.shift();
    const mean =
      energyHistory.current.reduce((a, b) => a + b, 0) / Math.max(1, energyHistory.current.length);
    const variance =
      energyHistory.current.reduce((a, b) => a + (b - mean) ** 2, 0) /
      Math.max(1, energyHistory.current.length);
    const std = Math.sqrt(variance);
    const k = 1.2;
    const isHit = bass > mean + k * (std || 1);
    hit = isHit ? 1 : Math.max(0, hit - 0.08);
    return { hit, bass };
  };
}

/* --------------------------- PAR wall ---------------------------- */
function ParWall({ analyserRef }: { analyserRef: MutableRefObject<AnalyserNode | null> }) {
  const matRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const getBands = useBands(analyserRef);

  useFrame(() => {
    const { mids } = getBands();
    if (!matRef.current) return;
    const hue = (mids / 255) * 360;
    matRef.current.color.setHSL(hue / 360, 1, 0.5);
    matRef.current.opacity = 0.18 + (mids / 255) * 0.25;
  });

  return (
    <mesh position={[0, 250, -900]}>
      <planeGeometry args={[1800, 600]} />
      <meshBasicMaterial ref={matRef} color={0x00ffff} transparent opacity={0.25} />
    </mesh>
  );
}

/* --------------------------- Moving heads ---------------------------- */
function MovingHeads({
  analyserRef,
  count = 6,
}: {
  analyserRef: MutableRefObject<AnalyserNode | null>;
  count?: number;
}) {
  const groups = useMemo(
    () => new Array(count).fill(0).map(() => React.createRef<THREE.Group>()),
    [count]
  );
  const coneMats = useMemo(
    () => new Array(count).fill(0).map(() => React.createRef<THREE.MeshBasicMaterial>()),
    [count]
  );
  const spots = useMemo(
    () => new Array(count).fill(0).map(() => React.createRef<THREE.SpotLight>()),
    [count]
  );
  const getBands = useBands(analyserRef);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const { bass, mids } = getBands();

    groups.forEach((gRef, i) => {
      const g = gRef.current;
      if (!g) return;
      const sweep = t * (0.4 + i * 0.05) + i;
      const yaw = Math.sin(sweep) * THREE.MathUtils.degToRad(50);
      const pitch = -THREE.MathUtils.degToRad(25 + Math.sin(sweep * 0.9) * 15);
      g.rotation.set(pitch, yaw, 0);

      const s = spots[i].current;
      if (s) {
        const hue = ((mids / 255) * 360 + i * 30) % 360;
        s.color.setHSL(hue / 360, 1, 0.6);
        s.intensity = 1.2 + (bass / 255) * 3.0;
      }

      const mat = coneMats[i].current;
      if (mat) mat.opacity = 0.1 + (bass / 255) * 0.25;
    });
  });

  return (
    <>
      {groups.map((gRef, i) => {
        const radius = 600;
        const angle = (i / count) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = 200 + (i % 3) * 10;

        // each head has a real target object so spotLight.target works
        const targetRef = useRef<THREE.Object3D>(null);

        return (
          <group ref={gRef} key={`head-${i}`}>
            <object3D ref={targetRef} position={[0, 100, 0]} />
            <spotLight
              ref={spots[i]}
              position={[x, y, z]}
              intensity={2}
              distance={2000}
              angle={THREE.MathUtils.degToRad(12)}
              penumbra={0.4}
              decay={1.5}
              castShadow={false}
              target={targetRef.current ?? undefined}
            />
            <mesh position={[x, y, z]} rotation-x={Math.PI}>
              <coneGeometry args={[12, 1400, 16, 1, true]} />
              <meshBasicMaterial
                ref={coneMats[i]}
                color={0xffffff}
                transparent
                opacity={0.12}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/* --------------------------- Lasers ---------------------------- */
function Lasers({
  analyserRef,
  count = 8,
}: {
  analyserRef: MutableRefObject<AnalyserNode | null>;
  count?: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const matRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const getBands = useBands(analyserRef);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const { highs } = getBands();
    for (let i = 0; i < count; i++) {
      const phase = t * (0.6 + i * 0.03) + i;
      const y = 120 + Math.sin(phase) * 180;
      const rotY = Math.sin(phase * 0.7) * 0.6;
      dummy.position.set(-1000 + (i * 2000) / (count - 1), y, 0);
      dummy.rotation.set(0, rotY, Math.PI / 2);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(i, dummy.matrix);
    }
    if (meshRef.current) meshRef.current.instanceMatrix.needsUpdate = true;

    if (matRef.current) {
      const opacity = 0.08 + (highs / 255) * 0.35;
      matRef.current.opacity = opacity;
      const hue = (highs % 360) / 360;
      matRef.current.color.setHSL(hue, 1, 0.5);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, count]}>
      <cylinderGeometry args={[0.7, 0.7, 2000, 8, 1, true]} />
      <meshBasicMaterial
        ref={matRef}
        color={'white'}
        transparent
        opacity={0.18}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

/* --------------------------- Pixel wall ---------------------------- */
function PixelWall({
  analyserRef,
  cols = 18,
  rows = 8,
  spacing = 60,
}: {
  analyserRef: MutableRefObject<AnalyserNode | null>;
  cols?: number;
  rows?: number;
  spacing?: number;
}) {
  const count = cols * rows;
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const matRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const getBands = useBands(analyserRef);
  const dataRef = useRef<Uint8Array>(new Uint8Array(0));
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // layout once on mount
  useEffect(() => {
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * spacing;
        const y = 350 - r * spacing * 0.75;
        const z = -880;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        meshRef.current?.setMatrixAt(idx++, dummy.matrix);
      }
    }
    if (meshRef.current) meshRef.current.instanceMatrix.needsUpdate = true;
  }, [cols, rows, spacing, dummy]);

  useFrame(() => {
    const analyser = analyserRef.current;
    if (analyser) {
      if (dataRef.current.length !== analyser.frequencyBinCount)
        dataRef.current = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataRef.current);
    } else {
      for (let i = 0; i < dataRef.current.length; i++) dataRef.current[i] *= 0.92;
    }

    if (matRef.current) {
      const mids = avg(dataRef.current, 48, 160);
      const hue = (mids / 255) * 360;
      matRef.current.emissive.setHSL(hue / 360, 1, 0.5);
      matRef.current.emissiveIntensity = 0.3 + (mids / 255) * 1.5;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, count]}>
      <boxGeometry args={[40, 40, 10]} />
      <meshStandardMaterial ref={matRef} color={'#111'} emissive={'#ff00ff'} />
    </instancedMesh>
  );
}

/* --------------------------- Blinder ---------------------------- */
function Blinder({ analyserRef }: { analyserRef: MutableRefObject<AnalyserNode | null> }) {
  const matRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const getBands = useBands(analyserRef);

  useFrame(() => {
    const { highs } = getBands();
    if (!matRef.current) return;
    matRef.current.opacity = THREE.MathUtils.clamp((highs - 200) / 55, 0, 0.9);
  });

  return (
    <mesh position={[0, 200, 300]}>
      <planeGeometry args={[4000, 3000]} />
      <meshBasicMaterial ref={matRef} color={'white'} transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/* --------------------------- FestivalLights (GodRays + sun mesh) ---------------------------- */
function FestivalLights({ analyserRef }: { analyserRef: MutableRefObject<AnalyserNode | null> }) {
  const sunRef = useRef<THREE.Mesh | null>(null);
  const lightRef = useRef<THREE.PointLight | null>(null);
  const getBands = useBands(analyserRef);

  useFrame(() => {
    const { bass } = getBands();
    if (sunRef.current) {
      sunRef.current.position.x = Math.sin(performance.now() * 0.002) * 8;
      sunRef.current.position.z = Math.cos(performance.now() * 0.002) * 8;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 0.6 + (bass / 255) * 2.5;
      lightRef.current.position.copy(sunRef.current?.position ?? new THREE.Vector3(0, 5, 0));
    }
  });

  return (
    <>
      {/* sun mesh used by GodRays */}
      <mesh ref={sunRef} position={[0, 150, -200]}>
        <sphereGeometry args={[8, 16, 16]} />
        <meshBasicMaterial color={'#ffd770'} />
      </mesh>

      {/* a point light to illuminate scene */}
      <pointLight
        ref={lightRef}
        position={[0, 150, -200]}
        color={'#fff'}
        intensity={1}
        distance={2000}
      />

      {/* Composer & GodRays - pass the mesh reference (we use non-null assertion because sunRef is present in JSX) */}
      <EffectComposer>
        <Bloom intensity={1.2} luminanceThreshold={0.2} luminanceSmoothing={0.1} />
        <GodRays sun={sunRef.current!} />
      </EffectComposer>
    </>
  );
}

/* --------------------------- CameraRig ---------------------------- */
function CameraRig({ analyserRef }: { analyserRef: MutableRefObject<AnalyserNode | null> }) {
  const beat = useBeat(analyserRef);
  const getBands = useBands(analyserRef);
  const exposureRef = useRef(1);

  useFrame(({ camera, gl }) => {
    const t = performance.now() * 0.001;
    const { bass } = getBands();
    const { hit } = beat();

    camera.position.x = Math.sin(t * 0.2) * 60 + (bass > 210 ? Math.random() * 10 - 5 : 0);
    camera.position.y = 120 + Math.sin(t * 0.3) * 6 + (bass > 210 ? Math.random() * 8 - 4 : 0);
    camera.position.z = 600 + Math.cos(t * 0.13) * 30;
    camera.lookAt(0, 150, 0);

    const targetExp = hit > 0.5 ? 1.6 : 1.0;
    exposureRef.current += (targetExp - exposureRef.current) * 0.12;
    gl.toneMappingExposure = exposureRef.current;
  });

  return null;
}
