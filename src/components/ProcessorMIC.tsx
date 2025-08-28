import * as React from 'react';

// Props interface for the ProcessorMIC component
interface ProcessorMICProps {
  onMicStream: (stream: MediaStream | null) => void; // Callback to pass MediaStream to parent component
}

/**
 * ProcessorMIC Component
 *
 * A comprehensive microphone input manager that handles:
 * - Audio input device enumeration and selection
 * - MediaStream acquisition and management
 * - Permission handling and error states
 * - Real-time device change detection
 * - User-friendly interface for microphone control
 *
 * Uses the Web Media Devices API to provide professional-grade audio input functionality.
 */
export const ProcessorMIC: React.FC<ProcessorMICProps> = ({ onMicStream }) => {
  // ========== STATE MANAGEMENT ==========

  /**
   * Array of available audio input devices
   * Populated by enumerateDevices() API call
   */
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);

  /**
   * Currently selected audio input device ID
   * Used to specify which microphone to use when starting stream
   */
  const [selected, setSelected] = React.useState<string>('');

  /**
   * Boolean flag indicating if microphone is currently active
   * Controls UI state and button labels
   */
  const [useMic, setUseMic] = React.useState<boolean>(false);

  /**
   * Error message state for user feedback
   * null when no error, string message when error occurs
   */
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Reference to the current MediaStream
   * Used for cleanup when stopping microphone or component unmounting
   */
  const STREAM_REF = React.useRef<MediaStream | null>(null);

  /**
   * Updates the list of available audio input devices
   *
   * Process:
   * 1. Requests microphone permission (required for device enumeration)
   * 2. Enumerates all media devices
   * 3. Filters for audio input devices only
   * 4. Updates component state with available devices
   * 5. Automatically selects default or first available device
   *
   * @returns Promise<MediaDeviceInfo[]> - Array of available audio input devices
   */
  const updateDevices = async (): Promise<MediaDeviceInfo[]> => {
    try {
      /**
       * Request microphone permission first
       * This is required because enumerateDevices() only returns device labels
       * and full device info after permission has been granted
       */
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get all available media devices from the system
      const ALL_DEVICE_LIST = await navigator.mediaDevices.enumerateDevices();

      /**
       * Filter for audio input devices only
       * Also ensures deviceId exists (some devices may not have IDs)
       */
      const AUDIO_INPUTS = ALL_DEVICE_LIST.filter(
        d => d.kind === 'audioinput' && d.deviceId
      );

      // Update component state with available devices
      setDevices(AUDIO_INPUTS);

      // Auto-select default or first available device
      if (AUDIO_INPUTS.length > 0) {
        /**
         * Prefer the 'default' device if available
         * The 'default' device is the system's preferred audio input
         */
        const DEFAULT_INPUT = AUDIO_INPUTS.find(d => d.deviceId === 'default');
        const FIRST_INPUT = DEFAULT_INPUT
          ? DEFAULT_INPUT.deviceId
          : AUDIO_INPUTS[0].deviceId;

        // Only set selected device if none is currently selected
        setSelected(prev => prev || FIRST_INPUT);
      }

      // Update error state based on device availability
      if (AUDIO_INPUTS.length === 0) {
        setError('No microphones found');
      } else {
        setError(null); // Clear any previous errors
      }

      return AUDIO_INPUTS;
    } catch (err) {
      // Handle permission denial or other errors
      setError('Microphone permission denied');
      console.error(err);
      return [];
    }
  };

  /**
   * Effect Hook - Device Management Setup
   *
   * Initializes device enumeration and sets up real-time device change monitoring.
   * This ensures the component stays up-to-date when users plug/unplug microphones.
   */
  React.useEffect(() => {
    // Initial device enumeration on component mount
    updateDevices();

    /**
     * Set up device change listener
     * This fires when audio devices are connected/disconnected
     * Automatically updates the device list in real-time
     */
    navigator.mediaDevices.ondevicechange = updateDevices;

    // Cleanup function - removes device change listener
    return () => {
      navigator.mediaDevices.ondevicechange = null;
    };
  }, []); // Empty dependency array - runs once on mount

  /**
   * Starts microphone input with the selected device
   *
   * Process:
   * 1. Ensures devices are available (refreshes if needed)
   * 2. Requests MediaStream with selected device constraints
   * 3. Stores stream reference for cleanup
   * 4. Passes stream to parent component via callback
   * 5. Updates component state to reflect active microphone
   */
  const startMic = async () => {
    // Ensure we have current device information
    let CURRENT_DEVICES = devices;
    if (CURRENT_DEVICES.length === 0) {
      // Refresh device list if empty
      CURRENT_DEVICES = await updateDevices();
      if (CURRENT_DEVICES.length === 0) {
        setError('No microphones found');
        return;
      }
    }

    try {
      /**
       * Request MediaStream with specific device constraints
       * If no device is selected, browser will use default
       */
      const STREAM = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selected || undefined },
      });

      // Store stream reference for later cleanup
      STREAM_REF.current = STREAM;

      // Pass stream to parent component for audio processing
      onMicStream(STREAM);

      // Update component state to reflect active microphone
      setUseMic(true);
      setError(null); // Clear any previous errors
    } catch (err) {
      // Handle errors (device busy, permission issues, etc.)
      setError('Could not start microphone');
      console.error(err);
    }
  };

  /**
   * Stops the current microphone input
   *
   * Process:
   * 1. Stops all tracks in the current MediaStream
   * 2. Clears the stream reference
   * 3. Notifies parent component that stream is stopped
   * 4. Updates component state to reflect inactive microphone
   */
  const stopMic = () => {
    if (STREAM_REF.current) {
      /**
       * Stop all tracks in the MediaStream
       * This releases the microphone resource and turns off recording indicator
       */
      STREAM_REF.current.getTracks().forEach(t => t.stop());
      STREAM_REF.current = null;
    }

    // Notify parent component that microphone is stopped
    onMicStream(null);

    // Update component state
    setUseMic(false);
  };

  // ========== COMPONENT RENDER ==========
  return (
    <div className="controller-section pb-4">
      {/* Section Title */}
      <label htmlFor="input_audio_device" className="section-title">
        Select Audio Input
      </label>

      {/* Device Selection Dropdown */}
      <select
        id="input_audio_device"
        className="w-full border-y-2 border-theme-800 p-4 text-sm cursor-pointer bg-theme-950"
        value={selected}
        onChange={e => setSelected(e.target.value)}
        disabled={devices.length === 0} // Disable if no devices available
      >
        {/* Conditional rendering based on device availability */}
        {devices.length === 0 ? (
          <option>No Microphones Found</option>
        ) : (
          devices.map(d => (
            <option key={d.deviceId} value={d.deviceId}>
              {/*
                Display device label if available, otherwise show generic name
                Some browsers/systems don't provide device labels without permission
              */}
              {d.label || `Mic ${d.deviceId}`}
            </option>
          ))
        )}
      </select>

      {/* Status/Error Message Display */}
      <p
        className={
          ' text-xs font-700 px-4 ' +
          (error ? 'text-red-400' : 'text-theme-400') // Red for errors, gray for status
        }
      >
        {/* Show error message or current microphone status */}
        {error || `Microphone is ${useMic ? 'in use' : 'not in use'}`}
      </p>

      {/* Control Buttons */}
      <div className="flex gap-2 px-4">
        {/* Start/Restart Microphone Button */}
        <button
          className={
            'btn flex-1 px-4 py-2' +
            (!useMic ? ' btn-primary' : ' btn-secondary') // Primary when stopped, secondary when active
          }
          onClick={startMic}
        >
          {/* Dynamic button text based on microphone state */}
          {useMic ? 'Restart Mic' : 'Use Microphone'}
        </button>

        {/* Stop Microphone Button */}
        <button
          className="btn btn-primary px-4 py-2"
          onClick={stopMic}
          disabled={!useMic} // Disabled when microphone is not active
        >
          Stop
        </button>
      </div>
    </div>
  );
};
