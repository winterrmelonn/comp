// study.html: how to study and free resources per AP course and standardized test (data/study.json),
// with official exam/test dates students can add to their comp. calendar (calendar.html reads comp-exams)
(async () => {
  const $ = id => document.getElementById(id);
  const el = (tag, props) => Object.assign(document.createElement(tag), props);
  const KEY = 'comp-exams';
  let data;
  try { data = await (await fetch('data/study.json')).json(); }
  catch { $('msg').textContent = "Couldn't load study resources. Check your connection."; return; }

  let mine = [];
  try { mine = JSON.parse(localStorage.getItem(KEY)) || []; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mine)); } catch {} };
  const keyOf = (i, d) => `${i.id}:${d.date}:${d.label}`;
  const onCal = (i, d) => mine.some(m => m.key === keyOf(i, d));
  const today = new Date().toLocaleDateString('en-CA');
  const nice = d => new Date(`${d}T00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const gcal = (title, date) => {
    const next = new Date(Date.parse(date) + 864e5).toISOString().slice(0, 10).replace(/-/g, '');
    return `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${date.replace(/-/g, '')}/${next}` })}`;
  };

  const params = new URLSearchParams(location.search);
  let group = params.get('group') || 'all';
  let onlyMine = params.get('mine') === '1';

  const card = i => {
    const c = el('article', { className: 'post study' });
    c.append(
      el('p', { className: 'label', textContent: data.groups[i.group] }),
      el('h2', { textContent: i.name }),
      el('p', { className: 'tip', textContent: i.tip }),
    );

    // Upcoming official dates, each one tap away from the student's calendar
    const upcoming = (i.dates || []).filter(d => d.date >= today);
    if (upcoming.length) {
      const box = el('div', { className: 'exam-dates' });
      for (const d of upcoming.slice(0, 5)) {
        const row = el('div', { className: 'exam-row' });
        const label = d.label === i.name || d.label.endsWith('exam') ? d.label : `${d.label}`;
        const text = el('div');
        text.append(el('b', { textContent: nice(d.date) }), el('span', { className: 'muted', textContent: ` · ${label}${d.time ? ` · ${d.time}` : ''}` }));
        const add = el('button', { type: 'button', className: 'chip' });
        const sync = () => { const on = onCal(i, d); add.textContent = on ? '✓ On calendar' : '+ Calendar'; add.setAttribute('aria-pressed', on); };
        add.onclick = () => {
          const k = keyOf(i, d);
          if (onCal(i, d)) mine = mine.filter(m => m.key !== k);
          else mine.push({ key: k, subject: i.id, date: d.date, title: label.includes(i.name) || i.group === 'tests' ? label : `${i.name}: ${label}` });
          save(); sync();
          $('msg').textContent = onCal(i, d) ? `Added to your calendar. ` : 'Removed from your calendar.';
          if (onCal(i, d)) $('msg').append(el('a', { href: 'calendar.html', textContent: 'Open calendar' }));
          if (onlyMine) render();
        };
        sync();
        const g = el('a', { href: gcal(label.includes(i.name) || i.group === 'tests' ? label : `${i.name}: ${label}`, d.date), target: '_blank', rel: 'noopener noreferrer', className: 'gcal', textContent: 'Google ↗', title: 'Add to Google Calendar' });
        row.append(text, add, g);
        box.append(row);
      }
      c.append(box);
    }

    const how = el('details', { className: 'how' });
    how.append(el('summary', { textContent: 'How to study it' }));
    const ol = el('ol');
    ol.append(...i.steps.map(s => el('li', { textContent: s })));
    how.append(ol);
    c.append(how);

    if (i.resources.length) {
      const ul = el('ul', { className: 'resources' });
      for (const r of i.resources) {
        const li = el('li');
        li.append(el('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', textContent: `${r.name} ↗` }), el('span', { className: 'muted', textContent: r.note }));
        ul.append(li);
      }
      c.append(ul);
    }
    return c;
  };

  const render = () => {
    const counts = { all: data.items.length };
    for (const i of data.items) counts[i.group] = (counts[i.group] || 0) + 1;
    $('s-groups').replaceChildren(...['all', ...Object.keys(data.groups)].map(g => {
      const b = el('button', { className: 'tab', type: 'button' });
      b.append(g === 'all' ? 'All' : data.groups[g], el('span', { className: 'n', textContent: counts[g] || 0 }));
      b.setAttribute('aria-pressed', g === group);
      b.onclick = () => { group = g; render(); };
      return b;
    }));
    $('s-mine').setAttribute('aria-pressed', onlyMine);
    $('s-mine').textContent = onlyMine ? '✓ My exams only' : 'My exams only';
    const q = $('s-q').value.trim().toLowerCase();
    const subjects = new Set(mine.map(m => m.subject));
    const list = data.items.filter(i => (group === 'all' || i.group === group) && (!onlyMine || subjects.has(i.id))
      && (!q || [i.name, i.tip, data.groups[i.group], ...i.resources.map(r => r.name)].join(' ').toLowerCase().includes(q)));
    $('study').replaceChildren(...list.map(card));
    $('s-count').textContent = `${list.length} ${list.length === 1 ? 'subject' : 'subjects'}`;
    $('s-empty').hidden = list.length > 0;
    $('s-empty').textContent = onlyMine && !mine.length ? 'Tap "+ Calendar" next to an exam date to add your exams.' : 'Nothing matches that search.';
    const qs = new URLSearchParams(Object.entries({ group: group === 'all' ? '' : group, mine: onlyMine ? '1' : '' }).filter(([, v]) => v));
    history.replaceState(null, '', qs.size ? `?${qs}` : location.pathname);
  };
  $('s-q').oninput = render;
  $('s-mine').onclick = () => { onlyMine = !onlyMine; render(); };
  render();
})();
