// App shell: sidebar (drawer on phones) shared by every in-app page. Loaded as the first thing in <body>.
(() => {
  const icon = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const I = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>',
    case: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    school: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',
    doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    plus: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    account: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
  };
  window.compIcon = name => icon(I[name]);
  // Each student sets their own hours goal (school requirement, cord, award); 100 until they do
  window.compGoal = () => { try { return Number(localStorage.getItem('comp-goal')) || 100; } catch { return 100; } };
  const link = (href, ic, text) => `<a href="${href}">${icon(I[ic])}<span>${text}</span></a>`;
  const brand = '<a class="brand" href="home.html"><span class="logo">c.</span>comp.</a>';

  // Lily UI switch (sidebar footer): Home becomes the lily page from before the redesign (lily.html)
  const here = location.pathname.split('/').pop() || 'home.html';
  let lily = false;
  try { lily = localStorage.getItem('comp-lily') === '1'; } catch {}
  if (lily && here === 'home.html') return location.replace('lily.html');

  document.body.classList.add('shell');
  document.body.insertAdjacentHTML('afterbegin', `
<aside class="side" id="side" aria-label="Main">
  ${brand}
  <nav>
    ${link('home.html', 'home', 'Home')}
    ${link('calendar.html', 'cal', 'Calendar')}
    ${link('log.html', 'clock', 'Log hours')}
    ${link('profile.html', 'user', 'My hours &amp; profile')}
    ${link('resume.html', 'doc', 'Resume')}
    <p class="side-h">Applications</p>
    ${link('colleges.html', 'school', 'Colleges')}
    ${link('scholarships.html', 'award', 'Scholarships')}
    ${link('programs.html', 'case', 'Programs')}
    <p class="side-h">Explore</p>
    ${link('discover.html', 'compass', 'Discover')}
    ${link('study.html', 'book', 'Study')}
    ${link('submit-event.html', 'plus', 'Submit an event')}
    <a href="review.html" id="nav-review" hidden>${icon(I.shield)}<span>Review events</span></a>
  </nav>
  <div class="side-foot">
    <label class="switch"><input type="checkbox" id="lily-ui" role="switch"><span class="track"></span>Lily UI</label>
    <nav>${link('settings.html', 'gear', 'Settings')}${link('login.html', 'account', 'Account')}</nav>
  </div>
</aside>
<div class="scrim" id="scrim"></div>
<header class="mbar">
  <button class="icon-btn" id="menu-btn" type="button" aria-label="Open menu" aria-controls="side" aria-expanded="false">${icon(I.menu)}</button>
  ${brand}
</header>`);

  // Reviewers (supabase-9.sql) get a Review link; checked once the page's Supabase client exists
  addEventListener('DOMContentLoaded', async () => {
    const a = document.getElementById('nav-review');
    if (here === 'review.html') a.hidden = false;
    if (typeof sb === 'undefined' || !sb) return;
    try {
      if (!(await sb.auth.getSession()).data.session) return;
      const { data } = await sb.rpc('is_reviewer');
      if (data) a.hidden = false;
    } catch {}
  });

  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

  // Installable app with offline support
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

  // Reminder banner: anything due in the next 7 days, on every page, until dismissed for the day
  const todayStr = new Date().toLocaleDateString('en-CA');
  const daysTo = d => Math.round((Date.parse(d) - Date.parse(todayStr)) / 864e5);
  async function remind() {
    if (store.get('comp-banner-dismissed', '') === todayStr || ['review.html', 'settings.html'].includes(here)) return;
    let tracked = store.get('comp-tracked', []);
    try {
      if (typeof sb !== 'undefined' && sb && (await sb.auth.getSession()).data.session) {
        const { data } = await sb.from('tracked').select('name, kind, deadline, status');
        if (data) tracked = data;
      }
    } catch {}
    const due = [
      ...tracked.filter(i => i.deadline && ['interested', 'applying'].includes(i.status)).map(i => ({ date: i.deadline, title: i.name })),
      ...store.get('comp-exams', []).map(e => ({ date: e.date, title: e.title })),
    ].filter(i => daysTo(i.date) >= 0 && daysTo(i.date) <= 7).sort((a, b) => a.date.localeCompare(b.date));
    if (!due.length || !document.querySelector('main')) return;
    const when = d => { const n = daysTo(d); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : new Date(`${d}T00:00`).toLocaleDateString(undefined, { weekday: 'short' }); };
    const bar = document.createElement('div');
    bar.className = 'remind';
    bar.setAttribute('role', 'status');
    const list = due.slice(0, 3).map(i => `<b>${i.title.replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;')}</b> ${when(i.date)}`).join(', ');
    bar.innerHTML = `<span>⏰ Due this week: ${list}${due.length > 3 ? ` and ${due.length - 3} more` : ''}</span><a href="calendar.html">Calendar</a><button type="button" class="icon-btn" aria-label="Dismiss for today">×</button>`;
    bar.querySelector('button').onclick = () => { store.set('comp-banner-dismissed', todayStr); bar.remove(); };
    document.querySelector('main').prepend(bar);
  }
  addEventListener('DOMContentLoaded', remind);

  // First visit: a short setup so Home, Discover and the hours goal fit the student
  const INTERESTS = { stem: 'STEM', cs: 'Computer science', math: 'Math', arts: 'Arts', writing: 'Writing', humanities: 'History & social studies', leadership: 'Leadership', service: 'Community service' };
  window.compSetup = (force = false) => {
    if (!force && store.get('comp-setup', null)) return;
    const cur = store.get('comp-setup', {}) || {};
    const d = document.createElement('dialog');
    d.className = 'setup';
    d.innerHTML = `<form method="dialog">
      <h2>Welcome to comp. 👋</h2>
      <p class="muted">Three quick questions so we can show what matters for you. You can change these in Settings.</p>
      <fieldset class="seg"><legend>What grade are you in?</legend>
        ${[9, 10, 11, 12].map(g => `<label><input type="radio" name="grade" value="${g}" ${String(cur.grade) === String(g) ? 'checked' : ''}><span>${g}th</span></label>`).join('')}
        <label><input type="radio" name="grade" value="" ${cur.grade === '' ? 'checked' : ''}><span>Other</span></label>
      </fieldset>
      <label>Volunteer hours goal <input name="goal" type="number" min="1" max="2000" value="${store.get('comp-goal', 100)}"></label>
      <p class="muted hint">Use your school's graduation requirement or service cord, or an award goal (e.g. 100).</p>
      <fieldset class="picks"><legend>What are you into? <span class="muted">(pick any)</span></legend>
        ${Object.entries(INTERESTS).map(([k, t]) => `<label><input type="checkbox" name="interests" value="${k}" ${(cur.interests || []).includes(k) ? 'checked' : ''}><span>${t}</span></label>`).join('')}
      </fieldset>
      <div class="row"><button value="save">Save</button><button value="skip" class="secondary" formnovalidate>Skip for now</button></div>
    </form>`;
    document.body.append(d);
    d.addEventListener('close', () => {
      const f = d.querySelector('form');
      if (d.returnValue === 'save') {
        const grade = f.grade.value;
        const interests = [...f.querySelectorAll('[name=interests]:checked')].map(x => x.value);
        store.set('comp-setup', { grade, interests, at: todayStr });
        if (Number(f.goal.value) >= 1) localStorage.setItem('comp-goal', String(Math.round(Number(f.goal.value))));
        try { grade ? localStorage.setItem('comp-grade', grade) : localStorage.removeItem('comp-grade'); } catch {}
        location.reload();
      } else if (!store.get('comp-setup', null)) store.set('comp-setup', { skipped: true, at: todayStr });
      d.remove();
    });
    d.showModal();
  };
  if (here === 'home.html') addEventListener('DOMContentLoaded', () => window.compSetup());
  document.getElementById('lily-ui').onchange = () => {
    try { localStorage.setItem('comp-lily', '1'); } catch {}
    location.href = 'lily.html';
  };

  const alias = { 'edit-profile.html': 'profile.html' };
  document.querySelectorAll('.side nav a').forEach(a => {
    if (a.getAttribute('href') === (alias[here] || here)) a.setAttribute('aria-current', 'page');
  });

  const btn = document.getElementById('menu-btn');
  const setOpen = open => { document.body.classList.toggle('menu-open', open); btn.setAttribute('aria-expanded', open); };
  btn.onclick = () => setOpen(!document.body.classList.contains('menu-open'));
  document.getElementById('scrim').onclick = () => setOpen(false);
  addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
})();
