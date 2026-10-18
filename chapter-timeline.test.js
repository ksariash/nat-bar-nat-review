import test from 'node:test';
import assert from 'node:assert/strict';
import {chapterPosition,timelineTime} from './public/chapter-timeline.js';
const chapters=[{id:'a',start:0,end:19},{id:'b',start:19,end:44},{id:'c',start:44,end:60.25}];

test('chapter boundaries and recording endpoint give the correct elapsed/remaining time',()=>{
  assert.equal(chapterPosition(chapters,18.999,60.25).chapter.id,'a');
  const at=chapterPosition(chapters,19,60.25);assert.equal(at.chapter.id,'b');assert.equal(at.elapsed,0);assert.equal(at.remaining,25);
  const end=chapterPosition(chapters,60.25,60.25);assert.equal(end.chapter.id,'c');assert.equal(end.remaining,0);assert.equal(end.elapsed,16.25);
});
test('chapter progress is independent of recording time and stays inside the highlighted interval',()=>{
  const p=chapterPosition(chapters,29,60.25);assert.equal(p.elapsed,10);assert.equal(p.remaining,15);
  assert.ok(p.playedPercent<=p.widthPercent);assert.ok(Math.abs(p.startPercent+p.playedPercent-29/60.25*100)<1e-10);
});
test('invalid or missing chapters do not claim an unrelated chapter; out-of-range times clamp',()=>{
  assert.equal(chapterPosition([],0,60),null);assert.equal(chapterPosition(chapters,NaN,60.25),null);
  assert.equal(chapterPosition(chapters,10,0),null);assert.equal(chapterPosition([chapters[0],chapters[2]],30,60.25),null);
  assert.equal(chapterPosition(chapters,-5,60.25).elapsed,0);assert.equal(chapterPosition(chapters,70,60.25).remaining,0);
});
test('hover positions match native slider thumb travel at edges and midpoint, including narrow mobile tracks',()=>{
  assert.equal(timelineTime(107,100,214,60),0);assert.equal(timelineTime(307,100,214,60),60);
  assert.equal(timelineTime(207,100,214,60),30);assert.equal(timelineTime(0,100,214,60),0);
  assert.equal(timelineTime(400,100,214,60),60);assert.equal(timelineTime(100,100,8,60),0);
});

test('millisecond playback precision does not leave a phantom second at the recording end',()=>{
  const duration=4481.738005;
  const p=chapterPosition([{start:4451,end:duration}],4481.738,duration);
  assert.equal(p.remaining,0);assert.equal(p.time,duration);
});
