'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BandSnapshot, VisualizerConfig } from '@/config/Visual';

export function HudLayer({
  snapshotsRef,
  config,
}: {
  snapshotsRef: React.MutableRefObject<BandSnapshot[]>;
  config: VisualizerConfig;
}) {
  const { width: vpW, height: vpH } = useThree(s => s.viewport);
  const REF_GROUP = useRef<THREE.Group | null>(null);
  const REF_BARS = useRef<
    Array<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>
  >([]);
  const REF_TEXTURE = useRef<THREE.CanvasTexture | null>(null);
  const REF_TEXTURE_MATERIAL = useRef<THREE.SpriteMaterial | null>(null);
  const REF_SPRITE = useRef<THREE.Sprite | null>(null);

  const DIMENSIONS = useMemo(() => {
    const w = config.hud.width;
    const h = config.hud.height;
    const x = -vpW / 2 + config.hud.marginX + w / 2;
    const y = -vpH / 2 + config.hud.marginY + h / 2;
    return { w, h, x, y };
  }, [
    vpW,
    vpH,
    config.hud.width,
    config.hud.height,
    config.hud.marginX,
    config.hud.marginY,
  ]);

  const CANVAS = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    return c;
  }, []);

  useEffect(() => {
    REF_TEXTURE.current = new THREE.CanvasTexture(CANVAS);
    REF_TEXTURE.current.anisotropy = 1;
    REF_TEXTURE.current.needsUpdate = true;
    REF_TEXTURE_MATERIAL.current = new THREE.SpriteMaterial({
      map: REF_TEXTURE.current,
      transparent: true,
      opacity: config.hud.opacity,
    });
    REF_SPRITE.current = new THREE.Sprite(REF_TEXTURE_MATERIAL.current);
    REF_SPRITE.current.scale.set(DIMENSIONS.w, DIMENSIONS.h, 1);
    if (REF_GROUP.current && REF_SPRITE.current)
      REF_GROUP.current.add(REF_SPRITE.current);
  }, [CANVAS, DIMENSIONS.w, DIMENSIONS.h, config.hud.opacity]);

  useEffect(() => {
    if (!REF_GROUP.current) return;
    REF_BARS.current = [];
    const BANDS_COUNT = config.bands.length;
    const TOTAL_BAR_WIDTH =
      config.hud.barWidth * BANDS_COUNT + config.hud.barGap * (BANDS_COUNT - 1);
    let x =
      -DIMENSIONS.w / 2 +
      (DIMENSIONS.w - TOTAL_BAR_WIDTH) / 2 +
      config.hud.barWidth / 2;
    for (let i = 0; i < BANDS_COUNT; i++) {
      const GEOMETRY = new THREE.PlaneGeometry(config.hud.barWidth, 0.001);
      const MATERIAL = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: config.hud.opacity,
        depthWrite: false,
      });
      const MESH = new THREE.Mesh(GEOMETRY, MATERIAL);
      MESH.position.set(x, -DIMENSIONS.h / 2 + 0.08, 0.01);
      REF_GROUP.current.add(MESH);
      REF_BARS.current.push(MESH);
      x += config.hud.barWidth + config.hud.barGap;
    }
  }, [
    config.bands.length,
    config.hud.barWidth,
    config.hud.barGap,
    config.hud.opacity,
    DIMENSIONS.w,
    DIMENSIONS.h,
  ]);

  useFrame(() => {
    if (!config.hud.enabled) return;
    const CANVAS_CONTEXT = CANVAS.getContext('2d');
    if (!CANVAS_CONTEXT || !REF_TEXTURE.current || !REF_SPRITE.current) return;
    const SNAPS = snapshotsRef.current;
    CANVAS_CONTEXT.clearRect(0, 0, CANVAS.width, CANVAS.height);
    CANVAS_CONTEXT.globalAlpha = config.hud.opacity;
    CANVAS_CONTEXT.fillStyle = '#000';
    CANVAS_CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
    CANVAS_CONTEXT.fillStyle = '#fff';
    CANVAS_CONTEXT.font = `${config.hud.fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`;
    CANVAS_CONTEXT.textBaseline = 'top';
    const PADDING_X = 10;
    let PADDING_Y = PADDING_X;
    for (const s of SNAPS) {
      const line = `${s.name}  E:${s.energy.toFixed(1)}  R:${s.ratio.toFixed(2)}  dB:${s.riseDb.toFixed(1)}  ${s.active ? '●' : '○'}`;
      CANVAS_CONTEXT.fillText(line, PADDING_X, PADDING_Y);
      PADDING_Y += config.hud.fontSize + 4;
    }
    REF_TEXTURE.current.needsUpdate = true;
    const MAX_HEIGHT = DIMENSIONS.h - 0.2;
    for (let i = 0; i < REF_BARS.current.length; i++) {
      const CURRENT_SNAP = SNAPS[i];
      const CURRENT_MESH = REF_BARS.current[i];
      if (!CURRENT_SNAP || !CURRENT_MESH) continue;
      const CURRENT_HEIGHT =
        Math.max(
          0.01,
          Math.min(1, CURRENT_SNAP.energy / config.hud.maxEnergy)
        ) * MAX_HEIGHT;
      CURRENT_MESH.scale.y = CURRENT_HEIGHT;
      CURRENT_MESH.position.y = -DIMENSIONS.h / 2 + 0.08 + CURRENT_HEIGHT / 2;
      const CURRENT_COLUMN = CURRENT_SNAP.active ? 0x00ff88 : 0xffffff;
      CURRENT_MESH.material.color.setHex(CURRENT_COLUMN);
    }
  });

  return (
    <group ref={REF_GROUP} position={[DIMENSIONS.x, DIMENSIONS.y, 0.02]} />
  );
}
