# Make it yours: packs

Everything personal in this app comes from **packs**: folders in `app/packs/` that add content without changing any code. This starter pack gives you a few generic mood presets and this guide. Your own pack is where your gear, your sounds and your notes go.

## What a pack can add

- **Soundboards** for the Jam Room: your own sound effects, so friends listening in can play along.
- **Mood presets**: a key, scales to try, an effects recipe and a loop to build for a feeling or a setting.
- **Guides**: markdown notes like this one, shown on the Guides page.
- **Your rig**: the guitar and signal chain shown on the home page.
- **A practice plan** for the Blues Trainer. The default comes from the `blues` pack; yours can replace it.

## Making one

1. Make a folder, `app/packs/<your-name>/`.
2. Add a `pack.json`. The full format is in `PACKS.md` at the top of the repository.
3. Put audio in `sounds/` and notes in `guides/`.
4. Run `npm run check-packs`, then rebuild.

## Let an AI do it

The repository has an `AGENTS.md` written for AI coding assistants. Open the project in one (Claude Code, Codex, Cursor and so on) and say something like:

> Make me a pack. I play a Strat through a Blues Junior with a tube screamer and a cheap delay. I'm learning jazz chords, and I jam with friends over video on Fridays.

It will ask about your gear and goals, write the pack, check it and rebuild.

## Keeping it private

Packs other than `starter` and `blues` are ignored by git, so your personal pack stays on your machine unless you choose to share it. Keep it in its own private repository if you want a backup. Only share sounds you have the right to share.
