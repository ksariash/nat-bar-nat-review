import {applyNoteCorrections,pageCorrectionMarkup,studyCorrectionMarkup} from './note-corrections.js?v=20261018-correction2';
import {createChapterTimeline} from './chapter-timeline.js?v=20261018-chapters2';
import {passageParts, passageVisible, visiblePartIndex, horizontalTarget} from './pdf-navigation.js';
import {orderedTopics, rankedVisits, passageEntry, adjacentPassage, previousPassage} from './study-navigation.js?v=20261018-previous1';
import {reviewVisits, reviewRanges, reviewPosition, adjacentReviewVisit} from './review-queue.js';
import {createChunkPlayer,normalizePlaybackRate} from './chunk-player.js?v=20261018-resume1';
import {validatedSkips, skipAt} from './off-topic.js';
import {createFloatingPlayer} from './floating-player.js?v=20261018-compact1';
import * as pdfjs from './vendor/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=t=>{t=Math.max(0,Math.floor(Number(t)||0));return t>=3600?`${Math.floor(t/3600)}:${String(Math.floor(t/60)%60).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`:`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`};
let initializationComplete=false,queuedPage=null,lastSessionSave=0;let partSelection=null,parts=[],partIndex=0,partPinned=false;let D,pdf,pageNum=3,zoom=1,renderID=0,renderTask=null,selected=null,filter='all',query='',currentChapter=null,currentCue=null,loopRange=null,chunkIndex=0,pendingSeek=null,playAfterLoad=false,following=true,activePanel='focus',essayID='essay-1',toastTimer;
let reviewMode=false,reviewTimer=null,reviewComplete=false;
let player,chapterTimeline;let skipIntervals=[],replaySkipId=null,lastSkipped=null;const audio=$('#audio');let memory={};try{const saved=JSON.parse(localStorage.getItem('scp-review-desk-v1')||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))memory=saved}catch{};for(const key of ['review','saved','studied','checks','answers'])if(!memory[key]||typeof memory[key]!=='object'||Array.isArray(memory[key]))memory[key]={};
let playerHidden=memory.playerHidden===true,miniCollapsed=memory.miniCollapsed===true;
memory.playbackRate=normalizePlaybackRate(memory.playbackRate);$('#rate').value=String(memory.playbackRate);
function persist(){try{localStorage.setItem('scp-review-desk-v1',JSON.stringify(memory))}catch{toast('Browser storage is unavailable; changes will last for this visit.')}}
function toast(s,duration=3500){$('#toast').textContent=s;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),duration)}
const chapter=id=>D.chapters.find(c=>c.id===id), section=id=>D.study_sections.find(s=>s.id===id), authority=id=>D.authorities.find(a=>a.id===id);
const total=()=>D.audio.duration_seconds;
const compactPanels=()=>window.innerWidth<=900;
let desktopPanels={left:memory.panels?.left!==false,right:memory.panels?.right!==false},readingPanels={left:false,right:false};
function item(id){if(typeof id!=='string')return null;return id.startsWith('essay-')?D.essays.find(e=>e.id===id):section(id)}
function selectedSections(){if(!selected)return [];return selected.startsWith('essay-')?item(selected).study_section_ids:[selected]}
function selectedChapters(){const x=item(selected);return x?.audio_chapter_ids||[]}
function allItems(){return orderedTopics([...D.study_sections.filter(s=>s.test_kind==='multiple_choice'),...D.essays.map(e=>({...e,test_kind:'essay'}))],D.highlight_spans,D.chapters,memory.topicSort)}
function matchItem(x,q){if(!q)return true;const spans=D.highlight_spans.filter(s=>x.highlight_ids.includes(s.id));return `${x.title} ${spans.map(s=>s.text).join(' ')} ${(x.required_blue_authority_ids||[]).map(id=>authority(id)?.name).join(' ')}`.toLowerCase().includes(q)}
function nav(){$$('[data-sort]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sort===(memory.topicSort==='audio'?'audio':'pdf'))));const q=query.toLowerCase();let xs=allItems().filter(x=>(filter==='all'||filter==='mc'&&x.test_kind==='multiple_choice'||filter==='essay'&&x.test_kind==='essay'||filter==='saved'&&memory.saved[x.id]||filter==='review'&&memory.review[x.id])&&matchItem(x,q));$('#resultsCount').textContent=`${xs.length} ${filter==='essay'?'essay topics':'study topics'}`;$('#progressCount').textContent=`${Object.values(memory.studied).filter(Boolean).length} studied`;$('#clearSearch').hidden=!query;
 const topicHTML=x=>`<button class="topic ${selected===x.id?'active':''}" data-topic="${x.id}" aria-current="${selected===x.id?'true':'false'}"><span class="topic-title">${esc(x.title)}</span><span class="topic-meta"><span class="dot ${x.test_kind==='essay'?'green':'yellow'}"></span>${x.test_kind==='essay'?'ESSAY '+x.id.split('-')[1]:'MULTIPLE CHOICE'} <span>·</span> p. ${x.pdf_pages.join(', ')} ${x.audio_chapter_ids.length?'':'<span>· Notes only</span>'}${memory.saved[x.id]?' ☆':''}${memory.review[x.id]?' · Review':''}${memory.studied[x.id]?'<span class="done">✓</span>':''}</span></button>`;const current=item(selected);$('#topicList').innerHTML=(current&&!xs.some(x=>x.id===selected)?'<div class="current-topic-label">Current topic · outside this filter</div>'+topicHTML({...current,test_kind:selected.startsWith('essay-')?'essay':current.test_kind})+'<div class="current-topic-divider"></div>':'')+(xs.map(topicHTML).join('')||'<div class="empty-note">No topics match this filter.</div>');
 if(q){const hits=D.segments.filter(s=>s.text.toLowerCase().includes(q)).slice(0,20);if(hits.length)$('#topicList').innerHTML+=`<h3>In the transcript</h3>`+hits.map(s=>`<button class="search-hit" data-segment="${s.id}">${searchSnippet(s.text,query)}<small>${fmt(s.start)} · review audio</small></button>`).join('')}
}
function searchSnippet(text,q){const at=text.toLowerCase().indexOf(q.toLowerCase()),start=Math.max(0,at-45),end=Math.min(text.length,start+200);return (start?'…':'')+mark(text.slice(start,end),q)+(end<text.length?'…':'')}
function mark(t,q){if(!q)return esc(t);const parts=t.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'ig'));return parts.map(x=>x.toLowerCase()===q.toLowerCase()?`<mark>${esc(x)}</mark>`:esc(x)).join('')}
async function selectTopic(id,{seek=false,play=false,scroll=true,openPanel=true}={}){const x=item(id);if(!x)return;selected=id;nav();focus();if(id.startsWith('essay-')){essayID=id;practice()}overlays();$('#search').blur();$('#sidebar').classList.remove('open');if(openPanel)panel(id.startsWith('essay-')?'practice':'focus');else closeStudyPanels();if(scroll&&x.pdf_pages.length){await goPage(x.pdf_pages[0]);scrollHighlight()}if(seek&&x.audio_chapter_ids.length){const c=chapter(x.audio_chapter_ids[0]);await jump(c.start,play)}}
function visitPart(c,x=item(selected)){
 const sectionIDs=x.id.startsWith('essay-')?x.study_section_ids:[x.id];
 const matching=c.study_section_ids.filter(id=>sectionIDs.includes(id));
 const sid=matching.includes(c.primary_study_section_id)?c.primary_study_section_id:matching[0];
 const spans=D.highlight_spans.filter(s=>x.highlight_ids.includes(s.id)&&(!sid||s.study_section_id===sid));
 const ps=passageParts(spans);return ps.find(p=>p.page===c.preferred_pdf_page)||ps[0];
}
function focus(){
 const x=item(selected);if(!x)return;updatePassageParts();
 const isEssay=selected.startsWith('essay-'),ids=x.required_blue_authority_ids||[],visits=x.audio_chapter_ids.map(chapter).filter(Boolean).sort((a,b)=>a.start-b.start);
 const tags=[['save','saved','Bookmark','bookmark'],['studied','studied','Mark studied','check'],['review','review','Needs review','flag']];
 $('#focusPanel').innerHTML=`<span class="badge ${isEssay?'essay':''}"><span class="dot ${isEssay?'green':'yellow'}"></span>${isEssay?'ESSAY '+selected.split('-')[1]:'MULTIPLE CHOICE'}</span>
 <h2><button class="focus-title" data-action="show-map" title="Find this topic in the study map">${esc(x.title)}</button></h2>
 <p class="pages-line">Summary 5 · page${x.pdf_pages.length>1?'s':''} ${x.pdf_pages.join(', ')}</p>
 <p class="focus-note">${esc(isEssay?'Build a complete answer using the highlighted notes and the names below.':visits[0]?.test_focus||'Highlighted test material is preserved here even when no confident review-audio match was found.')}</p>
 ${studyCorrectionMarkup(selectedSections())}
 <section class="focus-section"><h3>Tag for follow-up</h3><div class="tag-actions" role="group" aria-label="Topic tags">${tags.map(([action,key,label,icon])=>`<button class="tag-button" data-action="${action}" aria-label="${label}" title="${label}" aria-pressed="${!!memory[key][selected]}">${svg(icon)}</button>`).join('')}</div></section>
 <section class="focus-section"><h3>Review this topic <span class="muted">${visits.length?'· '+visits.length+' visit'+(visits.length>1?'s':''):''}</span></h3><div class="visits">${visits.map(c=>{const p=visitPart(c,x);return `<div class="visit-row"><button class="visit" data-visit="${c.id}" aria-label="Play ${esc(c.title)} at ${fmt(c.start)}"><span class="visit-icon">${svg('play')}</span><span><strong>${esc(c.title)}</strong><small>${fmt(c.start)} – ${fmt(c.end)}${c.kind==='essay'?' · Essay recap':''}</small></span></button>${p?`<button class="visit-pdf" data-visit-pdf="${c.id}" title="Open paired PDF passage" aria-label="Open notes for ${esc(c.title)}, page ${p.page}, ${p.column===0?'left':'right'} column">${svg('document')}<span>p. ${p.page}<small>${p.column===0?'Left':'Right'}</small></span></button>`:''}</div>`}).join('')||'<p class="empty-note">Notes only. No confident matching passage was found in the review audio.</p><button class="action" data-action="read-notes">Open highlighted notes</button>'}</div></section>
 <section class="focus-section"><h3>Blue-highlighted names</h3><div class="names">${ids.map(id=>`<button class="name-chip" data-name="${id}" title="Find this authority in the review">${esc(authority(id)?.name)}</button>`).join('')||'<p class="muted">No authority names are blue-highlighted in this passage.</p>'}</div></section>
 ${isEssay?'<button class="action" data-action="practice" style="margin-top:24px">Open essay checklist ↗</button>':''}<p class="muted focus-footnote">Audio links follow topics. Known corrections are marked in the notes.</p>`;
}
function scrollActiveTopic(){
 requestAnimationFrame(()=>{const list=$('#topicList'),row=list.querySelector('[aria-current="true"]');if(!row||!list.clientHeight)return;const r=row.getBoundingClientRect(),v=list.getBoundingClientRect();list.scrollTop+=r.top-v.top-(v.height-r.height)/2});
}
async function openStudyMap(){
 if(!D)return;$('.details').classList.remove('open');
 if(compactPanels())$('#sidebar').classList.add('open');else await setDesktopPanel('left',true);
 nav();scrollActiveTopic();
}
async function openVisitPDF(id){
 const c=chapter(id),p=c&&visitPart(c);if(!p)return;
 following=false;$('#follow').checked=false;if(compactPanels())closeStudyPanels();
 const rev=viewRevision+1;await goPage(p.page);if(rev!==viewRevision)return;revealPart(p);setPartForSpan(p);updateReturnToAudio();
}
function playTopicVisit(c){
 if(!c)return;if(reviewMode&&!queueVisits().some(v=>v.id===c.id)){toast('Mark this topic Needs review, or turn off Review mode to play it.');return}
 following=true;$('#follow').checked=true;currentChapter=c.id;resetRepeat();replaySkipId=null;jump(c.start,true);
}
function panel(name,reveal=true){if(!D)return;activePanel=name;$$('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));for(const [key,id] of [['focus','focusPanel'],['transcript','transcriptPanel'],['practice','practicePanel']])$('#'+id).hidden=name!==key;if(compactPanels()){$('#sidebar').classList.remove('open');$('.details').classList.add('open');}else if(reveal&&initializationComplete)setDesktopPanel('right',true);if(name==='transcript')transcript();if(name==='practice')practice()}
function practice(){const e=D.essays.find(e=>e.id===essayID);if(!e)return;const names=e.required_blue_authority_ids.map(id=>authority(id).name);const checklist=[...e.answer_checklist,...names.map(n=>'Include '+n+' and the relevant position.')];$('#practicePanel').innerHTML=`<span class="eyebrow">FIVE ESSAYS · FIVE COMPLETE ANSWERS</span><h2>Put it into words.</h2><select class="essay-selector" id="essaySelect" aria-label="Choose an essay">${D.essays.map(e=>`<option value="${e.id}" ${e.id===essayID?'selected':''}>${e.id.split('-')[1]}. ${esc(e.title)}</option>`).join('')}</select><h3 class="selected-essay-title">${esc(e.title)}</h3><p class="pages-line">Summary 5 · pages ${e.pdf_pages.join(', ')} · ${fmt(e.audio_start)}</p><div class="topic-actions"><button class="action" data-essay-notes="${e.id}">View notes</button><button class="action" data-essay-play="${e.id}">▶ Play review</button></div><h3>Practice your answer</h3><textarea id="practiceAnswer" class="practice-answer" placeholder="Explain the issue, the opinions, and the reasoning in your own words…" aria-label="Practice essay answer">${esc(memory.answers[e.id]||'')}</textarea><div class="practice-save">Saved in this browser as you write.</div><div id="essayReadiness" class="essay-readiness" role="status"></div><h3>Answer checklist</h3><label class="switch"><input id="revealChecklist" type="checkbox" ${memory.reveal?'checked':''}><span></span>Show checklist</label><div id="checklist" ${memory.reveal?'':'hidden'}>${checklist.map((t,i)=>`${i===0?'<h3>Concepts and reasoning</h3>':''}${i===e.answer_checklist.length?'<h3>Required authority names</h3>':''}<label class="check-item"><input type="checkbox" data-check="${e.id}-${i}" ${memory.checks[e.id+'-'+i]?'checked':''}><span>${esc(t)}</span></label>`).join('')}</div><p class="muted" style="line-height:1.8;margin-top:20px">Study outline from the notes and review, not an official grading rubric.${e.additional_audio_guidance?' '+esc(e.additional_audio_guidance):''}</p>`;updateReadiness()}
function transcript(){const q=query.toLowerCase();$('#transcriptRows').innerHTML=D.segments.filter(s=>!q||s.text.toLowerCase().includes(q)).map(s=>`<button class="transcript-row ${s.source==='review_marker'?'unclear':''}" data-transcript="${s.id}"><time>${fmt(s.start)}</time>${mark(s.text,query)}</button>`).join('');updateCue(true)}

let pagesInitialized=false,pageObserver=null,geometryZoom=0,scrollFrame=0,viewRevision=0;
const sheetRenders=new Map();
const paper=()=>document.getElementById('page-'+pageNum);
function initPages(){if(pagesInitialized)return;pagesInitialized=true;$('#overlays').innerHTML=Array.from({length:pdf.numPages},(_,i)=>`<section class="pdf-page" id="page-${i+1}" data-page="${i+1}" aria-label="Summary 5 page ${i+1}"><canvas aria-label="PDF page ${i+1}"></canvas><div class="page-overlays"></div><span class="page-label">${i+1} / ${pdf.numPages}</span></section>`).join('');pageObserver=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)renderSheet(Number(e.target.dataset.page))},{root:$('#pdfScroll'),rootMargin:'500px 0px'});$$('.pdf-page').forEach(p=>pageObserver.observe(p));$('#pdfScroll').addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;const pane=$('#pdfScroll'),r=pane.getBoundingClientRect(),at=r.top+Math.min(100,r.height*.25);const current=$$('.pdf-page').map(p=>{const b=p.getBoundingClientRect();return {p,visible:Math.max(0,Math.min(b.bottom,r.bottom)-Math.max(b.top,r.top))}}).sort((a,b)=>b.visible-a.visible)[0]?.p;if(current){pageNum=Number(current.dataset.page);$('#pageInput').value=pageNum;$('#prevPage').disabled=pageNum===1;$('#nextPage').disabled=pageNum===pdf.numPages}for(const [n,cache] of sheetRenders){if(Math.abs(n-pageNum)>3){cache.task?.cancel();const canvas=$(`#page-${n} canvas`);canvas.width=1;canvas.height=1;sheetRenders.delete(n)}}})},{passive:true})}
function sizePages(){const pane=$('#pdfScroll'),style=getComputedStyle(pane),available=Math.max(240,pane.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight));for(const p of $$('.pdf-page')){const n=Number(p.dataset.page),g=D.pdf_geometry?.find(g=>g.page===n);p.style.width=available*zoom+'px';p.style.height=available*zoom*(g?g.height/g.width:792/612)+'px'}updateZoomControls()}
async function goPage(n){if(!pdf)return;viewRevision++;n=Math.min(pdf.numPages,Math.max(1,Math.round(Number(n)||1)));initPages();sizePages();pageNum=n;$('#pageInput').value=n;$('#prevPage').disabled=n===1;$('#nextPage').disabled=n===pdf.numPages;$('#follow').checked=following;$('#pdfScroll').scrollTo({top:document.getElementById('page-'+n).offsetTop,behavior:'instant'});await renderSheet(n);$('#pdfMessage').hidden=true;overlays(n)}
async function renderPDF(){if(!pdf)return;initPages();sizePages();const key=zoom.toFixed(3);if(geometryZoom!==key){geometryZoom=key;for(const cache of sheetRenders.values())cache.task?.cancel();sheetRenders.clear()}const r=$('#pdfScroll').getBoundingClientRect();const visible=$$('.pdf-page').filter(p=>{const b=p.getBoundingClientRect();return b.bottom>r.top-400&&b.top<r.bottom+400}).map(p=>Number(p.dataset.page));await Promise.all([...new Set([...visible,pageNum])].map(renderSheet));$('#pdfMessage').hidden=true;overlays()}
async function renderSheet(n){if(!pdf||!pagesInitialized||pinch)return;const key=zoom.toFixed(3)+'-'+document.getElementById('page-'+n).clientWidth;if(sheetRenders.get(n)?.key===key)return sheetRenders.get(n).promise;sheetRenders.get(n)?.task?.cancel();const cache={key,task:null,promise:null};sheetRenders.set(n,cache);cache.promise=(async()=>{try{const pg=await pdf.getPage(n);if(sheetRenders.get(n)!==cache)return;const sheet=document.getElementById('page-'+n),canvas=sheet.querySelector('canvas'),viewport=pg.getViewport({scale:sheet.clientWidth/pg.getViewport({scale:1}).width}),dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(viewport.width*dpr);canvas.height=Math.round(viewport.height*dpr);cache.task=pg.render({canvasContext:canvas.getContext('2d'),viewport,transform:dpr===1?null:[dpr,0,0,dpr,0,0]});await cache.task.promise;cache.task=null;overlays(n)}catch(e){if(e.name!=='RenderingCancelledException'){sheetRenders.delete(n);console.error(e);toast('A PDF page could not render. Try changing zoom or refreshing.')}}})();return cache.promise}
function overlays(onlyPage){if(!D||!pagesInitialized)return;const ids=selectedSections();for(const sheet of $$('.pdf-page')){const n=Number(sheet.dataset.page);if(onlyPage&&n!==onlyPage)continue;const highlighted=D.highlight_spans.filter(s=>s.page===n&&s.study_section_id);sheet.querySelector('.page-overlays').innerHTML=highlighted.filter(s=>!s.note_correction_id).map(s=>{const b=s.bbox;return `<button class="pdf-highlight ${s.supplemental_highlight?'supplemental-'+s.color:''} ${ids.includes(s.study_section_id)?'selected':''} ${s.authority_ids.length?'authority':''}" style="left:${b[0]*100}%;top:${b[1]*100}%;width:${(b[2]-b[0])*100}%;height:${(b[3]-b[1])*100}%" data-highlight="${s.id}" aria-label="${esc((s.test_kind==='essay'?'Essay: ':'Multiple choice: ')+s.text)}" title="${esc(s.authority_ids.length?s.authority_ids.map(id=>authority(id).name).join(', '):s.section_title)}"></button>`}).join('')+pageCorrectionMarkup(n);const selectedSpans=highlighted.filter(s=>ids.includes(s.study_section_id));for(const col of [0,1]){const spans=selectedSpans.filter(s=>s.column===col);if(!spans.length)continue;const top=Math.min(...spans.map(s=>s.bbox[1])),bottom=Math.max(...spans.map(s=>s.bbox[3]));sheet.querySelector('.page-overlays').insertAdjacentHTML('beforeend',`<span class="focus-margin" style="left:${col===0?5.2:51}%;top:${top*100}%;height:${(bottom-top)*100}%"></span>`)}}}
function revealPart(p,{vertical=true}={}){
 const pane=$('#pdfScroll'),sheet=$('#page-'+p.page),r=sheet.getBoundingClientRect(),v=pane.getBoundingClientRect();
 // Include the margin marker and column's leading edge, even for indented list text.
 const left=pane.scrollLeft+r.left-v.left+Math.min(p.bbox[0],p.column===0?.052:.51)*r.width,right=pane.scrollLeft+r.left-v.left+p.bbox[2]*r.width;
 readingColumn=null;
 pane.scrollTo({left:horizontalTarget(left,right,pane.scrollLeft,pane.clientWidth,pane.scrollWidth),top:vertical?Math.max(0,pane.scrollTop+r.top-v.top+p.bbox[1]*r.height-24):pane.scrollTop,behavior:'instant'});
 updateZoomControls();
}
function scrollHighlight(focusSection){
 const ids=focusSection?[focusSection]:selectedSections();
 const p=passageParts(D.highlight_spans.filter(s=>ids.includes(s.study_section_id)&&s.page===pageNum))[0];
 if(p)revealPart(p);
}
function revealFollowingHorizontally(){
 if(!following||!currentChapter||!pagesInitialized)return;
 const c=chapter(currentChapter),id=c?.primary_study_section_id||c?.study_section_ids?.[0],pane=$('#pdfScroll').getBoundingClientRect();
 const candidates=passageParts(D.highlight_spans.filter(s=>s.study_section_id===id&&s.page===pageNum));
 const p=candidates.find(p=>{const r=spanRect(p);return r.bottom>pane.top&&r.top<pane.bottom});
 if(p)revealPart(p,{vertical:false});
}
function globalTime(){return player?.time()||0}
function resetRepeat(){loopRange=null;$('#loop').setAttribute('aria-pressed','false')}
function jump(t,play=false){if(!player)return;reviewComplete=false;if(reviewMode){const ranges=queueRanges(),at=reviewPosition(ranges,t);if(!at){if(!ranges.length){player.pause();return}t=ranges.at(-1).end-.001;play=false;reviewComplete=true}else t=at.time;}if(loopRange&&(t<loopRange.start-.1||t>=loopRange.end))resetRepeat();if(replaySkipId){const r=skipIntervals.find(x=>x.id===replaySkipId);if(!r||t<r.start-.1||t>=r.end)replaySkipId=null}player.seek(t,play);tick();rememberSession()}
function queueVisits(){return D?reviewVisits([...D.study_sections,...D.essays],D.chapters,memory.review):[]}
function queueRanges(){return reviewRanges(queueVisits(),memory.skipOfftopic===true&&!loopRange?skipIntervals:[])}
function updateReviewSummary(){if(!D)return;const visits=queueVisits(),marked=allItems().filter(x=>memory.review[x.id]),noAudio=marked.filter(x=>!x.audio_chapter_ids.length).length;$('#reviewSummary').textContent=visits.length+' linked visits · '+marked.length+' marked topics'+(noAudio?' · '+noAudio+' notes-only':'');$('#reviewMode').checked=reviewMode;document.body.classList.toggle('review-mode',reviewMode);$('#reviewBadge').hidden=!reviewMode;$('#reviewBadge').textContent='Review mode'}
function setReviewMode(on){
 if(on&&!queueVisits().length){$('#reviewMode').checked=false;toast('Mark a topic with linked audio as Needs review first.');return}
 reviewMode=on;reviewComplete=false;memory.reviewMode=on;persist();resetRepeat();replaySkipId=null;clearTimeout(reviewTimer);updateReviewSummary();
 if(on)refreshReviewQueue();toast(on?'Review mode: marked topics only, in audio order.':'Review mode is off.');
}
function refreshReviewQueue(){
 if(!reviewMode)return;const ranges=queueRanges();
 if(!ranges.length){player.pause();setReviewMode(false);toast('No marked audio remains. Review mode is off.');return}
 const at=reviewPosition(ranges,globalTime());if(!at||at.time!==globalTime())jump(at?.time??ranges[0].start,player.playing);else tick();
}
function safePlay(){
 if(!player)return;if(reviewMode){const ranges=queueRanges();if(!ranges.length){toast('No playable marked topics.');return}if(reviewComplete){jump(ranges[0].start,true);return}const at=reviewPosition(ranges,globalTime());if(!at||at.time!==globalTime()){jump(at?.time??ranges[0].start,true);return}}
 player.play();tick();
}
function advanceReview(t){
 clearTimeout(reviewTimer);if(!reviewMode||!player.playing||player.pending!==null)return false;
 const ranges=queueRanges(),at=reviewPosition(ranges,t);
 if(!at){player.pause();if(ranges.length)player.seek(ranges.at(-1).end-.001,false);reviewComplete=true;tick();toast('Review complete. Press play to review these topics again.');return true}
 if(at.time!==t){jump(at.time,true);return true}
 reviewTimer=setTimeout(tick,Math.max(20,Math.ceil((at.range.end-t)/audio.playbackRate*1000)+10));return false;
}
audio.addEventListener('pause',()=>clearTimeout(reviewTimer));
audio.addEventListener('ratechange',()=>{if(initializationComplete)tick()});
function updatePlayControls(){const playing=player?.playing??false;for(const b of [$('#play'),$('#miniPlay')]){const label=playing?'Pause audio':'Play audio';if(b.getAttribute('aria-label')!==label||!b.firstElementChild){b.innerHTML=svg(playing?'pause':'play');b.setAttribute('aria-label',label);b.title=label}}updatePlayerVisibility();updateMiniPlayer()}
audio.addEventListener('loadedmetadata',()=>{$('#audioStatus').textContent='';tick()});
audio.addEventListener('ended',()=>{if(loopRange&&D.audio_chunks[player.index].end>=loopRange.end){jump(loopRange.start,true);return}if(player.index<D.audio_chunks.length-1)jump(D.audio_chunks[player.index+1].start,true);else {player.pause();tick()}});
audio.addEventListener('timeupdate',tick);audio.addEventListener('waiting',()=>$('#audioStatus').textContent='Buffering…');audio.addEventListener('playing',()=>$('#audioStatus').textContent='');audio.addEventListener('error',()=>{$('#audioStatus').textContent='Audio unavailable. Press play to retry.'});
function tick(){if(!D||!player)return;const t=Math.min(total(),globalTime());if(loopRange&&t>=loopRange.end-.08&&player.playing){jump(loopRange.start,true);return}if(advanceReview(t))return;if(replaySkipId&&t>=(skipIntervals.find(x=>x.id===replaySkipId)?.end??0))replaySkipId=null;const off=skipAt(skipIntervals,t);if(memory.skipOfftopic===true&&player.playing&&player.pending===null&&!loopRange&&off&&off.id!==replaySkipId){lastSkipped=off;$('#replaySkipped').hidden=false;$('#replaySkipped').title=off.label+' · '+fmt(off.start)+'–'+fmt(off.end);toast('Skipped off-topic conversation. Replay it from More.');jump(off.end,true);return}$('#currentTime').textContent=fmt(t);$('#seek').value=t;chapterTimeline?.update(t);updatePlayControls();if(loopRange&&t>=loopRange.end-.08&&player.playing){jump(loopRange.start,true);return}const c=D.chapters.find(c=>t>=c.start&&t<c.end)||D.chapters.at(-1);$('#nowTitle').textContent=c.title;$('#nowPage').textContent=c.pdf_pages.length?'Summary 5 · p. '+c.pdf_pages.join(', '):'Review discussion';if(c.id!==currentChapter){currentChapter=c.id;if(following)followChapter(c)}updateCue()}
function followChapter(c){if(!c)return;const sections=c.study_section_ids||[];if(!sections.length)return;const marked=reviewMode?allItems().find(x=>memory.review[x.id]&&x.audio_chapter_ids.includes(c.id)):null;const sec=section(marked?.study_section_ids?.find(id=>sections.includes(id)))||section(marked?.id)||section(c.primary_study_section_id)||section(sections[0]);const id=marked?.id||sec.essay_id||sec.id;if(selected!==id){selected=id;nav();focus();overlays();if(id.startsWith('essay-')){essayID=id;if(activePanel==='practice')practice()}}const pg=c.preferred_pdf_page||sec.pdf_pages[0],rev=viewRevision+1;goPage(pg).then(()=>{if(rev!==viewRevision||!following)return;scrollHighlight(sec.id);partPinned=false;updatePartPosition();updateReturnToAudio()})}
function updateCue(force=false){if(activePanel!=='transcript')return;const t=globalTime();const s=D.segments.find(s=>t>=s.start&&t<s.end);if(!s)return;if(!force&&currentCue===s.id)return;currentCue=s.id;$$('.transcript-row.current').forEach(e=>e.classList.remove('current'));const row=$(`[data-transcript="${s.id}"]`);if(row){row.classList.add('current');if($('#followTranscript').checked&&!query)row.scrollIntoView({block:'center',behavior:'instant'})}}
function manualPage(n){partPinned=false;if(!initializationComplete){queuedPage=n;return}following=false;$('#follow').checked=false;goPage(n)}
$('#topicList').addEventListener('click',e=>{const b=e.target.closest('[data-topic]');if(b){following=false;$('#follow').checked=false;selectTopic(b.dataset.topic);}const s=e.target.closest('[data-segment]');if(s){$('#search').blur();$('#sidebar').classList.remove('open');const seg=D.segments.find(x=>x.id===s.dataset.segment);jump(seg.start,true);panel('transcript')}});
$('#focusPanel').addEventListener('click',e=>{
 const a=e.target.closest('[data-action]');
 if(a){const action=a.dataset.action;
  if(action==='show-map'){openStudyMap();return}
  if(action==='read-notes'){if(compactPanels())closeStudyPanels();scrollHighlight()}
  const key={save:'saved',studied:'studied',review:'review'}[action];
  if(key){memory[key][selected]=!memory[key][selected];persist();nav();focus();$('#focusPanel [data-action="'+action+'"]').focus({preventScroll:true});updateReviewSummary();if(reviewMode)refreshReviewQueue();toast((memory[key][selected]?'Added: ':'Removed: ')+{save:'Bookmark',studied:'Studied',review:'Needs review'}[action])}
  if(action==='practice'){essayID=selected;panel('practice')}
 }
 const v=e.target.closest('[data-visit]');if(v)playTopicVisit(chapter(v.dataset.visit));
 const p=e.target.closest('[data-visit-pdf]');if(p)openVisitPDF(p.dataset.visitPdf);
 const n=e.target.closest('[data-name]');if(n){const a=authority(n.dataset.name),m=a.audio_mentions.find(m=>selectedChapters().includes(m.chapter_id));if(m){jump(m.start,true);panel('transcript')}else toast(`${a.name}: required by the notes; no confident audio mention in this topic.`)}
});
$('#overlays').addEventListener('click',e=>{
 const b=e.target.closest('[data-highlight]');if(!b)return;const span=D.highlight_spans.find(s=>s.id===b.dataset.highlight);
 selectTopic(span.essay_id||span.study_section_id,{scroll:false,openPanel:false});setPartForSpan(span);
 const skips=memory.skipOfftopic===true?skipIntervals:[],visits=rankedVisits(span,D.chapters).filter(c=>passageEntry(c,skips)!==null);
 if(!visits.length){toast('Notes-only passage: no confident audio match.');return}
 // Keep the clicked segment in view; Follow resumes at the next audio topic.
 const c=visits[0];if(reviewMode&&!queueVisits().some(v=>v.id===c.id)){toast('Mark this topic Needs review, or turn off Review mode to play it.');return}currentChapter=c.id;resetRepeat();replaySkipId=null;jump(passageEntry(c,skips),true);
 toast(visits.length>1?'Playing the closest match. '+(visits.length-1)+' other audio visit'+(visits.length>2?'s are':' is')+' available in Focus.':'Playing the linked review passage.',5000);
 updateReturnToAudio();
});
$$('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;$$('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));nav()});
$$('[data-panel]').forEach(b=>b.onclick=()=>panel(b.dataset.panel));$('#search').oninput=e=>{query=e.target.value.trim();nav();if(activePanel==='transcript')transcript()};$('#clearSearch').onclick=()=>{$('#search').value='';query='';nav();if(activePanel==='transcript')transcript()};$('#transcriptRows').onclick=e=>{const b=e.target.closest('[data-transcript]');if(b)jump(D.segments.find(s=>s.id===b.dataset.transcript).start,true)};
$('#practicePanel').addEventListener('change',e=>{if(e.target.id==='essaySelect'){essayID=e.target.value;practice()}if(e.target.id==='revealChecklist'){memory.reveal=e.target.checked;$('#checklist').hidden=!e.target.checked;persist()}if(e.target.dataset.check){memory.checks[e.target.dataset.check]=e.target.checked;persist();updateReadiness()}});$('#practicePanel').addEventListener('input',e=>{if(e.target.id==='practiceAnswer'){memory.answers[essayID]=e.target.value;persist()}});$('#practicePanel').addEventListener('click',e=>{const n=e.target.closest('[data-essay-notes]');if(n){following=false;$('#follow').checked=false;selectTopic(n.dataset.essayNotes,{openPanel:false})}const p=e.target.closest('[data-essay-play]');if(p){const x=D.essays.find(x=>x.id===p.dataset.essayPlay);following=true;$('#follow').checked=true;jump(x.audio_start,true);followChapter(chapter(x.audio_chapter_ids.find(id=>chapter(id).kind==='essay')||x.audio_chapter_ids[0]))}});
$('#play').onclick=$('#miniPlay').onclick=()=>{if(player?.playing)player.pause();else safePlay()};$('#rewind').onclick=$('#miniRewind').onclick=()=>jump(globalTime()-10,player?.playing??false);$('#forward').onclick=()=>jump(globalTime()+10,player?.playing??false);$('#seek').oninput=e=>jump(Number(e.target.value),player?.playing??false);$('#rate').onchange=e=>{memory.playbackRate=normalizePlaybackRate(e.target.value);$('#rate').value=String(memory.playbackRate);player?.setRate(memory.playbackRate);if(initializationComplete)rememberSession();else persist()};
$('#loop').onclick=()=>{if(!D)return;if(loopRange?.mode==='topic'){loopRange=null}else{const c=chapter(currentChapter);if(!c)return;loopRange={start:c.start,end:c.end,mode:'topic'};toast('Repeating: '+c.title)}$('#loop').setAttribute('aria-pressed',String(!!loopRange))};
function navigateAudio(direction){
 if(!D||!currentChapter)return;const skips=memory.skipOfftopic===true?skipIntervals:[],time=globalTime();
 const visits=reviewMode?queueVisits():D.chapters.filter(c=>c.study_section_ids?.length);
 const current=D.chapters.find(c=>time>=c.start&&time<c.end)||chapter(currentChapter);
 const target=direction<0?previousPassage(visits,time,skips):reviewMode?adjacentReviewVisit(visits,time,direction,skips):adjacentPassage(D.chapters,current.id,direction,skips);
 if(!target){toast(direction<0?'You are at the first review passage.':'You are at the last review passage.');return}
 resetRepeat();replaySkipId=null;jump(target.time,player?.playing??false);
}
$('#prevTopic').onclick=$('#miniPrev').onclick=()=>navigateAudio(-1);$('#nextTopic').onclick=$('#miniNext').onclick=()=>navigateAudio(1);
$$('[data-sort]').forEach(b=>b.onclick=()=>{memory.topicSort=b.dataset.sort;persist();nav();scrollActiveTopic()});
$('#prevPage').onclick=()=>manualPage(pageNum-1);$('#nextPage').onclick=()=>manualPage(pageNum+1);$('#pageInput').onchange=e=>manualPage(e.target.value);$('#zoomIn').onclick=()=>changeZoom(zoom+.25);$('#zoomOut').onclick=()=>changeZoom(zoom-.25);$('#fit').onclick=()=>changeZoom(1);$('#follow').onchange=e=>{following=e.target.checked;if(following)followChapter(chapter(currentChapter));else updateReturnToAudio()};$('#backCurrent').onclick=()=>{following=true;$('#follow').checked=true;followChapter(chapter(currentChapter))};$('#help').onclick=()=>$('#helpDialog').showModal();$('#closeHelp').onclick=()=>$('#helpDialog').close();$('#helpDialog').onclick=e=>{if(e.target===e.currentTarget)e.currentTarget.close()};$('#menu').onclick=()=>{if($('#sidebar').classList.contains('open'))closeStudyPanels();else openStudyMap()};
$('#detailsToggle').onclick=()=>{if($('.details').classList.contains('open'))$('.details').classList.remove('open');else {$('#sidebar').classList.remove('open');panel(activePanel)}};const close=document.createElement('button');close.className='icon panel-close mobile';close.textContent='×';close.setAttribute('aria-label','Close study panel');close.onclick=()=>$('.details').classList.remove('open');$('.details').append(close);
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||$('#helpDialog').open||$('#moreDialog').open)return;if(e.code==='Space'&&!e.target.closest('button,a')){e.preventDefault();$('#play').click()}if(e.key==='ArrowLeft'){e.preventDefault();$('#rewind').click()}if(e.key==='ArrowRight'){e.preventDefault();$('#forward').click()}if(e.key==='/'){e.preventDefault();openStudyMap().then(()=>$('#search').focus())}if(e.key.toLowerCase()==='f'){$('#follow').checked=!following;$('#follow').dispatchEvent(new Event('change'))}if(e.key.toLowerCase()==='t')panel('transcript')});
let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(async()=>{if(!pdf||!pagesInitialized)return;const rev=viewRevision,r=$('#pdfScroll').getBoundingClientRect(),anchor=anchorAt(r.left+30,r.top+30);await renderPDF();if(rev===viewRevision){keepAnchor(anchor);if(readingColumn){const target=document.getElementById('page-'+anchor.page);$('#pdfScroll').scrollLeft=target.offsetLeft+target.clientWidth*(readingColumn==='left'?.065:.525)-10}revealFollowingHorizontally()}},150)}).observe($('#pdfScroll'));

