import { FC, useRef, useEffect } from 'react';
import SignalPreview from './SignalPreview';
import ProcessMic from './ProcessMic';
import ProcessAudio from './ProcessAudio';

const PAGE_Home: FC = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const currentDataRef = useRef<Float32Array | null>(null);

  // Initialize once on client
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioCtxRef.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      currentDataRef.current = new Float32Array(analyser.frequencyBinCount);
      audioCtxRef.current = ctx;

      // Optional: connect analyser to destination so you hear the mix
      analyser.connect(ctx.destination);
    }
  }, []);

  return (
    <div className="absolute w-96 top-10 left-10 bg-slate-800/50 text-slate-50 p-5 rounded-xl backdrop-blur flex flex-col gap-4 text-sm z-10">
      <h2 className="text-lg font-bold">Controller</h2>

      <SignalPreview analyserRef={analyserRef} currentDataRef={currentDataRef} />

      <ProcessMic
        analyserRef={analyserRef}
        currentDataRef={currentDataRef}
        audioCtxRef={audioCtxRef}
      />

      <ProcessAudio
        analyserRef={analyserRef}
        currentDataRef={currentDataRef}
        audioCtxRef={audioCtxRef}
      />
    </div>
  );
};

export default PAGE_Home;
