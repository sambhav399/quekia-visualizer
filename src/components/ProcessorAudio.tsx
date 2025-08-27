import { FC, useRef, useState, useEffect } from 'react';
import Icon from '@/assets/Icon';

interface ProcessorAudioProps {
  onAudioElement: (audioElement: HTMLAudioElement) => void;
}

type RepeatMode = 'none' | 'track' | 'playlist';

export const ProcessorAudio: FC<ProcessorAudioProps> = ({ onAudioElement }) => {
  const [queue, setQueue] = useState<File[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('none');
  const [shuffle, setShuffle] = useState(false);
  const [progress, setProgress] = useState(0);
  const AUDIO_REF = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (queue.length === 0) return;
    const CURRENT_FILE = queue[currentIndex];
    const CURRENT_AUDIO = new Audio(URL.createObjectURL(CURRENT_FILE));
    CURRENT_AUDIO.preload = 'auto';
    CURRENT_AUDIO.oncanplay = () => onAudioElement(CURRENT_AUDIO);
    CURRENT_AUDIO.ontimeupdate = () =>
      setProgress(
        (CURRENT_AUDIO.currentTime / CURRENT_AUDIO.duration) * 100 || 0
      );

    CURRENT_AUDIO.onended = handleTrackEnd;
    AUDIO_REF.current = CURRENT_AUDIO;
    playAudio();
  }, [currentIndex]);

  const handleTrackEnd = () => {
    if (repeat === 'track') {
      playAudio(true);
    } else if (shuffle) {
      playNext(true);
    } else if (currentIndex < queue.length - 1) {
      playNext();
    } else if (repeat === 'playlist') {
      setCurrentIndex(0);
    } else {
      setIsPlaying(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const UPLOADED_FILES = Array.from(e.target.files);
    setQueue(prev => [...prev, ...UPLOADED_FILES]);

    if (!AUDIO_REF.current && UPLOADED_FILES.length > 0) {
      const CURRENT_AUDIO = new Audio(URL.createObjectURL(UPLOADED_FILES[0]));
      CURRENT_AUDIO.preload = 'auto';
      CURRENT_AUDIO.oncanplay = () => onAudioElement(CURRENT_AUDIO);
      CURRENT_AUDIO.ontimeupdate = () =>
        setProgress(
          (CURRENT_AUDIO.currentTime / CURRENT_AUDIO.duration) * 100 || 0
        );
      CURRENT_AUDIO.onended = handleTrackEnd;
      AUDIO_REF.current = CURRENT_AUDIO;
    }

    e.target.value = '';
  };

  const playAudio = async (restart = false) => {
    if (!AUDIO_REF.current) return;
    if (restart) AUDIO_REF.current.currentTime = 0;
    await AUDIO_REF.current.play();
    setIsPlaying(true);
  };

  const pauseAudio = () => {
    AUDIO_REF.current?.pause();
    setIsPlaying(false);
  };

  const playNext = (random = false) => {
    if (queue.length === 0) return;
    if (random) {
      let NEXT_INDEX;
      do {
        NEXT_INDEX = Math.floor(Math.random() * queue.length);
      } while (NEXT_INDEX === currentIndex && queue.length > 1);
      setCurrentIndex(NEXT_INDEX);
    } else {
      setCurrentIndex(prev => (prev + 1) % queue.length);
    }
  };

  const playPrev = () => {
    if (queue.length === 0) return;
    setCurrentIndex(prev => (prev - 1 + queue.length) % queue.length);
  };

  const toggleRepeat = () => {
    setRepeat(prev =>
      prev === 'none' ? 'track' : prev === 'track' ? 'playlist' : 'none'
    );
  };

  const renderJSX_TRACK_UPLOAD = () => {
    return (
      <div className="block">
        <label
          htmlFor="dropzone-file"
          className="flex items-center cursor-pointer bg-slate-800 py-4"
        >
          <div className="px-4">
            <Icon.UPLOAD height={24} width={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-400">
              <span className="font-semibold">Click to upload</span> or drag and
              drop
            </p>
            <p className="text-xs text-slate-400">Audio files only</p>
            <input
              id="dropzone-file"
              type="file"
              accept="audio/*"
              multiple
              onChange={onFileChange}
              className="hidden"
            />
          </div>
        </label>
      </div>
    );
  };

  const renderJSX_PLAYER_FILE = () => {
    const FILE = queue[currentIndex];
    return (
      <div
        className={
          'mb-1 text-xs ' + (!FILE ? 'text-slate-500' : 'text-slate-50')
        }
      >
        {' '}
        <p id="file-name" className="line-clamp-1">
          {' '}
          File: {FILE?.name || 'No file selected'}{' '}
        </p>{' '}
        <p id="file-size" className="line-clamp-1">
          {' '}
          Size: {FILE?.size
            ? (FILE.size / 1024 / 1024).toFixed(2)
            : '0.00'}{' '}
          MB{' '}
        </p>{' '}
      </div>
    );
  };

  const renderJSX_PLAYER_PROGRESS = () => {
    const formatTime = (time: number | undefined): string => {
      if (time == null || isNaN(time)) return '0:00';

      const HOURS = Math.floor(time / 3600);
      const MINUTES = Math.floor((time % 3600) / 60);
      const SECONDS = Math.floor(time % 60)
        .toString()
        .padStart(2, '0');

      if (HOURS > 0) {
        return `${HOURS}:${MINUTES.toString().padStart(2, '0')}:${SECONDS}`;
      }

      return `${MINUTES}:${SECONDS}`;
    };

    return (
      <>
        <input
          id="audio_player"
          type="range"
          value={progress}
          min={0}
          max={100}
          onChange={e => {
            const newValue = parseFloat(e.target.value);
            if (AUDIO_REF.current) {
              AUDIO_REF.current.currentTime =
                (newValue / 100) * AUDIO_REF.current.duration;
            }
            setProgress(Math.round(newValue));
          }}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-700
               [&::-webkit-slider-thumb]:appearance-none
               [&::-webkit-slider-thumb]:h-3
               [&::-webkit-slider-thumb]:w-3
               [&::-webkit-slider-thumb]:rounded-full
               [&::-webkit-slider-thumb]:bg-white
               [&::-moz-range-thumb]:appearance-none
               [&::-moz-range-thumb]:h-3
               [&::-moz-range-thumb]:w-3
               [&::-moz-range-thumb]:rounded-full
               [&::-moz-range-thumb]:bg-white"
        />
        <div className="flex justify-between items-center text-xs mt-1 text-slate-300">
          <p>{formatTime(AUDIO_REF.current?.currentTime)}</p>
          <p>Played: {Math.round(progress)}%</p>
          <p>{formatTime(AUDIO_REF.current?.duration)}</p>
        </div>
      </>
    );
  };

  const renderJSX_PLAYER_CONTROLS = () => {
    return (
      <div className="flex gap-2 justify-between items-center mt-2">
        <button
          onClick={() => setShuffle(!shuffle)}
          className="bg-slate-800 p-2 rounded-full"
        >
          <Icon.SHUFFLE height={16} width={16} />
        </button>
        <button onClick={playPrev} className="bg-slate-800 p-3 rounded-full">
          <Icon.BACK height={16} width={16} />
        </button>
        <button
          className="bg-slate-50 text-slate-950 rounded-full p-4"
          onClick={!isPlaying ? () => playAudio() : pauseAudio}
        >
          {!isPlaying ? (
            <Icon.PLAY height={24} width={24} />
          ) : (
            <Icon.PAUSE height={24} width={24} />
          )}
        </button>
        <button
          onClick={() => playNext(shuffle)}
          className="bg-slate-800 p-3 rounded-full"
        >
          <Icon.NEXT height={16} width={16} />
        </button>
        <button
          onClick={toggleRepeat}
          className="bg-slate-800 p-2 rounded-full"
        >
          {(repeat === 'track' || repeat === 'none') && (
            <Icon.REPEAT_1 height={16} width={16} />
          )}
          {repeat === 'playlist' && <Icon.REPEAT height={16} width={16} />}
        </button>
      </div>
    );
  };

  const renderJSX_TRACK_PLAYER = () => {
    return (
      <div className="bg-slate-950 p-4">
        {renderJSX_PLAYER_FILE()}
        {renderJSX_PLAYER_PROGRESS()}
        {renderJSX_PLAYER_CONTROLS()}
      </div>
    );
  };

  const renderJSX_TRACK_LIST = () => {
    return (
      <div>
        {queue?.map((track, index) => (
          <div
            key={track.lastModified}
            className={`py-2 rounded-lg cursor-pointer hover:bg-slate-800 overflow-hidden ${
              index === currentIndex ? 'bg-slate-800' : ''
            }`}
            onClick={() => setCurrentIndex(index)}
            title={track.name}
          >
            <p className="line-clamp-1">{track.name}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2 py-4">
      <label htmlFor="audio_player" className="text-sm font-semibold px-4">
        Audio Player
      </label>
      {renderJSX_TRACK_PLAYER()}
      {renderJSX_TRACK_UPLOAD()}
      {renderJSX_TRACK_LIST()}
    </div>
  );
};
