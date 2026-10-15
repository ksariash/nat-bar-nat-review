const FILES = new Map([
  ['review.json', 'application/json; charset=utf-8'],
  ['summary5.pdf', 'application/pdf'],
  ...Array.from({length: 8}, (_, i) => [`review-${String(i).padStart(2, '0')}.m4a`, 'audio/mp4']),
]);

export function parseRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2]) || size <= 0) return false;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return false;
    const length = Math.min(size, suffix);
    return {offset: size - length, length};
  }
  const start = Number(match[1]);
  const last = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(last) || start >= size || last < start) return false;
  return {offset: start, length: Math.min(last, size - 1) - start + 1};
}

export async function serveStudyAsset(request, env, name) {
  if (!FILES.has(name)) return new Response('Not found', {status: 404});
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status: 405, headers: {Allow: 'GET, HEAD'}});
  const bucket = env.STUDY_ASSETS;
  if (!bucket) return new Response('Study storage is not configured', {status: 503});
  const key = `rashti-review/${name}`;
  const meta = await bucket.head(key);
  if (!meta) return new Response('Study file not found', {status: 404});
  const etag = meta.httpEtag || `"${meta.etag}"`;
  const headers = new Headers({
    'Content-Type': FILES.get(name),
    'Accept-Ranges': 'bytes',
    'ETag': etag,
    'Last-Modified': meta.uploaded.toUTCString(),
    'Cache-Control': name === 'review.json' ? 'public, max-age=300' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  if (request.headers.get('If-None-Match')?.split(',').map(x => x.trim()).some(x => x === etag || x === '*' || x === `W/${etag}`)) return new Response(null, {status: 304, headers});
  let rangeHeader = request.headers.get('Range');
  const ifRange = request.headers.get('If-Range');
  if (ifRange && ifRange !== etag && Date.parse(ifRange) < meta.uploaded.getTime()) rangeHeader = null;
  if (ifRange && ifRange !== etag && !Number.isFinite(Date.parse(ifRange))) rangeHeader = null;
  const range = parseRange(rangeHeader, meta.size);
  if (range === false) {
    headers.set('Content-Range', `bytes */${meta.size}`);
    return new Response(null, {status: 416, headers});
  }
  const status = range ? 206 : 200;
  headers.set('Content-Length', String(range ? range.length : meta.size));
  if (range) headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${meta.size}`);
  if (request.method === 'HEAD') return new Response(null, {status, headers});
  const object = await bucket.get(key, range ? {range} : {});
  if (!object) return new Response('Study file not found', {status: 404});
  if (object.httpEtag && object.httpEtag !== etag) return new Response('File changed; retry the request', {status: 503, headers: {'Retry-After': '1'}});
  return new Response(object.body, {status, headers});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/assets/')) {
      let name;
      try {name = decodeURIComponent(url.pathname.slice('/assets/'.length));}
      catch {return new Response('Bad request', {status: 400});}
      return serveStudyAsset(request, env, name);
    }
    return env.ASSETS.fetch(request);
  },
};
