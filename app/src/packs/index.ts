// Packs: folders under app/packs/<id>/ that add content without touching app code.
// Each has a pack.json (see PACKS.md for the format) plus optional sounds/ and guides/.
// Everything is bundled at build time, so adding or removing a pack folder and rebuilding is all it takes.

export interface PackSound {
    /** Globally unique id, `<pack>--<sound>`; this is what travels over the Jam Room signalling channel. */
    id: string
    label: string
    icon: string
    url: string
    loop: boolean
    category?: string
    /** Renders as a blank tile until hovered (easter eggs); also kept out of the activity feed. */
    hidden?: boolean
}

export interface Soundboard {
    /** Globally unique, `<pack>--<board>`. */
    id: string
    name: string
    description?: string
    pack: string
    sounds: PackSound[]
}

export interface SceneEffect { name: string; setting: string; details?: string[] }

export interface Scene {
    id: string
    pack: string
    name: string
    emoji: string
    subtitle?: string
    mood: string
    /** Accent colour for the card, any CSS colour. */
    color?: string
    keys: string[]
    /** Scale ids from src/data/scales.json; the first one is drawn on the fretboard. */
    scales: string[]
    pickup?: string
    effects: SceneEffect[]
    techniques: string[]
    layers?: string[]
}

export interface Guide {
    id: string
    pack: string
    title: string
    category: string
    content: string
}

export interface Rig {
    pack: string
    guitar: string
    details?: string
    chain: string[]
}

export interface Pack {
    id: string
    name: string
    description?: string
    priority: number
}

const manifests = import.meta.glob('../../packs/*/pack.json', { eager: true, import: 'default' }) as Record<string, unknown>
const audio = import.meta.glob('../../packs/*/sounds/**/*.{mp3,ogg,wav,m4a,webm}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const markdown = import.meta.glob('../../packs/*/guides/**/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

const ID = /^[a-z0-9][a-z0-9-]{0,30}$/
const str = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const strs = (v: unknown): v is string[] => Array.isArray(v) && v.every(str)

const packs: Pack[] = []
const soundboards: Soundboard[] = []
const scenes: Scene[] = []
const guides: Guide[] = []
const rigs: Rig[] = []
const blues: { pack: string; content: unknown }[] = []
const problems: string[] = []

for (const [path, raw] of Object.entries(manifests)) {
    const parts = path.split('/')
    const folder = parts[parts.length - 2]
    const warn = (msg: string) => problems.push(`packs/${folder}: ${msg}`)
    const m = raw as Record<string, any>
    if (!m || typeof m !== 'object' || m.id !== folder || !ID.test(folder)) {
        warn('pack.json must have "id" equal to the folder name (lowercase letters, digits, dashes)')
        continue
    }
    const pack = folder
    packs.push({ id: pack, name: str(m.name) ? m.name : pack, description: m.description, priority: Number(m.priority) || 0 })

    for (const b of Array.isArray(m.soundboards) ? m.soundboards : []) {
        if (!str(b?.id) || !ID.test(b.id) || !str(b?.name) || !Array.isArray(b?.sounds)) { warn(`soundboard "${b?.id}" needs id, name and sounds`); continue }
        const sounds: PackSound[] = []
        for (const s of b.sounds) {
            const url = audio[`../../packs/${pack}/${s?.file}`]
            if (!str(s?.id) || !ID.test(s.id) || !str(s?.label) || !url) { warn(`sound "${s?.id}" in ${b.id} needs id, label and a file under sounds/`); continue }
            sounds.push({ id: `${pack}--${s.id}`, label: s.label, icon: str(s.icon) ? s.icon : '🔊', url, loop: Boolean(s.loop), category: s.category, hidden: Boolean(s.hidden) })
        }
        soundboards.push({ id: `${pack}--${b.id}`, name: b.name, description: b.description, pack, sounds })
    }

    for (const s of Array.isArray(m.scenes) ? m.scenes : []) {
        if (!str(s?.id) || !str(s?.name) || !strs(s?.keys) || !strs(s?.scales) || !s.keys.length || !s.scales.length) { warn(`scene "${s?.id}" needs id, name, keys and scales`); continue }
        scenes.push({
            id: `${pack}--${s.id}`, pack, name: s.name, emoji: s.emoji ?? '🎸', subtitle: s.subtitle, mood: s.mood ?? '',
            color: s.color, keys: s.keys, scales: s.scales, pickup: s.pickup,
            effects: Array.isArray(s.effects) ? s.effects.filter((e: any) => str(e?.name)) : [],
            techniques: strs(s.techniques) ? s.techniques : [], layers: strs(s.layers) ? s.layers : undefined,
        })
    }

    for (const g of Array.isArray(m.guides) ? m.guides : []) {
        const content = markdown[`../../packs/${pack}/${g?.file}`]
        if (!str(g?.title) || content == null) { warn(`guide "${g?.file}" needs a title and a .md file under guides/`); continue }
        guides.push({ id: `${pack}--${g.file}`, pack, title: g.title, category: str(g.category) ? g.category : 'Notes', content })
    }

    // Blues Trainer scripts and Blues Plan content; shape checked by scripts/check-packs.mjs.
    if (m.blues && typeof m.blues === 'object') blues.push({ pack, content: m.blues })

    if (m.rig) {
        if (str(m.rig.guitar) && strs(m.rig.chain)) rigs.push({ pack, guitar: m.rig.guitar, details: m.rig.details, chain: m.rig.chain })
        else warn('rig needs "guitar" and a "chain" list')
    }
}

// Higher priority first; the starter pack uses a negative priority so personal packs lead.
const rank = new Map(packs.map(p => [p.id, p.priority]))
const byPriority = <T extends { pack: string }>(a: T, b: T) => (rank.get(b.pack) ?? 0) - (rank.get(a.pack) ?? 0)
packs.sort((a, b) => b.priority - a.priority)
soundboards.sort(byPriority)
scenes.sort(byPriority)
guides.sort(byPriority)
rigs.sort(byPriority)
blues.sort(byPriority)

if (problems.length) console.warn(`Pack problems (run \`npm run check-packs\`):\n${problems.join('\n')}`)

export const PACKS = packs
export const SOUNDBOARDS = soundboards
export const SCENES = scenes
export const GUIDES = guides
/** The rig shown on the home page: the highest-priority pack that describes one. */
export const RIG: Rig | undefined = rigs[0]
/** Blues Trainer and Blues Plan content from the highest-priority pack that has a "blues" section. */
export const BLUES: unknown = blues[0]?.content
export const SOUND_BY_ID = new Map(soundboards.flatMap(b => b.sounds).map(s => [s.id, s] as const))
export const PACK_PROBLEMS = problems
