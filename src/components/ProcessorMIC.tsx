import * as React from 'react';

interface ProcessorMICProps {
  onMicStream: (stream: MediaStream | null) => void;
}

export const ProcessorMIC: React.FC<ProcessorMICProps> = ({ onMicStream }) => {
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = React.useState<string>('');
  const [useMic, setUseMic] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const STREAM_REF = React.useRef<MediaStream | null>(null);

  const updateDevices = async (): Promise<MediaDeviceInfo[]> => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const ALL_DEVICE_LIST = await navigator.mediaDevices.enumerateDevices();
      const AUDIO_INPUTS = ALL_DEVICE_LIST.filter(
        d => d.kind === 'audioinput' && d.deviceId
      );

      setDevices(AUDIO_INPUTS);

      if (AUDIO_INPUTS.length > 0) {
        const DEFAULT_INPUT = AUDIO_INPUTS.find(d => d.deviceId === 'default');
        const FIRST_INPUT = DEFAULT_INPUT
          ? DEFAULT_INPUT.deviceId
          : AUDIO_INPUTS[0].deviceId;
        setSelected(prev => prev || FIRST_INPUT);
      }

      if (AUDIO_INPUTS.length === 0) {
        setError('No microphones found');
      } else {
        setError(null);
      }

      return AUDIO_INPUTS;
    } catch (err) {
      setError('Microphone permission denied');
      return [];
    }
  };

  React.useEffect(() => {
    updateDevices();
    navigator.mediaDevices.ondevicechange = updateDevices;
    return () => {
      navigator.mediaDevices.ondevicechange = null;
    };
  }, []);

  const startMic = async () => {
    let CURRENT_DEVICES = devices;
    if (CURRENT_DEVICES.length === 0) {
      CURRENT_DEVICES = await updateDevices();
      if (CURRENT_DEVICES.length === 0) {
        setError('No microphones found');
        return;
      }
    }

    try {
      const STREAM = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selected || undefined },
      });

      STREAM_REF.current = STREAM;
      onMicStream(STREAM);

      setUseMic(true);
      setError(null);
    } catch (err) {
      setError('Could not start microphone');
      console.error(err);
    }
  };

  const stopMic = () => {
    if (STREAM_REF.current) {
      STREAM_REF.current.getTracks().forEach(t => t.stop());
      STREAM_REF.current = null;
    }
    onMicStream(null);
    setUseMic(false);
  };

  return (
    <div className="controller-section pb-4">
      <label htmlFor="input_audio_device" className="section-title">
        Select Audio Input
      </label>
      <select
        id="input_audio_device"
        className="w-full border-y-2 border-theme-800 p-4 text-sm cursor-pointer"
        value={selected}
        onChange={e => setSelected(e.target.value)}
        disabled={devices.length === 0}
      >
        {devices.length === 0 ? (
          <option>No Microphones Found</option>
        ) : (
          devices.map(d => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Mic ${d.deviceId}`}
            </option>
          ))
        )}
      </select>

      <p
        className={
          ' text-xs font-700 px-4 ' +
          (error ? 'text-red-400' : 'text-theme-400')
        }
      >
        {error || `Microphone is ${useMic ? 'in use' : 'not in use'}`}
      </p>

      <div className="flex gap-2 px-4">
        <button
          className={
            'btn flex-1 px-4 py-2' +
            (!useMic ? ' btn-primary' : ' btn-secondary')
          }
          onClick={startMic}
        >
          {useMic ? 'Restart Mic' : 'Use Microphone'}
        </button>
        <button
          className="btn btn-primary px-4 py-2"
          onClick={stopMic}
          disabled={!useMic}
        >
          Stop
        </button>
      </div>
    </div>
  );
};
