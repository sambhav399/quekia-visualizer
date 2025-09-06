'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { BandSnapshot, VisualizerConfig } from '@/config/Visual';
import { VertexShader, FragmentShader } from '../shaders/festiveVisual';

type Props = {
  snapshotsRef: React.MutableRefObject<BandSnapshot[]>;
  bandName?: string;
  config: VisualizerConfig;
  intensity?: number;
  maxEnergy?: number;
  scale?: number;
  damp?: number;
  strobeRef?: React.MutableRefObject<boolean>;
  expansion?: number;
  strobeDuckDecay?: number;
  zoomCoeff?: number;
  zoomDamp?: number;
  zoomPulseDecay?: number;
  zoomMax?: number;
  zoomCurve?: number;
};

export function FestiveVisualLayer({
  snapshotsRef,
  bandName = 'lowMid',
  intensity = 1.0,
  maxEnergy = 180,
  scale = 1.0,
  damp = 6,
  strobeRef,
  expansion = 0.9,
  strobeDuckDecay = 0.18,
  zoomCoeff = 0.9,
  zoomDamp = 6,
  zoomPulseDecay = 0.12,
  zoomMax = 0.18,
  zoomCurve = 1.4,
}: Props) {
  const { viewport, size, gl } = useThree();
  const REF_MATERIAL = useRef<THREE.ShaderMaterial | null>(null);
  const REF_STROBE_VALUE = useRef(0);
  const REF_ZOOM_PULSE = useRef(0);

  const SHADER_UNIFORMS = useMemo(
    () => ({
      uResolution: { value: new THREE.Vector2(512, 512) },
      uTime: { value: 0 },
      uMod: { value: 0 },
      uIntensity: { value: intensity },
      uScale: { value: scale },
      uExpansion: { value: expansion },
      uStrobe: { value: 0 },
      uZoom: { value: 0 },
    }),
    [intensity, scale, expansion]
  );

  useFrame((_state, dt) => {
    SHADER_UNIFORMS.uTime.value += dt;

    const SNAPS = snapshotsRef.current || [];
    const BAND = SNAPS.find(s => s.name === bandName);
    const BAND_ENERGY = BAND ? BAND.energy : 0;
    const SHADER_MOD_RAW = Math.max(0, Math.min(1, BAND_ENERGY / maxEnergy));

    SHADER_UNIFORMS.uMod.value = THREE.MathUtils.damp(
      SHADER_UNIFORMS.uMod.value,
      SHADER_MOD_RAW,
      damp,
      dt
    );

    SHADER_UNIFORMS.uIntensity.value = intensity;
    SHADER_UNIFORMS.uScale.value = scale;
    SHADER_UNIFORMS.uExpansion.value = expansion;

    const DEVICE_PIXEL_RATIO = gl.getPixelRatio();
    const RESOLUTION_WIDTH = size.width * DEVICE_PIXEL_RATIO;
    const RESOLUTION_HEIGHT = size.height * DEVICE_PIXEL_RATIO;
    SHADER_UNIFORMS.uResolution.value.set(RESOLUTION_WIDTH, RESOLUTION_HEIGHT);

    if (strobeRef?.current) {
      REF_STROBE_VALUE.current = 1.0;
      REF_ZOOM_PULSE.current = Math.max(REF_ZOOM_PULSE.current, 1.0);
      strobeRef.current = false;
    }
    REF_STROBE_VALUE.current *= Math.exp(-dt / Math.max(1e-6, strobeDuckDecay));
    SHADER_UNIFORMS.uStrobe.value = REF_STROBE_VALUE.current;

    const SHADER_MOD_ZOOM_RAW = Math.min(
      1,
      Math.pow(SHADER_MOD_RAW, 0.85) * zoomCoeff
    );

    REF_ZOOM_PULSE.current *= Math.exp(-dt / Math.max(1e-6, zoomPulseDecay));

    let TARGET_COMBINED = Math.max(SHADER_MOD_ZOOM_RAW, REF_ZOOM_PULSE.current);

    if (zoomCurve !== 1.0 && TARGET_COMBINED > 0.0001) {
      TARGET_COMBINED = Math.pow(TARGET_COMBINED, zoomCurve);
    }

    TARGET_COMBINED = Math.min(TARGET_COMBINED, Math.max(0, zoomMax));

    SHADER_UNIFORMS.uZoom.value = THREE.MathUtils.damp(
      SHADER_UNIFORMS.uZoom.value,
      TARGET_COMBINED,
      zoomDamp,
      dt
    );
  });

  const [w, h] = useMemo<[number, number]>(
    () => [viewport.width, viewport.height],
    [viewport.width, viewport.height]
  );

  return (
    <mesh scale={[w, h, 1]} position={[0, 0, -0.02]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={REF_MATERIAL}
        vertexShader={VertexShader}
        fragmentShader={FragmentShader}
        uniforms={SHADER_UNIFORMS}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
