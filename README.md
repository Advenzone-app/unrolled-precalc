# Unrolled — Pre-Calculus you can see

30 short animated Pre-Calculus lessons in the 3Blue1Brown style, grouped into 9 units that follow the Texas Pre-Calculus standards (TEKS §111.42).

## What's inside

- `server.js` — one Express app that serves the pages, the lesson API (`/api/course`) and the videos (with range requests, so seeking works).
- `data/lessons.json` — units, lessons, durations, "what you'll learn" notes and practice questions. Edit this to change text or order.
- `public/` — the front end (plain HTML/CSS/JS, no build step) and lesson thumbnails.
- `media/videos/` — the 30 lesson videos (`ep01.mp4` … `ep30.mp4`).

Progress ("watched" lessons and resume position) is saved in each visitor's browser. There are no accounts and no database.

## Run locally

```bash
npm install
npm start          # http://localhost:3000
```

## Deploy on Render

Create a **Web Service** from this repo: runtime Node, build `npm install`, start `npm start`, plan Free.

## Adding a lesson

1. Put the video in `media/videos/epNN.mp4` and a 640×360 thumbnail in `public/thumbs/epNN.jpg`.
2. Add an entry to the right unit in `data/lessons.json` (`ep`, `title`, `secs`, `teks`, `blurb`, `learn`, `try`).
3. Commit and push — Render redeploys automatically.
