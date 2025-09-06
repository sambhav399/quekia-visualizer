import { FC, useRef, useState, useEffect, useCallback } from 'react';
import Icon from '@/assets/Icon';

// Props interface for the ProcessorAudio component
interface ProcessorAudioProps {
  onAudioElement: (audioElement: HTMLAudioElement) => void; // Callback to expose audio element to parent
}

// Type definition for repeat modes: no repeat, repeat current track, or repeat entire playlist
type RepeatMode = 'none' | 'track' | 'playlist';

/**
 * ProcessorAudio Component (Enhanced Version)
 *
 * A comprehensive audio player with playlist management that provides:
 * - File upload and queue management with drag-and-drop support
 * - Full playback controls (play/pause, next/previous, shuffle, repeat)
 * - Progress tracking and seeking capabilities
 * - Track deletion and playlist management
 * - Memory leak prevention with proper URL cleanup
 * - Enhanced state synchronization for reliable playback
 *
 */
export const ProcessorAudio: FC<ProcessorAudioProps> = ({ onAudioElement }) => {
  // ========== STATE MANAGEMENT ==========

  /**
   * Array of audio files in the playlist queue
   * Files are added through upload interface and managed through playlist
   */
  const [queue, setQueue] = useState<File[]>([]);

  /**
   * Index of currently active track in the queue
   * Used to determine which file to play and highlight in UI
   */
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  /**
   * Boolean flag for current playback state
   * Controls play/pause button appearance and behavior
   */
  const [isPlaying, setIsPlaying] = useState(false);

  /**
   * Current repeat mode setting
   * Determines behavior when tracks end or playlist completes
   */
  const [repeat, setRepeat] = useState<RepeatMode>('none');

  /**
   * Shuffle mode toggle
   * When enabled, next/previous buttons select random tracks
   */
  const [shuffle, setShuffle] = useState(false);

  /**
   * Current playback progress as percentage (0-100)
   * Used for progress bar display and seeking functionality
   */
  const [progress, setProgress] = useState(0);

  // ========== REFS FOR STATE SYNCHRONIZATION ==========

  /**
   * Reference to current HTML5 Audio element
   * Direct DOM access needed for playback control and event handling
   */
  const AUDIO_REF = useRef<HTMLAudioElement | null>(null);

  /**
   * Ref to access repeat mode in async callbacks
   * Prevents stale closure issues in event handlers
   */
  const REPEAT_REF = useRef<RepeatMode>(repeat);

  /**
   * Ref to access shuffle state in async callbacks
   * Ensures callbacks have current shuffle setting
   */
  const SHUFFLE_REF = useRef<boolean>(shuffle);

  /**
   * Ref to access playing state in async callbacks
   * Critical for maintaining playback state during track changes
   */
  const IS_PLAYING_REF = useRef<boolean>(isPlaying);

  /**
   * Ref to track last setup file using unique key
   * Prevents redundant audio element creation for same file
   * Uses file key instead of direct File reference for better comparison
   */
  const LAST_SETUP_FILE_KEY_REF = useRef<string | null>(null);

  /**
   * Ref to track current object URL for memory management
   * Essential for preventing memory leaks by revoking unused URLs
   */
  const AUDIO_URL_REF = useRef<string | null>(null);

  // ========== REF SYNCHRONIZATION EFFECTS ==========

  /**
   * Keep repeat mode ref in sync with state
   * Required for callbacks to access current repeat setting
   */
  useEffect(() => {
    REPEAT_REF.current = repeat;
  }, [repeat]);

  /**
   * Keep shuffle mode ref in sync with state
   * Required for callbacks to access current shuffle setting
   */
  useEffect(() => {
    SHUFFLE_REF.current = shuffle;
  }, [shuffle]);

  /**
   * Keep playing state ref in sync with state
   * Critical for maintaining playback continuity during track changes
   */
  useEffect(() => {
    IS_PLAYING_REF.current = isPlaying;
  }, [isPlaying]);

  // ========== AUDIO CONTROL FUNCTIONS ==========

  /**
   * Plays the current audio track with error handling
   * @param restart - If true, restarts track from beginning
   *
   * Enhanced with proper promise handling and error recovery
   */
  const playAudio = useCallback(async (restart = false) => {
    if (!AUDIO_REF.current) return;

    if (restart) AUDIO_REF.current.currentTime = 0;

    try {
      // Handle the promise returned by play() method
      const p = AUDIO_REF.current.play();
      if (p && typeof p.then === 'function') await p;
      setIsPlaying(true);
    } catch {
      // Gracefully handle play failures (permissions, codec issues, etc.)
      setIsPlaying(false);
    }
  }, []);

  /**
   * Pauses the current audio track
   * Simple wrapper with state update
   */
  const pauseAudio = useCallback(() => {
    AUDIO_REF.current?.pause();
    setIsPlaying(false);
  }, []);

  /**
   * Plays the previous track in queue
   * Uses modulo arithmetic for circular navigation
   */
  const playPrev = useCallback(() => {
    if (queue.length === 0) return;
    setCurrentIndex(prev => (prev - 1 + queue.length) % queue.length);
  }, [queue.length]);

  /**
   * Cycles through repeat modes: none → track → playlist → none
   * Each mode affects end-of-track behavior
   */
  const toggleRepeat = useCallback(() => {
    setRepeat(prev =>
      prev === 'none' ? 'track' : prev === 'track' ? 'playlist' : 'none'
    );
  }, []);

  /**
   * Plays next track with optional shuffle support
   * @param random - If true, selects random track (shuffle mode)
   *
   * Enhanced with better single-track handling
   */
  const playNext = useCallback(
    (random = false) => {
      if (queue.length === 0) return;

      if (random) {
        let NEXT_INDEX;
        // Handle single track case to prevent infinite loop
        if (queue.length === 1) NEXT_INDEX = 0;
        else {
          // Generate random index different from current (if possible)
          do {
            NEXT_INDEX = Math.floor(Math.random() * queue.length);
          } while (NEXT_INDEX === currentIndex && queue.length > 1);
        }
        setCurrentIndex(NEXT_INDEX);
      } else {
        // Normal sequential playback with wraparound
        setCurrentIndex(prev => (prev + 1) % queue.length);
      }
    },
    [currentIndex, queue.length]
  );

  /**
   * Handles end-of-track behavior based on current settings
   * Implements all repeat and shuffle modes
   */
  const handleTrackEnd = useCallback(() => {
    if (REPEAT_REF.current === 'track') {
      // Repeat current track infinitely
      playAudio(true);
    } else if (SHUFFLE_REF.current) {
      // Shuffle to random next track
      playNext(true);
    } else if (currentIndex < queue.length - 1) {
      // Normal progression to next track
      playNext();
    } else if (REPEAT_REF.current === 'playlist') {
      // Restart playlist from beginning
      setCurrentIndex(0);
    } else {
      // Stop at end of playlist
      setIsPlaying(false);
    }
  }, [currentIndex, queue.length, playAudio, playNext]);

  // ========== FILE MANAGEMENT FUNCTIONS ==========

  /**
   * Creates a unique key for file identification
   * Uses multiple file properties to ensure uniqueness
   * @param f - File object to create key for
   * @returns Unique string identifier for the file
   */
  const makeFileKey = (f: File) => `${f.name}::${f.size}::${f.lastModified}`;

  /**
   * Creates and configures HTML5 Audio element for a file
   * Enhanced with proper memory management and comprehensive event handling
   *
   * @param file - Audio file to set up
   * @returns Configured Audio element
   */
  const setupAudioElement = useCallback(
    (file: File) => {
      const key = makeFileKey(file);

      // Avoid redundant setup if file hasn't changed
      if (LAST_SETUP_FILE_KEY_REF.current === key && AUDIO_REF.current) {
        return AUDIO_REF.current;
      }

      // Clean up previous object URL to prevent memory leaks
      if (AUDIO_URL_REF.current) {
        try {
          URL.revokeObjectURL(AUDIO_URL_REF.current);
        } catch {}
        AUDIO_URL_REF.current = null;
      }

      // Create new object URL and audio element
      const url = URL.createObjectURL(file);
      AUDIO_URL_REF.current = url;
      const audio = new Audio(url);
      audio.preload = 'auto'; // Preload audio data for smooth playback

      // ========== AUDIO EVENT HANDLERS ==========

      /**
       * oncanplay: Audio is ready to play
       * Notify parent component for Web Audio API integration
       */
      audio.oncanplay = () => onAudioElement(audio);

      /**
       * ontimeupdate: Playback position changed
       * Update progress bar in real-time
       */
      audio.ontimeupdate = () =>
        setProgress((audio.currentTime / audio.duration) * 100 || 0);

      /**
       * onended: Track finished playing
       * Trigger repeat/shuffle/next logic
       */
      audio.onended = handleTrackEnd;

      /**
       * onplay: Playback started
       * Ensure UI reflects playing state
       */
      audio.onplay = () => setIsPlaying(true);

      /**
       * onpause: Playback paused
       * Enhanced logic to distinguish pause vs. natural end
       */
      audio.onpause = () => {
        const dur = audio.duration || 0;
        const cur = audio.currentTime || 0;
        // Don't update state if pause is due to track ending
        const atEnd = dur > 0 && Math.abs(dur - cur) < 0.5;
        if (!atEnd) setIsPlaying(false);
      };

      LAST_SETUP_FILE_KEY_REF.current = key;
      return audio;
    },
    [handleTrackEnd, onAudioElement]
  );

  // ========== TRACK CHANGE EFFECT ==========

  /**
   * Effect to handle track changes and audio element setup
   * Manages the complete lifecycle of switching between tracks
   */
  useEffect(() => {
    // Skip if no queue or invalid index
    if (queue.length === 0 || currentIndex >= queue.length) return;

    const currentFile = queue[currentIndex];
    const key = makeFileKey(currentFile);

    // Skip if already set up for this file
    if (LAST_SETUP_FILE_KEY_REF.current === key) return;

    // Remember if audio was playing before switching
    const wasPlaying = IS_PLAYING_REF.current;

    // Clean up current audio element and URLs
    if (AUDIO_REF.current) {
      try {
        AUDIO_REF.current.pause();
      } catch {}

      // Clean up object URL to prevent memory leaks
      if (AUDIO_URL_REF.current) {
        try {
          URL.revokeObjectURL(AUDIO_URL_REF.current);
        } catch {}
        AUDIO_URL_REF.current = null;
      }
      AUDIO_REF.current = null;
    }

    // Set up new audio element
    const currentAudio = setupAudioElement(currentFile);
    currentAudio.onended = handleTrackEnd; // Ensure event handler is current
    AUDIO_REF.current = currentAudio;

    // Resume playback if it was playing before track change
    if (wasPlaying) {
      playAudio().catch(() => {
        setIsPlaying(false);
      });
    } else {
      setIsPlaying(false);
    }
  }, [currentIndex, queue, setupAudioElement, playAudio, handleTrackEnd]);

  // ========== FILE UPLOAD HANDLER ==========

  /**
   * Handles file input changes (drag-and-drop or click upload)
   * Adds new files to queue and auto-selects first track if queue was empty
   */
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const uploaded = Array.from(e.target.files);
    setQueue(prev => {
      const next = [...prev, ...uploaded];

      // Auto-select first track if queue was previously empty
      if (prev.length === 0) {
        setTimeout(() => setCurrentIndex(0), 0);
      }
      return next;
    });

    // Reset input to allow uploading same files again
    e.target.value = '';
  };

  // ========== PLAYLIST MANAGEMENT ==========

  /**
   * Deletes a track from the playlist
   * Handles index adjustments and playback state when current track is deleted
   *
   * @param index - Index of track to delete
   */
  const deleteTrack = (index: number) => {
    setQueue(prev => {
      const next = [...prev];
      next.splice(index, 1); // Remove track at index

      // Handle empty playlist
      if (next.length === 0) {
        setCurrentIndex(0);
        setIsPlaying(false);
        if (AUDIO_REF.current) {
          AUDIO_REF.current.pause();
        }
        return [];
      }

      // Adjust current index when deleting tracks
      if (index === currentIndex) {
        // If deleting current track, move to next (or wrap to 0)
        setCurrentIndex(cur => (cur >= next.length ? 0 : cur));
      } else if (index < currentIndex) {
        // If deleting track before current, shift index down
        setCurrentIndex(cur => cur - 1);
      }
      // If deleting track after current, no index adjustment needed

      return next;
    });
  };

  // ========== RENDER FUNCTIONS ==========

  /**
   * Renders file upload interface with drag-and-drop styling
   * Supports multiple file selection and audio-only filtering
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
              accept="audio/*" // Restrict to audio files only
              multiple // Allow multiple file selection
              onChange={onFileChange}
              className="hidden" // Hidden input, styled label acts as button
            />
          </div>
        </label>
      </div>
    );
  };

  /**
   * Renders current file information display
   * Shows file name and size with fallbacks for no selection
   */
  const renderJSX_PLAYER_FILE = () => {
    const FILE = queue[currentIndex];
    return (
      <div
        className={
          'mb-1 text-xs ' + (!FILE ? 'text-theme-500' : 'text-theme-50')
        }
      >
        <p id="file-name" className="line-clamp-1">
          <span className="text-theme-400">File:</span>{' '}
          {FILE?.name || 'No file selected'}
        </p>
        <p id="file-size" className="line-clamp-1">
          <span className="text-theme-400">Size:</span>{' '}
          {FILE?.size ? (FILE.size / 1024 / 1024).toFixed(2) : '0.00'} MB
        </p>
      </div>
    );
  };

  /**
   * Renders progress bar and time display
   * Includes seeking functionality and formatted time display
   */
  const renderJSX_PLAYER_PROGRESS = () => {
    /**
     * Formats seconds to MM:SS or H:MM:SS format
     * Handles undefined/NaN values gracefully
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
        {/* Progress slider with seeking capability */}
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

        {/* Time and progress display */}
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
   * Renders main playback control buttons
   * Includes shuffle, previous, play/pause, next, and repeat controls
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

        {/* Repeat mode toggle - shows different icons for different modes */}
        <button
          onClick={toggleRepeat}
          className={
            'btn p-2 rounded-full' +
            (repeat === 'none' ? ' opacity-50' : '') + // Dimmed when no repeat
            (!isPlaying ? ' bg-brand-900' : ' bg-brand-700')
          }
        >
          {repeat === 'track' && <Icon.REPEAT_1 height={16} width={16} />}
          {(repeat === 'playlist' || repeat === 'none') && (
            <Icon.REPEAT height={16} width={16} />
          )}
        </button>
      </div>
    );
  };

  /**
   * Renders the complete player interface
   * Sticky header with file info, progress, and controls
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
   * Renders the scrollable playlist with click-to-play and delete functionality
   * Enhanced with individual track management
   */
  const renderJSX_TRACK_LIST = () => {
    return (
      <div className="">
        {queue?.map((track, index) => (
          <div
            key={makeFileKey(track)} // Use file key for stable React keys
            className={`py-2 px-4 text-sm cursor-pointer flex items-center hover:bg-theme-700 ${
              index === currentIndex ? 'bg-theme-800' : ''
            }`}
            title={track.name} // Tooltip shows full filename
          >
            {/* Track name - clickable to select */}
            <p
              onClick={() => setCurrentIndex(index)}
              className="line-clamp-1 flex-1"
            >
              {track.name}
            </p>

            {/* Playing indicator for current track */}
            {index === currentIndex && (
              <p className="text-theme-400 mr-2">
                <Icon.PLAYING height={16} width={16} />
              </p>
            )}

            {/* Delete track button */}
            <button
              onClick={() => deleteTrack(index)}
              className="text-danger ml-2"
            >
              <Icon.DELETE height={16} width={16} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  // ========== MAIN COMPONENT RENDER ==========
  return (
    <div className="controller-section gap-0">
      {/* Sticky player controls at top */}
      {renderJSX_TRACK_PLAYER()}

      {/* File upload interface */}
      {renderJSX_TRACK_UPLOAD()}

      {/* Scrollable playlist */}
      {renderJSX_TRACK_LIST()}

      {/* Additional upload section for long playlists (UX improvement) */}
      {queue.length > 10 && renderJSX_TRACK_UPLOAD()}
    </div>
  );
};
