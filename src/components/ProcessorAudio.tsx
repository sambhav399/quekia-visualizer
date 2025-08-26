import { FC, useRef, useState } from 'react';

interface ProcessorAudioProps {
  onAudioElement: (audioElement: HTMLAudioElement) => void;
}

export const ProcessorAudio: FC<ProcessorAudioProps> = ({ onAudioElement }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = e.target.files[0];
    setFile(selected);

    // Create hidden <audio> element
    const audioElement = new Audio(URL.createObjectURL(selected));
    audioElement.preload = 'auto';
    audioElement.oncanplay = () => {
      onAudioElement(audioElement); // Connect to AudioContext for visualization
    };
    audioRef.current = audioElement;
    e.target.value = ''; // Reset input
  };

  const playAudio = async () => {
    if (!audioRef.current) return;
    await audioRef.current.play();
    setIsPlaying(true);
  };

  const pauseAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  };

  const stopAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold">Audio Player</label>
      <input
        type="file"
        accept="audio/*"
        onChange={onFileChange}
        className="border-2 border-slate-700 rounded-lg p-2"
      />

      {file && (
        <div className="flex gap-2 mt-2">
          {!isPlaying ? (
            <button onClick={playAudio} className="px-3 py-1 bg-green-500 rounded">
              Play
            </button>
          ) : (
            <button onClick={pauseAudio} className="px-3 py-1 bg-yellow-500 rounded">
              Pause
            </button>
          )}
          <button onClick={stopAudio} className="px-3 py-1 bg-red-500 rounded">
            Stop
          </button>
        </div>
      )}
    </div>
  );
};
