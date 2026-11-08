#!/usr/bin/env node
// Validates every app/packs/<id>/pack.json against the format in PACKS.md.
// Runs before every build; also handy on its own: `npm run check-packs`.
// Exits 1 on errors (the build stops); warnings are printed but don't stop it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packsDir = path.join(appDir, 'packs')
const scaleIds = new Set(JSON.parse(fs.readFileSync(path.join(appDir, 'src/data/scales.json'), 'utf8')).scales.map(s => s.id))
// Form ids are read from the BLUES_FORMS block (voicing modes later in the file also have ids).
const formsSrc = fs.readFileSync(path.join(appDir, 'src/data/bluesForms.ts'), 'utf8')
const formsBlock = formsSrc.slice(formsSrc.indexOf('BLUES_FORMS'), formsSrc.indexOf('\n]', formsSrc.indexOf('BLUES_FORMS')))
const formIds = new Set([...formsBlock.matchAll(/id: '([a-z0-9-]+)'/g)].map(m => m[1]))
const OVERLAYS = new Set(['chord-tones', 'chord-mixolydian', 'blues-scale', 'bb-box', 'minor-pent', 'major-pent', 'bass-line', 'off'])
const ID = /^[a-z0-9][a-z0-9-]{0,30}$/
const AUDIO = /\.(mp3|ogg|wav|m4a|webm)$/i
const str = v => typeof v === 'string' && v.trim().length > 0
const strs = v => Array.isArray(v) && v.every(str)

let errors = 0, warnings = 0
const err = (where, msg) => { errors++; console.error(`  ✗ ${where}: ${msg}`) }
const warn = (where, msg) => { warnings++; console.warn(`  ! ${where}: ${msg}`) }

const folders = fs.existsSync(packsDir) ? fs.readdirSync(packsDir).filter(f => fs.statSync(path.join(packsDir, f)).isDirectory()) : []
if (!folders.length) console.warn('No packs found in app/packs/. The app will run, but with no soundboards, presets or guides.')

