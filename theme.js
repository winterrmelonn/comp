// Loaded in <head> on every page: apply the theme chosen in Settings before anything paints (system theme otherwise)
try { const t = localStorage.getItem('comp-theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch {}
