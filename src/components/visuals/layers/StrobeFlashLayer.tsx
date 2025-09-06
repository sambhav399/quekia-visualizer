'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { VisualizerConfig } from '@/config/Visual';
import { VertexShader, FragmentShader } from '../shaders/strobeFlash';

function vivid(prev: THREE.Color | null, cfg: VisualizerConfig['flash']) {
  const sMin = Math.max(0, Math.min(1, cfg.colorSaturationMin));
  const sMax = Math.max(sMin, Math.min(1, cfg.colorSaturationMax));
  const l = Math.max(0, Math.min(1, cfg.colorLightness));
  let prevH: number | null = null;
  if (prev) {
    const hsl = { h: 0, s: 0, l: 0 };
    prev.getHSL(hsl);
    prevH = hsl.h;
  }
  const tries = Math.max(1, cfg.colorMaxTries | 0);
  const minDelta = Math.max(0, Math.min(0.5, cfg.minHueDelta));
  for (let i = 0; i < tries; i++) {
    const h = Math.random();
    const s = sMin + Math.random() * (sMax - sMin);
    if (prevH == null) return new THREE.Color().setHSL(h, s, l);
    const dh = Math.abs(h - prevH);
    const hueDelta = Math.min(dh, 1 - dh);
    if (hueDelta >= minDelta) return new THREE.Color().setHSL(h, s, l);
  }
  if (prevH != null) {
    const h = (prevH + minDelta) % 1;
    const s = sMin + Math.random() * (sMax - sMin);
    return new THREE.Color().setHSL(h, s, l);
  }
  return new THREE.Color().setHSL(
    Math.random(),
    sMin + Math.random() * (sMax - sMin),
    l
  );
}

type Props = {
  kickRef: React.MutableRefObject<boolean>;
  config: VisualizerConfig;
  gridPx?: number;
  gridPxX?: number;
  gridPxY?: number;
  dotPx?: number;
  decay?: number;
  brightness?: number;
};

export function StrobeFlashLayer({
  kickRef,
  config,
  gridPx = 48,
  gridPxX,
  gridPxY,
  dotPx = 36,
  decay = 0.12,
  brightness = 1.6,
}: Props) {
  const { viewport, size } = useThree();
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const flashRef = useRef(0);
  const colorRef = useRef<THREE.Color>(new THREE.Color('#ffffff'));
  const groupRef = useRef<THREE.Group | null>(null);

  const gX = typeof gridPxX === 'number' ? gridPxX : gridPx;
  const gY = typeof gridPxY === 'number' ? gridPxY : gridPx;

  const uniforms = useMemo(
    () => ({
      uResolution: { value: new THREE.Vector2(512, 512) },
      uTime: { value: 0 },
      uLastBeat: { value: 0 },
      uColor: { value: new THREE.Color('#ffffff') },
      uFlash: { value: 0 },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uGridPxX: { value: gX },
      uGridPxY: { value: gY },
      uDotPx: { value: dotPx },
      uBrightness: { value: brightness },
    }),
    [gX, gY, dotPx, brightness]
  );

  useFrame((_state, dt) => {
    uniforms.uTime.value += dt;

    if (kickRef.current) {
      flashRef.current = 1.0;
      colorRef.current = vivid(colorRef.current, config.flash);
      uniforms.uColor.value.copy(colorRef.current);
      uniforms.uCenter.value.set(
        0.5 + (Math.random() - 0.5) * 0.02,
        0.5 + (Math.random() - 0.5) * 0.02
      );

      uniforms.uLastBeat.value = uniforms.uTime.value;
      uniforms.uFlash.value = Math.max(uniforms.uFlash.value, 1.0);

      kickRef.current = false;
    }

    uniforms.uFlash.value = Math.max(uniforms.uFlash.value, flashRef.current);
    const rate = Math.exp(-dt / Math.max(1e-4, decay));
    flashRef.current *= rate;
    uniforms.uFlash.value *= rate;

    const wpx = size.width;
    const hpx = size.height;
    uniforms.uResolution.value.set(wpx, hpx);

    uniforms.uGridPxX.value = gX;
    uniforms.uGridPxY.value = gY;
    uniforms.uDotPx.value = dotPx;
    uniforms.uBrightness.value = brightness;
  });

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;

    g.renderOrder = -1;

    g.traverse((obj: any) => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        mats.forEach((m: any) => {
          if (m) {
            m.depthTest = true;
            m.depthWrite = false;
            m.transparent = true;
          }
        });
      }
    });
  }, [config]);

  const [w, h] = useMemo<[number, number]>(
    () => [viewport.width, viewport.height],
    [viewport.width, viewport.height]
  );

  return (
    <mesh scale={[w, h, 1]} position={[0, 0, -0.03]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VertexShader}
        fragmentShader={FragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
