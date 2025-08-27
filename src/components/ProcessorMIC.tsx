import * as React from 'react';
import { Button } from './UI';

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
    let currentDevices = devices;
    if (currentDevices.length === 0) {
      currentDevices = await updateDevices();
      if (currentDevices.length === 0) {
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
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold">Select Device</label>
      <select
        className="w-full border-2 border-slate-700 rounded-lg p-2"
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
      {error && (
        <p className="text-red-400 text-xs font-semibold mb-2">{error}</p>
      )}

      <div className="flex gap-2">
        <Button className="bg-blue-500 text-white flex-1" onClick={startMic}>
          {useMic ? 'Restart Mic' : 'Use Microphone'}
        </Button>
        <Button
          className="bg-red-500 text-white"
          onClick={stopMic}
          disabled={!useMic}
        >
          Stop
        </Button>
      </div>
    </div>
  );
};
