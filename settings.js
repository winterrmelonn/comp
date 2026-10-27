// settings.html: setup answers, theme, install, and backup/restore of everything comp. keeps in this browser
(async () => {
  const $ = id => document.getElementById(id);
  const say = t => { $('msg').textContent = t; };
  const keys = () => Object.keys(localStorage).filter(k => k === 'comp' || k.startsWith('comp-'));
  const INTERESTS = { stem: 'STEM', cs: 'Computer science', math: 'Math', arts: 'Arts', writing: 'Writing', humanities: 'History & social studies', leadership: 'Leadership', service: 'Community service' };

  // About you
  let setup = {};
  try { setup = JSON.parse(localStorage.getItem('comp-setup')) || {}; } catch {}
  const goal = window.compGoal ? compGoal() : 100;
  $('setup-summary').textContent = setup.grade || setup.interests?.length
    ? [setup.grade ? `${setup.grade}th grade` : null, `${goal}-hour goal`, setup.interests?.length ? `into ${setup.interests.map(k => INTERESTS[k]).join(', ')}` : null].filter(Boolean).join(' · ')
    : `Not set up yet · ${goal}-hour goal`;
  $('edit-setup').onclick = () => window.compSetup(true);

  // Theme
  const theme = (() => { try { return localStorage.getItem('comp-theme') || ''; } catch { return ''; } })();
  for (const r of document.querySelectorAll('[name=theme]')) {
    r.checked = r.value === theme;
    r.onchange = () => {
      try { r.value ? localStorage.setItem('comp-theme', r.value) : localStorage.removeItem('comp-theme'); } catch {}
      r.value ? (document.documentElement.dataset.theme = r.value) : delete document.documentElement.dataset.theme;
    };
  }

  // Lily UI: Home becomes lily.html (shell.js sends it there)
  try { $('lily-ui').checked = localStorage.getItem('comp-lily') === '1'; } catch {}
  $('lily-ui').onchange = ev => {
    try { localStorage.setItem('comp-lily', ev.target.checked ? '1' : '0'); } catch {}
    say(ev.target.checked ? 'Lily UI is on: Home shows the lily menu.' : 'Lily UI is off.');
  };

  // Install
  let prompt;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e; $('install').hidden = false; });
  $('install').onclick = async () => { if (!prompt) return; prompt.prompt(); await prompt.userChoice; prompt = null; $('install').hidden = true; };
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) $('install-ios').hidden = false;
  if (matchMedia('(display-mode: standalone)').matches) $('install-text').textContent = "You're using the installed app. 🎉";

  // Logged in: account data is already saved; the backup still covers this device's calendars, exams and settings
  const user = typeof sb !== 'undefined' && sb ? (await sb.auth.getSession()).data.session?.user : null;
  if (user) $('data-text').textContent = 'Your hours and lists are saved in your account. A backup also covers what lives only on this device: imported calendars, exam dates, your resume draft, checklist and settings.';

  // Backup / restore
  $('backup').onclick = () => {
    const data = Object.fromEntries(keys().map(k => [k, localStorage.getItem(k)]));
    const blob = new Blob([JSON.stringify({ app: 'comp.', version: 1, saved: new Date().toISOString(), data }, null, 1)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `comp-backup-${new Date().toLocaleDateString('en-CA')}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
    say(`Backup downloaded (${keys().length} items). Keep it somewhere safe, like Google Drive.`);
  };
  $('restore').onchange = async ev => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const b = JSON.parse(await file.text());
      if (b.app !== 'comp.' || typeof b.data !== 'object') throw new Error("That file isn't a comp. backup.");
      const entries = Object.entries(b.data).filter(([k, v]) => (k === 'comp' || k.startsWith('comp-')) && typeof v === 'string');
      if (!confirm(`Replace this device's comp. data with the backup from ${new Date(b.saved).toLocaleString()}?`)) return;
      for (const k of keys()) localStorage.removeItem(k);
      for (const [k, v] of entries) localStorage.setItem(k, v);
      say(`Restored ${entries.length} items. Reloading…`);
      setTimeout(() => location.reload(), 800);
    } catch (err) { say(`Couldn't restore: ${err.message}`); }
  };

  // Erase (two clicks)
  const wipe = $('wipe');
  wipe.onclick = () => {
    if (wipe.textContent !== 'Sure? This can’t be undone') { wipe.textContent = 'Sure? This can’t be undone'; setTimeout(() => { wipe.textContent = 'Erase data on this device'; }, 4000); return; }
    for (const k of keys()) localStorage.removeItem(k);
    say('Erased. Reloading…');
    setTimeout(() => location.reload(), 600);
  };
})();
