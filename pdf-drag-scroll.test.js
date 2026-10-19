import test from 'node:test';
import assert from 'node:assert/strict';
import {enablePdfDragScroll} from './public/pdf-drag-scroll.js';

function setup(){
 const events=()=>{
  const listeners=new Map();
  return {addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn)},emit(type,values={}){
   const event={pointerType:'mouse',button:0,buttons:1,isPrimary:true,pointerId:1,clientX:300,clientY:300,detail:1,target:{closest:()=>null},preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true},...values};
   for(const fn of listeners.get(type)||[]){fn(event);if(event.stopped)break}return event;
  }};
 };
 const win=events(),classes=new Set(),capture=new Set(),calls={start:0,end:0};globalThis.window=win;
 const surface={...events(),scrollLeft:300,scrollTop:700,scrollWidth:1800,scrollHeight:6000,clientWidth:600,clientHeight:500,clientLeft:0,clientTop:0,
  getBoundingClientRect:()=>({left:100,top:100}),classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},
  setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id)};
 enablePdfDragScroll(surface,{onDragStart:()=>calls.start++,onDragEnd:()=>calls.end++});
 const highlight={closest(){return this},matches:()=>true};
 return {surface,win,classes,capture,calls,highlight};
}

test('a highlighted passage click with small pointer jitter is still an ordinary click',()=>{
 const {surface,win,capture,calls,highlight}=setup();
 surface.emit('pointerdown',{target:highlight});win.emit('pointermove',{clientX:303,clientY:302});win.emit('pointerup');
 assert.equal(surface.scrollLeft,300);assert.equal(surface.scrollTop,700);assert.equal(capture.size,0);assert.equal(calls.start,0);
 assert.equal(surface.emit('click',{target:highlight}).stopped,undefined);
});

test('dragging a passage pans both axes and releasing never plays audio or zooms',()=>{
 const {surface,win,capture,classes,calls,highlight}=setup();
 surface.emit('pointerdown',{target:highlight});win.emit('pointermove',{clientX:200,clientY:150});
 assert.equal(surface.scrollLeft,400);assert.equal(surface.scrollTop,850);assert.equal(capture.has(1),true);assert.equal(classes.has('pdf-dragging'),true);
 win.emit('pointermove',{clientX:-100,clientY:-200});assert.equal(surface.scrollTop,1200);
 win.emit('pointerup');assert.equal(capture.size,0);assert.equal(classes.size,0);assert.deepEqual(calls,{start:1,end:1});
 assert.equal(surface.emit('click',{target:highlight}).stopped,true);assert.equal(surface.emit('dblclick').stopped,true);
 assert.equal(surface.emit('click',{detail:0,target:highlight}).stopped,undefined);
 surface.emit('pointerdown',{target:highlight});win.emit('pointerup');assert.equal(surface.emit('click',{target:highlight}).stopped,undefined);
});

test('panning clamps to content edges and ignores other pointers',()=>{
 const {surface,win}=setup();surface.emit('pointerdown');
 win.emit('pointermove',{pointerId:2,clientX:0,clientY:0});assert.equal(surface.scrollTop,700);
 win.emit('pointermove',{clientX:10000,clientY:10000});assert.equal(surface.scrollLeft,0);assert.equal(surface.scrollTop,0);
 win.emit('pointermove',{clientX:-10000,clientY:-10000});assert.equal(surface.scrollLeft,1200);assert.equal(surface.scrollTop,5500);
});

test('touch, right click, modified clicks, controls, and native scrollbars stay native',()=>{
 for(const input of [{pointerType:'touch'},{pointerType:'pen'},{button:2},{ctrlKey:true},{target:{closest:()=>({matches:()=>false})}},{clientX:705},{clientY:605}]){
  const {surface,win,calls}=setup();assert.equal(surface.emit('pointerdown',input).prevented,undefined);
  const move=win.emit('pointermove',{clientX:100,clientY:100});assert.equal(move.prevented,undefined);assert.equal(surface.scrollTop,700);assert.equal(calls.start,0);
 }
});

test('cancel, capture loss, blur, and a released mouse button always finish the drag',()=>{
 for(const end of ['pointercancel','lostpointercapture','blur','released']){
  const {surface,win,capture,classes,calls}=setup();surface.emit('pointerdown');win.emit('pointermove',{clientY:200});
  if(end==='lostpointercapture')surface.emit(end);else if(end==='released')win.emit('pointermove',{buttons:0});else win.emit(end);
  assert.equal(capture.size,0);assert.equal(classes.size,0);assert.equal(calls.end,1);
  const top=surface.scrollTop;win.emit('pointermove',{clientY:0});assert.equal(surface.scrollTop,top);
  surface.emit('pointerdown',{pointerType:'touch'});assert.equal(surface.emit('click').stopped,undefined);
 }
});
