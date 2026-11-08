// Types and helpers for the chorus-coach scripts and the blues training plan.
// The content itself comes from a pack's "blues" section (app/packs/blues by default; see PACKS.md).
// Scripts drive the per-chorus assignments on the Blues Trainer;
// the plan drives the checkable curriculum on the Blues Plan page.

import type { ActiveSession } from '../utils/practiceLog'
import { BLUES } from '../packs'

export type CoachOverlay =
    | 'chord-tones'
    | 'chord-mixolydian'
    | 'blues-scale'
    | 'bb-box'
    | 'minor-pent'
    | 'major-pent'
    | 'bass-line'
    | 'off'

export type ChorusRole = 'comp' | 'bass' | 'solo'

export interface ChorusAssignment {
    label: string
    detail: string
    overlay: CoachOverlay
    role?: ChorusRole // the backing band drops out of the part you're playing
    callResponse?: boolean // shade alternate 2-bar groups play/rest
}

export interface PracticeScript {
    id: string
    name: string
    description: string
    noBacking?: boolean // your own loop is the band — keep the app's bass/organ silent
    choruses: ChorusAssignment[]
}

// ---------------------------------------------------------------------------
// Training plan
// ---------------------------------------------------------------------------

export interface Drill {
    id: string
    title: string
    goal: string
    how: string[]
    doneWhen: string
    trainerLink?: string
}

export interface Phase {
    id: string
    name: string
    weeks: string
    focus: string
    why: string
    drills: Drill[]
}

// ---------------------------------------------------------------------------
// Session builder: warm-up → main drill → free play
// ---------------------------------------------------------------------------

export const SESSION_LENGTHS = [15, 30, 45] as const
export type SessionLength = (typeof SESSION_LENGTHS)[number]

// Warm-up / main / free-play minutes for each total length.
const SESSION_SPLITS: Record<SessionLength, [number, number, number]> = {
    15: [3, 9, 3],
    30: [5, 20, 5],
    45: [8, 30, 7],
}

export function buildTodaySession(done: Record<string, boolean>, length: SessionLength = 30): ActiveSession {
    if (!TRAINING_PLAN.length) {
        return { startedAt: Date.now(), idx: 0, segments: [{ label: 'Free play', minutes: length, link: '/blues', playedMs: 0 }] }
    }
    const curIdx = TRAINING_PLAN.findIndex(p => p.drills.some(d => !done[d.id]))
    const phase = TRAINING_PLAN[curIdx === -1 ? TRAINING_PLAN.length - 1 : curIdx]
    const main =
        phase.drills.find(d => !done[d.id] && d.trainerLink) ??
        phase.drills.find(d => d.trainerLink) ??
        TRAINING_PLAN[0].drills[0]
    const warm = curIdx > 0 ? TRAINING_PLAN[curIdx - 1].drills.find(d => d.trainerLink) : null
    const [warmMin, mainMin, freeMin] = SESSION_SPLITS[length]

    const mainKey = new URLSearchParams(main.trainerLink!.split('?')[1]).get('key') ?? 'A'

    return {
        startedAt: Date.now(),
        idx: 0,
        segments: [
            {
                label: warm ? `Warm-up — ${warm.title}` : 'Warm-up — comp the form',
                minutes: warmMin,
                link: warm?.trainerLink ?? '/blues?form=quick-change&key=E&bpm=80&overlay=chord-tones',
                drillId: warm?.id,
                playedMs: 0,
            },
            {
                label: `Main drill — ${main.title}`,
                minutes: mainMin,
                link: main.trainerLink!,
                drillId: main.id,
                playedMs: 0,
            },
            {
                label: 'Free play — no assignment',
                minutes: freeMin,
                link: `/blues?form=quick-change&key=${encodeURIComponent(mainKey)}&bpm=90&overlay=blues-scale`,
                playedMs: 0,
            },
        ],
    }
}

export function findDrill(id: string | undefined): { drill: Drill; phase: Phase; phaseIdx: number } | null {
    if (!id) return null
    for (const [phaseIdx, phase] of TRAINING_PLAN.entries()) {
        const drill = phase.drills.find(d => d.id === id)
        if (drill) return { drill, phase, phaseIdx }
    }
    return null
}

export interface JamTune {
    title: string
    artist: string
    key: string
    form: string
    feel: string
    bpm: number
    note: string
    trainer: { form: string; drums: 'shuffle' | 'twelve8' | 'straight'; feel?: 'straight' }
}

// Deep link that sets the trainer up for a tune: key, form, tempo, and groove.
export function tuneTrainerLink(t: JamTune): string {
    const key = t.key.replace(/m$/, '')
    const feel = t.trainer.feel ? `&feel=${t.trainer.feel}` : ''
    return `/blues?key=${encodeURIComponent(key)}&form=${t.trainer.form}&bpm=${t.bpm}&drums=${t.trainer.drums}${feel}&overlay=${t.key.endsWith('m') ? 'minor-pent' : 'bb-box'}`
}

interface BluesContent { scripts: PracticeScript[]; plan: Phase[]; repertoire: JamTune[]; etiquette: string[] }
const content = (BLUES ?? {}) as Partial<BluesContent>

export const PRACTICE_SCRIPTS: PracticeScript[] = content.scripts ?? []
export const TRAINING_PLAN: Phase[] = content.plan ?? []
export const REPERTOIRE: JamTune[] = content.repertoire ?? []
export const JAM_ETIQUETTE: string[] = content.etiquette ?? []
