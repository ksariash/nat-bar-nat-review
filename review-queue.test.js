import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewVisits,reviewRanges,reviewPosition,adjacentReviewVisit} from './public/review-queue.js';
const chapters=[{id:'a',start:0,end:10},{id:'b',start:10,end:20},{id:'c',start:30,end:40},{id:'d',start:50,end:60}];
test('all linked visits appear once, in audio order, regardless of topic order',()=>{
 const items=[{id:'essay',audio_chapter_ids:['d','a']},{id:'s',audio_chapter_ids:['a','c']},{id:'notes',audio_chapter_ids:[]}];
 assert.deepEqual(reviewVisits(items,chapters,{essay:true,s:true,notes:true}).map(c=>c.id),['a','c','d']);
 assert.deepEqual(reviewVisits(items,chapters,{}),[]);
});
test('review ranges skip asides, including those crossing chapter boundaries',()=>{
 assert.deepEqual(reviewRanges(chapters,[{start:8,end:12},{start:18,end:35}]),[{start:0,end:8},{start:12,end:18},{start:35,end:40},{start:50,end:60}]);
});
test('shared or overlapping audio is never played twice during automatic progression',()=>{
 assert.deepEqual(reviewRanges([...chapters,{id:'overlap',start:5,end:35}]),[{start:0,end:40},{start:50,end:60}]);
});
test('position jumps over unmarked audio and stops at the end instead of wrapping',()=>{
 const ranges=reviewRanges([chapters[0],chapters[2]]);
 assert.equal(reviewPosition(ranges,5).time,5);assert.equal(reviewPosition(ranges,10).time,30);
 assert.equal(reviewPosition(ranges,40),null);assert.equal(reviewPosition([],0),null);
});
test('previous and next stay in review visits and skip visits with no playable audio',()=>{
 const visits=[chapters[0],chapters[2],chapters[3]];
 assert.equal(adjacentReviewVisit(visits,35,-1).time,0);
 assert.equal(adjacentReviewVisit(visits,9,1,[{start:30,end:40}]).time,50);
 assert.equal(adjacentReviewVisit(visits,25,1).time,30);
 assert.equal(adjacentReviewVisit(visits,55,1),null);
});