const shapes={bookmark:'<path d="M6 4h12v17l-6-4-6 4z"/>',check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',flag:'<path d="M5 21V4m0 0c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',document:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/>',repeat:'<path d="M20 7H7a4 4 0 0 0-4 4M20 7l-4-4m4 4-4 4M4 17h13a4 4 0 0 0 4-4M4 17l4 4m-4-4 4-4"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',panel:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M14 4v16M6 8h5M6 12h5"/>',left:'<path d="m14 6-6 6 6 6"/>',right:'<path d="m10 6 6 6-6 6"/>',minus:'<path d="M5 12h14"/>',plus:'<path d="M5 12h14M12 5v14"/>',play:'<path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none"/>',pause:'<path d="M8 5v14M16 5v14" stroke-width="4"/>',back:'<path d="M5 8a8 8 0 1 1-1 8M5 3v5h5"/>',forward:'<path d="M19 8a8 8 0 1 0 1 8M19 3v5h-5"/>',prev:'<path d="M6 5v14m12-14-9 7 9 7z"/>',next:'<path d="M18 5v14M6 5l9 7-9 7z"/>',down:'<path d="m6 9 6 6 6-6"/>',up:'<path d="m6 15 6-6 6 6"/>',expand:'<path d="M9 3H3v6m12-6h6v6M9 21H3v-6m12 6h6v-6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',columnLeft:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M6 8h3M6 12h3M6 16h3"/>',columnRight:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M15 8h3M15 12h3M15 16h3"/>'};
function svg(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name]}</svg>`}
for(const [id,name] of Object.entries({menu:'menu',detailsToggle:'panel',prevPage:'left',nextPage:'right',zoomOut:'minus',zoomIn:'plus',readLeft:'columnLeft',readRight:'columnRight',prevTopic:'prev',nextTopic:'next',loop:'repeat',closeMore:'close',play:'play',hidePlayer:'down',miniPlay:'play',miniPrev:'prev',miniNext:'next',expandPlayer:'up'}))$('#'+id).innerHTML=svg(name);
function skipIcon(forward=false){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g ${forward?'transform="translate(24 0) scale(-1 1)"':''}><path d="M6.34 6.34A8 8 0 1 1 4 12M6.34 2.5v3.84h3.84"/></g><text x="12" y="12" dy=".35em" text-anchor="middle" fill="currentColor" stroke="none" font-family="Arial, sans-serif" font-size="7.3" font-weight="700">10</text></svg>`}$('#rewind').innerHTML=skipIcon();$('#forward').innerHTML=skipIcon(true);close.innerHTML=svg('close');

