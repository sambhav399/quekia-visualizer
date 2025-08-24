import { FC, useState, useEffect, useRef } from 'react';
import SignalPreview from './SignalPreview';
import ProcessMic from './ProcessMic';

const PAGE_Home: FC = () => {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const currentDataRef = useRef<Float32Array | null>(null);

  return (
    <div className="absolute w-80 top-10 left-10 bg-slate-800/50 text-slate-50 p-5 rounded-xl backdrop-blur flex flex-col gap-4 text-sm z-10">
      <h2 className="text-lg font-bold">Controller</h2>
      <SignalPreview analyserRef={analyserRef} currentDataRef={currentDataRef} />
      <ProcessMic analyserRef={analyserRef} currentDataRef={currentDataRef} />
    </div>
  );
};

export default PAGE_Home;
