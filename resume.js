// resume.html: a resume and Common App-style activities list built from logged hours, profile clubs and won awards.
// The draft is saved in this browser (comp-resume); hours, clubs and awards are read from the account when logged in.
(async () => {
  const $ = id => document.getElementById(id);
  const el = (tag, props) => Object.assign(document.createElement(tag), props);
  const say = t => { $('msg').textContent = t; };
  const KEY = 'comp-resume';
  const LIMITS = { position: 50, org: 100, description: 150 };
  const GRADES = [9, 10, 11, 12];
  const LEVELS = ['School', 'State/Regional', 'National', 'International'];
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

  let r = get(KEY, null) || { header: {}, acts: [], awards: [] };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch {} };

  const user = typeof sb !== 'undefined' && sb ? (await sb.auth.getSession()).data.session?.user : null;
  const check = ({ data, error }) => { if (error) throw error; return data; };

  // Prefill the header once from the account or setup
  if (!r.header.name && user) {
    const p = await sb.from('profiles').select().eq('id', user.id).maybeSingle().then(x => x.data, () => null);
    Object.assign(r.header, { name: p?.name || '', school: p?.school || '', email: user.email || '' });
  }
  const setup = get('comp-setup', {}) || {};
  if (!r.header.gradYear && setup.grade) {
    const y = new Date().getFullYear() + (new Date().getMonth() >= 7 ? 1 : 0);
    r.header.gradYear = String(y + (12 - Number(setup.grade)));
  }

  // Header fields
  for (const i of document.querySelectorAll('[data-h]')) {
    i.value = r.header[i.dataset.h] || '';
    i.oninput = () => { r.header[i.dataset.h] = i.value; save(); };
  }

  const counted = (label, key, obj, max, props = {}) => {
    const l = el('label', { className: props.wide ? 'wide' : '' });
    const head = el('span', { className: 'lbl' });
    const n = el('span', { className: 'count' });
    head.append(label, n);
    const input = el(props.area ? 'textarea' : 'input', { value: obj[key] || '', maxLength: max, rows: 2 });
    const sync = () => { n.textContent = `${input.value.length}/${max}`; n.classList.toggle('full', input.value.length >= max); };
    input.oninput = () => { obj[key] = input.value; save(); sync(); };
    sync();
    l.append(head, input);
    return l;
  };
  const gradeBoxes = obj => {
    const f = el('fieldset', { className: 'grades' });
    f.append(el('legend', { textContent: 'Grades' }));
    for (const g of GRADES) {
      const cb = el('input', { type: 'checkbox', checked: (obj.grades || []).includes(g) });
      cb.onchange = () => { obj.grades = GRADES.filter(x => x === g ? cb.checked : (obj.grades || []).includes(x)); save(); };
      const l = el('label', { className: 'check' });
      l.append(cb, document.createTextNode(`${g}`));
      f.append(l);
    }
    return f;
  };
  const move = (list, n, d) => { const [x] = list.splice(n, 1); list.splice(Math.max(0, Math.min(list.length, n + d)), 0, x); save(); renderEdit(); };

  const renderEdit = () => {
    $('act-count').textContent = `(${r.acts.length}/10)`;
    $('acts').replaceChildren(...r.acts.map((a, n) => {
      const c = el('div', { className: 'act' });
      const top = el('div', { className: 'act-top' });
      top.append(el('b', { textContent: `${n + 1}.` }),
        Object.assign(el('button', { type: 'button', className: 'chip', textContent: '↑', ariaLabel: 'Move up' }), { onclick: () => move(r.acts, n, -1) }),
        Object.assign(el('button', { type: 'button', className: 'chip', textContent: '↓', ariaLabel: 'Move down' }), { onclick: () => move(r.acts, n, 1) }),
        Object.assign(el('button', { type: 'button', className: 'chip', textContent: 'Remove' }), { onclick: () => { r.acts.splice(n, 1); save(); renderEdit(); } }));
      const g = el('div', { className: 'grid' });
      const type = el('select');
      type.append(...['Community service (volunteer)', 'Club / organization', 'Athletics', 'Arts', 'Work (paid)', 'Research', 'Academic', 'Family responsibilities', 'Other'].map(t => new Option(t)));
      type.value = a.type || 'Other';
      type.onchange = () => { a.type = type.value; save(); };
      const tl = el('label', { textContent: 'Type' });
      tl.append(type);
      const num = (label, key) => { const l = el('label', { textContent: label }); const i = el('input', { type: 'number', min: 0, max: key === 'hpw' ? 40 : 52, value: a[key] ?? '' }); i.oninput = () => { a[key] = i.value; save(); }; l.append(i); return l; };
      g.append(tl, counted('Position / role', 'position', a, LIMITS.position), counted('Organization', 'org', a, LIMITS.org),
        counted('Description', 'description', a, LIMITS.description, { wide: true, area: true }), gradeBoxes(a), num('Hours per week', 'hpw'), num('Weeks per year', 'wpy'));
      c.append(top, g);
      return c;
    }));
    $('add-act').disabled = r.acts.length >= 10;
    $('awards').replaceChildren(...r.awards.map((a, n) => {
      const c = el('div', { className: 'act' });
      const g = el('div', { className: 'grid' });
      const lv = el('select');
      lv.append(...LEVELS.map(t => new Option(t)));
      lv.value = a.level || 'School';
      lv.onchange = () => { a.level = lv.value; save(); };
      const ll = el('label', { textContent: 'Level' });
      ll.append(lv);
      g.append(counted('Award', 'title', a, 100, { wide: true }), ll, gradeBoxes(a));
      c.append(g, Object.assign(el('button', { type: 'button', className: 'chip', textContent: 'Remove' }), { onclick: () => { r.awards.splice(n, 1); save(); renderEdit(); } }));
      return c;
    }));
  };

  $('add-act').onclick = () => { if (r.acts.length < 10) { r.acts.push({ type: 'Other', grades: [] }); save(); renderEdit(); } };
  $('add-award').onclick = () => { r.awards.push({ level: 'School', grades: [] }); save(); renderEdit(); };

  // Fill in from logged hours (one activity per organization), profile clubs, and won scholarships/accepted programs
  $('import').onclick = async () => {
    let hours = get('comp', { entries: [] }).entries || [];
    let clubs = [];
    let tracked = get('comp-tracked', []);
    if (user) {
      hours = await sb.from('hours').select('date, org, activity, hours').then(x => x.data || [], () => hours);
      clubs = await sb.from('profiles').select('memberships').eq('id', user.id).maybeSingle().then(x => x.data?.memberships || [], () => []);
      tracked = await sb.from('tracked').select('name, kind, status').then(x => x.data || [], () => tracked);
    }
    const byOrg = {};
    for (const h of hours) (byOrg[h.org] ||= []).push(h);
    const have = new Set(r.acts.map(a => (a.org || '').toLowerCase()));
    let added = 0;
    for (const [org, list] of Object.entries(byOrg).sort((a, b) => b[1].reduce((s, h) => s + Number(h.hours), 0) - a[1].reduce((s, h) => s + Number(h.hours), 0))) {
      if (have.has(org.toLowerCase()) || r.acts.length >= 10) continue;
      const total = Math.round(list.reduce((s, h) => s + Number(h.hours), 0) * 10) / 10;
      const what = [...new Set(list.map(h => h.activity).filter(Boolean))].slice(0, 3).join(', ');
      r.acts.push({ type: 'Community service (volunteer)', position: 'Volunteer', org: org.slice(0, 100), description: `${what ? `${what}. ` : ''}${total} hours logged`.slice(0, 150), grades: [], hpw: '', wpy: '' });
      added++;
    }
    for (const m of clubs) {
      if (have.has((m.club || '').toLowerCase()) || r.acts.length >= 10) continue;
      r.acts.push({ type: 'Club / organization', position: (m.role || 'Member').slice(0, 50), org: m.club.slice(0, 100), description: '', grades: [], hpw: '', wpy: '' });
      added++;
    }
    const awards = new Set(r.awards.map(a => (a.title || '').toLowerCase()));
    for (const t of tracked.filter(t => t.status === 'accepted' && t.kind !== 'college')) {
      if (awards.has(t.name.toLowerCase())) continue;
      r.awards.push({ title: t.kind === 'scholarship' ? `${t.name} recipient` : `Selected for ${t.name}`, level: 'National', grades: [] });
      added++;
    }
    save(); renderEdit();
    say(added ? `Added ${added} item${added === 1 ? '' : 's'}. Add descriptions, grades and hours per week.` : 'Nothing new to add. Log hours or add clubs to your profile first.');
  };

  const gradesText = g => !g?.length ? '' : g.length === 1 ? `Grade ${g[0]}` : `Grades ${g[0]}–${g.at(-1)}`;
  const renderResume = () => {
    const h = r.header;
    const p = $('resume');
    p.replaceChildren(el('h1', { textContent: h.name || 'Your Name' }),
      el('p', { className: 'contact', textContent: [h.school, h.gradYear && `Class of ${h.gradYear}`, h.email].filter(Boolean).join(' · ') }));
    const section = (title, rows) => { if (!rows.length) return; p.append(el('h2', { textContent: title })); p.append(...rows); };
    const groups = {};
    for (const a of r.acts.filter(a => a.org || a.position)) (groups[a.type?.startsWith('Community') ? 'Community Service' : a.type?.startsWith('Work') ? 'Work Experience' : 'Activities & Leadership'] ||= []).push(a);
    for (const title of ['Activities & Leadership', 'Community Service', 'Work Experience']) {
      section(title, (groups[title] || []).map(a => {
        const d = el('div', { className: 'entry' });
        const top = el('div', { className: 'entry-top' });
        top.append(el('b', { textContent: [a.position, a.org].filter(Boolean).join(', ') }), el('span', { textContent: [gradesText(a.grades), a.hpw && `${a.hpw} hrs/wk`].filter(Boolean).join(' · ') }));
        d.append(top);
        if (a.description) d.append(el('p', { textContent: a.description }));
        return d;
      }));
    }
    section('Honors & Awards', r.awards.filter(a => a.title).map(a => {
      const d = el('div', { className: 'entry-top' });
      d.append(el('b', { textContent: a.title }), el('span', { textContent: [a.level, gradesText(a.grades)].filter(Boolean).join(' · ') }));
      return d;
    }));
    if (h.skills) section('Skills & Languages', [el('p', { textContent: h.skills })]);
  };
  const commonAppText = () => r.acts.map((a, n) => [`${n + 1}. ${a.type || 'Other'}`, `Position: ${a.position || ''}`, `Organization: ${a.org || ''}`, `Description: ${a.description || ''}`,
    `Grades: ${(a.grades || []).join(', ')} · ${a.hpw || 0} hrs/week · ${a.wpy || 0} weeks/year`].join('\n')).join('\n\n');
  const renderCommonApp = () => {
    $('commonapp').replaceChildren(...(r.acts.length ? r.acts.map((a, n) => {
      const c = el('div', { className: 'post' });
      c.append(el('p', { className: 'label', textContent: `${n + 1} · ${a.type || 'Other'} · ${gradesText(a.grades) || 'grades not set'} · ${a.hpw || 0} hrs/wk, ${a.wpy || 0} wks/yr` }),
        el('h2', { textContent: a.position || '(position)' }), el('p', { className: 'muted', textContent: a.org || '(organization)' }), el('p', { textContent: a.description || '(description)' }));
      return c;
    }) : [el('p', { className: 'muted', textContent: 'No activities yet. Add some in Edit.' })]));
  };

  // Views
  let view = 'edit';
  const show = v => {
    view = v;
    for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', b.dataset.view === v);
    $('edit').hidden = v !== 'edit';
    $('resume').hidden = v !== 'resume';
    $('commonapp').hidden = v !== 'commonapp';
    if (v === 'resume') renderResume();
    if (v === 'commonapp') renderCommonApp();
  };
  for (const b of document.querySelectorAll('[data-view]')) b.onclick = () => show(b.dataset.view);
  $('print').onclick = () => { if (view !== 'resume') show('resume'); setTimeout(() => print(), 50); };
  $('copy').onclick = async () => {
    try { await navigator.clipboard.writeText(commonAppText()); say('Copied. Paste it into a doc to work on, then into the Common App.'); }
    catch { prompt('Copy your activities:', commonAppText()); }
  };

  renderEdit();
})();
