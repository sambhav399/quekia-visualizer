import { FC, useRef, useState, useEffect } from 'react';
import { ProcessorMIC } from './ProcessorMIC';
import { ProcessorAudio } from './ProcessorAudio';
import SignalPreview from './SignalPreview';

const PAGE_Home: FC = () => {
  const AUDIO_CONTENT_REF = useRef<AudioContext | null>(null);
  const ANALYZER_REF = useRef<AnalyserNode | null>(null);
  const CURRENT_DATA_REF = useRef<Float32Array | null>(null);

  const MIC_SOURCE_REF = useRef<MediaStreamAudioSourceNode | null>(null);
  const FILE_SOURCE_REF = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    if (!AUDIO_CONTENT_REF.current) {
      AUDIO_CONTENT_REF.current = new AudioContext();
    }
    const AUDIO_CONTEXT = AUDIO_CONTENT_REF.current;
    const ANALYZER = AUDIO_CONTEXT.createAnalyser();
    ANALYZER.fftSize = 2048;
    ANALYZER_REF.current = ANALYZER;

    CURRENT_DATA_REF.current = new Float32Array(ANALYZER.frequencyBinCount);

    return () => {
      MIC_SOURCE_REF.current?.disconnect();
      FILE_SOURCE_REF.current?.disconnect();
      AUDIO_CONTEXT.close();
    };
  }, []);

  const handleMicStream = async (stream: MediaStream | null) => {
    if (!AUDIO_CONTENT_REF.current || !ANALYZER_REF.current) return;
    const AUDIO_CONTEXT = AUDIO_CONTENT_REF.current;

    if (MIC_SOURCE_REF.current) {
      MIC_SOURCE_REF.current.disconnect();
      MIC_SOURCE_REF.current = null;
    }

    if (stream) {
      if (AUDIO_CONTEXT.state === 'suspended') await AUDIO_CONTEXT.resume();

      const MIC_SOURCE = AUDIO_CONTEXT.createMediaStreamSource(stream);
      MIC_SOURCE.connect(ANALYZER_REF.current);
      MIC_SOURCE_REF.current = MIC_SOURCE;
    }

    if (FILE_SOURCE_REF.current) {
      FILE_SOURCE_REF.current.disconnect();
      FILE_SOURCE_REF.current.connect(ANALYZER_REF.current);
      FILE_SOURCE_REF.current.connect(AUDIO_CONTEXT.destination);
    }
  };

  const handleAudioElement = async (audioElement: HTMLAudioElement) => {
    if (!AUDIO_CONTENT_REF.current || !ANALYZER_REF.current) return;

    const AUDIO_CONTEXT = AUDIO_CONTENT_REF.current;
    const ANALYZER = ANALYZER_REF.current;

    if (
      FILE_SOURCE_REF.current &&
      FILE_SOURCE_REF.current.mediaElement === audioElement
    ) {
      return;
    }

    if (FILE_SOURCE_REF.current) {
      FILE_SOURCE_REF.current.disconnect();
      FILE_SOURCE_REF.current = null;
    }

    if (AUDIO_CONTEXT.state === 'suspended') await AUDIO_CONTEXT.resume();

    const FILE_SOURCE = AUDIO_CONTEXT.createMediaElementSource(audioElement);
    FILE_SOURCE.connect(ANALYZER);
    FILE_SOURCE.connect(AUDIO_CONTEXT.destination);
    FILE_SOURCE_REF.current = FILE_SOURCE;

    if (MIC_SOURCE_REF.current) {
      MIC_SOURCE_REF.current.disconnect();
      MIC_SOURCE_REF.current.connect(ANALYZER);
      MIC_SOURCE_REF.current.connect(AUDIO_CONTEXT.destination);
    }
  };

  return (
    <div className="absolute w-80 inset-y-10 left-10 bg-slate-800/50 text-slate-50 rounded-3xl backdrop-blur flex flex-col z-10 border-2 border-slate-800 overflow-hidden">
      <div id="controller-header" className="p-4">
        <h2 className="text-lg font-bold">Controller</h2>
      </div>
      <SignalPreview
        analyserRef={ANALYZER_REF}
        currentDataRef={CURRENT_DATA_REF}
      />
      <div className="overflow-auto flex-1 flex flex-col items-stretch">
        <ProcessorMIC onMicStream={handleMicStream} />
        <ProcessorAudio onAudioElement={handleAudioElement} />
      </div>
    </div>
  );
};

export default PAGE_Home;
