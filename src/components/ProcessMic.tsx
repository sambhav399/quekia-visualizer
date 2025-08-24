import { FC, useState, useEffect } from 'react';
import SignalPreview from './SignalPreview';
import { Button } from './UI';

interface ProcessMicProps {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  currentDataRef: React.MutableRefObject<Float32Array | null>;
  audioCtxRef?: React.MutableRefObject<AudioContext | null>;
}

const ProcessMic: FC<ProcessMicProps> = ({ analyserRef, currentDataRef, audioCtxRef }) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [source, setSource] = useState<MediaStreamAudioSourceNode | null>(null);
  const [useMic, setUseMic] = useState(false);

  const updateDevices = async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const inputs = list.filter(d => d.kind === 'audioinput' && d.deviceId);
      setDevices(inputs);
      if (inputs.length > 0 && !selected) {
        const def = inputs.find(d => d.deviceId === 'default');
        setSelected(def ? def.deviceId : inputs[0].deviceId);
      }
    } catch (err) {
      console.error('Error enumerating devices:', err);
    }
  };

  useEffect(() => {
    updateDevices();
    navigator.mediaDevices.ondevicechange = updateDevices;
    return () => {
      navigator.mediaDevices.ondevicechange = null;
    };
  }, []);

  const onMicStart = async (deviceId?: string) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });

      await updateDevices();

      const ctx = audioCtx?.state !== 'closed' && audioCtx ? audioCtx : new AudioContext();
      const src = ctx.createMediaStreamSource(newStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);

      setAudioCtx(ctx);
      setStream(newStream);
      setSource(src);
      analyserRef.current = analyser;
      currentDataRef.current = new Float32Array(analyser.frequencyBinCount);

      setUseMic(true);
    } catch (err) {
      console.error('Mic error:', err);
    }
  };

  const onMicStop = () => {
    stream?.getTracks().forEach(track => track.stop());
    source?.disconnect();
    setUseMic(false);
    setStream(null);
    setSource(null);

    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close();
    }

    analyserRef.current = null;
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

      <div className="flex gap-2">
        <Button className="bg-blue-500 text-white flex-1" onClick={() => onMicStart(selected)}>
          {useMic ? 'Restart Mic' : 'Use Microphone'}
        </Button>
        <Button className="bg-red-500 text-white" onClick={onMicStop}>
          Stop
        </Button>
      </div>
    </div>
  );
};

export default ProcessMic;