for (const folder of folders) {
    const dir = path.join(packsDir, folder)
    const where = `packs/${folder}`
    const file = path.join(dir, 'pack.json')
    if (!fs.existsSync(file)) { err(where, 'missing pack.json'); continue }
    let m
    try { m = JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { err(where, `pack.json is not valid JSON (${e.message})`); continue }
    console.log(`${where} — ${m.name ?? '(no name)'}`)
    if (m.id !== folder) err(where, `"id" must equal the folder name "${folder}"`)
    if (!ID.test(folder)) err(where, 'folder name must be lowercase letters, digits and dashes (max 31 chars)')
    if (!str(m.name)) err(where, '"name" is required')
    const exists = rel => fs.existsSync(path.join(dir, rel))

    const boardIds = new Set()
    for (const [i, b] of (m.soundboards ?? []).entries()) {
        const w = `${where} soundboards[${i}]`
        if (!str(b.id) || !ID.test(b.id)) err(w, '"id" must be a lowercase slug')
        else if (boardIds.has(b.id)) err(w, `duplicate soundboard id "${b.id}"`)
        boardIds.add(b.id)
        if (!str(b.name)) err(w, '"name" is required')
        if (!Array.isArray(b.sounds) || !b.sounds.length) { err(w, '"sounds" must be a non-empty list'); continue }
        const soundIds = new Set()
        for (const [j, s] of b.sounds.entries()) {
            const ws = `${w} sound "${s.id ?? j}"`
            if (!str(s.id) || !ID.test(s.id)) err(ws, '"id" must be a lowercase slug')
            else if (soundIds.has(s.id)) err(ws, 'duplicate id on this board')
            soundIds.add(s.id)
            if (!str(s.label)) err(ws, '"label" is required')
            if (!str(s.file) || !s.file.startsWith('sounds/') || !AUDIO.test(s.file)) err(ws, '"file" must be an audio file under sounds/ (mp3, ogg, wav, m4a, webm)')
            else if (!exists(s.file)) err(ws, `file not found: ${s.file}`)
            if (s.loop !== undefined && typeof s.loop !== 'boolean') err(ws, '"loop" must be true or false')
        }
    }
    if ((m.soundboards ?? []).length && !exists('sounds/LICENSES.md') && !exists('LICENSES.md'))
        warn(where, 'has sounds but no LICENSES.md saying where they came from')

    for (const [i, s] of (m.scenes ?? []).entries()) {
        const w = `${where} scenes[${i}] "${s.id ?? ''}"`
        if (!str(s.id) || !ID.test(s.id)) err(w, '"id" must be a lowercase slug')
        if (!str(s.name)) err(w, '"name" is required')
        if (!strs(s.keys) || !s.keys.length) err(w, '"keys" must be a non-empty list like ["Em", "G"]')
        if (!strs(s.scales) || !s.scales.length) err(w, '"scales" must be a non-empty list of scale ids')
        else for (const id of s.scales) if (!scaleIds.has(id)) err(w, `unknown scale "${id}" (valid: ${[...scaleIds].join(', ')})`)
        if (s.effects !== undefined && !(Array.isArray(s.effects) && s.effects.every(e => str(e.name) && str(e.setting))))
            err(w, '"effects" must be a list of { "name", "setting", "details"? }')
        for (const k of ['techniques', 'layers']) if (s[k] !== undefined && !strs(s[k])) err(w, `"${k}" must be a list of strings`)
    }

    for (const [i, g] of (m.guides ?? []).entries()) {
        const w = `${where} guides[${i}]`
        if (!str(g.title)) err(w, '"title" is required')
        if (!str(g.file) || !g.file.startsWith('guides/') || !g.file.endsWith('.md')) err(w, '"file" must be a .md file under guides/')
        else if (!exists(g.file)) err(w, `file not found: ${g.file}`)
    }

    if (m.rig !== undefined && !(str(m.rig.guitar) && strs(m.rig.chain))) err(where, '"rig" needs "guitar" and a "chain" list')

    if (m.blues !== undefined) {
        const b = m.blues
        for (const [i, s] of (b.scripts ?? []).entries()) {
            const w = `${where} blues.scripts[${i}] "${s.id ?? ''}"`
            if (!str(s.id) || !str(s.name) || !Array.isArray(s.choruses) || !s.choruses.length) { err(w, 'needs id, name and a non-empty "choruses" list'); continue }
            for (const c of s.choruses) {
                if (!str(c.label) || !str(c.detail)) err(w, 'every chorus needs "label" and "detail"')
                if (!OVERLAYS.has(c.overlay)) err(w, `overlay "${c.overlay}" must be one of ${[...OVERLAYS].join(', ')}`)
                if (c.role !== undefined && !['comp', 'bass', 'solo'].includes(c.role)) err(w, 'role must be comp, bass or solo')
            }
        }
        const drillIds = new Set()
        for (const [i, p] of (b.plan ?? []).entries()) {
            const w = `${where} blues.plan[${i}] "${p.id ?? ''}"`
            if (!str(p.id) || !str(p.name) || !Array.isArray(p.drills) || !p.drills.length) { err(w, 'needs id, name and a non-empty "drills" list'); continue }
            for (const d of p.drills) {
                if (!str(d.id) || !str(d.title) || !str(d.goal) || !strs(d.how) || !str(d.doneWhen)) err(w, `drill "${d.id ?? '?'}" needs id, title, goal, how (list) and doneWhen`)
                else if (drillIds.has(d.id)) err(w, `duplicate drill id "${d.id}"`)
                drillIds.add(d.id)
                if (d.trainerLink !== undefined && !(str(d.trainerLink) && d.trainerLink.startsWith('/blues'))) err(w, `drill "${d.id}" trainerLink must start with /blues`)
            }
        }
        if ((b.plan ?? []).length && !(b.plan ?? []).some(p => (p.drills ?? []).some(d => d.trainerLink))) err(`${where} blues.plan`, 'at least one drill needs a trainerLink (the daily session is built from them)')
        for (const [i, t] of (b.repertoire ?? []).entries()) {
            const w = `${where} blues.repertoire[${i}] "${t.title ?? ''}"`
            if (!str(t.title) || !str(t.key) || typeof t.bpm !== 'number' || !t.trainer) err(w, 'needs title, key, bpm and trainer')
            else if (!formIds.has(t.trainer.form)) err(w, `trainer.form "${t.trainer.form}" must be one of ${[...formIds].join(', ')}`)
        }
        if (b.etiquette !== undefined && !strs(b.etiquette)) err(`${where} blues.etiquette`, 'must be a list of strings')
    }

    const known = new Set(['id', 'name', 'description', 'priority', 'soundboards', 'scenes', 'guides', 'rig', 'blues'])
    for (const k of Object.keys(m)) if (!known.has(k)) warn(where, `unknown key "${k}" is ignored`)
}

console.log(errors ? `\n${errors} error(s), ${warnings} warning(s).` : `\nPacks OK (${folders.length}), ${warnings} warning(s).`)
process.exit(errors ? 1 : 0)
