// study.html: free study resources per AP course and standardized test (data/study.json)
(async () => {
  const $ = id => document.getElementById(id);
  const el = (tag, props) => Object.assign(document.createElement(tag), props);
  let data;
  try { data = await (await fetch('data/study.json')).json(); }
  catch { $('msg').textContent = "Couldn't load study resources. Check your connection."; return; }
  let group = new URLSearchParams(location.search).get('group') || 'all';

  const card = i => {
    const c = el('article', { className: 'post study' });
    c.append(
      el('p', { className: 'label', textContent: data.groups[i.group] }),
      el('h2', { textContent: i.name }),
      el('p', { className: 'tip', textContent: i.tip }),
    );
    const ul = el('ul', { className: 'resources' });
    for (const r of i.resources) {
      const li = el('li');
      li.append(el('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', textContent: `${r.name} ↗` }), el('span', { className: 'muted', textContent: r.note }));
      ul.append(li);
    }
    c.append(ul);
    return c;
  };

  const render = () => {
    $('s-groups').replaceChildren(...['all', ...Object.keys(data.groups)].map(g => {
      const b = el('button', { className: 'chip', type: 'button', textContent: g === 'all' ? 'All' : data.groups[g] });
      b.setAttribute('aria-pressed', g === group);
      b.onclick = () => { group = g; render(); };
      return b;
    }));
    const q = $('s-q').value.trim().toLowerCase();
    const list = data.items.filter(i => (group === 'all' || i.group === group)
      && (!q || [i.name, i.tip, data.groups[i.group], ...i.resources.map(r => r.name)].join(' ').toLowerCase().includes(q)));
    $('study').replaceChildren(...list.map(card));
    $('s-count').textContent = `${list.length} ${list.length === 1 ? 'subject' : 'subjects'}`;
    $('s-empty').hidden = list.length > 0;
  };
  $('s-q').oninput = render;
  render();
})();
