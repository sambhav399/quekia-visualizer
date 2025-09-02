import { useEffect, useRef, ReactNode } from 'react';

// Props interface for the SignalPreview component
interface PROPS_SignalPreview {
  analyserRef: React.MutableRefObject<AnalyserNode | null>; // Reference to Web Audio API AnalyserNode
  currentDataRef: React.MutableRefObject<Float32Array | null>; // Reference to current frequency data array
}

/**
 * SignalPreview Component
 *
 * A real-time audio frequency spectrum analyzer that visualizes audio signals using HTML5 Canvas.
 * Creates a professional-grade frequency response display similar to audio engineering software.
 *
 * Features:
 * - Logarithmic frequency scaling (matches human hearing perception)
 * - Smooth animation with customizable smoothing factor
 * - Audio-responsive gradient coloring (red=high, green=low frequencies)
 * - Professional frequency range (20Hz - 20kHz)
 * - Real-time performance optimized with requestAnimationFrame
 *
 * Technical Implementation:
 * - Uses Web Audio API AnalyserNode for frequency analysis
 * - Applies logarithmic scaling for both X (frequency) and Y (amplitude) axes
 * - Implements temporal smoothing to reduce visual noise
 * - Uses filled polygon rendering for professional appearance
 */
export const SignalPreview: React.FC<PROPS_SignalPreview> = ({
  analyserRef,
  currentDataRef,
}): ReactNode => {
  /**
   * Canvas element reference for direct DOM manipulation
   * Required for high-performance 2D graphics rendering
   */
  const CANVAS_REF = useRef<HTMLCanvasElement | null>(null);

  /**
   * Effect Hook - Canvas Animation Setup
   *
   * Initializes and manages the real-time frequency visualization loop.
   * Handles canvas context setup, animation lifecycle, and cleanup.
   */
  useEffect(() => {
    // Ensure canvas element is available
    if (!CANVAS_REF.current) return;

    const CANVAS = CANVAS_REF.current;
    const CANVAS_CONTEXT = CANVAS.getContext('2d');

    // Ensure 2D rendering context is available
    if (!CANVAS_CONTEXT) return;

    // Animation frame ID for cleanup
    let ANIMATION_ID: number;

    /**
     * Main drawing function - executed every animation frame
     *
     * Process:
     * 1. Clear previous frame
     * 2. Set up gradient for frequency-based coloring
     * 3. Get frequency data from AnalyserNode
     * 4. Apply smoothing and scaling
     * 5. Convert to logarithmic coordinates
     * 6. Draw filled frequency curve
     * 7. Schedule next frame
     */
    const draw = () => {
      // Get canvas dimensions for coordinate calculations
      const CANVAS_WIDTH = CANVAS.width;
      const CANVAS_HEIGHT = CANVAS.height;

      // Clear previous frame
      CANVAS_CONTEXT.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      /**
       * Create vertical gradient for frequency visualization
       * Color mapping: Red (top/high freq) → Orange → Yellow → Green (bottom/low freq)
       * This mimics professional audio analyzer color schemes
       */
      const GRADIENT = CANVAS_CONTEXT.createLinearGradient(
        0, // Start X
        0, // Start Y (top)
        0, // End X
        CANVAS_HEIGHT // End Y (bottom)
      );
      GRADIENT.addColorStop(0, 'rgb(255, 0, 0)'); // Red - high frequencies
      GRADIENT.addColorStop(0.4, 'rgb(255, 128, 0)'); // Orange - mid-high frequencies
      GRADIENT.addColorStop(0.6, 'rgb(255, 255, 0)'); // Yellow - mid frequencies
      GRADIENT.addColorStop(1, 'rgb(0, 255, 0)'); // Green - low frequencies
      CANVAS_CONTEXT.fillStyle = GRADIENT;

      // ========== AUDIO PROCESSING PARAMETERS ==========

      /**
       * Temporal smoothing factor (0.0 - 1.0)
       * Lower values = faster response, more jitter
       * Higher values = slower response, smoother animation
       */
      const SMOOTH_FACTOR = 0.1;

      /**
       * Amplitude scaling factor
       * Adjusts overall height sensitivity of the visualization
       */
      const SCALE = 1;

      // Get references to audio analysis components
      const ANALYZER = analyserRef.current;
      const CURRENT_DATA = currentDataRef.current;

      // Skip frame if no frequency data is available
      if (!CURRENT_DATA) {
        ANIMATION_ID = requestAnimationFrame(draw);
        return;
      }

      // Default sample rate fallback
      let SAMPLE_RATE = 0;

      if (ANALYZER) {
        /**
         * Configure AnalyserNode parameters for optimal visualization
         * These settings balance performance with visual quality
         */
        ANALYZER.maxDecibels = -20; // Upper bound for dB scale (prevents clipping)
        ANALYZER.minDecibels = -100; // Lower bound for dB scale (sets noise floor)
        ANALYZER.smoothingTimeConstant = 0.8; // Built-in smoothing (0-1, higher = smoother)
        ANALYZER.fftSize = 2048; // FFT size (higher = more frequency resolution)

        // Get actual sample rate from audio context
        SAMPLE_RATE = ANALYZER.context.sampleRate ?? 44100;

        const BUFFER_LENGTH = ANALYZER.frequencyBinCount; // Always fftSize/2
        const DATA_ARRAY = new Uint8Array(BUFFER_LENGTH); // Byte array for frequency data

        /**
         * Get current frequency data from AnalyserNode
         * Returns values 0-255 representing amplitude at each frequency bin
         */
        ANALYZER.getByteFrequencyData(DATA_ARRAY);

        /**
         * Apply temporal smoothing to frequency data
         * Combines current frame with previous frame for smoother animation
         * Formula: newValue = oldValue * smoothing + currentValue * (1 - smoothing)
         */
        for (let i = 0; i < BUFFER_LENGTH; i++) {
          CURRENT_DATA[i] =
            CURRENT_DATA[i] * SMOOTH_FACTOR +
            (DATA_ARRAY[i] / 255) * (1 - SMOOTH_FACTOR);
        }
      } else {
        /**
         * Decay animation when no analyzer is available
         * Gradually reduces amplitude values to create fade-out effect
         */
        for (let i = 0; i < CURRENT_DATA.length; i++) {
          CURRENT_DATA[i] *= 0.9; // 10% decay per frame
        }
      }

      // ========== FREQUENCY CURVE RENDERING ==========

      // Begin drawing the frequency response curve
      CANVAS_CONTEXT.beginPath();

      /**
       * Audio frequency range constants
       * 20Hz - 20kHz represents the full range of human hearing
       */
      const MIN_FREQUENCY = 20; // Lower bound of human hearing
      const MAX_FREQUENCY = 20000; // Upper bound of human hearing
      const NYQUIST_FREQUENCY = SAMPLE_RATE / 2; // Maximum representable frequency
      const BUFFER_LENGTH = CURRENT_DATA.length;

      /**
       * Professional audio analysis parameters
       * These values can be adjusted for different visualization characteristics
       */
      const TOTAL_TILT_DB = 0; // Frequency tilt compensation (0 = flat response)
      const GAIN_FACTOR = 0.75; // Overall gain multiplier

      /**
       * Main frequency processing loop
       * Converts each frequency bin to screen coordinates with logarithmic scaling
       */
      for (let i = 0; i < BUFFER_LENGTH; i++) {
        /**
         * Convert bin index to actual frequency in Hz
         * Each bin represents (sampleRate/2) / bufferLength Hz
         */
        const FREQUENCY = (i / BUFFER_LENGTH) * NYQUIST_FREQUENCY;

        /**
         * Clamp frequency to human hearing range
         * Prevents log calculation errors with very low frequencies
         */
        const FFP_Y = Math.min(
          Math.max(FREQUENCY, MIN_FREQUENCY),
          MAX_FREQUENCY
        );

        /**
         * Calculate logarithmic Y position for frequency-based gain
         * Used for optional frequency tilt compensation (currently disabled)
         */
        const LOG_Y =
          Math.log2(FFP_Y / MIN_FREQUENCY) /
          Math.log2(MAX_FREQUENCY / MIN_FREQUENCY);

        /**
         * Apply frequency-dependent gain with tilt compensation
         * Currently set to flat response (TOTAL_TILT_DB = 0)
         */
        const GAIN_LENGTH =
          Math.pow(10, (TOTAL_TILT_DB * LOG_Y) / 20) * GAIN_FACTOR;

        /**
         * Calculate final amplitude level with gain applied
         * Clamp to maximum of 1.0 to prevent overdraw
         */
        const GAIN_LEVEL = Math.min(1, CURRENT_DATA[i] * GAIN_LENGTH);

        /**
         * Convert amplitude to canvas height
         * Higher amplitude = taller bars
         */
        const FREQUENCY_HEIGHT = GAIN_LEVEL * CANVAS_HEIGHT * SCALE;

        /**
         * Calculate Y position (inverted because canvas Y=0 is top)
         * Full height - frequency height = position from top
         */
        const POS_Y = CANVAS_HEIGHT - FREQUENCY_HEIGHT;

        /**
         * Calculate logarithmic X position for frequency
         * Logarithmic scaling matches human frequency perception
         * Low frequencies get more space, high frequencies compressed
         */
        const LOG_X =
          Math.log10(Math.max(FREQUENCY, MIN_FREQUENCY) / MIN_FREQUENCY) /
          Math.log10(MAX_FREQUENCY / MIN_FREQUENCY);

        /**
         * Convert logarithmic position to canvas X coordinate
         */
        const POS_X = LOG_X * CANVAS_WIDTH;

        /**
         * Draw line segment to current point
         * First point uses moveTo, subsequent points use lineTo
         */
        if (i === 0) CANVAS_CONTEXT.moveTo(POS_X, POS_Y);
        else CANVAS_CONTEXT.lineTo(POS_X, POS_Y);
      }

      /**
       * Complete the filled polygon
       * Connect to bottom corners to create filled area under curve
       */
      CANVAS_CONTEXT.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT); // Bottom right
      CANVAS_CONTEXT.lineTo(0, CANVAS_HEIGHT); // Bottom left
      CANVAS_CONTEXT.closePath(); // Close the path

      /**
       * Fill the polygon with the gradient
       * Creates the final visual effect
       */
      CANVAS_CONTEXT.fill();

      // Schedule next animation frame
      ANIMATION_ID = requestAnimationFrame(draw);
    };

    // Start the animation loop
    draw();

    /**
     * Cleanup function - runs when component unmounts or dependencies change
     * Cancels the animation frame to prevent memory leaks
     */
    return () => cancelAnimationFrame(ANIMATION_ID);
  }, [analyserRef, currentDataRef]); // Re-run effect if analyzer or data refs change

  // ========== COMPONENT RENDER ==========
  return (
    <div className="controller-section">
      {/* Section title */}
      <p className="section-title">Signal Preview</p>

      {/*
        Canvas element for frequency visualization
        - ref: Direct DOM access for high-performance rendering
        - className: Full width, fixed height, dark background
        - Canvas will auto-size to CSS dimensions
      */}
      <canvas ref={CANVAS_REF} className="w-full h-36 bg-theme-950" />
    </div>
  );
};
