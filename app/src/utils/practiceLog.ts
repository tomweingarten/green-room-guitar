// Practice log + active-session persistence (localStorage).

export type Rating = 1 | 2 | 3 // rough / ok / clean

export interface LogEntry {
    id: string
    ts: number // entry timestamp (end of the play run)
    minutes: number
    key: string
    bpm: number
    form: string
    script: string // 'off' or script id
    overlay: string
    drillId?: string
    choruses: number
    rating?: Rating
}

export interface SessionSegment {
    label: string
    minutes: number
    link: string // /blues?... params to apply
    drillId?: string
    playedMs: number
}

export interface ActiveSession {
    startedAt: number
    idx: number
    segments: SessionSegment[]
}

const LOG_KEY = 'blues-practice-log'
const SESSION_KEY = 'blues-active-session'
const PROGRESS_KEY = 'blues-plan-progress'

function read<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key)
        return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
        return fallback
    }
}

export function loadLog(): LogEntry[] {
    return read<LogEntry[]>(LOG_KEY, [])
}

export function appendLogEntry(entry: Omit<LogEntry, 'id'>): LogEntry {
    const full: LogEntry = { ...entry, id: `${entry.ts}-${Math.random().toString(36).slice(2, 7)}` }
    const log = loadLog()
    log.push(full)
    localStorage.setItem(LOG_KEY, JSON.stringify(log))
    return full
}

export function setEntryRating(id: string, rating: Rating) {
    const log = loadLog()
    const e = log.find(x => x.id === id)
    if (e) {
        e.rating = rating
        localStorage.setItem(LOG_KEY, JSON.stringify(log))
    }
}

// Drill checkmarks from the Blues Plan (shared with the trainer's drill card).
export function loadProgress(): Record<string, boolean> {
    return read<Record<string, boolean>>(PROGRESS_KEY, {})
}

export function saveProgress(done: Record<string, boolean>) {
    try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(done))
    } catch { /* storage unavailable — progress just won't persist */ }
}

export function loadActiveSession(): ActiveSession | null {
    return read<ActiveSession | null>(SESSION_KEY, null)
}

export function saveActiveSession(s: ActiveSession) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
}

export function clearActiveSession() {
    localStorage.removeItem(SESSION_KEY)
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

// Local calendar day. (toISOString would be the UTC day, which files an
// evening session in New York under tomorrow and breaks streaks.)
const localDay = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dayKey = (ts: number) => localDay(new Date(ts))

export function minutesByDay(log: LogEntry[]): Map<string, number> {
    const m = new Map<string, number>()
    for (const e of log) m.set(dayKey(e.ts), (m.get(dayKey(e.ts)) ?? 0) + e.minutes)
    return m
}

// Consecutive days with >= 5 practice minutes, counting back from today
// (or from yesterday if today hasn't been played yet).
export function currentStreak(log: LogEntry[]): { days: number; playedToday: boolean } {
    const byDay = minutesByDay(log)
    const played = (d: Date) => (byDay.get(localDay(d)) ?? 0) >= 5
    const cursor = new Date()
    const playedToday = played(cursor)
    if (!playedToday) cursor.setDate(cursor.getDate() - 1)
    let days = 0
    while (played(cursor)) {
        days++
        cursor.setDate(cursor.getDate() - 1)
    }
    return { days, playedToday }
}

export function minutesLastNDays(log: LogEntry[], n: number): number {
    const cutoff = Date.now() - n * 86400000
    return Math.round(log.filter(e => e.ts >= cutoff).reduce((s, e) => s + e.minutes, 0))
}

export interface DrillTempo {
    bestCleanBpm: number | null // highest bpm with a 'clean' (3) rating
    maxBpm: number | null // highest bpm practiced at all
    minutes: number
}

export function tempoByDrill(log: LogEntry[]): Map<string, DrillTempo> {
    const m = new Map<string, DrillTempo>()
    for (const e of log) {
        if (!e.drillId) continue
        const t = m.get(e.drillId) ?? { bestCleanBpm: null, maxBpm: null, minutes: 0 }
        t.minutes += e.minutes
        t.maxBpm = Math.max(t.maxBpm ?? 0, e.bpm)
        if (e.rating === 3) t.bestCleanBpm = Math.max(t.bestCleanBpm ?? 0, e.bpm)
        m.set(e.drillId, t)
    }
    return m
}

export function recentEntries(log: LogEntry[], n: number): LogEntry[] {
    return [...log].sort((a, b) => b.ts - a.ts).slice(0, n)
}
