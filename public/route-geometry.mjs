// One long, restrained curve. Section boundaries no longer create a detour.
export function buildRoute(blocks, width, totalHeight) {
  if (!blocks.length) return { d: '', segments: [], crossings: 0 };
  const mobile = width < 701, edge = mobile ? 9 : 18;
  const near = Math.min(width - edge, Math.max(...blocks.map(b => b.right)) + (mobile ? 18 : 30));
  const far = Math.min(width - edge, near + (mobile ? 3 : 32));
  const endY = Math.max(5, totalHeight - 12);
  const segment = { type: 'C', p0: [near, 4], c1: [far, endY * .3], c2: [far, endY * .7], p1: [near, endY] };
  const d = `M ${segment.p0.join(' ')} C ${segment.c1.join(' ')}, ${segment.c2.join(' ')}, ${segment.p1.join(' ')}`;
  return { d, segments: [segment], crossings: 0 };
}

export function sampleSegment(segment, t) {
  if (segment.type === 'L') return segment.p0.map((v, axis) => v + (segment.p1[axis] - v) * t);
  const u = 1 - t;
  return segment.p0.map((v, axis) => u * u * u * v + 3 * u * u * t * segment.c1[axis] + 3 * u * t * t * segment.c2[axis] + t * t * t * segment.p1[axis]);
}

export function routeCollisions(segments, blocks, padding = 12) {
  let count = 0;
  for (const segment of segments) for (let index = 0; index <= 24; index++) {
    const [x, y] = sampleSegment(segment, index / 24);
    if (blocks.some(b => x > b.left - padding && x < b.right + padding && y > b.top - padding && y < b.bottom + padding)) count++;
  }
  return count;
}
