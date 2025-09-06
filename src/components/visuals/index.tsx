'use client';

import React from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { VISUAL_CONFIG, VisualizerConfig } from '@/config/Visual';
import { useBands } from './audio/useBands';
import { HudLayer } from './HudLayer';
import { FestiveVisualLayer } from './layers/FestiveVisualLayer';
import { StrobeFlashLayer } from './layers/StrobeFlashLayer';

export type ClubVisualizerProps = {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  currentDataRef: React.MutableRefObject<Float32Array | null>;
  config?: Partial<VisualizerConfig>;
};

function Scene({
  analyserRef,
  config,
}: {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  config: VisualizerConfig;
}) {
  const { setupAnalyser, step, snapshotsRef, strobeFlashTriggeredRef } =
    useBands();

  React.useEffect(() => {
    setupAnalyser(analyserRef.current, config);
  }, [analyserRef, config, setupAnalyser]);

  useFrame(() => {
    const ANALYZER = analyserRef.current;
    if (!ANALYZER) return;
    step(ANALYZER, config);
  });

  return (
    <>
      <StrobeFlashLayer
        kickRef={strobeFlashTriggeredRef}
        config={config}
        gridPx={32}
        dotPx={32}
        decay={0.175}
        brightness={2}
      />

      <FestiveVisualLayer
        snapshotsRef={snapshotsRef}
        bandName="DYNAMIC_VISUAL"
        config={config}
        intensity={1.1}
        maxEnergy={140}
        scale={1.0}
        damp={6}
        expansion={0.85}
        strobeRef={strobeFlashTriggeredRef}
        strobeDuckDecay={0.18}
      />

      {config.hud.enabled && (
        <HudLayer snapshotsRef={snapshotsRef} config={config} />
      )}
    </>
  );
}

export const Visuals = ({ analyserRef, config }: ClubVisualizerProps) => {
  const CONFIG_MERGED: VisualizerConfig = {
    ...VISUAL_CONFIG,
    ...(config || {}),
    flash: { ...VISUAL_CONFIG.flash, ...(config?.flash || {}) },
    hud: { ...VISUAL_CONFIG.hud, ...(config?.hud || {}) },
    bands: config?.bands ? config.bands : VISUAL_CONFIG.bands,
  };

  return (
    <div className="fixed inset-0">
      <Canvas
        orthographic
        camera={{ zoom: 1, position: [0, 0, 1] }}
        dpr={[1, 2]}
      >
        <Scene analyserRef={analyserRef} config={CONFIG_MERGED} />
      </Canvas>
    </div>
  );
};
