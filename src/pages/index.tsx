import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion } from 'framer-motion';

// --- Small UI bits ---
function Spectrum({ bass, mid, treble }: { bass: number; mid: number; treble: number }) {
  const barStyle = (v: number, color: string) => ({
    height: `${Math.min(100, v * 100)}%`,
    width: '24px',
    background: color,
    borderRadius: '6px',
    transition: 'height 0.1s linear',
  });

  return (
    <div className="flex items-end gap-2 h-24 p-2 bg-black/40 rounded-xl">
      <div style={barStyle(bass, '#ff0044')} title="Bass" />
      <div style={barStyle(mid, '#00ffaa')} title="Mid" />
      <div style={barStyle(treble, '#4488ff')} title="Treble" />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="text-sm opacity-80">{label}</span>
    </label>
  );
}
function Range({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm opacity-80">
        {label} <span className="opacity-60">{value.toFixed(2)}</span>
      </label>
      <input
        type="range"
        className="w-56"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm opacity-80">{label}</label>
      <select
        className="px-2 py-1 rounded bg-black/30 border border-white/10"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
function Button({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 shadow"
    >
      {children}
    </button>
  );
}

// --- Audio helpers ---
function avg(arr: Uint8Array, from: number, to: number) {
  let s = 0,
    n = 0;
  for (let i = from; i < to; i++) {
    s += arr[i];
    n++;
  }
  return n ? s / n / 255 : 0;
}

// --- Shaders ---
const vertex = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position, 1.0);}
`;
const fragment = `
  precision mediump float;
  varying vec2 vUv;
  uniform float u_time;
  uniform float u_bass;
  uniform float u_mid;
  uniform float u_treble;
  uniform float u_gain;
  uniform float u_detail;
  uniform int u_palette;

  vec3 paletteColor(float t) {
    if(u_palette==0) return vec3(0.5+0.5*sin(6.2831*(t+vec3(0.0,0.33,0.67))));
    if(u_palette==1) return vec3(1.0,0.5*t,0.0);
    return vec3(t, t*0.5, 1.0-t);
  }

  void main() {
    vec2 uv = vUv*2.0-1.0;
    float len = length(uv);
    float a = atan(uv.y, uv.x);
    float f = sin(u_time*0.5 + len*10.0*u_detail + a*4.0);
    float amp = u_bass*1.5 + u_mid + u_treble*0.5;
    float intensity = smoothstep(0.0,1.0,amp*u_gain);
    vec3 col = paletteColor(f*0.5+0.5+intensity*0.5);
    col *= (1.0-len*0.7);
    gl_FragColor = vec4(col,1.0);
  }
`;

export default function Home() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const uniformsRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  const [ctx, setCtx] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);

  const [uiOpen, setUiOpen] = useState(true);
  const [gain, setGain] = useState(0.8);
  const [detail, setDetail] = useState(0.4);
  const [palette, setPalette] = useState('neon');
  const [bgMode, setBgMode] = useState('black');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [levels, setLevels] = useState({ bass: 0, mid: 0, treble: 0 });

  const paletteIndex = useMemo(
    () => (palette === 'neon' ? 0 : palette === 'fire' ? 1 : 2),
    [palette]
  );

  // Fetch audio input devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(list => {
      setDevices(list.filter(d => d.kind === 'audioinput'));
    });
  }, []);

  // Init Three
  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (mountRef.current) mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const uniforms = {
      u_time: { value: 0 },
      u_bass: { value: 0 },
      u_mid: { value: 0 },
      u_treble: { value: 0 },
      u_gain: { value: gain },
      u_detail: { value: detail },
      u_palette: { value: paletteIndex },
    };
    uniformsRef.current = uniforms;

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    scene.add(quad);

    const animate = (t: number) => {
      if (uniformsRef.current) {
        uniformsRef.current.u_time.value = t * 0.001;
      }
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };
    animate(0);

    const onResize = () => renderer.setSize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  // Uniform updates
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.u_gain.value = gain;
  }, [gain]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.u_detail.value = detail;
  }, [detail]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.u_palette.value = paletteIndex;
  }, [paletteIndex]);

  // Audio input start
  const startMic = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const an = audioCtx.createAnalyser();
      an.fftSize = 2048;
      an.smoothingTimeConstant = 0.7;
      source.connect(an);
      setCtx(audioCtx);
      setAnalyser(an);
      dataRef.current = new Uint8Array(an.frequencyBinCount);
    } catch (e) {
      alert('Audio device not available.');
      console.error(e);
    }
  };

  // Pump analyser
  useEffect(() => {
    if (!analyser || !dataRef.current || !uniformsRef.current) return;
    const data = dataRef.current;
    const update = () => {
      analyser.getByteFrequencyData(data);
      const bass = avg(data, 1, 40);
      const mid = avg(data, 40, 120);
      const treble = avg(data, 120, 512);
      uniformsRef.current.u_bass.value = bass;
      uniformsRef.current.u_mid.value = mid;
      uniformsRef.current.u_treble.value = treble;

      setLevels({ bass, mid, treble });
      requestAnimationFrame(update);
    };
    update();
  }, [analyser]);

  return (
    <div
      className="w-screen h-screen relative overflow-hidden"
      style={{ background: bgMode === 'chroma' ? '#00ff00' : 'black' }}
    >
      <div ref={mountRef} className="absolute inset-0" />

      {/* UI overlay */}
      {uiOpen && (
        <motion.div className="absolute top-4 left-4 p-4 rounded-2xl bg-black/60 backdrop-blur text-white flex flex-col gap-4 max-w-md shadow-lg">
          <div className="flex items-center justify-between gap-8">
            <div className="text-lg font-semibold">Audio-Reactive Visuals</div>
            <Button onClick={() => setUiOpen(false)}>Hide UI (H)</Button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Select
              label="Input Device"
              value={selectedDevice}
              onChange={setSelectedDevice}
              options={devices.map(d => ({
                value: d.deviceId,
                label: d.label || `Device ${d.deviceId}`,
              }))}
            />
            <Button onClick={startMic}>Start Audio</Button>
          </div>
          <Range label="Audio Gain" value={gain} min={0} max={2} step={0.01} onChange={setGain} />
          <Range label="Detail" value={detail} min={0} max={1} step={0.01} onChange={setDetail} />

          <Spectrum bass={levels.bass} mid={levels.mid} treble={levels.treble} />

          <Select
            label="Palette"
            value={palette}
            onChange={setPalette}
            options={[
              { value: 'neon', label: 'Neon' },
              { value: 'fire', label: 'Fire' },
              { value: 'cool', label: 'Cool' },
            ]}
          />
          <Select
            label="Background"
            value={bgMode}
            onChange={setBgMode}
            options={[
              { value: 'black', label: 'Black' },
              { value: 'chroma', label: 'Chroma Green' },
            ]}
          />
        </motion.div>
      )}
    </div>
  );
}
