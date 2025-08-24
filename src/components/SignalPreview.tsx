import { FC, useEffect, useRef, ReactNode } from 'react';

interface PROPS_SignalPreview {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  currentDataRef: React.MutableRefObject<Float32Array | null>;
}

const SignalPreview: React.FC<PROPS_SignalPreview> = ({
  analyserRef,
  currentDataRef,
}): ReactNode => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  console.log(analyserRef, currentDataRef);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationId: number;

    const draw = () => {
      const analyser = analyserRef.current;
      const currentData = currentDataRef.current;
      if (!currentData) {
        animationId = requestAnimationFrame(draw);
        return;
      }

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Color gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        gradient.addColorStop(t, `hsl(${t * 120}, 100%, 50%)`);
      }
      ctx.fillStyle = gradient;

      const smoothingFactor = 0;
      const scale = 0.8;

      if (analyser) {
        // Normal mic update
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        for (let i = 0; i < bufferLength; i++) {
          currentData[i] =
            currentData[i] * smoothingFactor + (dataArray[i] / 255) * (1 - smoothingFactor);
        }
      } else {
        // No analyser → slowly decay the last values
        for (let i = 0; i < currentData.length; i++) {
          currentData[i] *= 0.9; // decay factor controls fade speed
        }
      }

      // Draw waveform
      ctx.beginPath();
      const minFreq = 20;
      const maxFreq = 20000;
      const nyquist = 22050;
      const bufferLength = currentData.length;

      for (let i = 0; i < bufferLength; i++) {
        const freq = (i / bufferLength) * nyquist;
        const logX = Math.log10(Math.max(freq, minFreq) / minFreq) / Math.log10(maxFreq / minFreq);
        const xPos = logX * width;
        const value = currentData[i] * height * scale;
        const y = height - value;
        if (i === 0) ctx.moveTo(xPos, y);
        else ctx.lineTo(xPos, y);
      }

      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold">Signal Preview</label>
      <canvas ref={canvasRef} className="w-full h-32 bg-slate-950 rounded-lg" />
    </div>
  );
};

export default SignalPreview;
