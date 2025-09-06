export type BandSnapshot = {
  name: string;
  energy: number;
  ratio: number;
  riseDb: number;
  active: boolean;
};

export type BandConfig = {
  name: string;
  lowHz: number;
  highHz: number;
  absFloor: number;
  ratioOn: number;
  ratioOff: number;
  dbOn: number;
  dbOff: number;
  refractoryMs?: number;
};

export type StrobeFlashConfig = {
  spectrumSmoothing: number;
  flashDecay: number;
  colorSaturationMin: number;
  colorSaturationMax: number;
  colorLightness: number;
  minHueDelta: number;
  colorMaxTries: number;
};

export type HudConfig = {
  enabled: boolean;
  width: number;
  height: number;
  marginX: number;
  marginY: number;
  barWidth: number;
  barGap: number;
  maxEnergy: number;
  opacity: number;
  fontSize: number;
};

export type VisualizerConfig = {
  fftSize: number;
  minDecibels: number;
  maxDecibels: number;
  emaShortAlpha: number;
  emaLongAlpha: number;
  StrobeFlashBand: string;
  bands: BandConfig[];
  flash: StrobeFlashConfig;
  hud: HudConfig;
};

export const VISUAL_CONFIG: VisualizerConfig = {
  fftSize: 2048,
  minDecibels: -100,
  maxDecibels: -20,
  emaShortAlpha: 0.45,
  emaLongAlpha: 0.03,
  StrobeFlashBand: 'STROBE_FLASH',
  bands: [
    {
      name: 'STROBE_FLASH',
      lowHz: 50,
      highHz: 150,
      absFloor: 210,
      ratioOn: 1,
      ratioOff: 1.5,
      dbOn: 2.2,
      dbOff: 0.8,
      refractoryMs: 110,
    },
    {
      name: 'DYNAMIC_VISUAL',
      lowHz: 2000,
      highHz: 20000,
      absFloor: 8,
      ratioOn: 1.12,
      ratioOff: 1.04,
      dbOn: 2.0,
      dbOff: 0.8,
      refractoryMs: 80,
    },
  ],
  flash: {
    spectrumSmoothing: 0.22,
    flashDecay: 8,
    colorSaturationMin: 0.85,
    colorSaturationMax: 1.0,
    colorLightness: 0.5,
    minHueDelta: 0.08,
    colorMaxTries: 6,
  },
  hud: {
    enabled: true,
    width: 3.6,
    height: 1.4,
    marginX: 0.2,
    marginY: 0.2,
    barWidth: 0.2,
    barGap: 0.12,
    maxEnergy: 255,
    opacity: 0.9,
    fontSize: 18,
  },
};
