# MoneyPrinterTurbo — narrated-video stage (optional, offline batch)

MoneyPrinterTurbo (cloned at `tools/moneyprinterturbo`, git-ignored) renders
**narrated** chapter videos: Edge TTS voiceover (free, no key) + subtitles +
Pexels stock footage + background music, 16:9. It complements the app's two
built-in engines (Remotion 3D + HyperFrames file renders, both free and
instant) — it does NOT replace them, and the app never calls it at runtime.

## One-time setup (Windows, ~10 min)

1. Python 3.11 (REQUIRED — verified 2026-09-18: the frozen
   `litellm==1.86.2` rejects Python ≥3.14, and this machine has 3.14, so
   `pip install -r requirements.txt` fails here; `.python-version` pins 3.11).
2. ffmpeg on PATH (already present here: ffmpeg 8.x).
2. `cd tools/moneyprinterturbo && pip install -r requirements.txt`
3. `copy config.example.toml config.toml`, then edit:
   - `pexels_api_keys = ["<free key from pexels.com/api>"]` (free tier:
     200 req/hour — enough for batches of ~10 clips).
   - No LLM key needed: our batch script passes a custom `video_script`
     per chapter, so script generation is skipped entirely.
   - No TTS key needed: Edge TTS is keyless.
4. Start the API: `python main.py` (serves `http://127.0.0.1:8080`).

No Pexels key? Set `MPT_SOURCE=local` and point `video_materials` at local
mp4s (ffmpeg gradients work as abstract backgrounds) — see the script header.

## Batch-narrate chapters

```powershell
# one chapter
npx tsx scripts/moneyprinter-batch.ts --slugs c10-maths-04
# a whole subject (limit guards quota)
npx tsx scripts/moneyprinter-batch.ts --class 10 --subject Maths --limit 3
```

Each finished clip lands at `public/videos/<slug>/narrated.mp4` plus a
`public/videos/manifest.json` entry. Re-run
`npx tsx scripts/make-lesson-videos.ts` afterwards so the HyperFrames file
render links the narrated mp4, and the Videos page shows the Narrated button.

## Cost / quota reality

- Edge TTS: free, unlimited-ish. Subtitles: free (edge word boundaries).
- Pexels free: 200 requests/hour — a 5-clip batch fits; 500 chapters do NOT
  run in one sitting. Use `--limit`, or run overnight batches.
- Each 18–60s clip takes ~2–6 minutes end-to-end on a laptop.
