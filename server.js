// Unrolled — Pre-Calculus explainer site.
// One small Express app serves the pages, the lesson data API and the videos.
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// ---------- course data ----------
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'lessons.json'), 'utf8'));
const pad = (n) => String(n).padStart(2, '0');
const lessons = [];
const course = {
  ...raw.course,
  units: raw.units.map((u) => ({
    ...u,
    lessons: u.lessons.map((l, i) => {
      const code = `${u.n}.${i + 1}`;
      const item = {
        ...l,
        code,
        slug: `${u.n}-${i + 1}`,
        unit: u.n,
        unitName: u.name,
        color: u.color,
        video: `/videos/ep${pad(l.ep)}.mp4`,
        thumb: `/thumbs/ep${pad(l.ep)}.jpg`,
      };
      lessons.push(item);
      return item;
    }),
  })),
};
lessons.forEach((l, i) => {
  l.prev = i > 0 ? { slug: lessons[i - 1].slug, code: lessons[i - 1].code, title: lessons[i - 1].title } : null;
  l.next = i < lessons.length - 1 ? { slug: lessons[i + 1].slug, code: lessons[i + 1].code, title: lessons[i + 1].title } : null;
});
course.totalSecs = lessons.reduce((s, l) => s + l.secs, 0);
course.count = lessons.length;
const bySlug = Object.fromEntries(lessons.map((l) => [l.slug, l]));

// ---------- middleware ----------
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Videos: express.static handles HTTP range requests, so seeking works.
app.use('/videos', express.static(path.join(ROOT, 'media', 'videos'), {
  maxAge: '7d', immutable: true, acceptRanges: true, fallthrough: false,
}));
app.use(express.static(path.join(ROOT, 'public'), { maxAge: '1h', index: false }));

// ---------- API ----------
app.get('/api/course', (req, res) => res.json(course));
app.get('/api/lessons/:slug', (req, res) => {
  const l = bySlug[req.params.slug];
  if (!l) return res.status(404).json({ error: 'Lesson not found' });
  res.json(l);
});
app.get('/healthz', (req, res) => res.send('ok'));

// ---------- pages (single page app, with per-lesson share previews) ----------
const shell = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function page(req, title, desc, image) {
  const origin = `${req.protocol}://${req.get('host')}`;
  return shell
    .replace(/__TITLE__/g, esc(title))
    .replace(/__DESC__/g, esc(desc))
    .replace(/__IMAGE__/g, esc(origin + image))
    .replace(/__URL__/g, esc(origin + req.originalUrl));
}
app.set('trust proxy', true);
app.get('/', (req, res) => {
  res.send(page(req, 'Unrolled — Pre-Calculus you can see',
    `${course.count} short animated Pre-Calculus lessons. Free to watch and share.`, '/thumbs/ep01.jpg'));
});
app.get('/lesson/:slug', (req, res) => {
  const l = bySlug[req.params.slug];
  if (!l) return res.status(404).send(page(req, 'Lesson not found — Unrolled', 'That lesson does not exist.', '/thumbs/ep01.jpg'));
  res.send(page(req, `${l.code} ${l.title} — Unrolled`, `${l.blurb} A ${Math.round(l.secs / 60)}-minute animated Pre-Calculus lesson.`, l.thumb));
});
app.use((req, res) => res.status(404).send(page(req, 'Page not found — Unrolled', 'That page does not exist.', '/thumbs/ep01.jpg')));

app.listen(PORT, () => console.log(`Unrolled is running on port ${PORT}`));
