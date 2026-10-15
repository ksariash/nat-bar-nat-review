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

`review.json` must be the site's runtime copy, which includes `audio_chunks` (from `site/dist/assets/review.json`), not the earlier alignment-only JSON. The audio chunk references must be `assets/review-00.m4a` etc. The PDF, JSON, and audio remain in R2 and are not committed to this public repository.

Requests to `/assets/*` are routed through the Worker, which reads only these ten approved object names. Other app files use the static `ASSETS` binding. The bucket need not be publicly exposed. The Worker supports HEAD, conditional reads, and single byte ranges for PDF/audio seeking, and sets MIME types explicitly even if objects were uploaded as octet-stream.

The static frontend uses PDF.js downloaded from npm during build. Google Fonts are optional; system sans-serif fallback works if unavailable.

## Development and checks

```sh
npm install
npm test
npm run dev
```

Local Wrangler development uses a local R2 bucket by default. To test the real files, deploy to the connected Worker or seed the local R2 bucket. Never commit credentials or study media. Deployment credentials are handled by Cloudflare's Git integration.

The transcript is an automated draft with uncertainty markers. Audio/PDF links are reviewed topic-level matches, not exact sentence alignment. Bookmarks, studied topics, essay answers, and checklist progress are stored locally in each student's browser. There are 58 multiple-choice questions and 5 essays; study-section counts are not question numbers.
