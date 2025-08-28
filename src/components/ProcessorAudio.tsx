import { FC, useRef, useState, useEffect, useCallback } from 'react';
import Icon from '@/assets/Icon';

// Props interface for the ProcessorAudio component
interface ProcessorAudioProps {
  onAudioElement: (audioElement: HTMLAudioElement) => void; // Callback to expose audio element to parent
}

// Type definition for repeat modes: no repeat, repeat current track, or repeat entire playlist
type RepeatMode = 'none' | 'track' | 'playlist';

export const ProcessorAudio: FC<ProcessorAudioProps> = ({ onAudioElement }) => {
  // State Management
  const [queue, setQueue] = useState<File[]>([]); // Array of audio files in the playlist
  const [currentIndex, setCurrentIndex] = useState<number>(0); // Index of currently playing track
  const [isPlaying, setIsPlaying] = useState(false); // Boolean flag for play/pause state
  const [repeat, setRepeat] = useState<RepeatMode>('none'); // Current repeat mode
  const [shuffle, setShuffle] = useState(false); // Boolean flag for shuffle mode
  const [progress, setProgress] = useState(0); // Current playback progress (0-100%)

  // Refs for DOM elements and persistent values
  const AUDIO_REF = useRef<HTMLAudioElement | null>(null); // Reference to current audio element
  const REPEAT_REF = useRef<string>(repeat); // Ref to access repeat mode in callbacks
  const SHUFFLE_REF = useRef<boolean>(shuffle); // Ref to access shuffle mode in callbacks
  const LAST_SETUP_FILE_REF = useRef<File | null>(null); // Prevents redundant audio element creation

  /**
   * Handles file input change event
   * Adds selected audio files to the queue and sets up first track if queue was empty
   */
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const UPLOADED_FILES = Array.from(e.target.files);
    setQueue(prev => {
      const NEW_QUEUE = [...prev, ...UPLOADED_FILES];
      // If this is the first upload, automatically select the first track
      if (prev.length === 0) {
        setTimeout(() => setCurrentIndex(0), 0); // Use setTimeout to ensure state update
      }
      return NEW_QUEUE;
    });

    // Clear the input value to allow re-uploading the same files
    e.target.value = '';
  };

  /**
   * Plays the current audio track
   * @param restart - If true, restarts the track from the beginning
   */
  const playAudio = useCallback(async (restart = false) => {
    if (!AUDIO_REF.current) return;

    if (restart) AUDIO_REF.current.currentTime = 0;
    await AUDIO_REF.current.play();
    setIsPlaying(true);
  }, []);

  /**
   * Pauses the current audio track
   */
  const pauseAudio = () => {
    AUDIO_REF.current?.pause();
    setIsPlaying(false);
  };

  /**
   * Plays the previous track in the queue
   * Uses modulo arithmetic to wrap around to the end when at the beginning
   */
  const playPrev = () => {
    if (queue.length === 0) return;
    setCurrentIndex(prev => (prev - 1 + queue.length) % queue.length);
  };

  /**
   * Cycles through repeat modes: none → track → playlist → none
   */
  const toggleRepeat = () => {
    setRepeat(prev =>
      prev === 'none' ? 'track' : prev === 'track' ? 'playlist' : 'none'
    );
  };

  /**
   * Plays the next track in the queue
   * @param random - If true, selects a random track (for shuffle mode)
   */
  const playNext = useCallback(
    (random = false) => {
      if (queue.length === 0) return;

      if (random) {
        // Generate random index, ensuring it's different from current (if more than 1 track)
        let NEXT_INDEX;
        do {
          NEXT_INDEX = Math.floor(Math.random() * queue.length);
        } while (NEXT_INDEX === currentIndex && queue.length > 1);
        setCurrentIndex(NEXT_INDEX);
      } else {
        // Normal sequential playback with wraparound
        setCurrentIndex(prev => (prev + 1) % queue.length);
      }
    },
    [currentIndex, queue.length]
  );

  /**
   * Handles the end of a track based on current playback settings
   * Implements repeat track, shuffle, normal progression, and playlist repeat logic
   */
  const handleTrackEnd = useCallback(() => {
    if (REPEAT_REF.current === 'track') {
      // Repeat current track
      playAudio(true);
    } else if (SHUFFLE_REF.current) {
      // Shuffle to random track
      playNext(true);
    } else if (currentIndex < queue.length - 1) {
      // Normal progression to next track
      playNext();
    } else if (REPEAT_REF.current === 'playlist') {
      // Restart playlist from beginning
      setCurrentIndex(0);
    } else {
      // Stop playing at end of playlist
      setIsPlaying(false);
    }
  }, [currentIndex, queue.length, playAudio, playNext]);

  /**
   * Creates and configures a new HTML5 Audio element for the given file
   * Uses object URL for file access and sets up event listeners
   * @param file - The audio file to set up
   * @returns The configured Audio element
   */
  const setupAudioElement = useCallback(
    (file: File) => {
      // Avoid recreating audio element if file hasn't changed
      if (LAST_SETUP_FILE_REF.current === file && AUDIO_REF.current) {
        return AUDIO_REF.current;
      }

      // Create new audio element with object URL
      const CURRENT_AUDIO = new Audio(URL.createObjectURL(file));
      CURRENT_AUDIO.preload = 'auto'; // Preload audio data

      // Set up event listeners
      CURRENT_AUDIO.oncanplay = () => onAudioElement(CURRENT_AUDIO); // Notify parent when ready
      CURRENT_AUDIO.ontimeupdate = () =>
        setProgress(
          (CURRENT_AUDIO.currentTime / CURRENT_AUDIO.duration) * 100 || 0
        ); // Update progress bar
      CURRENT_AUDIO.onended = handleTrackEnd; // Handle track completion

      LAST_SETUP_FILE_REF.current = file;
      return CURRENT_AUDIO;
    },
    [handleTrackEnd, onAudioElement]
  );

  // Effect to keep refs in sync with state for use in callbacks
  useEffect(() => {
    REPEAT_REF.current = repeat;
    SHUFFLE_REF.current = shuffle;
  }, [repeat, shuffle]);

  // Effect to handle track changes and audio element setup
  useEffect(() => {
    if (queue.length === 0 || currentIndex >= queue.length) return;

    const CURRENT_FILE = queue[currentIndex];

    // Skip if already set up for this file
    if (LAST_SETUP_FILE_REF.current === CURRENT_FILE) return;

    // Remember if audio was playing before switching
    const wasPlaying = AUDIO_REF.current?.paused === false;

    // Pause current audio if playing
    if (AUDIO_REF.current) {
      AUDIO_REF.current.pause();
    }

    // Set up new audio element
    const CURRENT_AUDIO = setupAudioElement(CURRENT_FILE);
    AUDIO_REF.current = CURRENT_AUDIO;

    // Resume playback if it was playing before the track change
    if (wasPlaying && LAST_SETUP_FILE_REF.current !== null) {
      playAudio();
    }
  }, [currentIndex, setupAudioElement, playAudio, queue]);

  /**
   * Renders the file upload section with drag-and-drop styling
   * @returns JSX for the upload interface
   */
  const renderJSX_TRACK_UPLOAD = () => {
    return (
      <div className="block">
        <label
          htmlFor="dropzone-file"
          className="flex items-center cursor-pointer bg-theme-800 py-4"
        >
          <div className="px-4">
            <Icon.UPLOAD height={24} width={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-theme-400">
              <span className="font-700">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-theme-400">Audio files only</p>
            <input
              id="dropzone-file"
              type="file"
              accept="audio/*" // Only accept audio files
              multiple // Allow multiple file selection
              onChange={onFileChange}
              className="hidden" // Hidden input, styled label acts as trigger
            />
          </div>
        </label>
      </div>
    );
  };

  /**
   * Renders current file information (name and size)
   * @returns JSX displaying file details
   */
  const renderJSX_PLAYER_FILE = () => {
    const FILE = queue[currentIndex];
    return (
      <div
        className={
          'mb-1 text-xs ' + (!FILE ? 'text-theme-500' : 'text-theme-50')
        }
      >
        {' '}
        <p id="file-name" className="line-clamp-1">
          {' '}
          <span className="text-theme-400">File:</span>{' '}
          {FILE?.name || 'No file selected'}{' '}
        </p>{' '}
        <p id="file-size" className="line-clamp-1">
          {' '}
          <span className="text-theme-400">Size:</span>{' '}
          {FILE?.size ? (FILE.size / 1024 / 1024).toFixed(2) : '0.00'} MB{' '}
        </p>{' '}
      </div>
    );
  };

  /**
   * Renders the progress bar and time display
   * @returns JSX for progress tracking interface
   */
  const renderJSX_PLAYER_PROGRESS = () => {
    /**
     * Formats time in seconds to MM:SS or H:MM:SS format
     * @param time - Time in seconds
     * @returns Formatted time string
     */
    const formatTime = (time: number | undefined): string => {
      if (time == null || isNaN(time)) return '0:00';

      const HOURS = Math.floor(time / 3600);
      const MINUTES = Math.floor((time % 3600) / 60);
      const SECONDS = Math.floor(time % 60)
        .toString()
        .padStart(2, '0');

      // Include hours if track is longer than 1 hour
      if (HOURS > 0) {
        return `${HOURS}:${MINUTES.toString().padStart(2, '0')}:${SECONDS}`;
      }

      return `${MINUTES}:${SECONDS}`;
    };

    return (
      <>
        {/* Progress slider */}
        <input
          id="audio_player"
          type="range"
          value={progress}
          min={0}
          max={100}
          onChange={e => {
            const VALUE = parseFloat(e.target.value);
            // Seek to new position when user drags slider
            if (AUDIO_REF.current) {
              AUDIO_REF.current.currentTime =
                (VALUE / 100) * AUDIO_REF.current.duration;
            }
            setProgress(VALUE);
          }}
          className="audio-player-progress"
        />
        {/* Time display grid */}
        <div className="grid grid-cols-4 items-center text-xs mt-1 text-theme-300">
          <p className="justify-self-start">
            {formatTime(AUDIO_REF.current?.currentTime)}
          </p>
          <p className="justify-self-center col-span-2">
            Played: {Math.round(progress)}%
          </p>
          <p className="justify-self-end">
            {formatTime(AUDIO_REF.current?.duration)}
          </p>
        </div>
      </>
    );
  };

  /**
   * Renders the main playback control buttons
   * @returns JSX for shuffle, previous, play/pause, next, and repeat controls
   */
  const renderJSX_PLAYER_CONTROLS = () => {
    return (
      <div className="flex gap-2 justify-between items-center mt-2">
        {/* Shuffle toggle button */}
        <button
          onClick={() => setShuffle(!shuffle)}
          className={
            'btn p-2 rounded-full' +
            (!shuffle ? ' opacity-50' : '') + // Dimmed when inactive
            (!isPlaying ? ' bg-brand-900' : ' bg-brand-700')
          }
        >
          <Icon.SHUFFLE height={16} width={16} />
        </button>

        {/* Previous track button */}
        <button
          onClick={playPrev}
          className={
            'btn p-3 rounded-full' +
            (!isPlaying ? ' bg-brand-700' : ' bg-brand-500')
          }
        >
          <Icon.BACK height={16} width={16} />
        </button>

        {/* Main play/pause button - larger and prominent */}
        <button
          className={
            'btn rounded-full p-4' +
            (!isPlaying ? ' btn-primary' : ' btn-secondary')
          }
          onClick={!isPlaying ? () => playAudio() : pauseAudio}
        >
          {!isPlaying ? (
            <Icon.PLAY height={24} width={24} />
          ) : (
            <Icon.PAUSE height={24} width={24} />
          )}
        </button>

        {/* Next track button - respects shuffle mode */}
        <button
          onClick={() => playNext(shuffle)}
          className={
            'btn p-3 rounded-full' +
            (!isPlaying ? ' bg-brand-700' : ' bg-brand-500')
          }
        >
          <Icon.NEXT height={16} width={16} />
        </button>

        {/* Repeat mode toggle button - cycles through none/track/playlist */}
        <button
          onClick={toggleRepeat}
          className={
            'btn p-2 rounded-full' +
            (repeat === 'none' ? ' opacity-50' : '') + // Dimmed when no repeat
            (!isPlaying ? ' bg-brand-900' : ' bg-brand-700')
          }
        >
          {/* Show different icons based on repeat mode */}
          {repeat === 'track' && <Icon.REPEAT_1 height={16} width={16} />}
          {(repeat === 'playlist' || repeat === 'none') && (
            <Icon.REPEAT height={16} width={16} />
          )}
        </button>
      </div>
    );
  };

  /**
   * Renders the complete player interface including file info, progress, and controls
   * @returns JSX for the sticky player header
   */
  const renderJSX_TRACK_PLAYER = () => {
    return (
      <div className="bg-theme-950 p-4 sticky top-0">
        {renderJSX_PLAYER_FILE()}
        {renderJSX_PLAYER_PROGRESS()}
        {renderJSX_PLAYER_CONTROLS()}
      </div>
    );
  };

  /**
   * Renders the scrollable list of tracks in the queue
   * @returns JSX for the playlist display with click-to-select functionality
   */
  const renderJSX_TRACK_LIST = () => {
    return (
      <div className="">
        {queue?.map((track, index) => (
          <div
            key={track.lastModified} // Use lastModified as unique key
            className={`py-2 px-4 text-sm cursor-pointer flex items-center hover:bg-theme-700 ${
              index === currentIndex ? 'bg-theme-800' : '' // Highlight current track
            }`}
            onClick={() => setCurrentIndex(index)} // Click to select track
            title={track.name} // Tooltip shows full name
          >
            <p className="line-clamp-1 flex-1">{track.name}</p>
            {/* Show playing indicator on current track */}
            {index === currentIndex && (
              <p className="text-theme-400">
                <Icon.PLAYING height={16} width={16} />
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Main component render
  return (
    <div className="controller-section gap-0">
      <label htmlFor="audio_player" className="section-title">
        Audio Player
      </label>

      {/* Sticky player controls at top */}
      {renderJSX_TRACK_PLAYER()}

      {/* File upload section */}
      {renderJSX_TRACK_UPLOAD()}

      {/* Scrollable track list */}
      {renderJSX_TRACK_LIST()}

      {/* Additional upload section for long playlists (UX improvement) */}
      {queue.length > 8 && renderJSX_TRACK_UPLOAD()}
    </div>
  );
};
