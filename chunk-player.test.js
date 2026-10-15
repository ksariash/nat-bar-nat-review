import test from 'node:test';
import assert from 'node:assert/strict';
import {createChunkPlayer} from './public/chunk-player.js';
class Audio extends EventTarget {
  src='';currentTime=0;readyState=0;paused=true;ended=false;error=null;plays=0;
  load(){this.readyState=0;this.pause()}
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'))}
  async play(){this.plays++;this.paused=false;this.dispatchEvent(new Event('play'))}
  ready(){this.readyState=1;this.dispatchEvent(new Event('loadedmetadata'))}
}
const setup=()=>{const a=new Audio();return [a,createChunkPlayer(a,[{start:0,end:60,src:'a'},{start:60.01,end:120,src:'b'}],120)]};
test('rapid seeks while a new chunk loads retain latest target and playback intent',()=>{
  const [a,p]=setup();p.seek(65,true);p.seek(76);assert.equal(p.time(),76);assert.equal(p.playing,true);a.ready();assert.equal(a.currentTime,15.990000000000002);assert.equal(a.plays,1);
});
test('pausing during load prevents late autoplay',()=>{const[a,p]=setup();p.seek(65,true);p.pause();a.ready();assert.equal(a.plays,0);assert.equal(p.playing,false)});
test('paused session restore never autoplays; explicit play during load does',()=>{const[a,p]=setup();p.seek(70,false);a.ready();assert.equal(a.plays,0);p.seek(10,false);p.play();a.ready();assert.equal(a.plays,1)});
test('codec rounding gaps and endpoints still seek',()=>{const[a,p]=setup();p.seek(60.005,false);assert.equal(p.index,0);assert.equal(p.time(),60.005);p.seek(999,false);assert.equal(p.time(),120);assert.equal(p.index,1)});
test('retry preserves the failed seek target',()=>{const[a,p]=setup();p.seek(75,true);a.error={code:2};a.dispatchEvent(new Event('error'));p.play();a.error=null;a.ready();assert.equal(p.time(),75);assert.equal(a.plays,1)});
test('media precision cannot leave an exact chapter seek in the preceding chapter',()=>{const[a,p]=setup();p.seek(75,false);a.ready();a.currentTime=14.989999999;assert.equal(p.time(),75)});
test('queued events from an old source cannot reverse the latest playback command',()=>{const[a,p]=setup();p.seek(75,true);a.ready();a.dispatchEvent(new Event('pause'));assert.equal(p.playing,true);p.pause();a.dispatchEvent(new Event('play'));assert.equal(p.playing,false)});
test('one pause cancels a play request that starts asynchronously after the click',async()=>{
 const[a,p]=setup();p.seek(5,false);a.ready();let finish;
 a.play=()=>new Promise(resolve=>{finish=()=>{a.paused=false;a.dispatchEvent(new Event('play'));resolve()}});
 p.play();p.pause();finish();await Promise.resolve();
 assert.equal(a.paused,true);assert.equal(p.playing,false);
});
test('a new play command wins over completion of an older cancelled play request',async()=>{
 const[a,p]=setup();p.seek(5,false);a.ready();const requests=[];
 a.play=()=>new Promise(resolve=>requests.push(()=>{a.paused=false;a.dispatchEvent(new Event('play'));resolve()}));
 p.play();p.pause();p.play();requests[0]();requests[1]();await Promise.resolve();
 assert.equal(a.paused,false);assert.equal(p.playing,true);p.pause();assert.equal(p.playing,false);
});
