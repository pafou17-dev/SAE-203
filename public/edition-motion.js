import { buildRoute, routeCollisions } from './route-geometry.mjs?v=20261112-map-1';

const wrapper = document.getElementById('journey');
if (wrapper) initializeStory();

function initializeStory() {
  const svg = wrapper.querySelector('.journey-thread');
  const route = document.getElementById('journey-route');
  const accent = document.getElementById('journey-route-dark');
  const band = document.getElementById('mobility-band');
  const bandSvg = document.getElementById('mobility-backdrop');
  const bandShape = document.getElementById('mobility-surface');
  const bandClip = document.getElementById('route-band-clip-shape');
  const yellowBand = document.getElementById('versions-band');
  const yellowSurface = document.getElementById('versions-band-surface');
  const hero = document.getElementById('top');
  const nav = document.getElementById('journey-nav');
  const links = [...nav.querySelectorAll('[data-section-link]')];
  const sections = [...wrapper.querySelectorAll('[data-journey-section]')];
  const progress = document.getElementById('reading-progress');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = preference.matches;
  let geometryPending = true, frame = 0, previousTime = 0, guideProgress = null;
  let wrapperTop = 0, width = 0, height = 0, heroBottom = 0, totalLength = 0, sectionBounds = [];
  let bandTop = 0, bandBottom = 0, bandHeight = 0, extent = 210;
  let yellowTop = 0, yellowBottom = 0, yellowInset = 0, yellowRadius = 0;
  let revealObserver;
  const schedule = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(update); };
  const rebuild = () => { geometryPending = true; schedule(); };

  function measure() {
    geometryPending = false;
    const bounds = wrapper.getBoundingClientRect();
    wrapperTop = bounds.top + scrollY; width = bounds.width; height = bounds.height;
    heroBottom = hero.getBoundingClientRect().bottom + scrollY;
    sectionBounds = sections.map(section => ({ id: section.id, top: section.getBoundingClientRect().top + scrollY }));
    const blocks = [...wrapper.querySelectorAll('[data-route-block]')].map(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left - bounds.left, right: rect.right - bounds.left, top: rect.top - bounds.top, bottom: rect.bottom - bounds.top };
    });
    const geometry = buildRoute(blocks, width, height);
    const collisions = routeCollisions(geometry.segments, blocks);
    wrapper.dataset.routeClear = String(collisions === 0);
    wrapper.dataset.routeCollisions = String(collisions);
    wrapper.dataset.routeCrossings = String(geometry.crossings);
    wrapper.dataset.routeSegments = String(geometry.segments.length);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    route.setAttribute('d', geometry.d); accent.setAttribute('d', geometry.d);
    totalLength = route.getTotalLength();
    route.style.strokeDasharray = `${totalLength} ${totalLength}`;
    accent.style.strokeDasharray = `${totalLength} ${totalLength}`;
    const bandBounds = band.getBoundingClientRect();
    bandTop = bandBounds.top + scrollY; bandBottom = bandBounds.bottom + scrollY; bandHeight = bandBounds.height;
    extent = width < 701 ? Math.max(64, Math.min(86, width * .2)) : Math.min(210, width * .15);
    band.style.setProperty('--band-extent', `${extent}px`);
    bandSvg.setAttribute('viewBox', `0 0 ${width} ${bandHeight + extent * 2}`);
    const yellowBounds = yellowBand.getBoundingClientRect();
    yellowTop = yellowBounds.top + scrollY; yellowBottom = yellowBounds.bottom + scrollY;
    yellowInset = Math.min(64, width * .045); yellowRadius = width < 701 ? 28 : 96;
    wrapper.dataset.routeLength = totalLength.toFixed(1);
  }

  function update(time) {
    frame = 0;
    if (geometryPending) measure();
    const delta = previousTime ? Math.min(60, time - previousTime) : 16; previousTime = time;
    // Distance along the stroke controls the reveal, rather than a forced
    // viewport Y. Near-horizontal curves take time instead of racing across.
    const desired = Math.max(0, Math.min(1, (scrollY + innerHeight * .72 - wrapperTop) / height));
    if (guideProgress === null || reduced) guideProgress = desired;
    else guideProgress += (desired - guideProgress) * (1 - Math.exp(-delta / 145));
    const drawn = reduced ? totalLength : totalLength * guideProgress;
    route.style.strokeDashoffset = String(totalLength - drawn); accent.style.strokeDashoffset = String(totalLength - drawn);
    svg.style.visibility = desired > 0 || reduced ? 'visible' : 'hidden';
    wrapper.dataset.routeProgress = guideProgress.toFixed(5);

    const curveAt = edge => {
      if (reduced) return Math.min(52, extent);
      const progress = Math.max(0, Math.min(1, (scrollY + innerHeight - edge) / (innerHeight * 1.15)));
      return 2 + (extent - 2) * (1 - progress * progress * (3 - 2 * progress));
    };
    const upper = curveAt(bandTop), lower = curveAt(bandBottom);
    band.dataset.topCurve = upper.toFixed(2); band.dataset.bottomCurve = lower.toFixed(2);
    bandShape.setAttribute('d', `M 0 ${extent} Q ${width / 2} ${extent - upper * 2} ${width} ${extent} L ${width} ${extent + bandHeight} Q ${width / 2} ${extent + bandHeight + lower * 2} 0 ${extent + bandHeight} Z`);
    const localTop = bandTop - wrapperTop, localBottom = bandBottom - wrapperTop;
    bandClip.setAttribute('d', `M 0 ${localTop} Q ${width / 2} ${localTop - upper * 2} ${width} ${localTop} L ${width} ${localBottom} Q ${width / 2} ${localBottom + lower * 2} 0 ${localBottom} Z`);

    // A second motion vocabulary: the warm panel opens sideways and its corners
    // relax, while its text and product retain their position and scale.
    const entry = Math.max(0, Math.min(1, (scrollY + innerHeight - yellowTop) / (innerHeight * .9)));
    const opening = reduced ? 1 : entry * entry * (3 - 2 * entry);
    yellowSurface.style.clipPath = `inset(0 ${yellowInset * (1 - opening)}px round ${yellowRadius * (1 - opening)}px)`;
    yellowBand.dataset.openProgress = opening.toFixed(4);

    const showNav = scrollY >= heroBottom - Math.min(180, innerHeight * .22);
    nav.classList.toggle('is-visible', showNav); nav.inert = !showNav; nav.setAttribute('aria-hidden', String(!showNav));
    nav.classList.toggle('is-on-dark', bandTop - scrollY <= 76 && bandBottom - scrollY >= 76);
    nav.classList.toggle('is-on-yellow', yellowTop - scrollY <= 76 && yellowBottom - scrollY >= 76);
    let active = sectionBounds[0]?.id;
    sectionBounds.forEach(section => { if (section.top <= scrollY + innerHeight * .35) active = section.id; });
    links.forEach(link => { if (showNav && link.getAttribute('href') === `#${active}`) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${maxScroll > 0 ? Math.max(0, Math.min(1, scrollY / maxScroll)) : 0})`;
    if (!reduced && Math.abs(guideProgress - desired) * totalLength > .1) schedule();
  }

  function configureReveals() {
    revealObserver?.disconnect();
    const elements = [...wrapper.querySelectorAll('.reveal')];
    if (reduced || !('IntersectionObserver' in window)) { elements.forEach(element => element.classList.add('is-revealed')); return; }
    revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); revealObserver.unobserve(entry.target); }
    }), { threshold: .06, rootMargin: '0px 0px -24px 0px' });
    elements.filter(element => !element.classList.contains('is-revealed')).forEach(element => revealObserver.observe(element));
  }

  document.addEventListener('click', event => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-open-model]') : null;
    if (!trigger) return;
    const index = Number(trigger.dataset.openModel);
    if (!Number.isInteger(index) || index < 0 || index > 2) return;
    event.preventDefault(); window.dispatchEvent(new CustomEvent('cycleup:show-model', { detail: { index } }));
    hero.tabIndex = -1; hero.focus({ preventScroll: true }); history.replaceState(null, '', '#top');
    hero.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  });
  document.addEventListener('focusin', event => {
    if (!(event.target instanceof Element)) return;
    let element = event.target.closest('.reveal');
    while (element) { element.classList.add('is-revealed'); element = element.parentElement?.closest('.reveal'); }
  });
  preference.addEventListener('change', () => { reduced = preference.matches; guideProgress = null; configureReveals(); schedule(); });
  addEventListener('scroll', schedule, { passive: true }); addEventListener('resize', rebuild, { passive: true });
  const observer = new ResizeObserver(rebuild); observer.observe(wrapper); sections.forEach(section => observer.observe(section)); observer.observe(hero);
  document.fonts?.ready.then(rebuild);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else { previousTime = 0; schedule(); } });
  configureReveals(); document.body.classList.add('journey-enhanced'); wrapper.dataset.motionReady = 'true'; schedule();
}
