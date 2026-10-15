// Keep playback intent separate from the media element's temporary paused state while loading.
export function createChunkPlayer(audio, chunks, duration, changed = () => {}, failed = () => {}) {
  let index = 0, pending = null, loading = false, intended = false, revision = 0, starting = 0;
  const time = () => pending ?? Math.min(duration, Math.round((chunks[index].start + (audio.currentTime || 0)) * 1000) / 1000);
  async function playReady() {
    const request = revision;
    starting++;
    try { await audio.play(); if (!intended) audio.pause(); }
    catch (e) { if (request === revision && e.name !== 'AbortError') { intended = false; failed(e); changed(); } }
    finally { starting--; changed(); }
  }
  function seek(value, play = intended, reload = false) {
    const t = Math.min(duration, Math.max(0, Number(value) || 0));
    // Chunk starts are authoritative; tiny codec rounding gaps must not swallow a seek.
    let next = chunks.length - 1;
    while (next > 0 && t < chunks[next].start) next--;
    revision++; intended = play;
    if (reload || next !== index || !audio.src) {
      pending = t; loading = true; index = next;
      audio.src = chunks[index].src; audio.load();
    } else if (loading || audio.readyState === 0) {
      pending = t;
    } else {
      pending = null; audio.currentTime = t - chunks[index].start;
      if (play) playReady(); else audio.pause();
    }
    changed();
  }
  audio.addEventListener('loadedmetadata', () => {
    if (!loading && pending === null) return;
    const t = pending ?? chunks[index].start;
    audio.currentTime = Math.max(0, t - chunks[index].start);
    pending = null; loading = false;
    if (intended) playReady();
    changed();
  });
  // Media events are queued: an event from the previous source must not undo a newer command.
  audio.addEventListener('play', () => { if (!intended && !audio.paused) audio.pause(); changed(); });
  audio.addEventListener('pause', () => { if (!loading && !starting && audio.paused && !audio.ended) intended = false; changed(); });
  audio.addEventListener('error', () => { intended = false; loading = false; changed(); });
  return {
    seek, time,
    get index() { return index; },
    get pending() { return pending; },
    get playing() { return intended || (!audio.paused && !audio.ended); },
    play() { revision++; intended = true; if (audio.error) seek(time(), true, true); else if (!loading) playReady(); changed(); },
    pause() { revision++; intended = false; audio.pause(); changed(); }
  };
}