$('#miniRewind').innerHTML=skipIcon();
const floatingPlayer=createFloatingPlayer({elements:[$('#miniPlayer')],position:memory.floatingPlayerPosition,onPositionChange:position=>{memory.floatingPlayerPosition=position;persist()}});
function updatePlayerVisibility(){
 $('#fullPlayer').hidden=playerHidden;$('#miniPlayer').hidden=!playerHidden;
 floatingPlayer.layout();
}
function updateMiniPlayer(){
 if(!playerHidden||!player||!D)return;
 const time=globalTime(),c=D.chapters.find(c=>time>=c.start&&time<c.end)||D.chapters.at(-1);
 $('#miniTitle').textContent=c?.title||'Review audio';$('#miniTitle').title=c?.title||'Review audio';
 $('#miniTime').textContent=player.playing&&audio.readyState<3?'Loading audio…':fmt(time)+' · '+player.rate+'×';
 $('#miniPlayer').title=$('#miniTitle').textContent+' · '+$('#miniTime').textContent;
}
function setMiniCollapsed(collapsed,{save=true}={}){
 miniCollapsed=collapsed;$('#miniPlayer').classList.toggle('collapsed',collapsed);
 $$('#miniPlayer .mini-extra').forEach(button=>{button.hidden=collapsed});
 const label=collapsed?'Expand mini player':'Collapse mini player',handle=$('#miniHandle');
 handle.innerHTML=svg(collapsed?'left':'right');handle.setAttribute('aria-label',label);handle.setAttribute('aria-expanded',String(!collapsed));handle.title=label+' · Drag to move';
 if(save){memory.miniCollapsed=collapsed;persist()}
 floatingPlayer.layout();
}
function setPlayerHidden(hidden,{save=true,focus=true}={}){
 playerHidden=hidden;document.body.classList.toggle('player-hidden',hidden);
 if(save){memory.playerHidden=hidden;persist()}
 $('#chapterTooltip').hidden=true;if($('#moreDialog').open)$('#moreDialog').close();
 updatePlayerVisibility();updateMiniPlayer();
 if(focus)(hidden?$('#miniPlay'):$('#play')).focus({preventScroll:true});
}
$('#hidePlayer').onclick=$('#hidePlayerOption').onclick=()=>setPlayerHidden(true);
$('#expandPlayer').onclick=()=>setPlayerHidden(false);
$('#miniHandle').onclick=()=>setMiniCollapsed(!miniCollapsed);
setMiniCollapsed(miniCollapsed,{save:false});
setPlayerHidden(playerHidden,{save:false,focus:false});

