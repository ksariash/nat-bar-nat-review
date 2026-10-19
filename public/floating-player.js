// Share one position between the playing and paused controls, relative to the
// available viewport so resizing or switching controls cannot strand them.
export function createFloatingPlayer({elements,position,onPositionChange}){
 const clamp=n=>Math.max(0,Math.min(1,n));
 let anchor={x:1,y:1},drag=null;
 if(Number.isFinite(position?.x)&&Number.isFinite(position?.y))anchor={x:clamp(position.x),y:clamp(position.y)};
 function bounds(element){
  const viewport=window.visualViewport,style=getComputedStyle(element);
  const inset=side=>parseFloat(style.getPropertyValue('--floating-safe-'+side))||0;
  const width=viewport?.width||window.innerWidth,height=viewport?.height||window.innerHeight;
  const left=(viewport?.offsetLeft||0)+12+inset('left'),top=(viewport?.offsetTop||0)+12+inset('top');
  element.style.maxWidth=Math.max(0,width-24-inset('left')-inset('right'))+'px';
  const rect=element.getBoundingClientRect();
  return {left,top,x:Math.max(0,width-24-inset('left')-inset('right')-rect.width),y:Math.max(0,height-24-inset('top')-inset('bottom')-rect.height)};
 }
 function layout(){
  for(const element of elements){
   if(element.hidden)continue;
   const b=bounds(element);
   element.style.left=(b.left+anchor.x*b.x)+'px';
   element.style.top=(b.top+anchor.y*b.y)+'px';
   element.style.right='auto';element.style.bottom='auto';
  }
 }
 function move(element,left,top){
  const b=bounds(element);
  anchor={x:b.x?clamp((left-b.left)/b.x):anchor.x,y:b.y?clamp((top-b.top)/b.y):anchor.y};
  layout();
 }
 for(const element of elements){
  let suppressClick=false;
  element.addEventListener('pointerdown',event=>{
   if(drag||!event.isPrimary||event.button!==0)return;
   suppressClick=false;
   // Pause/expand remain ordinary buttons; drag the topic area or Show player.
   const control=event.target.closest('button,a,input,select');
   if(control&&control!==element)return;
   const rect=element.getBoundingClientRect();
   drag={element,id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,moved:false};
   element.setPointerCapture(event.pointerId);
  });
  element.addEventListener('pointermove',event=>{
   if(drag?.element!==element||drag.id!==event.pointerId)return;
   const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
   if(!drag.moved&&Math.hypot(dx,dy)<6)return;
   drag.moved=true;element.classList.add('dragging');event.preventDefault();
   move(element,drag.left+dx,drag.top+dy);
  });
  const finish=event=>{
   if(drag?.element!==element||drag.id!==event.pointerId)return;
   const moved=drag.moved;drag=null;element.classList.remove('dragging');
   if(element.hasPointerCapture(event.pointerId))element.releasePointerCapture(event.pointerId);
   if(moved){suppressClick=true;onPositionChange({...anchor})}
  };
  for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,finish);
  element.addEventListener('click',event=>{
   if(suppressClick&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation();suppressClick=false}
  },true);
  element.addEventListener('keydown',event=>{
   if(event.target!==element&&!event.target.matches('[data-player-drag]'))return;
   const deltas={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
   if(!deltas[event.key]&&event.key!=='Home')return;
   event.preventDefault();event.stopPropagation();
   if(event.key==='Home'){anchor={x:1,y:1};layout()}
   else{
    const [dx,dy]=deltas[event.key],rect=element.getBoundingClientRect(),step=event.shiftKey?40:16;
    move(element,rect.left+dx*step,rect.top+dy*step);
   }
   onPositionChange({...anchor});
  });
 }
 window.addEventListener('resize',layout);
 window.visualViewport?.addEventListener('resize',layout);
 window.visualViewport?.addEventListener('scroll',layout);
 layout();
 return {layout};
}
