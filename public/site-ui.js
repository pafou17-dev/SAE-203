const menu = document.getElementById('site-menu');
const menuButtons = [...document.querySelectorAll('[data-open-menu]')];
menuButtons.forEach(button => button.addEventListener('click', () => {
  menu?.showModal();
  menuButtons.forEach(item => item.setAttribute('aria-expanded', 'true'));
}));
menu?.addEventListener('close', () => menuButtons.forEach(button => button.setAttribute('aria-expanded', 'false')));
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog')?.close()));
menu?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => menu.close()));
menu?.addEventListener('click', event => {
  const bounds = menu.getBoundingClientRect();
  if (event.target === menu && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) menu.close();
});

// The anchor stays fixed. Only the decorative mark rotates with the scroll.
const cubes = [...document.querySelectorAll('[data-scroll-idea]')];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let boxFrame = 0, boxAngle = 20, lastBoxTime = 0;
function drawBox(time) {
  boxFrame = 0;
  const target = motion.matches ? 0 : scrollY * .075;
  const delta = lastBoxTime ? Math.min(60, time - lastBoxTime) : 16;
  lastBoxTime = time;
  boxAngle += (target - boxAngle) * (1 - Math.exp(-delta / 100));
  cubes.forEach(cube => cube.style.setProperty('--idea-turn', boxAngle.toFixed(2) + 'deg'));
  if (Math.abs(target - boxAngle) > .03 && !document.hidden) boxFrame = requestAnimationFrame(drawBox);
}
function requestBoxFrame() { if (!boxFrame && !document.hidden) boxFrame = requestAnimationFrame(drawBox); }
addEventListener('scroll', requestBoxFrame, { passive: true });
motion.addEventListener('change', requestBoxFrame);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(boxFrame); boxFrame = 0; }
  else { lastBoxTime = 0; requestBoxFrame(); }
});
requestBoxFrame();

function followLegacyIdeasLink() {
  if (document.body.classList.contains('home-page') && location.hash === '#les-idees') location.replace(new URL('boite-a-idees/',document.baseURI));
}
addEventListener('hashchange', followLegacyIdeasLink);
followLegacyIdeasLink();