let readingColumn=null,pinch=null,lastTap=null,suppressTapUntil=0;
function updateZoomControls(){
 $('#fit').setAttribute('aria-pressed',String(zoom===1));$('#fit').title='Fit page · current zoom '+Math.round(zoom*100)+'%';
 $('#readLeft').setAttribute('aria-pressed',String(readingColumn==='left'));$('#readRight').setAttribute('aria-pressed',String(readingColumn==='right'));
 $('#zoomOut').disabled=zoom<=.75;$('#zoomIn').disabled=zoom>=3.5;updateReturnToAudio();
}
function anchorAt(x,y){const r=paper().getBoundingClientRect();return {page:pageNum,x,y,fx:(x-r.left)/r.width,fy:(y-r.top)/r.height}}
function keepAnchor(a){const pane=$('#pdfScroll'),r=document.getElementById('page-'+a.page).getBoundingClientRect();pane.scrollLeft+=r.left+a.fx*r.width-a.x;pane.scrollTop+=r.top+a.fy*r.height-a.y}
async function changeZoom(value,point){if(!pdf)return;viewRevision++;readingColumn=null;const r=$('#pdfScroll').getBoundingClientRect();const anchor=anchorAt(point?.x??(r.left+r.width/2),point?.y??(r.top+Math.min(r.height/2,180)));zoom=Math.max(.75,Math.min(3.5,value));await renderPDF();keepAnchor(anchor);revealFollowingHorizontally();updateZoomControls()}
async function readColumn(side){if(!pdf)return;viewRevision++;const pane=$('#pdfScroll'),r=pane.getBoundingClientRect(),anchor=anchorAt(r.left+30,r.top+30);readingColumn=side;zoom=2.25;await renderPDF();keepAnchor(anchor);const target=document.getElementById('page-'+anchor.page);pane.scrollLeft=target.offsetLeft+target.clientWidth*(side==='left'?.065:.525)-10;updateZoomControls()}
$('#readLeft').onclick=()=>readColumn('left');$('#readRight').onclick=()=>readColumn('right');
const surface=$('#pdfScroll');
const distance=touches=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
const midpoint=touches=>({x:(touches[0].clientX+touches[1].clientX)/2,y:(touches[0].clientY+touches[1].clientY)/2});
surface.addEventListener('touchstart',event=>{if(event.touches.length===2&&pdf){const mid=midpoint(event.touches);pinch={distance:distance(event.touches),zoom,anchor:anchorAt(mid.x,mid.y),width:paper().clientWidth/zoom,height:paper().clientHeight/zoom};lastTap=null;readingColumn=null;suppressTapUntil=Date.now()+500;event.preventDefault()}},{passive:false});
surface.addEventListener('touchmove',event=>{if(!pinch||event.touches.length!==2)return;event.preventDefault();const mid=midpoint(event.touches);zoom=Math.max(.75,Math.min(3.5,pinch.zoom*distance(event.touches)/pinch.distance));sizePages();pinch.currentAnchor={...pinch.anchor,x:mid.x,y:mid.y};keepAnchor(pinch.currentAnchor);updateZoomControls();suppressTapUntil=Date.now()+500},{passive:false});
function endPinch(){if(!pinch)return false;const anchor=pinch.currentAnchor||pinch.anchor;pinch=null;suppressTapUntil=Date.now()+400;renderPDF().then(()=>{keepAnchor(anchor);revealFollowingHorizontally()});return true}
surface.addEventListener('touchend',event=>{if(pinch){endPinch();return}if(event.changedTouches.length!==1||Date.now()<suppressTapUntil)return;const t=event.changedTouches[0],now=Date.now();if(lastTap&&now-lastTap.time<300&&Math.hypot(t.clientX-lastTap.x,t.clientY-lastTap.y)<25&&!event.target.closest('.pdf-highlight')){event.preventDefault();if(zoom>1.8)changeZoom(1);else{const r=paper().getBoundingClientRect();readColumn(t.clientX<r.left+r.width/2?'left':'right')}lastTap=null;suppressTapUntil=now+400}else lastTap={time:now,x:t.clientX,y:t.clientY}},{passive:false});
surface.addEventListener('touchcancel',endPinch);surface.addEventListener('dblclick',event=>{if(event.target.closest('.pdf-highlight'))return;event.preventDefault();if(zoom>1.8)changeZoom(1);else{const r=paper().getBoundingClientRect();readColumn(event.clientX<r.left+r.width/2?'left':'right')}});
surface.addEventListener('click',event=>{if(Date.now()<suppressTapUntil){event.preventDefault();event.stopPropagation()}},true);
$('#panelBackdrop').onclick=()=>{$('#sidebar').classList.remove('open');$('.details').classList.remove('open')};
const sheetObserver=new MutationObserver(()=>{$('#panelBackdrop').hidden=!($('#sidebar').classList.contains('open')||$('.details').classList.contains('open'))});sheetObserver.observe($('#sidebar'),{attributes:true,attributeFilter:['class']});sheetObserver.observe($('.details'),{attributes:true,attributeFilter:['class']});

