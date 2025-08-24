// components/LightingVisualizer.tsx
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PointLightHelper, Effects } from '@react-three/drei';
import { GodRays } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useRef, useEffect, useState } from 'react';

interface Props {
  analyser: AnalyserNode | null;
}

const LightingVisualizer = ({ analyser }: Props) => {
  const [dataArray, setDataArray] = useState<Uint8Array | null>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const pixelsRef = useRef<THREE.InstancedMesh>(null);

  // Initialize audio data buffer
  useEffect(() => {
    if (analyser) {
      setDataArray(new Uint8Array(analyser.frequencyBinCount));
    }
  }, [analyser]);

  // Animate lights based on frequencies
  useFrame(() => {
    if (analyser && dataArray) {
      analyser.getByteFrequencyData(dataArray);

      const bass = dataArray.slice(0, 40).reduce((a, b) => a + b, 0) / 40;
      const mids = dataArray.slice(40, 120).reduce((a, b) => a + b, 0) / 80;
      const highs = dataArray.slice(120).reduce((a, b) => a + b, 0) / (dataArray.length - 120);

      // Move point light like a moving head
      if (lightRef.current) {
        lightRef.current.intensity = bass / 50;
        lightRef.current.position.x = Math.sin(Date.now() * 0.001) * 5;
        lightRef.current.position.z = Math.cos(Date.now() * 0.001) * 5;
      }

      // Pixel wall animation
      if (pixelsRef.current) {
        const dummy = new THREE.Object3D();
        for (let i = 0; i < 100; i++) {
          const value = dataArray[i % dataArray.length] / 255;
          dummy.position.set((i % 10) - 5, Math.floor(i / 10) - 5, 0);
          dummy.scale.setScalar(value * 2);
          dummy.updateMatrix();
          pixelsRef.current.setMatrixAt(i, dummy.matrix);
        }
        pixelsRef.current.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <>
      {/* Moving head light */}
      <pointLight ref={lightRef} position={[0, 5, 5]} intensity={2} color="white" />
      <PointLightHelper args={[lightRef.current!, 0.5]} />

      {/* Pixel wall */}
      <instancedMesh ref={pixelsRef} args={[null as any, null as any, 100]}>
        <boxGeometry args={[0.5, 0.5, 0.1]} />
        <meshStandardMaterial color="hotpink" emissive="hotpink" emissiveIntensity={1} />
      </instancedMesh>

      {/* God Rays */}
      <Effects>
        <GodRays sun={lightRef} />
      </Effects>
    </>
  );
};

export default LightingVisualizer;
