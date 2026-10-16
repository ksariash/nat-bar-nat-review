// Shared chapter IDs occur under several study topics. One chapter is one visit.
export function reviewVisits(items, chapters, marked) {
  const ids = new Set(items.filter(x => marked[x.id]).flatMap(x => x.audio_chapter_ids));
  return chapters.filter(c => ids.has(c.id)).sort((a,b) => a.start-b.start);
}

export function reviewRanges(visits, skips = []) {
  const ranges=[];
  for (const c of visits) {
    let start=c.start;
    for (const skip of skips) {
      if (skip.end<=start || skip.start>=c.end) continue;
      if (skip.start>start) ranges.push({start,end:skip.start});
      start=Math.max(start,skip.end);
      if(start>=c.end) break;
    }
    if(start<c.end) ranges.push({start,end:c.end});
  }
  const merged=[];
  for(const r of ranges.sort((a,b)=>a.start-b.start)) {
    const last=merged.at(-1);
    if(last && r.start<=last.end) last.end=Math.max(last.end,r.end);
    else merged.push({...r});
  }
  return merged;
}

export function reviewPosition(ranges, time) {
  const range=ranges.find(r=>time>=r.start && time<r.end);
  if(range) return {time,range};
  const next=ranges.find(r=>r.start>time);
  return next?{time:next.start,range:next}:null;
}

export function adjacentReviewVisit(visits, time, direction, skips=[]) {
  const current=visits.findIndex(c=>time>=c.start && time<c.end);
  const candidates=current>=0?(direction<0?visits.slice(0,current).reverse():visits.slice(current+1)):
    (direction<0?[...visits].reverse().filter(c=>c.start<time):visits.filter(c=>c.start>time));
  for(const chapter of candidates){
    const ranges=reviewRanges([chapter],skips);
    if(ranges.length)return {chapter,time:ranges[0].start};
  }
  return null;
}