try{const response=await fetch('assets/review.json?v=20261015-navigation1');if(!response.ok)throw Error('Study data could not load');D=await response.json();applyNoteCorrections(D);player=createChunkPlayer(audio,D.audio_chunks,total(),updatePlayControls,()=>toast('Press play to start or retry the audio.'));player.setRate(memory.playbackRate);skipIntervals=validatedSkips(D.audio_skip_intervals,total());$('#skipOfftopic').checked=memory.skipOfftopic===true;$('#skipSummary').textContent=skipIntervals.length+' marked asides · '+fmt(skipIntervals.reduce((n,x)=>n+x.end-x.start,0));$('#skipOfftopic').disabled=!skipIntervals.length;$('#seek').max=total();chapterTimeline=createChapterTimeline({chapters:D.chapters,duration:total(),format:fmt});$('#totalTime').textContent=fmt(total());pdf=await pdfjs.getDocument({url:'assets/summary5.pdf',cMapUrl:'vendor/package/cmaps/',cMapPacked:true,standardFontDataUrl:'vendor/package/standard_fonts/',wasmUrl:'vendor/package/wasm/'}).promise;selected=D.study_sections.find(s=>s.audio_chapter_ids.includes('chapter-001'))?.id||D.study_sections[0].id;nav();focus();const resume=memory.session;following=false;zoom=Math.max(.75,Math.min(3.5,Number(resume?.zoom)||1));readingColumn=resume?.column||null;await goPage(resume?.page||3);await jump(resume?.time||0);if(resume?.selected&&item(resume.selected)){selected=resume.selected;nav();focus();overlays()}following=resume?.following??true;$('#follow').checked=following;if(readingColumn)await readColumn(readingColumn);if(resume)toast('Your last study position is restored. Press play when ready.');initializationComplete=true;reviewMode=memory.reviewMode===true&&queueVisits().length>0;updateReviewSummary();await applyStudyLink();rememberSession();if(queuedPage!==null){manualPage(queuedPage);queuedPage=null}panel('focus',false);if(compactPanels())$('.details').classList.remove('open');window.reviewDesk={get state(){return {pageNum,selected,currentChapter,following,loopRange,chunkIndex:player.index,time:globalTime()}},data:D,jump,selectTopic,goPage};}catch(e){console.error(e);$('#pdfMessage').hidden=false;$('#pdfMessage').textContent='Could not open the study desk. Please refresh, or open the original PDF from More.';$('#resultsCount').textContent='Unable to load study material.'}

