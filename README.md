# SCP Review Desk

Student-facing study site for Nat bar Nat and Stam Yeinam. No sign-in is implemented or required by the application.

## Cloudflare deployment

- Worker: `nat-bar-nat-review`
- Domain: `rashti-review.scp-study.app`
- R2 bucket: `scp-study-audio`
- R2 binding: `STUDY_ASSETS` (declared in `wrangler.jsonc`; created during deployment)
- R2 key prefix: `rashti-review/`

Connect the repository's `main` branch to the existing Worker in Cloudflare Workers Builds. Use the repository root and the deploy command `npx wrangler deploy`. Dependencies install from `package.json`; Wrangler's build command runs `npm run build` to prepare PDF.js. An additional Cloudflare build command is not required. Use Node 22.13+ (Node 24 recommended).

The existing custom domain is declared in Wrangler. If Cloudflare Access has separately been enabled for this domain, remove that Access policy for student-facing anonymous use. The application itself has no authentication or account requirement.

## Required R2 objects

The contents of the original site assets folder should already exist at these keys:

- `rashti-review/review.json`
- `rashti-review/summary5.pdf`
- `rashti-review/review-00.m4a` through `rashti-review/review-07.m4a`
- `rashti-review/review-full.m4a` — full cleaned audio with chapter titles and PDF page references
- `rashti-review/review-chapters.html` — companion chapter index linking to audio times and notes

`review.json` must be the site's runtime copy, which includes `audio_chunks` (from `site/dist/assets/review.json`), not the earlier alignment-only JSON. The audio chunk references must be `assets/review-00.m4a` etc. The PDF, JSON, and audio remain in R2 and are not committed to this public repository.

Requests to `/assets/*` are routed through the Worker, which reads only these twelve approved object names. Other app files use the static `ASSETS` binding. The bucket need not be publicly exposed. The Worker supports HEAD, conditional reads, and single byte ranges for PDF/audio seeking, and sets MIME types explicitly even if objects were uploaded as octet-stream. The full audio response includes an attachment filename for download.

The static frontend uses PDF.js downloaded from npm during build. Google Fonts are optional; system sans-serif fallback works if unavailable.

## Development and checks

```sh
npm install
npm test
npm run dev
```

Local Wrangler development uses a local R2 bucket by default. To test the real files, deploy to the connected Worker or seed the local R2 bucket. Never commit credentials or study media. Deployment credentials are handled by Cloudflare's Git integration.

The transcript is an automated draft with uncertainty markers. Audio/PDF links are reviewed topic-level matches, not exact sentence alignment. Bookmarks, studied topics, essay answers, and checklist progress are stored locally in each student's browser. There are 58 multiple-choice questions and 5 essays; study-section counts are not question numbers.

Review mode plays all visits linked to topics flagged Needs review, in audio order. Shared chapters and overlapping time ranges play once; the queue stops at the end. Skip off-topic remains a separate setting. Notes-only topics stay in the map. The mobile Focus view shares the main playback bar, and each visit has a separate PDF button that does not seek audio. PDF/Audio map order is remembered; opening the map or changing order reveals the selected topic.

Deep links accept validated `chapter` and `topic` IDs from `review.json`, for example `?chapter=chapter-001&topic=study-002`. They open the linked notes and seek without autoplay. Downloads always contain the full recording, independent of review/skip settings. M4A chapter display depends on the student's audio player; the HTML index provides portable links back into the site.

The audio timeline uses the existing chapter boundaries in `review.json`: gold marks the current chapter, darker gold shows its played portion, and ticks mark other chapter boundaries. Hovering previews the chapter title, focus, PDF pages, and elapsed/remaining time at that point without seeking. Touch scrubbing and keyboard slider navigation also show previews. A compact counter continuously shows current-chapter elapsed/remaining time; the outer labels retain the full-recording times. These times refer to source audio duration, independent of playback speed and off-topic skipping.
