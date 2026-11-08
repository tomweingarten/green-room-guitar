# Green Room Guitar

A browser app for practising guitar and playing to friends.

- **Fretboard**: 18 scales and modes on an interactive neck, with chord progressions and a comparison overlay.
- **Metronome**: subdivisions, tap tempo and timing drills.
- **Blues Trainer**: a synthesized band (drums, bass, organ) over standard, quick-change, minor, 8-bar and jazz blues forms, with a big chord chart, chord-aware fretboard overlays and coached chorus-by-chorus practice scripts.
- **Blues Plan**: five phases from the 12-bar form to open-mic ready, with daily 15–45 minute sessions and a jam repertoire.
- **Recorder**: monitor any input and capture clips.
- **Jam Room**: stream your guitar to friends over WebRTC. Everyone in the room can trigger soundboard effects that all of you hear.
- **Mood presets**: a key, scales, an effects recipe and a loop to build for a mood.

## Make it yours

Personal content comes from **packs** in `app/packs/`: your soundboards, mood presets for your effects, your notes, your rig, even your own practice plan. The format is in [PACKS.md](PACKS.md).

Or let an AI coding assistant write one: [AGENTS.md](AGENTS.md) tells it how. Open the repo in Claude Code, Codex, Cursor or similar and ask it to make you a pack.

## Run it

```sh
cd app
npm install
npm run dev        # http://localhost:5180/guitar/
npm run build      # checks packs, type-checks, builds to app/dist
```

The app is built to be served at `/guitar/` (see `base` in `app/vite.config.ts` and `basename` in `app/src/main.tsx`).

## Jam Room server

The Jam Room needs a small WebSocket signalling server, in `server/` (Node, no database). Audio goes peer to peer; the server only introduces peers and relays soundboard triggers.

```sh
cd server
npm install
LISTEN_PORT=8787 LISTEN_HOST_TOKEN=some-long-random-string node listen-server.js
```

Point the app at it with `VITE_LISTEN_WS_URL` in `app/.env` (see `app/.env.example`). The host opens `/jam/<room>?host=<token>` once; listeners just open `/jam/<room>`. `server/listen-server.service` and `deploy-listen-server.sh` are an example systemd setup.

Microphone access needs HTTPS (or localhost), so serve the app over HTTPS when friends connect.

## Licenses

Code: MIT (see `LICENSE`). Fonts: Poiret One and IBM Plex Mono under the SIL Open Font License, texts in `app/public/fonts/`. Starter sounds: credited in `app/packs/starter/sounds/LICENSES.md`.
