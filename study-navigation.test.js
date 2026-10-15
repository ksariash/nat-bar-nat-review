import test from 'node:test';
import assert from 'node:assert/strict';
import {orderedTopics,rankedVisits,adjacentPassage,passageEntry} from './public/study-navigation.js';
import {horizontalTarget} from './public/pdf-navigation.js';

test('PDF order respects columns even when highlight records are unordered; audio order is chronological with notes last',()=>{
 const items=[{id:'a',highlight_ids:['a2','a1'],pdf_pages:[2],audio_chapter_ids:['late']},{id:'b',highlight_ids:['b'],pdf_pages:[2],audio_chapter_ids:['early']},{id:'c',highlight_ids:[],pdf_pages:[1],audio_chapter_ids:[]}];
 const spans=[{id:'a2',page:3,column:0,bbox:[0,.1]},{id:'a1',page:2,column:0,bbox:[0,.8]},{id:'b',page:2,column:1,bbox:[0,.1]}];
 const chapters=[{id:'late',start:100},{id:'early',start:10}];
 assert.deepEqual(orderedTopics(items,spans,chapters).map(x=>x.id),['c','a','b']);
 assert.deepEqual(orderedTopics(items,spans,chapters,'audio').map(x=>x.id),['b','a','c']);
});
test('PDF click prefers a directly aligned topic over an earlier broad mention',()=>{
 const span={study_section_id:'s',page:12,audio_chapter_ids:['broad','specific']};
 const chapters=[{id:'broad',start:20,study_section_ids:['s','q']},{id:'specific',start:100,primary_study_section_id:'s',preferred_pdf_page:12,study_section_ids:['s']}];
 assert.equal(rankedVisits(span,chapters)[0].id,'specific');
});
test('Previous never skips back into the current passage; it passes fully skipped and administrative chapters',()=>{
 const chapters=[{id:'a',start:0,end:10,study_section_ids:['a']},{id:'b',start:10,end:20,study_section_ids:['b']},{id:'aside',start:20,end:30,study_section_ids:[]},{id:'c',start:30,end:50,study_section_ids:['c']}];
 const skips=[{start:10,end:35}];
 assert.equal(adjacentPassage(chapters,'c',-1,skips).chapter.id,'a');
 assert.equal(adjacentPassage(chapters,'a',1,skips).time,35);
 assert.equal(adjacentPassage(chapters,'a',-1,skips),null);
 assert.equal(passageEntry(chapters[1],skips),null);
});
test('horizontal reveal works below the old zoom threshold and preserves an already visible target',()=>{
 assert.equal(horizontalTarget(260,470,0,393,500),93);
 assert.equal(horizontalTarget(100,280,30,393,900),30);
 assert.equal(horizontalTarget(50,250,200,393,900),34);
});
test('oversized text aligns its leading edge, and targets never exceed the scroll range',()=>{
 assert.equal(horizontalTarget(600,1200,0,393,1400),584);
 assert.equal(horizontalTarget(900,990,0,393,1000),607);
 assert.equal(horizontalTarget(5,370,0,393,393),0);
});
