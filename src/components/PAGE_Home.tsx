import { FC, useRef, useState, useEffect } from 'react';
import { ProcessorMIC } from './ProcessorMIC';
import { ProcessorAudio } from './ProcessorAudio';
import SignalPreview from './SignalPreview';

const PAGE_Home: FC = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const currentDataRef = useRef<Float32Array | null>(null);

  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const fileSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const audioCtx = audioContextRef.current;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    // Data array for visualization
    currentDataRef.current = new Float32Array(analyser.frequencyBinCount);

    return () => {
      // Clean up all sources on unmount
      micSourceRef.current?.disconnect();
      fileSourceRef.current?.disconnect();
      audioCtx.close();
    };
  }, []);

  // 🔹 Mic Stream Handler
  const handleMicStream = async (stream: MediaStream | null) => {
    if (!audioContextRef.current || !analyserRef.current) return;
    const ctx = audioContextRef.current;

    // Stop previous mic node if exists
    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }

    if (stream) {
      if (ctx.state === 'suspended') await ctx.resume();

      const micSource = ctx.createMediaStreamSource(stream);
      micSource.connect(analyserRef.current);
      // micSource.connect(ctx.destination);
      micSourceRef.current = micSource;
    }

    // Reconnect file if already playing
    if (fileSourceRef.current) {
      fileSourceRef.current.disconnect();
      fileSourceRef.current.connect(analyserRef.current);
      fileSourceRef.current.connect(ctx.destination);
    }
  };

  // 🔹 Audio File Handler
  // PAGE_Home.tsx
  const handleAudioElement = async (audioElement: HTMLAudioElement) => {
    if (!audioContextRef.current || !analyserRef.current) return;

    const audioCtx = audioContextRef.current;
    const analyser = analyserRef.current;

    // If same audio element is passed again, just return
    if (fileSourceRef.current && fileSourceRef.current.mediaElement === audioElement) {
      return; // Already connected
    }

    // Disconnect previous source if exists
    if (fileSourceRef.current) {
      fileSourceRef.current.disconnect();
      fileSourceRef.current = null;
    }

    if (audioCtx.state === 'suspended') await audioCtx.resume();

    // Create source only once
    const fileSource = audioCtx.createMediaElementSource(audioElement);
    fileSource.connect(analyser);
    fileSource.connect(audioCtx.destination);
    fileSourceRef.current = fileSource;

    // If mic already running, reconnect it
    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current.connect(analyser);
      micSourceRef.current.connect(audioCtx.destination);
    }
  };

  return (
    <div className="absolute w-96 top-10 left-10 bg-slate-800/50 text-slate-50 p-5 rounded-xl backdrop-blur flex flex-col gap-4 text-sm z-10">
      <h2 className="text-lg font-bold">Controller</h2>
      <SignalPreview analyserRef={analyserRef} currentDataRef={currentDataRef} />
      <ProcessorMIC onMicStream={handleMicStream} />
      <ProcessorAudio onAudioElement={handleAudioElement} />
    </div>
  );
};

export default PAGE_Home;
