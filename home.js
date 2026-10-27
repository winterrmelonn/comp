// home.html: this month's checklist for the student's grade (data/roadmap.json) and Discover picks for their interests
(async () => {
  const $ = id => document.getElementById(id);
  const el = (tag, props) => Object.assign(document.createElement(tag), props);
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const setup = get('comp-setup', {}) || {};
  const grade = String(setup.grade || '');
  const today = new Date().toLocaleDateString('en-CA');
  const month = Number(today.slice(5, 7));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const schoolOrder = m => (m - 8 + 12) % 12; // the school year starts in August

  // Checklist
  const card = $('roadmap-card');
  card.hidden = false;
  const road = await fetch('data/roadmap.json').then(r => r.json()).catch(() => null);
  const items = road?.grades[grade];
  if (!items) {
    $('roadmap-title').textContent = 'Your checklist';
    const b = el('button', { type: 'button', className: 'secondary', textContent: 'Set your grade' });
    b.onclick = () => window.compSetup?.(true);
    $('roadmap').replaceChildren(el('li', { textContent: 'Tell us your grade to get a month-by-month checklist.' }), b);
    $('roadmap-more').parentElement.hidden = true;
  } else {
    let done = new Set(get('comp-roadmap', []));
    let all = false;
    const now = schoolOrder(month);
    const render = () => {
      // This month and the next two first; everything else with "Show the whole year"
      const sorted = [...items].sort((a, b) => schoolOrder(a.month) - schoolOrder(b.month));
      const shown = all ? sorted : sorted.filter(i => !done.has(i.id) && ((schoolOrder(i.month) - now + 12) % 12 <= 2 || schoolOrder(i.month) < now)).slice(0, 5);
      $('roadmap-title').textContent = `${grade}th grade checklist`;
      $('roadmap-count').textContent = `${items.filter(i => done.has(i.id)).length} of ${items.length} done`;
      $('roadmap').replaceChildren(...(shown.length ? shown : sorted.filter(i => !done.has(i.id)).slice(0, 3)).map(i => {
        const li = el('li', { className: done.has(i.id) ? 'done' : '' });
        const cb = el('input', { type: 'checkbox', checked: done.has(i.id), ariaLabel: i.text });
        cb.onchange = () => {
          cb.checked ? done.add(i.id) : done.delete(i.id);
          try { localStorage.setItem('comp-roadmap', JSON.stringify([...done])); } catch {}
          render();
        };
        const text = el('span');
        text.append(i.link ? el('a', { href: i.link, textContent: i.text, ...(i.link.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }) : document.createTextNode(i.text));
        const late = schoolOrder(i.month) < now && !done.has(i.id);
        li.append(cb, text, el('span', { className: 'tag', textContent: i.month === month ? 'Now' : late ? 'Catch up' : MON[i.month - 1] }));
        return li;
      }));
      if (!items.some(i => !done.has(i.id))) $('roadmap').append(el('li', { textContent: 'All done for this year. 🎉' }));
      $('roadmap-more').textContent = all ? 'Show what’s next' : 'Show the whole year';
    };
    $('roadmap-more').onclick = ev => { ev.preventDefault(); all = !all; render(); };
    render();
  }

  // Picks: open opportunities that fit the grade and interests, soonest first
  const cat = await fetch('data/catalog.json').then(r => r.json()).catch(() => null);
  if (cat && typeof filterCatalog === 'function') {
    const interests = setup.interests || [];
    let tracked = get('comp-tracked', []);
    const fits = filterCatalog(cat.items, { grade }, today)
      .filter(i => !tracked.some(t => t.name === i.name))
      .filter(i => !interests.length || i.fields.some(f => interests.includes(f)));
    const picks = sortCatalog(fits, 'deadline', today).filter(i => dueText(i, today) && !/closed/i.test(dueText(i, today))).slice(0, 4);
    if (picks.length) {
      $('picks-card').hidden = false;
      $('picks-more').href = `discover.html${grade ? `?grade=${grade}` : ''}`;
      $('picks').replaceChildren(...picks.map(i => {
        const li = el('li');
        li.append(el('a', { href: `discover.html?q=${encodeURIComponent(i.name)}`, textContent: i.name }),
          el('span', { className: 'muted', textContent: [i.kind === 'scholarship' ? i.amountText : i.category, dueText(i, today)].filter(Boolean).join(' · ') }));
        return li;
      }));
    }
  }
})();
