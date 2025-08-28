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
      const ANALYZER = analyserRef.current;
      const CURRENT_DATA = currentDataRef.current;
      if (!CURRENT_DATA) {
        ANIMATION_ID = requestAnimationFrame(draw);
        return;
      }

      const CANVAS_WIDTH = CANVAS.width;
      const CANVAS_HEIGHT = CANVAS.height;
      CANVAS_CONTEXT.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const GRADIENT = CANVAS_CONTEXT.createLinearGradient(
        0,
        0,
        0,
        CANVAS_HEIGHT
      );
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        GRADIENT.addColorStop(t, `hsl(${t * 120}, 100%, 50%)`);
      }
      CANVAS_CONTEXT.fillStyle = GRADIENT;

      const SMOOTH_FACTOR = 0.1;
      const SCALE = 1;

      if (ANALYZER) {
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
      const NYQUIST_FREQUENCY = 22050;
      const BUFFER_LENGTH = CURRENT_DATA.length;

      for (let i = 0; i < BUFFER_LENGTH; i++) {
        const FREQUENCY = (i / BUFFER_LENGTH) * NYQUIST_FREQUENCY;
        const LOG_X =
          Math.log10(Math.max(FREQUENCY, MIN_FREQUENCY) / MIN_FREQUENCY) /
          Math.log10(MAX_FREQUENCY / MIN_FREQUENCY);
        const POS_X = LOG_X * CANVAS_WIDTH;
        const FREQUENCY_HEIGHT = CURRENT_DATA[i] * CANVAS_HEIGHT * SCALE;

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
