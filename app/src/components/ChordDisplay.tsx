import React, { useState, useMemo, useEffect } from 'react';
import { getChordNameFromRoman, getTabForChord } from '../utils/musicUtils';

interface ChordDisplayProps {
    roman: string;
    rootKey: string;
}

const VOICING_LABELS = ['Open', 'Barre', 'Alt'];

// Strings from high E (top of diagram) to low E (bottom).
// Our tab data is stored low-to-high (E A D G B E).
const STRING_LABELS_HIGH_TO_LOW = ['e', 'B', 'G', 'D', 'A', 'E'];

const ChordDisplay: React.FC<ChordDisplayProps> = ({ roman, rootKey }) => {
    const chordName = getChordNameFromRoman(roman.trim(), rootKey);
    const tabs = useMemo(() => getTabForChord(chordName) || [], [chordName]);
    const [voicingIdx, setVoicingIdx] = useState(0);

    // Reset voicing when key/chord changes so we don't index past the new list.
    useEffect(() => { setVoicingIdx(0); }, [chordName]);

    const hasMultiple = tabs.length > 1;
    const currentTab = tabs[voicingIdx] || '';
    const frets = currentTab ? currentTab.split(' ') : [];
    // Flip low-to-high to high-to-low for display.
    const fretsHighToLow = [...frets].reverse();

    const handleCycle = () => {
        if (hasMultiple) setVoicingIdx((voicingIdx + 1) % tabs.length);
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '10px 8px',
            background: 'var(--color-bg-primary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            minWidth: '92px',
            gap: '6px',
        }}>
            <div style={{ textAlign: 'center', lineHeight: 1.1 }}>
                <div style={{
                    fontSize: 'var(--text-base)',
                    fontWeight: 700,
                    color: 'var(--color-text-accent)',
                }}>
                    {chordName}
                </div>
                <div style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                    fontFamily: 'monospace',
                    marginTop: '2px',
                }}>
                    {roman}
                </div>
            </div>

            {frets.length > 0 && (
                <button
                    onClick={handleCycle}
                    disabled={!hasMultiple}
                    aria-label={hasMultiple ? `Cycle voicing (${VOICING_LABELS[voicingIdx]})` : 'Chord voicing'}
                    style={{
                        background: '#1a1a26',
                        border: '1px solid #2a2a3d',
                        borderRadius: '4px',
                        padding: '6px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        cursor: hasMultiple ? 'pointer' : 'default',
                        width: '100%',
                    }}
                >
                    {fretsHighToLow.map((fret, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            lineHeight: 1,
                        }}>
                            <span style={{ width: '10px', color: '#9b97b0', textAlign: 'right' }}>
                                {STRING_LABELS_HIGH_TO_LOW[i]}
                            </span>
                            <span style={{
                                width: '14px',
                                textAlign: 'center',
                                color: fret === 'x' ? '#c43e5c' : '#8b5cf6',
                                fontWeight: 600,
                            }}>
                                {fret === 'x' ? '×' : fret === '0' ? '○' : fret}
                            </span>
                            <div style={{ flex: 1, height: '1px', background: '#2a2a3d' }} />
                        </div>
                    ))}
                </button>
            )}

            <div style={{
                fontSize: '10px',
                color: 'var(--color-text-muted)',
                letterSpacing: '0.05em',
                height: '12px',
            }}>
                {hasMultiple
                    ? `${VOICING_LABELS[voicingIdx] || `#${voicingIdx + 1}`} · tap ${voicingIdx + 1}/${tabs.length}`
                    : frets.length > 0 ? VOICING_LABELS[0] : ''}
            </div>
        </div>
    );
};


export default ChordDisplay;
