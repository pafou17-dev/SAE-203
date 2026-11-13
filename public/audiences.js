const tabs = [...document.querySelectorAll('[data-persona]')];
const panels = [...document.querySelectorAll('.persona-panel')];
const narrow = matchMedia('(max-width:700px)');
const reduced = matchMedia('(prefers-reduced-motion:reduce)');
const list = document.querySelector('.persona-tabs');
function orient() { list?.setAttribute('aria-orientation', narrow.matches ? 'horizontal' : 'vertical'); }
function choose(tab, focus = false) {
  if (!tab) return;
  tabs.forEach(item => { const active = item === tab; item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1; });
  panels.forEach(panel => { panel.hidden = panel.id !== tab.getAttribute('aria-controls'); });
  if (focus) tab.focus({ preventScroll: true });
  if (narrow.matches) {
    const left = tab.offsetLeft - list.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2;
    list.scrollTo({ left, behavior: reduced.matches ? 'instant' : 'smooth' });
  }
  const panel = document.getElementById(tab.getAttribute('aria-controls'));
  if (panel && !reduced.matches) panel.animate([{ opacity: .4, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 260, easing: 'ease-out' });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => choose(tab));
  tab.addEventListener('keydown', event => {
    const forward = event.key === (narrow.matches ? 'ArrowRight' : 'ArrowDown');
    const backward = event.key === (narrow.matches ? 'ArrowLeft' : 'ArrowUp');
    let next = index;
    if (forward) next = (index + 1) % tabs.length;
    else if (backward) next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault(); choose(tabs[next], true);
  });
});
narrow.addEventListener('change', orient); orient();

document.querySelectorAll('[data-profile-gallery]').forEach(button => {
  button.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('cycleup:gallery-open', {
      detail: { index: Number(button.dataset.profileGallery), trigger: button },
    }));
  });
});
