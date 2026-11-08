import { useState, useEffect, useRef } from 'react';
import DbMeter from '../components/DbMeter';

interface Clip {
    id: string;
    name: string;
    url: string;
    blob: Blob;
    duration: number;
    createdAt: Date;
}

export default function RecorderPage() {
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [inputId, setInputId] = useState<string>(() => localStorage.getItem('grimoire-rec-in') ?? 'default');
    const [outputId, setOutputId] = useState<string>(() => localStorage.getItem('grimoire-rec-out') ?? 'default');
    const [monitorActive, setMonitorActive] = useState(false);
    const [recording, setRecording] = useState(false);
    const [clips, setClips] = useState<Clip[]>([]);
    const [playingClipId, setPlayingClipId] = useState<string | null>(null);
    const [inputVolume, setInputVolume] = useState(1.0);
    const [recordingDuration, setRecordingDuration] = useState(0);

    // Audio engine refs
    const audioCtxRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const gainRef = useRef<GainNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const recordStartRef = useRef<number>(0);
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);

    // Enumerate devices
    useEffect(() => {
        const getDevices = async () => {
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                const devs = await navigator.mediaDevices.enumerateDevices();
                setDevices(devs.filter(d => d.kind === 'audioinput' || d.kind === 'audiooutput'));
            } catch (err) {
                console.error('Failed to enumerate devices:', err);
            }
        };
        getDevices();
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }, []);

    // Persist device choices
    useEffect(() => {
        localStorage.setItem('grimoire-rec-in', inputId);
        localStorage.setItem('grimoire-rec-out', outputId);
    }, [inputId, outputId]);

    // Update gain when volume changes
    useEffect(() => {
        if (gainRef.current) gainRef.current.gain.value = inputVolume;
    }, [inputVolume]);

    const startMonitor = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: inputId !== 'default' ? { exact: inputId } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                },
            });
            streamRef.current = stream;

            const ctx = new AudioContext();
            audioCtxRef.current = ctx;

            const source = ctx.createMediaStreamSource(stream);
            sourceRef.current = source;

            const gain = ctx.createGain();
            gain.gain.value = inputVolume;
            gainRef.current = gain;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048;
            analyserRef.current = analyser;

            source.connect(gain);
            gain.connect(analyser);
            analyser.connect(ctx.destination);

            if (typeof (ctx as any).setSinkId === 'function' && outputId !== 'default') {
                await (ctx as any).setSinkId(outputId);
            }

            setMonitorActive(true);
        } catch (err) {
            console.error('Failed to start monitor:', err);
        }
    };

    const stopMonitor = async () => {
        if (recording) stopRecording();

        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        analyserRef.current = null;

        if (audioCtxRef.current) {
            await audioCtxRef.current.close();
            audioCtxRef.current = null;
        }
        setMonitorActive(false);
    };

    const startRecording = () => {
        const stream = streamRef.current;
        if (!stream) return;

        chunksRef.current = [];
        recordStartRef.current = Date.now();

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';

        const mr = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mr;

        mr.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mr.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const duration = (Date.now() - recordStartRef.current) / 1000;

            const clip: Clip = {
                id: Date.now().toString(),
                name: `Clip ${new Date().toLocaleTimeString()}`,
                url,
                blob,
                duration,
                createdAt: new Date(),
            };
            setClips(prev => [clip, ...prev]);
        };

        mr.start(100);
        setRecording(true);
        setRecordingDuration(0);

        durationIntervalRef.current = setInterval(() => {
            setRecordingDuration(Math.floor((Date.now() - recordStartRef.current) / 1000));
        }, 500);
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setRecording(false);
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }
    };

    const playClip = async (clip: Clip) => {
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
        }

        if (playingClipId === clip.id) {
            setPlayingClipId(null);
            return;
        }

        const audio = new Audio(clip.url);
        currentAudioRef.current = audio;

        if (typeof (audio as any).setSinkId === 'function' && outputId !== 'default') {
            await (audio as any).setSinkId(outputId);
        }

        audio.onended = () => setPlayingClipId(null);
        audio.play();
        setPlayingClipId(clip.id);
    };

    const deleteClip = (id: string) => {
        if (playingClipId === id) {
            currentAudioRef.current?.pause();
            currentAudioRef.current = null;
            setPlayingClipId(null);
        }
        setClips(prev => {
            const clip = prev.find(c => c.id === id);
            if (clip) URL.revokeObjectURL(clip.url);
            return prev.filter(c => c.id !== id);
        });
    };

    const renameClip = (id: string) => {
        const clip = clips.find(c => c.id === id);
        if (!clip) return;
        const name = prompt('Rename clip:', clip.name);
        if (name) setClips(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    };

    const downloadClip = (clip: Clip) => {
        const a = document.createElement('a');
        a.href = clip.url;
        a.download = `${clip.name}.webm`;
        a.click();
    };

    const formatDuration = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    const audioOutputs = devices.filter(d => d.kind === 'audiooutput');

    return (
        <div className="page-container">
            <header className="page-header">
                <h1>Recorder</h1>
                <p>Monitor any input and capture clips. Clips live in this tab only, so download the keepers.</p>
            </header>

            <div className="grid-layout">
                {/* Input / Monitor Setup */}
                <section className="card form-section" style={{ gridColumn: '1' }}>
                    <h3>Input Setup</h3>

                    <div className="form-group">
                        <label>Input Source</label>
                        <select
                            className="select-input"
                            value={inputId}
                            onChange={e => setInputId(e.target.value)}
                            disabled={monitorActive}
                        >
                            <option value="default">Default Microphone</option>
                            {audioInputs.map(d => (
                                <option key={d.deviceId} value={d.deviceId}>
                                    {d.label || `Input ${d.deviceId.substring(0, 8)}...`}
                                </option>
                            ))}
                        </select>
                        <small>Select microphone, line-in, or any audio input device.</small>
                    </div>

                    <div className="form-group">
                        <label>Monitor / Playback Output</label>
                        <select
                            className="select-input"
                            value={outputId}
                            onChange={e => setOutputId(e.target.value)}
                        >
                            <option value="default">Default Speaker</option>
                            {audioOutputs.map(d => (
                                <option key={d.deviceId} value={d.deviceId}>
                                    {d.label || `Output ${d.deviceId.substring(0, 8)}...`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Monitor Volume</span>
                            <span>{Math.round(inputVolume * 100)}%</span>
                        </label>
                        <input
                            type="range" min="0" max="1" step="0.01"
                            value={inputVolume}
                            onChange={e => setInputVolume(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                        <button
                            className={`btn ${monitorActive ? 'btn-danger' : 'btn-primary'}`}
                            style={{ flex: 1 }}
                            onClick={monitorActive ? stopMonitor : startMonitor}
                        >
                            {monitorActive ? '⏹ Stop monitor' : '▶ Start monitor'}
                        </button>
                    </div>

                    {monitorActive && (
                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <span className="section-label" style={{ margin: 0 }}>Input level</span>
                                <span style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: recording ? 'var(--vermilion)' : 'var(--sage)',
                                    display: 'inline-block',
                                }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <DbMeter
                                    analyser={analyserRef.current}
                                    orientation="horizontal"
                                    height={28}
                                    width={360}
                                />
                            </div>
                        </div>
                    )}
                </section>

                {/* Recording Controls */}
                <section className="card" style={{ gridColumn: '1' }}>
                    <h3>Recording</h3>

                    {!monitorActive && (
                        <p style={{ fontSize: 'var(--text-sm)' }}>
                            Start the monitor to enable recording.
                        </p>
                    )}

                    {monitorActive && (
                        <>
                            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                                {recording ? (
                                    <div>
                                        <div style={{
                                            width: '72px', height: '72px', borderRadius: '50%',
                                            background: 'var(--vermilion)',
                                            color: '#fff',
                                            margin: '0 auto 1rem',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.5rem',
                                            animation: 'pulse 1s ease-in-out infinite',
                                        }}>⏺</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-accent-red)', fontVariantNumeric: 'tabular-nums' }}>
                                            {formatDuration(recordingDuration)}
                                        </div>
                                        <div className="section-label" style={{ color: 'var(--color-accent-red)', marginTop: '4px' }}>Recording</div>
                                        <button
                                            className="btn btn-danger"
                                            style={{ marginTop: '1rem', padding: '0.6rem 2rem' }}
                                            onClick={stopRecording}
                                        >
                                            ⏹ Stop recording
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{
                                            width: '72px', height: '72px', borderRadius: '50%',
                                            background: 'var(--color-bg-elevated)',
                                            border: '1.5px solid var(--ink)',
                                            color: 'var(--vermilion)',
                                            margin: '0 auto 1rem',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.5rem',
                                        }}>⏺</div>
                                        <button
                                            className="btn btn-primary"
                                            style={{ padding: '0.6rem 2rem' }}
                                            onClick={startRecording}
                                        >
                                            ⏺ Start recording
                                        </button>
                                        <p style={{ fontSize: 'var(--text-xs)', marginTop: '0.75rem' }}>
                                            Captures everything from the selected input.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </section>

                {/* Clip Library */}
                <section className="card" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>Clips</h3>
                        <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                            {clips.length} clip{clips.length !== 1 ? 's' : ''} · Session only
                        </span>
                    </div>

                    {clips.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                            <p>No clips yet. Start the monitor and record something.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {clips.map(clip => (
                                <div
                                    key={clip.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '10px 14px',
                                        background: playingClipId === clip.id ? 'var(--color-accent-purple-glow)' : 'var(--color-bg-input)',
                                        border: `1px solid ${playingClipId === clip.id ? 'var(--sage)' : 'var(--color-border)'}`,
                                        borderRadius: '8px',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    <button
                                        className="btn btn-sm"
                                        style={{
                                            background: playingClipId === clip.id ? 'var(--sage-deep)' : 'transparent',
                                            color: playingClipId === clip.id ? '#fff' : 'var(--sage-deep)',
                                            border: '1px solid var(--sage-deep)',
                                            minWidth: '36px',
                                        }}
                                        onClick={() => playClip(clip)}
                                    >
                                        {playingClipId === clip.id ? '⏸' : '▶'}
                                    </button>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 500, fontSize: '0.9rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                            {clip.name}
                                        </div>
                                        <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                                            {formatDuration(clip.duration)} · {clip.createdAt.toLocaleTimeString()}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            className="btn btn-sm btn-ghost"
                                            title="Rename"
                                            onClick={() => renameClip(clip.id)}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="btn btn-sm btn-ghost"
                                            title="Download"
                                            onClick={() => downloadClip(clip)}
                                        >
                                            ⬇️
                                        </button>
                                        <button
                                            className="btn btn-sm btn-ghost"
                                            title="Delete"
                                            onClick={() => deleteClip(clip.id)}
                                            style={{ color: 'var(--color-accent-red)' }}
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
