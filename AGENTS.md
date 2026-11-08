# Instructions for AI assistants

This file is for AI coding assistants (Claude Code, Codex, Cursor, Copilot and others) working in this repository. The most common request is **"make me a pack"**: personalising the app for its user without changing the shared code.

## What the app is

A guitar practice app (Vite + React + TypeScript in `app/`) with a fretboard explorer, a metronome, a blues trainer with a practice plan, guides, a recorder, mood presets, and a Jam Room where the user streams their playing to friends who can trigger soundboard effects. An optional WebSocket signalling server for the Jam Room lives in `server/`.

Everything personal comes from **packs** in `app/packs/<id>/`. The format is in `PACKS.md`; read it before writing one.

## Making a pack for the user

1. **Ask before writing.** Find out, briefly:
   - Their guitar(s) and pickups, and their amp and effects in signal-chain order (rough is fine).
   - What they're working on and their level.
   - Styles and moods they want to play. For mood presets, ask what settings or occasions they play for (game nights, writing, relaxing, a band).
   - Whether they jam with friends in the Jam Room, and what kind of soundboard would be fun for that group.
   - What to call the pack, and whether they plan to share it.
2. **Write `app/packs/<id>/pack.json`.** Use the user's real gear in `rig` and in each scene's `effects`, with settings in the language of their knobs ("Time at 2 o'clock", "Mix 30%"). Only use scale ids from `app/src/data/scales.json`.
3. **Practice plan (optional).** If they're working toward a specific goal in blues, their pack can have its own `blues` section replacing the default plan. Base it on `app/packs/blues/pack.json` and tune keys, tempos, repertoire and drills to them. Leave it out if the default plan suits them.
4. **Guides.** Turn useful notes into markdown under `guides/`: a reference for their pedalboard, a practice routine for their goal. Keep them short and practical.
5. **Sounds.** Never download or include audio unless the user supplies the files or the source is clearly public domain (CC0) or Creative Commons with the credit recorded in `sounds/LICENSES.md`. Don't add game or film rips, or files from sites that forbid redistribution, to a pack the user plans to share. If they have no sounds yet, leave `soundboards` out and tell them how to add them.
6. **Check it:** run `npm run check-packs` in `app/` and fix every error.
7. **Build it:** run `npm run build` (or `npm run dev` to try it). Tell the user what you added and where to find it in the app.

## Rules

- Don't edit app code to personalise it. If a pack can't express what the user wants, say so and suggest a change to the pack format instead.
- Never commit a personal pack to this repository. `.gitignore` excludes everything in `app/packs/` except `starter` and `blues`. If the user wants a backup, suggest a separate private repository cloned into `app/packs/<id>`.
- Don't put personal information (addresses, health details, account names, tokens) in the starter pack or anywhere outside the user's own pack.
- The Jam Room's host token and server settings go in `server/.env` and `app/.env`, which are gitignored. Never commit them.
