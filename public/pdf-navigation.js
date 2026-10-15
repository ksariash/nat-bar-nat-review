// One reading part per highlighted column/page, in the document's reading order.
export function passageParts(spans) {
  const groups = new Map();
  for (const span of spans) {
    const b = span.bbox;
    if (!Number.isInteger(span.page) || span.page < 1 || !Array.isArray(b) ||
        b.length !== 4 || !b.every(Number.isFinite) || b[2] <= b[0] || b[3] <= b[1]) continue;
    const column = span.column === 1 ? 1 : 0;
    const key = `${span.page}:${column}`;
    let part = groups.get(key);
    if (!part) {
      part = {page: span.page, column, bbox: [...b]};
      groups.set(key, part);
    } else {
      part.bbox = [Math.min(part.bbox[0], b[0]), Math.min(part.bbox[1], b[1]),
        Math.max(part.bbox[2], b[2]), Math.max(part.bbox[3], b[3])];
    }
  }
  return [...groups.values()].sort((a, b) => a.page - b.page || a.column - b.column);
}

export function passageVisible(rects, viewport) {
  return rects.some(r => {
    const width = r.right - r.left, height = r.bottom - r.top;
    if (width <= 0 || height <= 0) return false;
    const x = Math.min(viewport.right, r.right) - Math.max(viewport.left, r.left);
    const y = Math.min(viewport.bottom, r.bottom) - Math.max(viewport.top, r.top);
    // A one-pixel sliver is not useful evidence that the passage is in view.
    return x >= Math.min(60, width * .4) && y >= Math.min(18, height * .5);
  });
}

export function visiblePartIndex(rects, viewport) {
  let best = -1, area = 0;
  rects.forEach((r, i) => {
    const visible = Math.max(0, Math.min(viewport.right, r.right) - Math.max(viewport.left, r.left)) *
      Math.max(0, Math.min(viewport.bottom, r.bottom) - Math.max(viewport.top, r.top));
    if (visible > area) { best = i; area = visible; }
  });
  return best;
}
