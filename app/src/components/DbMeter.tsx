import { useEffect, useRef } from 'react';

interface DbMeterProps {
    analyser: AnalyserNode | null;
    label?: string;
    orientation?: 'vertical' | 'horizontal';
    height?: number;
    width?: number;
}

// Segment thresholds in dBFS
const SEGMENTS = 24; // Total number of segments
const YELLOW_THRESHOLD = -12; // dBFS above which turns yellow
const RED_THRESHOLD = -3;     // dBFS above which turns red

function dbFromRms(rms: number): number {
    if (rms < 0.000001) return -96;
    return 20 * Math.log10(rms);
}

function getSegmentColor(segmentDb: number): string {
    if (segmentDb > RED_THRESHOLD) return '#ff3333';
    if (segmentDb > YELLOW_THRESHOLD) return '#ffcc00';
    return '#22cc66';
}

function getDimColor(segmentDb: number): string {
    if (segmentDb > RED_THRESHOLD) return '#3a0808';
    if (segmentDb > YELLOW_THRESHOLD) return '#2e2500';
    return '#062010';
}

export default function DbMeter({ analyser, label, orientation = 'vertical', height = 120, width = 28 }: DbMeterProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(0);
    const peakDbRef = useRef<number>(-96);
    const peakHoldFramesRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const isVertical = orientation === 'vertical';
        const dataArray = new Uint8Array(analyser ? analyser.fftSize : 256);

        const draw = () => {
            rafRef.current = requestAnimationFrame(draw);

            let db = -96;
            if (analyser) {
                analyser.getByteTimeDomainData(dataArray);
                // Calculate RMS
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    const normalized = (dataArray[i] - 128) / 128;
                    sum += normalized * normalized;
                }
                const rms = Math.sqrt(sum / dataArray.length);
                db = dbFromRms(rms);
            }

            // Peak hold logic
            if (db > peakDbRef.current) {
                peakDbRef.current = db;
                peakHoldFramesRef.current = 60; // hold for 60 frames
            } else {
                peakHoldFramesRef.current--;
                if (peakHoldFramesRef.current <= 0) {
                    peakDbRef.current = Math.max(peakDbRef.current - 0.5, -96);
                }
            }

            const W = canvas.width;
            const H = canvas.height;
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#0a0a0e';
            ctx.fillRect(0, 0, W, H);

            // Map dB range: -60 to 0 dBFS
            const DB_MIN = -60;
            const DB_MAX = 0;
            const segmentGap = 2;

            for (let i = 0; i < SEGMENTS; i++) {
                // Each segment represents a dB value from DB_MIN to DB_MAX
                const segmentDb = DB_MIN + (i / (SEGMENTS - 1)) * (DB_MAX - DB_MIN);
                const lit = db >= segmentDb;

                const color = lit ? getSegmentColor(segmentDb) : getDimColor(segmentDb);
                ctx.fillStyle = color;

                if (isVertical) {
                    const segH = (H - segmentGap * SEGMENTS) / SEGMENTS;
                    // Draw from bottom (quiet) to top (loud)
                    const y = H - (i + 1) * (segH + segmentGap);
                    ctx.fillRect(segmentGap, y + segmentGap, W - segmentGap * 2, segH);
                } else {
                    const segW = (W - segmentGap * SEGMENTS) / SEGMENTS;
                    const x = i * (segW + segmentGap);
                    ctx.fillRect(x, segmentGap, segW, H - segmentGap * 2);
                }
            }

            // Peak hold indicator
            const peakDb = peakDbRef.current;
            const peakFraction = (peakDb - DB_MIN) / (DB_MAX - DB_MIN);
            const peakFractionClamped = Math.max(0, Math.min(1, peakFraction));

            ctx.fillStyle = peakDb > RED_THRESHOLD ? '#ff6666' : peakDb > YELLOW_THRESHOLD ? '#ffee44' : '#44ee88';
            if (isVertical) {
                const segH = (H - segmentGap * SEGMENTS) / SEGMENTS;
                const peakY = H - peakFractionClamped * (H - segmentGap) - segH;
                ctx.fillRect(segmentGap, peakY, W - segmentGap * 2, 2);
            } else {
                const segW = (W - segmentGap * SEGMENTS) / SEGMENTS;
                const peakX = peakFractionClamped * (W - segmentGap) - segW;
                ctx.fillRect(peakX, segmentGap, 2, H - segmentGap * 2);
            }
        };

        draw();

        return () => cancelAnimationFrame(rafRef.current);
    }, [analyser, orientation]);

    const isVertical = orientation === 'vertical';

    return (
        <div style={{
            display: 'flex',
            flexDirection: isVertical ? 'column' : 'row',
            alignItems: 'center',
            gap: '4px',
        }}>
            {label && (
                <span style={{
                    fontSize: '0.65rem',
                    color: '#666',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    writingMode: isVertical ? 'horizontal-tb' : 'vertical-rl',
                    whiteSpace: 'nowrap',
                }}>
                    {label}
                </span>
            )}
            <canvas
                ref={canvasRef}
                width={isVertical ? width : height}
                height={isVertical ? height : width}
                style={{ borderRadius: '3px', display: 'block' }}
            />
        </div>
    );
}
