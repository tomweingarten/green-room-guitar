import { chordName, type Bar } from '../data/bluesForms'
import './FormChart.css'
import type { ChartDisplay } from '../utils/trainerSettings'

interface FormChartProps {
    bars: Bar[]
    musicalKey: string
    display: ChartDisplay
    activeBar: number | null // null when stopped or counting in
    beat: number // 0..3 within the active bar
    callResponse?: boolean // mark 2-bar play / rest groups
    introStart?: number | null // bar index where the "from the V" intro starts
    inIntro?: boolean
    size?: 'md' | 'lg'
}

// The form written the way a chart is: four bars to a line, so the
// I–IV–V architecture (and the quick change in bar 2) is visible at a glance.
function FormChart({
    bars,
    musicalKey,
    display,
    activeBar,
    beat,
    callResponse = false,
    introStart = null,
    inIntro = false,
    size = 'md',
}: FormChartProps) {
    const nextBar = activeBar == null ? null : (activeBar + 1) % bars.length
    // On the last beat before a chord change, flag the bar that's coming.
    const changeComing =
        activeBar != null &&
        nextBar != null &&
        beat === 3 &&
        chordName(musicalKey, bars[nextBar]) !== chordName(musicalKey, bars[activeBar])

    return (
        <div className={`form-chart form-chart-${size}`} role="list" aria-label="Form chart">
            {bars.map((bar, idx) => {
                const active = idx === activeBar
                const upcoming = changeComing && idx === nextBar
                const playBar = Math.floor(idx / 2) % 2 === 0
                const rest = callResponse && !playBar
                const name = chordName(musicalKey, bar)
                const main = display === 'numerals' ? bar.roman : display === 'blind' ? String(idx + 1) : name
                const sub = display === 'numerals' ? name : display === 'blind' ? '' : bar.roman
                return (
                    <div
                        key={idx}
                        role="listitem"
                        aria-current={active ? 'true' : undefined}
                        className={[
                            'form-bar',
                            active && 'is-active',
                            upcoming && 'is-upcoming',
                            rest && 'is-rest',
                            idx % 4 === 0 && 'line-start',
                        ].filter(Boolean).join(' ')}
                    >
                        <div className="form-bar-top">
                            <span>{display === 'blind' ? '' : idx + 1}</span>
                            <span>
                                {introStart === idx && <span className="form-bar-tag">{inIntro && active ? 'intro' : 'intro ↘'}</span>}
                                {callResponse && (playBar ? ' 🎸' : ' 🤫')}
                            </span>
                        </div>
                        <div className="form-bar-main">{main}</div>
                        {sub && <div className="form-bar-sub">{sub}</div>}
                        {active && (
                            <div className="form-bar-beats" aria-hidden="true">
                                {[0, 1, 2, 3].map(b => (
                                    <span key={b} className={b <= beat ? 'on' : ''} />
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

export default FormChart
