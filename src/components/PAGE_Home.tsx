import { FC, useRef, useEffect, useState } from 'react';
import Icon from '@/assets/Icon';
import { ProcessorAudio } from './ProcessorAudio';
import { ProcessorMIC } from './ProcessorMIC';
import { SignalPreview } from './SignalPreview';
import { Visuals } from './visuals';

/**
 * PAGE_Home Component
 *
 * Main page component that orchestrates an audio visualization system.
 * Uses Web Audio API to analyze audio from microphone input or uploaded files,
 * then displays visual representations through various child components.
 *
 * Architecture:
 * - Creates and manages a single AudioContext for all audio processing
 * - Uses AnalyserNode for real-time frequency analysis
 * - Supports both microphone and file audio sources
 * - Provides visual feedback through multiple visualization components
 */
const PAGE_Home: FC = () => {
  // ========== WEB AUDIO API CORE REFERENCES ==========

  /**
   * Primary AudioContext reference - the foundation of all Web Audio API operations
   * AudioContext provides the audio processing graph and manages audio timing
   */
  const AUDIO_CONTENT_REF = useRef<AudioContext | null>(null);

  /**
   * AnalyserNode reference - performs real-time frequency analysis
   * Extracts frequency data from audio signals for visualization purposes
   */
  const ANALYZER_REF = useRef<AnalyserNode | null>(null);

  /**
   * Float32Array to store current frequency analysis data
   * Updated continuously by the AnalyserNode for real-time visualization
   */
  const CURRENT_DATA_REF = useRef<Float32Array | null>(null);

  // ========== AUDIO SOURCE REFERENCES ==========

  /**
   * MediaStreamAudioSourceNode reference for microphone input
   * Connects microphone stream to the audio analysis chain
   */
  const MIC_SOURCE_REF = useRef<MediaStreamAudioSourceNode | null>(null);

  /**
   * MediaElementAudioSourceNode reference for file playback
   * Connects HTML5 audio elements to the audio analysis chain
   */
  const FILE_SOURCE_REF = useRef<MediaElementAudioSourceNode | null>(null);

  // ========== STATE MANAGEMENT ==========
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  /**
   * Effect Hook - Web Audio API Initialization
   *
   * Sets up the core audio processing infrastructure:
   * - Creates AudioContext for all audio operations
   * - Creates AnalyserNode with optimal FFT settings
   * - Initializes data array for frequency analysis
   * - Handles cleanup on component unmount
   */
  useEffect(() => {
    // Initialize AudioContext if not already created
    if (!AUDIO_CONTENT_REF.current) {
      AUDIO_CONTENT_REF.current = new AudioContext();
    }

    const AUDIO_CONTEXT = AUDIO_CONTENT_REF.current;

    // Create AnalyserNode for frequency analysis
    const ANALYZER = AUDIO_CONTEXT.createAnalyser();

    /**
     * FFT (Fast Fourier Transform) size configuration
     * 2048 provides good balance between frequency resolution and performance
     * - Higher values = more frequency detail but more CPU usage
     * - Must be a power of 2 (256, 512, 1024, 2048, 4096, etc.)
     */
    ANALYZER.fftSize = 2048;
    ANALYZER_REF.current = ANALYZER;

    /**
     * Initialize data array for frequency analysis
     * frequencyBinCount is always fftSize/2 (1024 in this case)
     * Float32Array provides normalized frequency data (-1 to 1 range)
     */
    CURRENT_DATA_REF.current = new Float32Array(ANALYZER.frequencyBinCount);

    // Cleanup function - runs when component unmounts
    return () => {
      // Disconnect all audio sources to prevent memory leaks
      MIC_SOURCE_REF.current?.disconnect();
      FILE_SOURCE_REF.current?.disconnect();

      // Close AudioContext to free system audio resources
      AUDIO_CONTEXT.close();
    };
  }, []); // Empty dependency array - runs once on mount

  /**
   * Microphone Stream Handler
   *
   * Manages microphone input connection to the audio analysis chain.
   * Handles stream switching and ensures proper audio routing.
   *
   * @param stream - MediaStream from microphone or null to disconnect
   */
  const handleMicStream = async (stream: MediaStream | null) => {
    // Ensure audio context and analyzer are available
    if (!AUDIO_CONTENT_REF.current || !ANALYZER_REF.current) return;
    const AUDIO_CONTEXT = AUDIO_CONTENT_REF.current;

    // Disconnect existing microphone source if present
    if (MIC_SOURCE_REF.current) {
      MIC_SOURCE_REF.current.disconnect();
      MIC_SOURCE_REF.current = null;
    }

    // Connect new microphone stream if provided
    if (stream) {
      /**
       * Resume AudioContext if suspended
       * Many browsers suspend AudioContext by default until user interaction
       */
      if (AUDIO_CONTEXT.state === 'suspended') await AUDIO_CONTEXT.resume();

      // Create audio source from microphone stream
      const MIC_SOURCE = AUDIO_CONTEXT.createMediaStreamSource(stream);

      // Connect microphone to analyzer for frequency analysis
      MIC_SOURCE.connect(ANALYZER_REF.current);
      MIC_SOURCE_REF.current = MIC_SOURCE;
    }

    /**
     * Re-establish file audio connections if present
     * This ensures file audio continues to work when switching mic states
     * Connects to both analyzer (for visualization) and destination (for playback)
     */
    if (FILE_SOURCE_REF.current) {
      FILE_SOURCE_REF.current.disconnect();
      FILE_SOURCE_REF.current.connect(ANALYZER_REF.current);
      FILE_SOURCE_REF.current.connect(AUDIO_CONTEXT.destination);
    }
  };

  /**
   * Audio Element Handler
   *
   * Manages file audio connection to the audio analysis chain.
   * Creates MediaElementAudioSourceNode from HTML5 audio elements.
   *
   * @param audioElement - HTML5 audio element for file playback
   */
  const handleAudioElement = async (audioElement: HTMLAudioElement) => {
    // Ensure audio context and analyzer are available
    if (!AUDIO_CONTENT_REF.current || !ANALYZER_REF.current) return;

    const AUDIO_CONTEXT = AUDIO_CONTENT_REF.current;
    const ANALYZER = ANALYZER_REF.current;

    /**
     * Optimization: Skip if already connected to the same audio element
     * Prevents unnecessary disconnections and reconnections
     */
    if (
      FILE_SOURCE_REF.current &&
      FILE_SOURCE_REF.current.mediaElement === audioElement
    ) {
      return;
    }

    // Disconnect existing file source if present
    if (FILE_SOURCE_REF.current) {
      FILE_SOURCE_REF.current.disconnect();
      FILE_SOURCE_REF.current = null;
    }

    /**
     * Resume AudioContext if suspended
     * Required for audio playback to work in most browsers
     */
    if (AUDIO_CONTEXT.state === 'suspended') await AUDIO_CONTEXT.resume();

    // Create audio source from HTML5 audio element
    const FILE_SOURCE = AUDIO_CONTEXT.createMediaElementSource(audioElement);

    /**
     * Dual connection setup:
     * 1. Connect to analyzer for frequency analysis/visualization
     * 2. Connect to destination for actual audio output through speakers
     */
    FILE_SOURCE.connect(ANALYZER);
    FILE_SOURCE.connect(AUDIO_CONTEXT.destination);
    FILE_SOURCE_REF.current = FILE_SOURCE;

    /**
     * Re-establish microphone connections if present
     * This ensures microphone input continues to work when switching audio files
     * Note: Microphone typically doesn't connect to destination (no speaker output)
     */
    if (MIC_SOURCE_REF.current) {
      MIC_SOURCE_REF.current.disconnect();
      MIC_SOURCE_REF.current.connect(ANALYZER);
      MIC_SOURCE_REF.current.connect(AUDIO_CONTEXT.destination);
    }
  };

  const handleFullScreenToggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    }
  };

  const handleVisibilityToggle = () => {
    setIsVisible(isVisible => !isVisible);
  };

  // ========== COMPONENT RENDER ==========
  return (
    <>
      {/*
        Main Visual Display Component
        Full-screen audio visualization with customizable parameters
      */}
      <Visuals
        analyserRef={ANALYZER_REF} // Reference to analyzer for frequency data
        currentDataRef={CURRENT_DATA_REF} // Reference to current analysis data
      />

      {/*
        Control Panel Container
        Houses all user interaction components
      */}
      {!isVisible && (
        <button
          type="button"
          className="btn fixed"
          onClick={handleVisibilityToggle}
        >
          <Icon.SHOW height={16} width={16} />
        </button>
      )}
      <div className={'controller' + (isVisible ? '' : ' hide')}>
        {/* Controller Header */}
        <div id="controller-header" className="controller-header">
          <h2 className="controller-title">Controller</h2>
          <div className="controller-actions">
            <button
              type="button"
              className="btn full-screen"
              onClick={handleFullScreenToggle}
            >
              {isFullscreen ? (
                <Icon.MINI_SCREEN height={16} width={16} />
              ) : (
                <Icon.FULL_SCREEN height={16} width={16} />
              )}
            </button>
            <button
              type="button"
              className="btn hide-controller"
              onClick={handleVisibilityToggle}
            >
              {isVisible ? (
                <Icon.HIDE height={16} width={16} />
              ) : (
                <Icon.SHOW height={16} width={16} />
              )}
            </button>
          </div>
        </div>

        {/*
          Signal Preview Component
          Shows real-time audio signal information and analysis
        */}
        <SignalPreview
          analyserRef={ANALYZER_REF} // Analyzer node for signal analysis
          currentDataRef={CURRENT_DATA_REF} // Current frequency data
        />

        {/* Main Control Panel */}
        <div className="controller-body">
          {/*
            Microphone Input Component
            Handles microphone permissions and stream management
          */}
          <ProcessorMIC onMicStream={handleMicStream} />

          {/*
            Audio File Player Component
            Handles file uploads, playlist management, and playback controls
          */}
          <ProcessorAudio onAudioElement={handleAudioElement} />
        </div>
      </div>
    </>
  );
};

export default PAGE_Home;
