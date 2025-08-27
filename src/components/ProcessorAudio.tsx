import { FC, useRef, useState } from 'react';
import Icon from '@/assets/Icon';

interface ProcessorAudioProps {
  onAudioElement: (audioElement: HTMLAudioElement) => void;
}

export const ProcessorAudio: FC<ProcessorAudioProps> = ({ onAudioElement }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const AUDIO_REF = useRef<HTMLAudioElement | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const SELECTED = e.target.files[0];
    setFile(SELECTED);

    const AUDIO_ELEMENT = new Audio(URL.createObjectURL(SELECTED));
    AUDIO_ELEMENT.preload = 'auto';
    AUDIO_ELEMENT.oncanplay = () => {
      onAudioElement(AUDIO_ELEMENT);
    };
    AUDIO_REF.current = AUDIO_ELEMENT;
    e.target.value = '';
  };

  const playAudio = async () => {
    if (!AUDIO_REF.current) return;
    await AUDIO_REF.current.play();
    setIsPlaying(true);
  };

  const pauseAudio = () => {
    if (!AUDIO_REF.current) return;
    AUDIO_REF.current.pause();
    setIsPlaying(false);
  };

  const stopAudio = () => {
    if (!AUDIO_REF.current) return;
    AUDIO_REF.current.pause();
    AUDIO_REF.current.currentTime = 0;
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold">Audio Player</label>

      {/* Audio Uploader */}
      <div className="flex items-center justify-center">
        <label
          htmlFor="dropzone-file"
          className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer bg-slate-800 py-4"
        >
          <div className="flex flex-col items-center justify-center">
            <Icon.UPLOAD height={24} width={24} className="mb-2" />
            <p className=" text-sm text-slate-400">
              <span className="font-semibold">Click to upload</span> or drag and
              drop
            </p>
            <p className="text-xs text-slate-400">Audio files only</p>
          </div>
          <input
            id="dropzone-file"
            type="file"
            accept="audio/*"
            onChange={onFileChange}
            className="hidden"
          />
        </label>
      </div>

      {/* Audio Player */}
      <div className="bg-slate-950 p-4 rounded-2xl">
        <div className={'mb-4 ' + (!file ? 'text-slate-500' : 'text-slate-50')}>
          <p id="file-name" className="line-clamp-1">
            File: {file?.name || 'No file selected'}
          </p>
          <p id="file-selected">
            Size: {file?.size ? (file.size / 1024 / 1024).toFixed(2) : '0.00'}{' '}
            MB
          </p>
        </div>
        <div className="flex gap-2 justify-between items-center">
          <button
            className="bg-slate-800 text-slate-50 rounded-full w-10 h-10 flex self-center justify-center items-center"
            onClick={stopAudio}
          >
            <Icon.BACK height={16} width={16} />
          </button>
          <button
            className="bg-slate-50 text-slate-950 rounded-full p-4"
            onClick={!isPlaying ? playAudio : pauseAudio}
          >
            {!isPlaying ? (
              <Icon.PLAY height={24} width={24} />
            ) : (
              <Icon.PAUSE height={24} width={24} />
            )}
          </button>
          <button className="bg-slate-800 text-slate-50 rounded-full w-10 h-10 flex self-center justify-center items-center">
            <Icon.NEXT height={16} width={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
