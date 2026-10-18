const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));

// Boundaries belong to the next chapter, except the recording's final endpoint.
export function chapterPosition(chapters,time,duration){
  if(!chapters.length||!Number.isFinite(time)||!(duration>0))return null;
  const bounded=clamp(time,0,duration);
  // The chunk player reports milliseconds; codec duration may contain microseconds.
  const t=duration-bounded<.001?duration:bounded;
  let index=chapters.findIndex(c=>t>=c.start&&t<c.end);
  if(index<0&&t===duration&&chapters.at(-1).end===duration)index=chapters.length-1;
  if(index<0)return null;
  const chapter=chapters[index],elapsed=clamp(t-chapter.start,0,chapter.end-chapter.start);
  return {chapter,index,time:t,elapsed,remaining:Math.max(0,chapter.end-t),
    startPercent:chapter.start/duration*100,widthPercent:(chapter.end-chapter.start)/duration*100,
    playedPercent:elapsed/duration*100};
}

// Native range thumbs travel between their centers, inset by half their width.
export function timelineTime(clientX,left,width,duration,thumbWidth=14){
  if(!(width>thumbWidth)||!(duration>0))return 0;
  return clamp((clientX-left-thumbWidth/2)/(width-thumbWidth),0,1)*duration;
}

export function createChapterTimeline({chapters,duration,format}){
  const $=s=>document.querySelector(s),range=$('#seek'),rail=$('#chapterRail');
  const active=$('#chapterRange'),played=$('#chapterPlayed'),preview=$('#chapterPreview');
  const tip=$('#chapterTooltip'),heading=$('#chapterTipTitle'),description=$('#chapterTipDescription');
  let keyboard=false,dragging=false,lastPointer=null,hideTimer;
  const pct=n=>n+'%';
  const remaining=n=>format(Math.ceil(Math.max(0,n)));
  const timing=p=>format(p.elapsed)+' elapsed · '+remaining(p.remaining)+' left';
  const text=(el,value)=>{if(el.textContent!==value)el.textContent=value};
  for(const chapter of chapters.slice(1)){
    const marker=document.createElement('i');marker.className='chapter-marker';
    marker.style.left=pct(chapter.start/duration*100);rail.append(marker);
  }
  function hide(){clearTimeout(hideTimer);tip.hidden=true;preview.hidden=true;lastPointer=null;keyboard=false}
  function positionTip(x){
    const r=range.getBoundingClientRect(),v=window.visualViewport;
    const left=v?.offsetLeft||0,top=v?.offsetTop||0,width=v?.width||window.innerWidth;
    const box=tip.getBoundingClientRect();
    tip.style.left=clamp(x-box.width/2,left+8,Math.max(left+8,left+width-box.width-8))+'px';
    tip.style.top=Math.max(top+8,r.top-box.height-12)+'px';
  }
  function show(time,x){
    const p=chapterPosition(chapters,time,duration);if(!p){hide();return}
    clearTimeout(hideTimer);
    text($('#chapterTipLabel'),'Chapter '+(p.index+1)+' / '+chapters.length+(p.chapter.pdf_pages?.length?' · PDF p. '+p.chapter.pdf_pages.join(', '):''));
    text(heading,p.chapter.title);text(description,p.chapter.test_focus||'');description.hidden=!p.chapter.test_focus;
    text($('#chapterTipTime'),format(p.time)+' in recording');text($('#chapterTipProgress'),timing(p));
    preview.style.left=pct(p.startPercent);preview.style.width=pct(p.widthPercent);preview.hidden=false;
    tip.hidden=false;positionTip(x);
  }
  function showCurrent(){const r=range.getBoundingClientRect();show(Number(range.value),r.left+7+(r.width-14)*Number(range.value)/duration)}
  function hover(e){
    if(e.pointerType==='touch'&&!dragging)return;
    keyboard=false;lastPointer=e.clientX;
    const r=range.getBoundingClientRect();show(timelineTime(e.clientX,r.left,r.width,duration),e.clientX);
  }
  range.addEventListener('pointerenter',hover);
  range.addEventListener('pointermove',hover);
  range.addEventListener('pointerdown',e=>{dragging=e.button===0;hover(e)});
  range.addEventListener('pointerup',e=>{dragging=false;if(e.pointerType==='touch'){showCurrent();hideTimer=setTimeout(hide,1800)}});
  range.addEventListener('pointercancel',()=>{dragging=false;hide()});
  range.addEventListener('pointerleave',()=>{if(!dragging)hide()});
  range.addEventListener('focus',()=>{if(!dragging){keyboard=true;showCurrent()}});
  range.addEventListener('blur',hide);
  range.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!tip.hidden){hide();e.preventDefault();e.stopPropagation()}
    else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)){keyboard=true;lastPointer=null}
  });
  range.addEventListener('input',()=>{if(keyboard||dragging)showCurrent()});
  document.addEventListener('pointerdown',e=>{if(e.target!==range)hide()});
  window.addEventListener('resize',hide);window.visualViewport?.addEventListener('resize',hide);
  return {update(time){
    const p=chapterPosition(chapters,time,duration);
    $('#recordingPlayed').style.width=pct(clamp(time/duration*100,0,100));
    active.hidden=played.hidden=!p;
    if(!p){text($('#chapterLabel'),'Between chapters');text($('#chapterTiming'),'');return}
    active.style.left=played.style.left=pct(p.startPercent);active.style.width=pct(p.widthPercent);played.style.width=pct(p.playedPercent);
    text($('#chapterLabel'),'Chapter '+(p.index+1)+' / '+chapters.length);text($('#chapterTiming'),timing(p));
    range.setAttribute('aria-valuetext',format(p.time)+' of '+format(duration)+'. Chapter '+(p.index+1)+' of '+chapters.length+': '+p.chapter.title+'. '+timing(p));
    if(!tip.hidden&&keyboard&&lastPointer===null)showCurrent();
  }};
}
