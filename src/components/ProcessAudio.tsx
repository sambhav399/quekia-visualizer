import { FC, useState, useRef, useEffect } from 'react';
import { Button } from './UI';

interface ProcessAudioProps {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  currentDataRef: React.MutableRefObject<Float32Array | null>;
  audioCtxRef?: React.MutableRefObject<AudioContext | null>;
}

interface AudioTrack {
  id: string;
  name: string;
  url: string;
  size: number;
  duration: number;
  buffer?: AudioBuffer;
}

const ProcessAudio: FC<ProcessAudioProps> = ({ analyserRef, currentDataRef, audioCtxRef }) => {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);

  // Initialize GainNode for mixing
  const ensureGainNode = () => {
    const ctx = audioCtxRef?.current;
    if (!ctx) return null;
    if (!gainRef.current) {
      const gain = ctx.createGain();
      gain.connect(analyserRef.current!);
      gainRef.current = gain;
    }
    return gainRef.current;
  };

  const loadTracks = async (files: FileList) => {
    const ctx = audioCtxRef?.current;
    if (!ctx) return;
    const newTracks: AudioTrack[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      newTracks.push({
        id: crypto.randomUUID(),
        name: file.name,
        url: URL.createObjectURL(file),
        size: file.size,
        duration: buffer.duration,
        buffer,
      });
    }
    setTracks(prev => [...prev, ...newTracks]);
    if (!currentTrack && newTracks.length > 0) setCurrentTrack(newTracks[0]);
  };

  const playTrack = (track: AudioTrack) => {
    const ctx = audioCtxRef?.current;
    if (!ctx || !track.buffer) return;
    const gainNode = ensureGainNode();
    if (!gainNode) return;

    stopTrack();

    const src = ctx.createBufferSource();
    src.buffer = track.buffer;
    src.connect(gainNode);
    const offset = pauseTimeRef.current || 0;
    src.start(0, offset);
    startTimeRef.current = ctx.currentTime - offset;
    sourceRef.current = src;
    setCurrentTrack(track);
    setIsPlaying(true);

    src.onended = () => {
      setIsPlaying(false);
      pauseTimeRef.current = 0;
    };
  };

  const stopTrack = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    pauseTimeRef.current = 0;
    setIsPlaying(false);
  };

  const pauseTrack = () => {
    if (!sourceRef.current || !audioCtxRef?.current) return;
    const ctx = audioCtxRef.current;
    pauseTimeRef.current = ctx.currentTime - startTimeRef.current;
    stopTrack();
  };

  const resumeTrack = () => {
    if (currentTrack) playTrack(currentTrack);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    loadTracks(e.target.files);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold">Audio Player</label>

      {!currentTrack && (
        <input
          type="file"
          multiple
          accept="audio/*"
          onChange={onFileChange}
          className="border-2 border-slate-700 rounded-lg p-2"
        />
      )}

      {currentTrack && (
        <div className="flex flex-col gap-2">
          <div>
            {currentTrack.name} ({(currentTrack.size / 1024).toFixed(2)} KB) -{' '}
            {currentTrack.duration.toFixed(1)}s
          </div>
          <div className="flex gap-2">
            {!isPlaying ? (
              <Button onClick={() => resumeTrack()} className="bg-green-500 text-white">
                Play
              </Button>
            ) : (
              <Button onClick={() => pauseTrack()} className="bg-yellow-500 text-white">
                Pause
              </Button>
            )}
            <Button onClick={() => stopTrack()} className="bg-red-500 text-white">
              Stop
            </Button>
          </div>
        </div>
      )}

      {tracks.length > 1 && (
        <div className="mt-2 flex flex-col gap-1">
          <label className="text-sm font-semibold">Queue</label>
          {tracks.map(t => (
            <div
              key={t.id}
              className={`p-1 rounded cursor-pointer ${t.id === currentTrack?.id ? 'bg-blue-500' : 'bg-slate-700'}`}
              onClick={() => playTrack(t)}
            >
              {t.name} - {t.duration.toFixed(1)}s
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProcessAudio;
