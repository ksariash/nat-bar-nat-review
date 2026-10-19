// Mouse panning supplements native touch scrolling and the reader's pinch zoom.
// Wait for intentional movement so highlighted passages still behave as buttons.
export function enablePdfDragScroll(surface,{onDragStart=()=>{},onDragEnd=()=>{}}={}){
 let gesture=null,suppressClick=false,blockDoubleClickUntil=0;
 surface.addEventListener('pointerdown',event=>{
  suppressClick=false;
  if(event.pointerType!=='mouse'||event.button!==0||!event.isPrimary||event.ctrlKey||event.metaKey||event.altKey)return;
  const control=event.target.closest('button,a,input,select,textarea,[contenteditable]');
  if(control&&!control.matches('.pdf-highlight,.pdf-correction'))return;
  // Leave the native scrollbar's dragging behavior alone.
  const r=surface.getBoundingClientRect();
  if(event.clientX>=r.left+surface.clientLeft+surface.clientWidth||event.clientY>=r.top+surface.clientTop+surface.clientHeight)return;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,left:surface.scrollLeft,top:surface.scrollTop,moved:false};
 });
 function finish(event){
  if(!gesture||(event?.pointerId!==undefined&&event.pointerId!==gesture.id))return;
  const {id,moved}=gesture;gesture=null;
  surface.classList.remove('pdf-dragging');
  if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);
  if(moved){suppressClick=true;blockDoubleClickUntil=Date.now()+400;onDragEnd()}
 }
 window.addEventListener('pointermove',event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  if(!(event.buttons&1)){finish(event);return}
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
  if(!gesture.moved){
   if(Math.hypot(dx,dy)<6)return;
   gesture.moved=true;surface.classList.add('pdf-dragging');
   surface.setPointerCapture(event.pointerId);onDragStart();
  }
  event.preventDefault();
  surface.scrollLeft=Math.max(0,Math.min(surface.scrollWidth-surface.clientWidth,gesture.left-dx));
  surface.scrollTop=Math.max(0,Math.min(surface.scrollHeight-surface.clientHeight,gesture.top-dy));
 },{passive:false});
 for(const type of ['pointerup','pointercancel'])window.addEventListener(type,finish);
 surface.addEventListener('lostpointercapture',finish);
 window.addEventListener('blur',()=>finish());
 surface.addEventListener('click',event=>{
  if(suppressClick&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation();suppressClick=false}
 },true);
 surface.addEventListener('dblclick',event=>{
  if(Date.now()<blockDoubleClickUntil){event.preventDefault();event.stopImmediatePropagation()}
 },true);
 surface.addEventListener('dragstart',event=>event.preventDefault());
}
