'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { StrobeFlashConfig, VisualizerConfig } from '@/config/Visual';
import { VertexShader, FragmentShader } from '../shaders/strobeFlash';

function strobeFlashVividColor(
  prev: THREE.Color | null,
  config: StrobeFlashConfig
) {
  const COLOR_SATURATION_MIN = Math.max(
    0,
    Math.min(1, config.colorSaturationMin)
  );
  const COLOR_SATURATION_MAX = Math.max(
    COLOR_SATURATION_MIN,
    Math.min(1, config.colorSaturationMax)
  );
  const COLOR_LIGHTNESS = Math.max(0, Math.min(1, config.colorLightness));
  let PREVIOUS_HUE: number | null = null;
  if (prev) {
    const CURRENT_HSL = { h: 0, s: 0, l: 0 };
    prev.getHSL(CURRENT_HSL);
    PREVIOUS_HUE = CURRENT_HSL.h;
  }
  const COLOR_TRIES = Math.max(1, config.colorMaxTries | 0);
  const COLOR_MIN_HUE_DELTA = Math.max(0, Math.min(0.5, config.minHueDelta));
  for (let i = 0; i < COLOR_TRIES; i++) {
    const CURRENT_HUE = Math.random();
    const CURRENT_SATURATION =
      COLOR_SATURATION_MIN +
      Math.random() * (COLOR_SATURATION_MAX - COLOR_SATURATION_MIN);
    if (PREVIOUS_HUE == null)
      return new THREE.Color().setHSL(
        CURRENT_HUE,
        CURRENT_SATURATION,
        COLOR_LIGHTNESS
      );
    const dh = Math.abs(CURRENT_HUE - PREVIOUS_HUE);
    const hueDelta = Math.min(dh, 1 - dh);
    if (hueDelta >= COLOR_MIN_HUE_DELTA)
      return new THREE.Color().setHSL(
        CURRENT_HUE,
        CURRENT_SATURATION,
        COLOR_LIGHTNESS
      );
  }
  if (PREVIOUS_HUE != null) {
    const NEW_HUE = (PREVIOUS_HUE + COLOR_MIN_HUE_DELTA) % 1;
    const NEW_SATURATION =
      COLOR_SATURATION_MIN +
      Math.random() * (COLOR_SATURATION_MAX - COLOR_SATURATION_MIN);
    return new THREE.Color().setHSL(NEW_HUE, NEW_SATURATION, COLOR_LIGHTNESS);
  }
  return new THREE.Color().setHSL(
    Math.random(),
    COLOR_SATURATION_MIN +
      Math.random() * (COLOR_SATURATION_MAX - COLOR_SATURATION_MIN),
    COLOR_LIGHTNESS
  );
}

type Props = {
  strobeFlashRef: React.MutableRefObject<boolean>;
  config: VisualizerConfig;
  gridPx?: number;
  gridPxX?: number;
  gridPxY?: number;
  dotPx?: number;
  decay?: number;
  brightness?: number;
};

export function StrobeFlashLayer({
  strobeFlashRef,
  config,
  gridPx = 48,
  gridPxX,
  gridPxY,
  dotPx = 36,
  decay = 0.12,
  brightness = 1.6,
}: Props) {
  const { viewport, size } = useThree();
  const REF_MATERIAL = useRef<THREE.ShaderMaterial | null>(null);
  const REF_STROBE_FLASH = useRef(0);
  const REF_COLOR = useRef<THREE.Color>(new THREE.Color('#ffffff'));

  const GRID_PIXEL_X = typeof gridPxX === 'number' ? gridPxX : gridPx;
  const GRID_PIXEL_Y = typeof gridPxY === 'number' ? gridPxY : gridPx;

  const SHADER_UNIFORMS = useMemo(
    () => ({
      uResolution: { value: new THREE.Vector2(512, 512) },
      uTime: { value: 0 },
      uLastBeat: { value: 0 },
      uColor: { value: new THREE.Color('#ffffff') },
      uFlash: { value: 0 },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uGridPxX: { value: GRID_PIXEL_X },
      uGridPxY: { value: GRID_PIXEL_Y },
      uDotPx: { value: dotPx },
      uBrightness: { value: brightness },
    }),
    [GRID_PIXEL_X, GRID_PIXEL_Y, dotPx, brightness]
  );

  useFrame((_state, dt) => {
    SHADER_UNIFORMS.uTime.value += dt;

    if (strobeFlashRef.current) {
      REF_STROBE_FLASH.current = 1.0;
      REF_COLOR.current = strobeFlashVividColor(
        REF_COLOR.current,
        config.flash
      );
      SHADER_UNIFORMS.uColor.value.copy(REF_COLOR.current);
      SHADER_UNIFORMS.uCenter.value.set(
        0.5 + (Math.random() - 0.5) * 0.02,
        0.5 + (Math.random() - 0.5) * 0.02
      );

      SHADER_UNIFORMS.uLastBeat.value = SHADER_UNIFORMS.uTime.value;
      SHADER_UNIFORMS.uFlash.value = Math.max(
        SHADER_UNIFORMS.uFlash.value,
        1.0
      );

      strobeFlashRef.current = false;
    }

    SHADER_UNIFORMS.uFlash.value = Math.max(
      SHADER_UNIFORMS.uFlash.value,
      REF_STROBE_FLASH.current
    );
    const STROBE_FLASH_RATE = Math.exp(-dt / Math.max(1e-4, decay));
    REF_STROBE_FLASH.current *= STROBE_FLASH_RATE;
    SHADER_UNIFORMS.uFlash.value *= STROBE_FLASH_RATE;

    const RESOLUTION_WIDTH = size.width;
    const RESOLUTION_HEIGHT = size.height;
    SHADER_UNIFORMS.uResolution.value.set(RESOLUTION_WIDTH, RESOLUTION_HEIGHT);

    SHADER_UNIFORMS.uGridPxX.value = GRID_PIXEL_X;
    SHADER_UNIFORMS.uGridPxY.value = GRID_PIXEL_Y;
    SHADER_UNIFORMS.uDotPx.value = dotPx;
    SHADER_UNIFORMS.uBrightness.value = brightness;
  });

  const [w, h] = useMemo<[number, number]>(
    () => [viewport.width, viewport.height],
    [viewport.width, viewport.height]
  );

  return (
    <mesh scale={[w, h, 1]} position={[0, 0, -0.03]}>
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