async function applyStudyLink(){
 const params=new URLSearchParams(location.search),c=chapter(params.get('chapter')),x=item(params.get('topic'));
 if(!c&&!x)return;following=false;$('#follow').checked=false;
 if(c){reviewMode=false;memory.reviewMode=false;persist();updateReviewSummary();jump(c.start,false)}
 const target=x||item(section(c?.primary_study_section_id)?.essay_id)||item(c?.primary_study_section_id);
 if(target){await selectTopic(target.id,{openPanel:false});if(c)await openVisitPDF(c.id)}
 // A fresh chapter link jumps once; refresh should restore subsequent listening progress.
 const url=new URL(location.href);url.searchParams.delete('chapter');url.searchParams.delete('topic');history.replaceState(history.state,'',url.pathname+url.search+url.hash);
}
function nextReview(){const xs=allItems().filter(x=>memory.review[x.id]);if(!xs.length){toast('Mark topics “Needs review” to build your study queue.');return}const index=xs.findIndex(x=>x.id===selected);following=false;$('#follow').checked=false;selectTopic(xs[(index+1)%xs.length].id)}
function updateReadiness(){const e=D.essays.find(e=>e.id===essayID),el=$('#essayReadiness');if(!e||!el)return;const n=e.answer_checklist.length,m=e.required_blue_authority_ids.length;const count=(start,end)=>Array.from({length:end-start},(_,i)=>memory.checks[e.id+'-'+(start+i)]?1:0).reduce((a,b)=>a+b,0);const a=count(0,n),b=count(n,n+m);el.innerHTML=`<strong>${a+b} / ${n+m} checked</strong><progress max="${n+m}" value="${a+b}" aria-label="Essay checklist progress"></progress><span>Concepts ${a}/${n} · ${m?'Authority names '+b+'/'+m:'No required blue names'}</span>`}
function rememberSession(){if(!initializationComplete||!player)return;memory.session={time:globalTime(),page:pageNum,zoom,column:readingColumn,selected,following};lastSessionSave=Date.now();persist()}
// Save seeks immediately and active progress at most once per second; idle tabs must not keep overwriting it.
audio.addEventListener('timeupdate',()=>{if(player?.playing&&Date.now()-lastSessionSave>=1000)rememberSession()});audio.addEventListener('seeked',rememberSession);window.addEventListener('pagehide',rememberSession);document.addEventListener('visibilitychange',()=>{if(document.hidden)rememberSession()});audio.addEventListener('pause',rememberSession);

