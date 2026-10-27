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
    plus: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    account: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
  };
  window.compIcon = name => icon(I[name]);
  // Each student sets their own hours goal (school requirement, cord, award); 100 until they do
  window.compGoal = () => { try { return Number(localStorage.getItem('comp-goal')) || 100; } catch { return 100; } };
  const link = (href, ic, text) => `<a href="${href}">${icon(I[ic])}<span>${text}</span></a>`;
  const brand = '<a class="brand" href="home.html"><span class="logo">c.</span>comp.</a>';

  document.body.classList.add('shell');
  document.body.insertAdjacentHTML('afterbegin', `
<aside class="side" id="side" aria-label="Main">
  ${brand}
  <nav>
    ${link('home.html', 'home', 'Home')}
    ${link('calendar.html', 'cal', 'Calendar')}
    ${link('log.html', 'clock', 'Log hours')}
    ${link('profile.html', 'user', 'My hours &amp; profile')}
    <p class="side-h">Applications</p>
    ${link('scholarships.html', 'award', 'Scholarships')}
    ${link('programs.html', 'case', 'Programs')}
    <p class="side-h">Explore</p>
    ${link('discover.html', 'compass', 'Discover')}
    ${link('study.html', 'book', 'Study')}
    ${link('submit-event.html', 'plus', 'Submit an event')}
    <a href="review.html" id="nav-review" hidden>${icon(I.shield)}<span>Review events</span></a>
  </nav>
  <div class="side-foot">
    <nav>${link('login.html', 'account', 'Account')}</nav>
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

  const here = location.pathname.split('/').pop() || 'home.html';
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
