import { useEffect, useRef, ReactNode } from 'react';

interface PROPS_SignalPreview {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  currentDataRef: React.MutableRefObject<Float32Array | null>;
}

export const SignalPreview: React.FC<PROPS_SignalPreview> = ({
  analyserRef,
  currentDataRef,
}): ReactNode => {
  const CANVAS_REF = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!CANVAS_REF.current) return;

    const CANVAS = CANVAS_REF.current;
    const CANVAS_CONTEXT = CANVAS.getContext('2d');

    if (!CANVAS_CONTEXT) return;

    let ANIMATION_ID: number;

    const draw = () => {
      const CANVAS_WIDTH = CANVAS.width;
      const CANVAS_HEIGHT = CANVAS.height;
      CANVAS_CONTEXT.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const GRADIENT = CANVAS_CONTEXT.createLinearGradient(
        0,
        0,
        0,
        CANVAS_HEIGHT
      );
      GRADIENT.addColorStop(0, 'rgb(255, 0, 0)');
      GRADIENT.addColorStop(0.4, 'rgb(255, 128, 0)');
      GRADIENT.addColorStop(0.6, 'rgb(255, 255, 0)');
      GRADIENT.addColorStop(1, 'rgb(0, 255, 0)');
      CANVAS_CONTEXT.fillStyle = GRADIENT;

      const SMOOTH_FACTOR = 0.1;
      const SCALE = 1;
      const ANALYZER = analyserRef.current;
      const CURRENT_DATA = currentDataRef.current;

      if (!CURRENT_DATA) {
        ANIMATION_ID = requestAnimationFrame(draw);
        return;
      }

      let SAMPLE_RATE = 0;
      if (ANALYZER) {
        ANALYZER.maxDecibels = -20;
        ANALYZER.minDecibels = -100;
        ANALYZER.smoothingTimeConstant = 0.8;
        ANALYZER.fftSize = 2048;

        SAMPLE_RATE = ANALYZER.context.sampleRate;
        const BUFFER_LENGTH = ANALYZER.frequencyBinCount;
        const DATA_ARRAY = new Uint8Array(BUFFER_LENGTH);
        ANALYZER.getByteFrequencyData(DATA_ARRAY);
        for (let i = 0; i < BUFFER_LENGTH; i++) {
          CURRENT_DATA[i] =
            CURRENT_DATA[i] * SMOOTH_FACTOR +
            (DATA_ARRAY[i] / 255) * (1 - SMOOTH_FACTOR);
        }
      } else {
        for (let i = 0; i < CURRENT_DATA.length; i++) {
          CURRENT_DATA[i] *= 0.9;
        }
      }

      CANVAS_CONTEXT.beginPath();
      const MIN_FREQUENCY = 20;
      const MAX_FREQUENCY = 20000;
      const NYQUIST_FREQUENCY = SAMPLE_RATE / 2;
      const BUFFER_LENGTH = CURRENT_DATA.length;
      const TOTAL_TILT_DB = 0;
      const GAIN_FACTOR = 0.75;

      for (let i = 0; i < BUFFER_LENGTH; i++) {
        const FREQUENCY = (i / BUFFER_LENGTH) * NYQUIST_FREQUENCY;
        const LOG_X =
          Math.log10(Math.max(FREQUENCY, MIN_FREQUENCY) / MIN_FREQUENCY) /
          Math.log10(MAX_FREQUENCY / MIN_FREQUENCY);
        const POS_X = LOG_X * CANVAS_WIDTH;
        const FREQUENCY_FACTOR = Math.min(
          Math.max(FREQUENCY, MIN_FREQUENCY),
          MAX_FREQUENCY
        );
        const POS_LOG =
          Math.log2(FREQUENCY_FACTOR / MIN_FREQUENCY) /
          Math.log2(MAX_FREQUENCY / MIN_FREQUENCY);
        const GAIN_LENGTH =
          Math.pow(10, (TOTAL_TILT_DB * POS_LOG) / 20) * GAIN_FACTOR;
        const GAIN_LEVEL = Math.min(1, CURRENT_DATA[i] * GAIN_LENGTH);
        const FREQUENCY_HEIGHT = GAIN_LEVEL * CANVAS_HEIGHT * SCALE;
        const POS_Y = CANVAS_HEIGHT - FREQUENCY_HEIGHT;

        if (i === 0) CANVAS_CONTEXT.moveTo(POS_X, POS_Y);
        else CANVAS_CONTEXT.lineTo(POS_X, POS_Y);
      }

      CANVAS_CONTEXT.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      CANVAS_CONTEXT.lineTo(0, CANVAS_HEIGHT);
      CANVAS_CONTEXT.closePath();
      CANVAS_CONTEXT.fill();

      ANIMATION_ID = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(ANIMATION_ID);
  }, [analyserRef, currentDataRef]);

  return (
    <div className="controller-section">
      <p className="section-title">Signal Preview</p>
      <canvas ref={CANVAS_REF} className="w-full h-36 bg-theme-950" />
    </div>
  );
};