function closeStudyPanels(){$('#sidebar').classList.remove('open');$('.details').classList.remove('open');$('#menu').setAttribute('aria-expanded','false');$('#search').blur()}
const navClose=document.createElement('button');navClose.className='icon nav-close mobile';navClose.setAttribute('aria-label','Close topic picker');navClose.innerHTML=svg('close');navClose.onclick=closeStudyPanels;$('#sidebar').append(navClose);
$('#menu').setAttribute('aria-controls','sidebar');$('#menu').setAttribute('aria-expanded','false');new MutationObserver(()=>{$('#menu').setAttribute('aria-expanded',String($('#sidebar').classList.contains('open')))}).observe($('#sidebar'),{attributes:true,attributeFilter:['class']});


$('#reviewMode').onchange=e=>setReviewMode(e.target.checked);updateReviewSummary();
$('#skipOfftopic').onchange=e=>{memory.skipOfftopic=e.target.checked;replaySkipId=null;persist();toast(e.target.checked?'Off-topic skipping is on. Repeat playback keeps the full passage.':'Off-topic skipping is off.');tick()};
$('#replaySkipped').onclick=()=>{if(!lastSkipped)return;if(reviewMode){toast('Turn off Review mode to replay this aside in full.');return}replaySkipId=lastSkipped.id;loopRange=null;$('#loop').setAttribute('aria-pressed','false');jump(lastSkipped.start,true);toast('Replaying the skipped passage in full.');};
// Safari's visual viewport shrinks independently when the on-screen keyboard opens.
function fitVisiblePanels(){const v=window.visualViewport;document.documentElement.style.setProperty('--visible-height',(v?.height||window.innerHeight)+'px');document.documentElement.style.setProperty('--visible-top',(v?.offsetTop||0)+'px')}
window.visualViewport?.addEventListener('resize',fitVisiblePanels);window.visualViewport?.addEventListener('scroll',fitVisiblePanels);window.addEventListener('resize',fitVisiblePanels);fitVisiblePanels();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#moreDialog').open&&!$('#helpDialog').open){closeStudyPanels();if(document.body.classList.contains('reading-mode')){e.preventDefault();setReadingMode(false)}}});

