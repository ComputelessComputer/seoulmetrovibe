# Seoul Metro Jazz

Every Seoul subway train is a note. Together they form a generative jazz ensemble that plays without pause — day and night, rush hour and 3am.

Inspired by [TrainJazz](https://www.trainjazz.com) by [@taydotfun](https://x.com/taydotfun).

## What is this?

[TrainJazz](https://www.trainjazz.com) turns every active NYC subway train into a musical note. 800+ trains form a small jazz combo — walking bass, piano, sax, vibes, brushes — that has been playing continuously for over a hundred years. Rush hour fills the band with held tones; at 3am the silences grow longer.

Seoul Metro Jazz is the same idea, applied to Seoul's subway system — one of the densest and most-used metro networks in the world. Line 2 alone runs 42+ trains simultaneously at peak. The music is different here.

## How it works

- Each subway line = a different instrument (Line 1 = bass, Line 2 = piano, Line 3 = sax, etc.)
- Train position along its route = pitch (start of line = low, end = high)
- Train density = volume
- Express trains = louder, more prominent
- Your location = trains nearest to you grow louder

## Tech stack

- **React + TypeScript** (Vite)
- **Leaflet.js** — map rendering
- **CartoDB + OpenStreetMap** tiles — light and dark modes
- **Tone.js** — Web Audio API generative music engine
- **Seoul Open Data API** (`swopenAPI.seoul.go.kr`) — real-time train positions (live mode)

## Data sources

- **Real-time train positions**: [Seoul Open Data Plaza](https://data.seoul.go.kr/dataList/OA-12601/A/1/datasetView.do) — 서울시 지하철 실시간 열차 위치정보 (TOPIS)
- **Station coordinates**: [gaussian37's Seoul metro coordinate dataset](https://gaussian37.github.io/python-etc-수도권-지하철/) — 589 stations
- **Line route data**: [sudo-happy/data-archive](https://github.com/sudo-happy/data-archive) — station sequences, line geometry

## Lines included

1호선, 2호선, 3호선, 4호선, 5호선, 6호선, 7호선, 8호선, 9호선, 분당선, 신분당선, 경의중앙선, 수인분당선, 경춘선, 공항철도, 경강선, 우이신설선

## Live mode

Get a free API key from [Seoul Open Data Plaza](https://data.seoul.go.kr) and replace `YOUR_API_KEY` in `src/constants.ts`. The app auto-falls back to demo mode if the key is missing or requests fail.

## Development

```bash
npm install
npm run dev
```

## Views

- **MAP** — Geographic map with train dots moving along real routes
- **BARS** — Piano roll view, one horizontal bar per line

---

*"Whatever is playing now has not played before and will not play again."*
— TrainJazz
