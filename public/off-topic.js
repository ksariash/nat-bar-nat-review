export function validatedSkips(intervals, duration) {
  if (!Array.isArray(intervals)) return [];
  const ids = new Set();
  let end = 0;
  return intervals.filter(x => x && typeof x.id === 'string' && typeof x.label === 'string' && Number.isFinite(x.start) && Number.isFinite(x.end) && x.start >= 0 && x.end > x.start && x.end < duration)
    .sort((a, b) => a.start - b.start)
    .filter(x => {
      if (ids.has(x.id) || x.start < end) return false;
      ids.add(x.id);
      end = x.end;
      return true;
    });
}

export function skipAt(intervals, time) {
  return intervals.find(x => time >= x.start && time < x.end);
}
