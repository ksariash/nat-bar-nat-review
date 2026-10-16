import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {parseRange, serveStudyAsset} from './src/worker.js';
const body = '0123456789';
const calls=[];
const bucket={
  async head(key){calls.push(['head',key]);return {size:10,etag:'test',httpEtag:'"test"',uploaded:new Date('2026-10-14T00:00:00Z')};},
  async get(key,opts){calls.push(['get',key,opts]);const r=opts.range;return {httpEtag:'"test"',body:r?body.slice(r.offset,r.offset+r.length):body};},
};
const env={STUDY_ASSETS:bucket,ASSETS:{fetch:async()=>new Response('site')}};
test('audio range requests preserve seek bytes and headers',async()=>{
 const r=await serveStudyAsset(new Request('https://test/assets/review-00.m4a',{headers:{Range:'bytes=3-6'}}),env,'review-00.m4a');
 assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),'bytes 3-6/10');assert.equal(r.headers.get('Content-Length'),'4');assert.equal(r.headers.get('Content-Type'),'audio/mp4');assert.equal(await r.text(),'3456');assert.equal(calls.at(-1)[1],'rashti-review/review-00.m4a');
});
test('suffix, open-ended, clamped, and invalid ranges',()=>{
 assert.deepEqual(parseRange('bytes=-3',10),{offset:7,length:3});assert.deepEqual(parseRange('bytes=8-',10),{offset:8,length:2});assert.deepEqual(parseRange('bytes=8-100',10),{offset:8,length:2});
 for(const value of ['bytes=10-','bytes=-0','bytes=6-3','bytes=0-2,5-8','bytes=-','nonsense'])assert.equal(parseRange(value,10),false);
});
test('HEAD and conditional requests do not read the body',async()=>{
 calls.length=0;const r=await serveStudyAsset(new Request('https://test/assets/summary5.pdf',{method:'HEAD'}),env,'summary5.pdf');assert.equal(r.status,200);assert.equal(await r.text(),'');assert.equal(calls.filter(x=>x[0]==='get').length,0);
 const same=await serveStudyAsset(new Request('https://test/assets/review.json',{headers:{'If-None-Match':'"test"'}}),env,'review.json');assert.equal(same.status,304);
});
test('invalid ranges return 416; stale If-Range returns full body',async()=>{
 const r=await serveStudyAsset(new Request('https://test/assets/review-00.m4a',{headers:{Range:'bytes=100-'}}),env,'review-00.m4a');assert.equal(r.status,416);assert.equal(r.headers.get('Content-Range'),'bytes */10');
 const full=await serveStudyAsset(new Request('https://test/assets/review-00.m4a',{headers:{Range:'bytes=1-3','If-Range':'"old"'}}),env,'review-00.m4a');assert.equal(full.status,200);assert.equal(await full.text(),body);
});
test('only named study files can be exposed; application files use static binding',async()=>{
 assert.equal((await worker.fetch(new Request('https://test/assets/private.txt'),env)).status,404);assert.equal((await worker.fetch(new Request('https://test/assets/rashti-review%2Fsecret'),env)).status,404);assert.equal(await(await worker.fetch(new Request('https://test/app.js'),env)).text(),'site');
});
test('missing storage and missing objects fail explicitly',async()=>{
 assert.equal((await serveStudyAsset(new Request('https://test/assets/review.json'),{},'review.json')).status,503);
 assert.equal((await serveStudyAsset(new Request('https://test/assets/review.json'),{STUDY_ASSETS:{head:async()=>null}},'review.json')).status,404);
});
test('chaptered audio is downloadable with ranges; the chapter index is readable',async()=>{
 const r=await serveStudyAsset(new Request('https://test/assets/review-full.m4a',{headers:{Range:'bytes=0-4'}}),env,'review-full.m4a');
 assert.equal(r.status,206);assert.match(r.headers.get('Content-Disposition'),/^attachment; filename="SCP-review-with-chapters.m4a"$/);assert.equal(await r.text(),'01234');
 const index=await serveStudyAsset(new Request('https://test/assets/review-chapters.html'),env,'review-chapters.html');assert.equal(index.status,200);assert.equal(index.headers.get('Content-Type'),'text/html; charset=utf-8');
});