// Keep occasional controls in a native dialog: focus stays inside it on phones and keyboards.
const moreDialog=$('#moreDialog');
$('#moreOptions').onclick=()=>{moreDialog.showModal();$('#moreOptions').setAttribute('aria-expanded','true')};
$('#closeMore').onclick=()=>moreDialog.close();
moreDialog.addEventListener('close',()=>$('#moreOptions').setAttribute('aria-expanded','false'));
moreDialog.addEventListener('click',e=>{const r=moreDialog.getBoundingClientRect();if(e.target===moreDialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))moreDialog.close()});
$('#moreHelp').onclick=()=>{moreDialog.close();$('#helpDialog').showModal()};
for(const id of ['replaySkipped','backCurrent'])$('#'+id).addEventListener('click',()=>moreDialog.close());
function updateMoreLabel(){
 const replay=!$('#replaySkipped').hidden;$('#moreLabel').textContent='More';
 $('#moreOptions').setAttribute('aria-label','More audio and reading settings'+(replay?', skipped aside available to replay':''));
}
new MutationObserver(updateMoreLabel).observe($('#replaySkipped'),{attributes:true,attributeFilter:['hidden']});updateMoreLabel();
function placePreferences(){const target=compactPanels()?$('#readingPreferences'):$('#desktopPreferences');if($('#syncbar').parentElement!==target)target.append($('#syncbar'))}
window.addEventListener('resize',placePreferences);placePreferences();
function syncDesktopPanels(){
 const panels=document.body.classList.contains('reading-mode')?readingPanels:desktopPanels;
 for(const [side,label] of [['left','topic navigation'],['right','study panel']]){
  document.body.classList.toggle(side+'-collapsed',!panels[side]);const b=$('#toggle'+(side==='left'?'Left':'Right'));
  b.setAttribute('aria-expanded',String(panels[side]));b.setAttribute('aria-label',(panels[side]?'Hide ':'Show ')+label);b.title=b.getAttribute('aria-label');
  b.innerHTML=svg((side==='left')===panels[side]?'left':'right');
 }
}
async function setDesktopPanel(side,show){
 if((document.body.classList.contains('reading-mode')?readingPanels:desktopPanels)[side]===show)return;
 if(compactPanels())return;const pane=$('#pdfScroll'),old=pane.getBoundingClientRect(),anchor=pagesInitialized?anchorAt(old.left+30,old.top+30):null,rev=++viewRevision;
 const panels=document.body.classList.contains('reading-mode')?readingPanels:desktopPanels;panels[side]=show;syncDesktopPanels();
 memory.panels=desktopPanels;persist();if(pdf){await renderPDF();if(anchor&&rev===viewRevision){const r=pane.getBoundingClientRect();keepAnchor({...anchor,x:r.left+30,y:r.top+30});revealFollowingHorizontally()}}updateReturnToAudio();
}
$('#toggleLeft').onclick=()=>{if($('#toggleLeft').getAttribute('aria-expanded')==='true')setDesktopPanel('left',false);else openStudyMap()};
$('#toggleRight').onclick=()=>setDesktopPanel('right',$('#toggleRight').getAttribute('aria-expanded')!=='true');syncDesktopPanels();
async function setReadingMode(on){
 const pane=$('#pdfScroll'),old=pane.getBoundingClientRect(),anchor=pagesInitialized?anchorAt(old.left+30,old.top+30):null;
 const rev=++viewRevision;closeStudyPanels();moreDialog.close();
 document.body.classList.toggle('reading-mode',on);
 if(on)readingPanels={left:false,right:false};syncDesktopPanels();placePreferences();
 memory.readingMode=on;persist();
 for(const id of ['readingMode','desktopReadingMode','readingModeOption'])$('#'+id).setAttribute('aria-pressed',String(on));
 $('#readingMode').setAttribute('aria-label',on?'Exit reader mode':'Enter reader mode');$('#readingMode').title=on?'Exit reader mode':'Reader mode';$('#readingMode').textContent=on?'×':'⛶';
 $('#readingModeState').textContent=on?'On':'Off';
 if(pdf){await renderPDF();if(anchor&&rev===viewRevision){const r=pane.getBoundingClientRect();keepAnchor({...anchor,x:r.left+30,y:r.top+30});revealFollowingHorizontally()}}
 (compactPanels()?$('#readingMode'):$('#desktopReadingMode')).focus({preventScroll:true});updateReturnToAudio();
}
$('#readingMode').onclick=$('#desktopReadingMode').onclick=()=>setReadingMode(!document.body.classList.contains('reading-mode'));
$('#readingModeOption').onclick=()=>setReadingMode(!document.body.classList.contains('reading-mode'));
if(memory.readingMode===true)await setReadingMode(true);
if(initializationComplete&&window.innerWidth<=900&&!memory.readingHintSeen){toast('Tip: pinch to zoom or use the column icons. Follow audio is in More.',6500);memory.readingHintSeen=true;persist()}

let returnFrame=0;
function updateReturnToAudio(){
 if(!D||!pagesInitialized||!currentChapter){$('#backCurrent').hidden=true;updateReaderContext();return}
 const c=chapter(currentChapter),sec=section(c?.primary_study_section_id)||section(c?.study_section_ids?.[0]);
 if(!sec){$('#backCurrent').hidden=true;updateReaderContext();return}
 const pane=$('#pdfScroll'),p=pane.getBoundingClientRect();
 const spans=D.highlight_spans.filter(s=>s.study_section_id===sec.id);
 const visible=passageVisible(spans.map(spanRect),p);
 $('#backCurrent').hidden=visible||!spans.length;updateReaderContext();
}
function scheduleReturnUpdate(){if(returnFrame)return;returnFrame=requestAnimationFrame(()=>{returnFrame=0;updateReturnToAudio();updatePartPosition()})}
$('#pdfScroll').addEventListener('scroll',scheduleReturnUpdate,{passive:true});window.addEventListener('resize',scheduleReturnUpdate);
new MutationObserver(scheduleReturnUpdate).observe($('#nowTitle'),{childList:true});updateReturnToAudio();

function spanRect(span){const r=$('#page-'+span.page).getBoundingClientRect(),b=span.bbox;return {left:r.left+b[0]*r.width,right:r.left+b[2]*r.width,top:r.top+b[1]*r.height,bottom:r.top+b[3]*r.height}}
function updateReaderContext(){$('#readerContext').hidden=$('#partNav').hidden}
function updatePassageParts(){
 if(!D||!selected)return;if(partSelection!==selected){partSelection=selected;const ids=new Set(item(selected).highlight_ids);parts=passageParts(D.highlight_spans.filter(s=>ids.has(s.id)));partIndex=0;partPinned=true}
 renderPartNavigation();
}
function renderPartNavigation(){
 $('#partNav').hidden=parts.length<2;
 if(parts.length){const p=parts[partIndex];$('#partLabel').innerHTML='Part '+(partIndex+1)+' of '+parts.length+'<small>p. '+p.page+' · '+(p.column===0?'Left':'Right')+'</small>';$('#partNav').setAttribute('aria-label','Parts of '+item(selected).title);$('#prevPart').disabled=partIndex===0;$('#nextPart').disabled=partIndex===parts.length-1}
 updateReaderContext();
}
function updatePartPosition(){
 if(!pagesInitialized||parts.length<2||partPinned)return;const i=visiblePartIndex(parts.map(spanRect),$('#pdfScroll').getBoundingClientRect());if(i>=0&&i!==partIndex){partIndex=i;renderPartNavigation()}
}
function setPartForSpan(s){const i=parts.findIndex(p=>p.page===s.page&&p.column===s.column);if(i>=0){partIndex=i;partPinned=true;renderPartNavigation()}}
async function jumpPart(direction){
 if(parts.length<2)return;partIndex=Math.max(0,Math.min(parts.length-1,partIndex+direction));const p=parts[partIndex];partPinned=true;following=false;$('#follow').checked=false;
 const rev=viewRevision+1;await goPage(p.page);if(rev!==viewRevision)return;revealPart(p);
 updateZoomControls();renderPartNavigation();updateReturnToAudio();
}
$('#prevPart').innerHTML=svg('left');$('#nextPart').innerHTML=svg('right');$('#prevPart').onclick=()=>jumpPart(-1);$('#nextPart').onclick=()=>jumpPart(1);
for(const event of ['wheel','touchstart','keydown'])$('#pdfScroll').addEventListener(event,()=>{partPinned=false},{passive:true});
updatePassageParts();
