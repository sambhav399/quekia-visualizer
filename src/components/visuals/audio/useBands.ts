import { useEffect, useRef } from 'react';
import type { BandSnapshot, VisualizerConfig } from '@/config/Visual';

export type UseBandsResult = {
  byteRef: React.MutableRefObject<Uint8Array | null>;
  snapshotsRef: React.MutableRefObject<BandSnapshot[]>;
  strobeFlashTriggeredRef: React.MutableRefObject<boolean>;
  setupAnalyser: (an: AnalyserNode | null, cfg: VisualizerConfig) => void;
  step: (an: AnalyserNode, cfg: VisualizerConfig) => void;
};

function hzToBin(hz: number, sampleRate: number, fftSize: number) {
  const NYQUIST_FREQUENCY = sampleRate / 2;
  const BIN_FREQUENCY = Math.floor((hz / NYQUIST_FREQUENCY) * (fftSize / 2));
  return Math.max(0, Math.min(fftSize / 2 - 1, BIN_FREQUENCY));
}

function bandEnergy(data: Uint8Array, a: number, b: number) {
  const BAND_FREQUENCY_LOW = Math.max(0, Math.min(a, b));
  const BAND_FREQUENCY_HIGH = Math.min(data.length - 1, Math.max(a, b));
  let SUM_FREQUENCY = 0;
  for (let i = BAND_FREQUENCY_LOW; i <= BAND_FREQUENCY_HIGH; i++)
    SUM_FREQUENCY += data[i];
  return SUM_FREQUENCY / (BAND_FREQUENCY_HIGH - BAND_FREQUENCY_LOW + 1);
}

export function useBands(): UseBandsResult {
  const REF_BYTE = useRef<Uint8Array | null>(null);
  const REF_EMA_SHORT = useRef<Record<string, number>>({});
  const REF_EMA_LONG = useRef<Record<string, number>>({});
  const REF_STATE = useRef<Record<string, { active: boolean }>>({});
  const REF_LAST_HIT = useRef<Record<string, number>>({});
  const REF_SNAP_SHOTS = useRef<BandSnapshot[]>([]);
  const REF_STROBE_FLASH_TRIGGER = useRef<boolean>(false);

  const setupAnalyser = (
    Analyser: AnalyserNode | null,
    Config: VisualizerConfig
  ) => {
    if (!Analyser) return;
    const fft =
      Config.fftSize && Config.fftSize >= 32 && Config.fftSize <= 32768
        ? Config.fftSize
        : 2048;
    Analyser.fftSize = fft;
    Analyser.minDecibels = Config.minDecibels;
    Analyser.maxDecibels = Config.maxDecibels;
    Analyser.smoothingTimeConstant = Config.flash.spectrumSmoothing;
  };

  const step = (Analyser: AnalyserNode, Config: VisualizerConfig) => {
    if (
      !REF_BYTE.current ||
      REF_BYTE.current.length !== Analyser.frequencyBinCount
    ) {
      REF_BYTE.current = new Uint8Array(Analyser.frequencyBinCount);
    }
    const DATA_ARRAY = new Uint8Array(REF_BYTE.current!.buffer as ArrayBuffer);
    Analyser.getByteFrequencyData(DATA_ARRAY);
    const SAMPLE_RATE = Analyser.context.sampleRate ?? 44100;
    const FFT_SIZE = Analyser.fftSize;
    const CURRENT_PERFORMANCE = performance.now();
    let STROBE_FLASH = false;
    const snaps: BandSnapshot[] = [];
    for (const band of Config.bands) {
      const BIN_FREQUENCY_LOW = hzToBin(band.lowHz, SAMPLE_RATE, FFT_SIZE);
      const BIN_FREQUENCY_HIGH = hzToBin(band.highHz, SAMPLE_RATE, FFT_SIZE);
      const energy = bandEnergy(
        DATA_ARRAY,
        BIN_FREQUENCY_LOW,
        BIN_FREQUENCY_HIGH
      );
      const BAND_NAME = band.name;
      const EMA_PREVIOUS_SHORT = REF_EMA_SHORT.current[BAND_NAME] ?? energy;
      const EMA_PREVIOUS_LONG = REF_EMA_LONG.current[BAND_NAME] ?? energy;
      const EMA_SHORT_ALPHA = Config.emaShortAlpha;
      const EMA_LONG_ALPHA = Config.emaLongAlpha;
      const EMA_CURRENT_SHORT =
        (1 - EMA_SHORT_ALPHA) * EMA_PREVIOUS_SHORT + EMA_SHORT_ALPHA * energy;
      const EMA_CURRENT_LONG =
        (1 - EMA_LONG_ALPHA) * EMA_PREVIOUS_LONG + EMA_LONG_ALPHA * energy;
      REF_EMA_SHORT.current[BAND_NAME] = EMA_CURRENT_SHORT;
      REF_EMA_LONG.current[BAND_NAME] = EMA_CURRENT_LONG;
      const CURRENT_BASELINE = Math.max(EMA_CURRENT_LONG, 1e-6);
      const CURRENT_RATIO = (EMA_CURRENT_SHORT + 1e-6) / CURRENT_BASELINE;
      const RISE_DB = 20 * Math.log10(CURRENT_RATIO);
      const CURRENT_STATE = (REF_STATE.current[BAND_NAME] ||= {
        active: false,
      });

      let CURRENT_HIT = false;
      if (!CURRENT_STATE.active) {
        if (
          energy >= band.absFloor &&
          (CURRENT_RATIO >= band.ratioOn || RISE_DB >= band.dbOn)
        ) {
          CURRENT_STATE.active = true;
          CURRENT_HIT = true;
        }
      } else {
        if (CURRENT_RATIO <= band.ratioOff && RISE_DB <= band.dbOff)
          CURRENT_STATE.active = false;
      }
      const refractory = band.refractoryMs ?? 0;
      const ok =
        CURRENT_PERFORMANCE - (REF_LAST_HIT.current[BAND_NAME] ?? 0) >
        refractory;
      if (CURRENT_HIT && ok) {
        REF_LAST_HIT.current[BAND_NAME] = CURRENT_PERFORMANCE;
        if (band.name === Config.StrobeFlashBand) STROBE_FLASH = true;
      }
      snaps.push({
        name: band.name,
        energy,
        ratio: CURRENT_RATIO,
        riseDb: RISE_DB,
        active: CURRENT_STATE.active,
      });
    }
    REF_SNAP_SHOTS.current = snaps;
    REF_STROBE_FLASH_TRIGGER.current = STROBE_FLASH;
  };

  useEffect(() => {
    REF_EMA_SHORT.current = {};
    REF_EMA_LONG.current = {};
    REF_STATE.current = {};
    REF_LAST_HIT.current = {};
    REF_SNAP_SHOTS.current = [];
    REF_STROBE_FLASH_TRIGGER.current = false;
  }, []);

  return {
    byteRef: REF_BYTE,
    snapshotsRef: REF_SNAP_SHOTS,
    strobeFlashTriggeredRef: REF_STROBE_FLASH_TRIGGER,
    setupAnalyser,
    step,
  };
}
