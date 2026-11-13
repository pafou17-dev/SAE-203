const map = document.getElementById('cycleup-map');

// Use the map component's public action event to open the site's existing 3D
// showroom. The map retains its selection when the visitor returns to it.
map?.addEventListener('cu-carte:action', event => {
  if (event.detail?.action !== 'rosalie-3d') return;
  event.preventDefault();
  window.dispatchEvent(new CustomEvent('cycleup:show-model', { detail: { index: 0 } }));
  const hero = document.getElementById('top');
  hero.tabIndex = -1;
  hero.focus({ preventScroll: true });
  history.replaceState(null, '', '#top');
  hero.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});
