import {skipAt} from './off-topic.js';

// Document order is page, then column, then position within that column.
export function orderedTopics(items, spans, chapters, order = 'pdf') {
  const keys = new Map(items.map(item => {
    const locations = spans.filter(s => item.highlight_ids.includes(s.id))
      .sort((a, b) => a.page - b.page || a.column - b.column || a.bbox[1] - b.bbox[1]);
    const first = locations[0];
    return [item.id, [first?.page ?? Math.min(...item.pdf_pages), first?.column ?? 0, first?.bbox[1] ?? 0,
      Math.min(...chapters.filter(c => item.audio_chapter_ids.includes(c.id)).map(c => c.start))]];
  }));
  return [...items].sort((a, b) => {
    const x = keys.get(a.id), y = keys.get(b.id);
    if (order === 'audio' && x[3] !== y[3]) return x[3] - y[3];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || a.id.localeCompare(b.id);
  });
}

export function rankedVisits(span, chapters) {
  const score = c => (c.primary_study_section_id === span.study_section_id ? 100 : 0) +
    (c.kind === 'essay' && span.essay_id ? 30 : 0) +
    (c.preferred_pdf_page === span.page ? 10 : 0) - (c.study_section_ids?.length ?? 0);
  return chapters.filter(c => span.audio_chapter_ids.includes(c.id))
    .sort((a, b) => score(b) - score(a) || a.start - b.start);
}

// Find a playable point INSIDE a passage. Never skip forward into the current passage
// when the user requested a preceding one.
export function passageEntry(chapter, skips = []) {
  let t = chapter.suggested_jump_time ?? chapter.start;
  t = Math.max(chapter.start, t);
  let off;
  while ((off = skipAt(skips, t))) t = off.end;
  return t < chapter.end ? t : null;
}

export function adjacentPassage(chapters, currentId, direction, skips = []) {
  const current = chapters.findIndex(c => c.id === currentId);
  if (current < 0) return null;
  for (let i = current + direction; i >= 0 && i < chapters.length; i += direction) {
    // Administrative chapters and unlinked asides are not study passages.
    if (!chapters[i].study_section_ids?.length) continue;
    const time = passageEntry(chapters[i], skips);
    if (time !== null) return {chapter: chapters[i], time};
  }
  return null;
}

// Allow a second press during the first three seconds to move back one passage.
// Callers supply either linked study passages or the marked Review-mode visits.
export function previousPassage(chapters, time, skips = []) {
  const current = chapters.find(c => time >= c.start && time < c.end);
  const entry = current ? passageEntry(current, skips) : null;
  if (entry !== null && time - entry > 3) return {chapter: current, time: entry};
  const before = current?.start ?? time;
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (chapters[i].start >= before) continue;
    const start = passageEntry(chapters[i], skips);
    if (start !== null) return {chapter: chapters[i], time: start};
  }
  // At the first playable passage, Previous simply returns to its beginning.
  return entry !== null ? {chapter: current, time: entry} : null;
}
