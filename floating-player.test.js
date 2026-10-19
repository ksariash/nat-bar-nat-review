import test from 'node:test';
import assert from 'node:assert/strict';
import {createFloatingPlayer} from './public/floating-player.js';

function setup(position){
 const listeners={},saved=[];
 globalThis.window={innerWidth:1000,innerHeight:800,addEventListener:(name,fn)=>{listeners[name]=fn}};
 globalThis.getComputedStyle=()=>({getPropertyValue:()=> '0px'});
 function element(width,height,button=false){
  const handlers={},captures=new Set();
  const e={hidden:false,style:{},classList:{add(){},remove(){}},
   getBoundingClientRect:()=>({left:parseFloat(e.style.left)||0,top:parseFloat(e.style.top)||0,width,height}),
   addEventListener:(name,fn)=>{handlers[name]=fn},closest:()=>button?e:null,matches:()=>false,
   setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),
   fire(name,values={}){const event={target:e,isPrimary:true,button:0,pointerId:1,clientX:0,clientY:0,detail:1,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true},stopPropagation(){this.stopped=true},...values};handlers[name]?.(event);return event}};
  return e;
 }
 const mini=element(336,58),restore=element(124,44,true);restore.hidden=true;
 const controller=createFloatingPlayer({elements:[mini,restore],position,onPositionChange:p=>saved.push(p)});
 return {mini,restore,controller,saved,resize:(w,h)=>{window.innerWidth=w;window.innerHeight=h;listeners.resize()}};
}

test('floating controls default to the bottom right and keep a saved position across size changes',()=>{
 const {mini,restore,controller,resize}=setup();
 assert.equal(mini.style.left,'652px');assert.equal(mini.style.top,'730px');
 mini.hidden=true;restore.hidden=false;controller.layout();
 assert.equal(restore.style.left,'864px');assert.equal(restore.style.top,'744px');
 resize(393,852);assert.equal(restore.style.left,'257px');assert.equal(restore.style.top,'796px');
 mini.hidden=false;restore.hidden=true;controller.layout();
 assert.equal(mini.style.left,'45px');assert.equal(mini.style.top,'782px');
});

test('dragging a floating control moves it without activating it; the next tap still works',()=>{
 const {mini,restore,controller,saved}=setup();mini.hidden=true;restore.hidden=false;controller.layout();
 restore.fire('pointerdown',{clientX:900,clientY:760});
 restore.fire('pointermove',{clientX:600,clientY:460});restore.fire('pointerup');
 assert.equal(restore.style.left,'564px');assert.equal(restore.style.top,'444px');assert.equal(saved.length,1);
 assert.equal(restore.fire('click').stopped,true);
 restore.fire('pointerdown');restore.fire('pointerup');assert.equal(restore.fire('click').stopped,undefined);
 const reloaded=setup(saved[0]);reloaded.mini.hidden=true;reloaded.restore.hidden=false;reloaded.controller.layout();
 assert.equal(reloaded.restore.style.left,'564px');assert.equal(reloaded.restore.style.top,'444px');
});

test('mini dragging clamps at viewport edges; cancelled drags do not swallow the next pause click',()=>{
 const {mini,saved}=setup(),pause={closest:()=>pause,matches:()=>false};
 mini.fire('pointerdown',{target:pause});mini.fire('pointermove',{clientX:200,clientY:200});mini.fire('pointerup');
 assert.equal(saved.length,0);
 mini.fire('pointerdown',{clientX:700,clientY:750});mini.fire('pointermove',{clientX:-2000,clientY:-2000});
 assert.equal(mini.style.left,'12px');assert.equal(mini.style.top,'12px');mini.fire('pointercancel');
 mini.fire('pointerdown',{target:pause});assert.equal(mini.fire('click',{target:pause}).stopped,undefined);
});

test('a drag handle keeps pointer capture on the button so taps still toggle it',()=>{
 const {mini,saved}=setup(),captures=new Set();
 const handle={closest:()=>handle,matches:()=>true,setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
 mini.fire('pointerdown',{target:handle,clientX:670,clientY:750});
 assert.equal(captures.has(1),true);assert.equal(mini.hasPointerCapture(1),false);
 mini.fire('pointerup',{target:handle});assert.equal(mini.fire('click',{target:handle}).stopped,undefined);
 mini.fire('pointerdown',{target:handle,clientX:670,clientY:750});
 mini.fire('pointermove',{target:handle,clientX:570,clientY:650});mini.fire('pointerup',{target:handle});
 assert.equal(saved.length,1);assert.equal(mini.style.left,'552px');assert.equal(mini.style.top,'630px');
 assert.equal(mini.fire('click',{target:handle}).stopped,true);assert.equal(captures.size,0);
});

test('small touch movement remains a tap, keyboard movement does not seek, and Home resets',()=>{
 const {mini,restore,controller,saved}=setup();mini.hidden=true;restore.hidden=false;controller.layout();
 restore.fire('pointerdown',{clientX:900,clientY:760});restore.fire('pointermove',{clientX:903,clientY:761});restore.fire('pointerup');
 assert.equal(saved.length,0);assert.equal(restore.fire('click').stopped,undefined);
 const event=restore.fire('keydown',{key:'ArrowLeft'});assert.equal(event.stopped,true);assert.equal(restore.style.left,'848px');
 restore.fire('keydown',{key:'Home'});assert.equal(restore.style.left,'864px');assert.equal(restore.style.top,'744px');
});
