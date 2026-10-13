// Unrolled — front end. Plain JavaScript, no build step.
(() => {
  'use strict';

  const $main = document.getElementById('main');
  const $slot = document.getElementById('topbar-slot');
  const $toast = document.getElementById('toast');

  let course = null;
  let lessons = [];
  let bySlug = {};
  const ui = { query: '', unit: 0 };

  // ---------- saved progress (this device only) ----------
  const KEY = 'unrolled.progress.v1';
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  let progress = Object.assign({ watched: {}, pos: {}, last: null }, load());
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* storage blocked: keep in memory */ }
  }
  const isWatched = (l) => !!progress.watched[l.ep];
  const watchedCount = () => lessons.filter(isWatched).length;
  function setWatched(l, on) {
    if (on) progress.watched[l.ep] = true; else delete progress.watched[l.ep];
    save();
  }

  // ---------- helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const long = (s) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
  let toastTimer;
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), 2600);
  }
  async function share(url, title) {
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); toast('Link copied — paste it to a friend'); }
    catch (e) { toast(url); }
  }
  const icon = {
    search: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#8a91a3" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    share: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    link: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 12l5 5 9-10"/></svg>',
    checkSm: '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12l5 5 9-10"/></svg>',
    play: '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="#14161d"/></svg>',
    list: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    speed: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 14l4-4"/><path d="M3.3 17a9 9 0 1117.4 0"/></svg>',
  };

  // ---------- routing ----------
  function navigate(path) {
    if (path === location.pathname) return;
    history.pushState({}, '', path);
    route();
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-link]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(a.getAttribute('href'));
  });
  window.addEventListener('popstate', route);

  function route() {
    const m = location.pathname.match(/^\/lesson\/([\w-]+)\/?$/);
    if (m && bySlug[m[1]]) renderLesson(bySlug[m[1]]);
    else if (m) renderMissing();
    else renderHome();
    window.scrollTo(0, 0);
  }

  // ---------- home ----------
  function renderHome() {
    document.title = 'Unrolled — Pre-Calculus you can see';
    const total = Math.round(course.totalSecs / 60);
    const lastSlug = progress.last && bySlug[progress.last] ? progress.last : null;
    const cont = lastSlug ? bySlug[lastSlug] : lessons[0];
    const n = watchedCount();
    const pct = Math.round(n / lessons.length * 100);

    $slot.innerHTML = `
      <span class="pill">Pre-Calculus</span>
      <label class="search"><span class="sr-only">Search lessons</span>${icon.search}
        <input id="q" type="search" autocomplete="off" placeholder="Search lessons — try “log” or “vectors”" value="${esc(ui.query)}"></label>
      <button type="button" class="btn btn-primary" id="share-site">${icon.share} Share with friends</button>`;

    $main.innerHTML = `
      <section class="hero">
        <div class="hero-text">
          <h1>Pre-Calculus<br>you can <em>see</em>.</h1>
          <p>${lessons.length} short animated lessons that turn every formula into a picture. Each one is about two minutes, and together they cover the whole Texas Pre-Calculus course.</p>
          <div class="stats">
            <div class="stat"><b>${lessons.length}</b><span>lessons</span></div>
            <div class="stat"><b>${course.units.length}</b><span>units</span></div>
            <div class="stat"><b>${total} min</b><span>total watch time</span></div>
          </div>
        </div>
        <a href="/lesson/${cont.slug}" data-link class="card continue">
          <div class="thumb">
            <img src="${cont.thumb}" alt="" width="640" height="360">
            <div class="play-overlay"><div class="play-dot">${icon.play}</div></div>
          </div>
          <div class="continue-body">
            <div class="eyebrow">${lastSlug ? 'Continue watching' : 'Start here'}</div>
            <div class="continue-title">${cont.code} · ${esc(cont.title)}</div>
            <div class="bar-row">
              <div class="bar" role="progressbar" aria-label="Lessons watched" aria-valuemin="0" aria-valuemax="${lessons.length}" aria-valuenow="${n}"><div style="width:${pct}%"></div></div>
              <div class="bar-label">${n} of ${lessons.length} watched</div>
            </div>
          </div>
        </a>
      </section>
      <nav class="chips" aria-label="Filter by unit" id="chips"></nav>
      <div id="lessons"></div>`;

    renderChips();
    renderGrid();

    const q = document.getElementById('q');
    q.addEventListener('input', () => { ui.query = q.value; renderGrid(); });
    document.getElementById('share-site').addEventListener('click', () => share(location.origin + '/', 'Unrolled — Pre-Calculus you can see'));
  }

  function renderChips() {
    const $chips = document.getElementById('chips');
    const items = [{ n: 0, label: 'All units' }].concat(course.units.map((u) => ({ n: u.n, label: `${u.n} · ${u.name}` })));
    $chips.innerHTML = items.map((c) =>
      `<button type="button" class="chip" data-unit="${c.n}" aria-pressed="${ui.unit === c.n}">${esc(c.label)}</button>`).join('');
    $chips.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      ui.unit = Number(b.dataset.unit);
      renderChips();
      renderGrid();
    }));
  }

  function renderGrid() {
    const q = ui.query.trim().toLowerCase();
    let shown = 0;
    const html = course.units.map((u) => {
      if (ui.unit && ui.unit !== u.n) return '';
      const items = u.lessons.filter((l) => !q || `${l.title} ${l.blurb} ${u.name} ${l.learn.join(' ')}`.toLowerCase().includes(q));
      if (!items.length) return '';
      shown += items.length;
      const done = u.lessons.filter(isWatched).length;
      return `
        <section class="unit" aria-labelledby="u${u.n}">
          <div class="unit-head">
            <div class="unit-title">
              <span class="unit-tag" style="background:${u.color}">Unit ${u.n}</span>
              <h2 id="u${u.n}">${esc(u.name)}</h2>
            </div>
            <div class="unit-progress">${done} of ${u.lessons.length} watched</div>
          </div>
          <div class="grid">${items.map((l) => cardHTML(l, u)).join('')}</div>
        </section>`;
    }).join('');
    document.getElementById('lessons').innerHTML = shown ? html :
      `<div class="empty">No lessons match “${esc(ui.query)}”. Try a shorter word, like “trig”.</div>`;
  }

  function cardHTML(l, u) {
    return `
      <a href="/lesson/${l.slug}" data-link class="card">
        <div class="thumb">
          <img src="${l.thumb}" alt="" loading="lazy" width="640" height="360">
          <span class="dur">${mmss(l.secs)}</span>
          ${isWatched(l) ? `<span class="watched-badge">${icon.checkSm}Watched</span>` : ''}
        </div>
        <div class="card-body">
          <div class="card-code" style="color:${u.color}">Lesson ${l.code}</div>
          <div class="card-title">${esc(l.title)}</div>
          <div class="card-blurb">${esc(l.blurb)}</div>
        </div>
      </a>`;
  }

  // ---------- lesson ----------
  const SPEEDS = [1, 1.25, 1.5, 0.75];
  function renderLesson(l) {
    document.title = `${l.code} ${l.title} — Unrolled`;
    progress.last = l.slug; save();
    const unit = course.units.find((u) => u.n === l.unit);

    $slot.innerHTML = `
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="/" data-link>Pre-Calculus</a><span class="crumb-sep" aria-hidden="true">/</span>
        <span class="crumb-unit">Unit ${unit.n} · ${esc(unit.name)}</span>
      </nav>
      <a href="/" data-link class="btn">${icon.list} All lessons</a>`;

    $main.innerHTML = `
      <div class="lesson">
        <div class="lesson-main">
          <div class="player">
            <video id="vid" controls playsinline preload="metadata" poster="${l.thumb}">
              <source src="${l.video}" type="video/mp4">
              Your browser can't play this video. <a href="${l.video}">Download it instead.</a>
            </video>
          </div>
          <div class="lesson-head">
            <div class="eyebrow">Unit ${unit.n} · Lesson ${l.code.split('.')[1]}</div>
            <h1>${esc(l.title)}</h1>
            <div class="meta"><span>${long(l.secs)}</span><span>TEKS ${esc(l.teks)}</span></div>
          </div>
          <div class="actions">
            <button type="button" id="watched" class="btn"></button>
            <button type="button" id="speed" class="btn" aria-label="Playback speed">${icon.speed} <span id="speed-label">1×</span></button>
            <button type="button" id="share" class="btn">${icon.link} Copy link for a friend</button>
          </div>
          <section class="panel" aria-labelledby="learn-h">
            <h2 id="learn-h">What you'll learn</h2>
            <ul>${l.learn.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
            <div class="try"><span class="try-label">Try it yourself</span><span>${esc(l.try)}</span></div>
          </section>
          <div class="prevnext">
            ${l.prev ? `<a class="pn" href="/lesson/${l.prev.slug}" data-link><small>Previous</small><b>${l.prev.code} · ${esc(l.prev.title)}</b></a>` : '<span style="flex:1 1 260px"></span>'}
            ${l.next ? `<a class="pn next" href="/lesson/${l.next.slug}" data-link><small>Next lesson</small><b>${l.next.code} · ${esc(l.next.title)}</b></a>` : ''}
          </div>
        </div>
        <aside class="side" aria-label="Lessons in this unit">
          <div class="side-box">
            <h2>Unit ${unit.n} · ${esc(unit.name)}</h2>
            ${unit.lessons.map((x) => {
              const cur = x.slug === l.slug;
              const meta = cur ? '<span class="row-meta now">Now playing</span>' :
                isWatched(x) ? '<span class="row-meta done">Watched</span>' : `<span class="row-meta">${mmss(x.secs)}</span>`;
              return `<a class="row" href="/lesson/${x.slug}" data-link ${cur ? 'aria-current="page"' : ''}>
                <img src="${x.thumb}" alt="" loading="lazy" width="112" height="63">
                <div class="row-text">${meta}<span class="row-title">${x.code} · ${esc(x.title)}</span></div></a>`;
            }).join('')}
          </div>
          <div class="side-box">
            <h2>Your progress</h2>
            <div class="bar-row" style="padding: 0 6px">
              <div class="bar" role="progressbar" aria-label="Lessons watched" aria-valuemin="0" aria-valuemax="${lessons.length}" id="course-bar"><div></div></div>
              <span class="bar-label" id="course-count"></span>
            </div>
            <p class="side-note">Saved on this device. No account needed. <button type="button" class="reset" id="reset">Reset</button></p>
          </div>
        </aside>
      </div>`;

    const vid = document.getElementById('vid');
    const $w = document.getElementById('watched');
    const $speed = document.getElementById('speed-label');

    function paint() {
      const on = isWatched(l);
      $w.className = on ? 'btn btn-done' : 'btn';
      $w.setAttribute('aria-pressed', String(on));
      $w.innerHTML = `${icon.check} ${on ? 'Watched' : 'Mark as watched'}`;
      const n = watchedCount();
      document.querySelector('#course-bar > div').style.width = `${Math.round(n / lessons.length * 100)}%`;
      document.getElementById('course-bar').setAttribute('aria-valuenow', String(n));
      document.getElementById('course-count').textContent = `${n} / ${lessons.length}`;
    }
    paint();

    $w.addEventListener('click', () => { setWatched(l, !isWatched(l)); paint(); });
    document.getElementById('share').addEventListener('click', () => share(`${location.origin}/lesson/${l.slug}`, `${l.code} ${l.title}`));
    document.getElementById('reset').addEventListener('click', () => {
      if (!window.confirm('Clear your watched lessons on this device?')) return;
      progress = { watched: {}, pos: {}, last: l.slug }; save(); paint(); toast('Progress cleared');
    });

    let speedIdx = 0;
    try { speedIdx = Math.max(0, SPEEDS.indexOf(Number(localStorage.getItem('unrolled.speed')) || 1)); } catch (e) { /* ignore */ }
    const applySpeed = () => { vid.playbackRate = SPEEDS[speedIdx]; $speed.textContent = `${SPEEDS[speedIdx]}×`; };
    applySpeed();
    document.getElementById('speed').addEventListener('click', () => {
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      applySpeed();
      try { localStorage.setItem('unrolled.speed', String(SPEEDS[speedIdx])); } catch (e) { /* ignore */ }
    });
    vid.addEventListener('ratechange', () => { $speed.textContent = `${vid.playbackRate}×`; });

    // Resume where the student left off.
    vid.addEventListener('loadedmetadata', () => {
      applySpeed();
      const t = progress.pos[l.ep];
      if (t && t > 5 && t < vid.duration * 0.92) { vid.currentTime = t; toast(`Resuming at ${mmss(t)}`); }
    }, { once: true });
    let lastSaved = 0;
    vid.addEventListener('timeupdate', () => {
      const t = vid.currentTime;
      if (Math.abs(t - lastSaved) >= 3) { progress.pos[l.ep] = t; lastSaved = t; save(); }
      if (!isWatched(l) && vid.duration && t / vid.duration >= 0.9) { setWatched(l, true); paint(); toast('Nice — lesson marked as watched'); }
    });
    vid.addEventListener('ended', () => { delete progress.pos[l.ep]; save(); });
  }

  function renderMissing() {
    document.title = 'Lesson not found — Unrolled';
    $slot.innerHTML = '';
    $main.innerHTML = `<div class="empty" style="margin-top:48px">That lesson doesn't exist. <a href="/" data-link>See all lessons</a></div>`;
  }

  // ---------- start ----------
  fetch('/api/course')
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      course = data;
      lessons = course.units.flatMap((u) => u.lessons);
      bySlug = Object.fromEntries(lessons.map((l) => [l.slug, l]));
      route();
    })
    .catch(() => {
      $main.innerHTML = '<div class="empty" style="margin-top:48px">Couldn\'t load the lessons. The site may be waking up — please refresh in a few seconds.</div>';
    });
})();
