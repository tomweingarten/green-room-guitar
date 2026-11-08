# Packs

A pack is a folder in `app/packs/` that adds content to the app: soundboards, mood presets, guides and a rig. The app finds every pack folder at build time. There's nothing to register: add a folder, run `npm run check-packs`, rebuild.

```
app/packs/<id>/
  pack.json          required
  sounds/            audio for soundboards (mp3, ogg, wav, m4a, webm)
  sounds/LICENSES.md where each sound came from (expected if you have sounds)
  guides/            markdown files for the Guides page
```

Two packs ship with the app: `starter` (generic mood presets and the pack guide) and `blues` (the Blues Trainer's coached scripts and the Blues Plan). Every other pack folder is ignored by git, so personal packs stay out of the public repository.

## pack.json

```jsonc
{
  "id": "my-pack",            // must equal the folder name: lowercase letters, digits, dashes
  "name": "My rig",
  "description": "Optional one-liner",
  "priority": 10,             // optional; higher shows first. starter is -10

  "rig": {                    // optional; the highest-priority rig is shown on the home page
    "guitar": "Fender Player Stratocaster",
    "details": "SSS · 22 frets · 9s",
    "chain": ["Tuner", "Tube Screamer", "Blues Junior", "Delay"]
  },

  "soundboards": [{           // optional; boards appear in the Jam Room
    "id": "game-night",
    "name": "Game night",
    "description": "Optional",
    "sounds": [
      { "id": "rimshot", "label": "Rimshot", "icon": "🥁", "file": "sounds/rimshot.mp3",
        "loop": false,        // optional; true for ambience that should repeat
        "category": "funny",  // optional; free text, used for ordering and grouping
        "hidden": false }     // optional; blank tile until hovered, kept out of the activity feed
    ]
  }],

  "scenes": [{                // optional; "Mood presets" in the Studio, and a filter on the Fretboard
    "id": "rainy-cafe",
    "name": "Rainy Café",
    "emoji": "☕",
    "subtitle": "Lo-fi chords for a slow afternoon",
    "mood": "Warm, hazy, unhurried",
    "color": "#b8913f",       // optional accent, any CSS colour
    "keys": ["Dm", "Am"],     // first key is drawn on the fretboard
    "scales": ["dorian"],     // scale ids from app/src/data/scales.json; first is drawn
    "pickup": "Neck pickup, tone rolled back",
    "effects": [{ "name": "Delay", "setting": "Short slapback", "details": ["Optional knob-by-knob notes"] }],
    "techniques": ["Seventh chords played softly"],
    "layers": ["Loop a two-chord vamp", "Add a melody on top"]  // optional loop-building steps
  }],

  "guides": [                 // optional
    { "file": "guides/pedalboard.md", "title": "Pedalboard", "category": "Gear" }
  ],

  "blues": { ... }            // optional; see "Blues Trainer content" below
}
```

Valid scale ids: `minor-pentatonic`, `major-pentatonic`, `natural-minor`, `dorian`, `mixolydian`, `harmonic-minor`, `phrygian`, `lydian`, `melodic-minor`, `phrygian-dominant`, `whole-tone`, `diminished-hw`, `major`, `locrian`, `blues`, `bebop-dominant`, `lydian-dominant`, `hirajoshi`.

## Blues Trainer content

The `blues` section supplies the Blues Trainer's coached practice scripts and the Blues Plan page. The highest-priority pack with a `blues` section wins, so a personal pack can replace the default plan entirely. If no pack has one, the Blues Plan page is hidden and the trainer still works without scripts. `app/packs/blues/pack.json` is the full working example; copy it as a starting point.

- `scripts`: `{ id, name, description, noBacking?, choruses: [{ label, detail, overlay, role?, callResponse? }] }`. `overlay` is what the fretboard highlights for that chorus: `chord-tones`, `chord-mixolydian`, `blues-scale`, `bb-box`, `minor-pent`, `major-pent`, `bass-line` or `off`. `role` (`comp`, `bass` or `solo`) makes the backing band drop that part.
- `plan`: phases `{ id, name, weeks, focus, why, drills: [{ id, title, goal, how: [...], doneWhen, trainerLink? }] }`. `trainerLink` is a `/blues?...` link that sets up the trainer (form, key, bpm, script, overlay). The daily session is built from drills that have one.
- `repertoire`: `{ title, artist, key, form, feel, bpm, note, trainer: { form, drums, feel? } }`. `trainer.form` is one of `standard`, `quick-change`, `minor`, `eight-bar`, `jazz`; `drums` is `shuffle`, `twelve8` or `straight`.
- `etiquette`: a list of tips.

## How ids work

Ids only need to be unique inside their pack. The app prefixes them with the pack id (`my-pack--rimshot`), so two packs can both have a `rimshot`. Everyone in a Jam Room runs the same build, so a sound played by one person plays for everyone, whichever board they have open.

## Sounds and licensing

Only include sounds you have the right to use. For a pack you share, that means sounds you recorded, public domain (CC0) or Creative Commons with the credit written in `sounds/LICENSES.md`. Many "free" sound sites allow use in projects but not redistribution of the files themselves, so they're fine in a private pack and not in a public one.

## Keeping a personal pack

Your pack folder is ignored by the app's git repository. To back it up or use it on another machine, make it its own private repository and clone it into `app/packs/`:

```sh
git clone git@github.com:you/my-guitar-pack.git app/packs/my-pack
```
