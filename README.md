# ems-protocols

Offline iOS/Android quick-reference for the **Boulder County EMS Protocols (April 22, 2026)**.
Pick a chief complaint, open a protocol, and step through its algorithm with Yes/No decisions.
Each step is badged with its certification level, and steps above your level are dimmed.
Protocols without a step-through yet show the original PDF pages.

> Quick-reference only. The official protocols and on-line medical direction take precedence.

## Layout

```
app/                         Expo (SDK 58, expo-router) app
  content/catalog.json       every protocol/med id → title, category, PDF pages (generated)
  content/complaints.json    chief complaint → protocol ids (hand-edited)
  content/protocols/*.json   structured protocols (source of truth for the step-through)
  assets/pages/*.webp        PDF page renders (generated)
  src/content/schema.ts      zod schema for all content
  scripts/                   build-content-index.mts, validate-content.mts
  tests/                     node:test unit tests
tools/extract/               PDF extraction (Python stdlib + poppler, cwebp)
content/source/              extraction output (gitignored, regenerable)
```

## Content pipeline

Requires poppler (`pdftotext`, `pdftocairo`, `pdftoppm`) and `cwebp` (Homebrew).

```sh
PDF="$HOME/Downloads/BoCo Protocols_Apr 2026.pdf"
python3 -I tools/extract/extract.py "$PDF" content/source                 # text, scope colors, links, page PNGs
python3 -I tools/extract/build_catalog.py content/source app/content/catalog.json
sh tools/extract/build_page_images.sh content/source app/assets/pages
python3 -I tools/extract/dump_page.py content/source 87                   # conversion view of one page
cd app && npm run content                                                 # regenerate index + validate
```

`extract.py` reads each flowchart box's fill color from the PDF's vector drawing and maps it to a
scope level (yellow = EMT/EMT-IV, green = AEMT, orange = EMT-I, blue = Paramedic, purple = peds,
grey = teaching). Internal PDF hyperlinks are resolved to target pages, which gives the cross-protocol links.

### Converting a protocol

1. Run `dump_page.py` for its pages and look at `content/source/pages/NNN.png`.
2. Write `app/content/protocols/<id>.json` per `schema.ts`. Each line of a box is an `item` with its
   own `level`. Use `[[p:4050|text]]` for protocol links and `[[m:9120|text]]` for medication links
   (medications use their 9xxx ids). Record any interpretation in `conversionNotes`.
3. Run `npm run content`. The validator checks graph integrity and that every PDF link and word on the
   page appears in the JSON.
4. **Clinical review**: compare against the PDF tab in the app, then set
   `"reviewed": { "by": "...", "date": "YYYY-MM-DD" }`.

## App

```sh
cd app
npm start            # Expo dev server (scan the QR with Expo Go)
npm test             # walker + scope unit tests
npm run typecheck
npx expo lint
```

Distribution: EAS Build → TestFlight (iOS) / internal APK (Android).
