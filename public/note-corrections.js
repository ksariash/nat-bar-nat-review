// Corrections supplied by the course owner, kept separate from the source PDF.
const agingCorrection={
  id:'page16-aging-stam-yeinam',page:16,studySection:'study-044',
  highlightIds:['highlight-0672','highlight-0673','highlight-0674','highlight-0675','highlight-0676','highlight-0677'],
  text:'Correction on page 16: Aging Stam Yeinam in your house is ASUR according to the Shulchan Aruch (SA). The original paragraph is incorrect.',
  // PDF points, measured around only the incorrect paragraph in the left column.
  box:[77.5,146.7,290,216.5],pageSize:[612,792]
};
export const noteCorrections=[agingCorrection];

// Page 8's two-line Divrei Malkiel passage belongs to the existing first essay.
// Partition the first line so green and blue never darken each other by overlap.
const divreiMalkielSpans=[
  {id:'highlight-supplied-divrei-malkiel-name',color:'blue',text:'דברי מלכיאל (Divrei Malkiel)',pdf_points:[43.2,273.2,174.1,285.46],authority_ids:['divrei-malkiel'],blue_role:'authority'},
  {id:'highlight-supplied-divrei-malkiel-line1',color:'green',text:'– Relies on the Magen',pdf_points:[174.1,273.2,288,285.46],authority_ids:[],blue_role:null},
  {id:'highlight-supplied-divrei-malkiel-line2',color:'green',text:'Avraham as one factor among others to permit.',pdf_points:[43.2,285.46,254.8,296.2],authority_ids:[],blue_role:null}
];
const addUnique=(list,value)=>{if(!list.includes(value))list.push(value)};

function addDivreiMalkielHighlight(data){
  const section=data.study_sections.find(s=>s.id==='study-017');
  const essay=data.essays.find(e=>e.id==='essay-1');
  const chapter=data.chapters.find(c=>c.id==='chapter-056');
  if(!section||!essay||!chapter)return;
  for(const span of divreiMalkielSpans){
    if(!data.highlight_spans.some(s=>s.id===span.id))data.highlight_spans.push({
      ...span,pdf_points:[...span.pdf_points],authority_ids:[...span.authority_ids],
      page:8,column:0,parent_test_color:'green',font_max:9.96,
      bbox:span.pdf_points.map((n,i)=>n/(i%2?792:612)),
      section_id:'pdf-section-031',section_title:section.title,study_section_id:section.id,
      essay_id:essay.id,test_kind:'essay',audio_chapter_ids:[chapter.id],
      alignment_status:'topic_aligned',match_basis:'Course-owner highlight correction; existing essay topic alignment.',
      supplemental_highlight:true
    });
    for(const owner of [section,essay,chapter])addUnique(owner.highlight_ids,span.id);
  }
  for(const owner of [section,essay])addUnique(owner.required_blue_authority_ids,'divrei-malkiel');
  addUnique(essay.required_blue_authorities,'Divrei Malkiel');
  addUnique(chapter.blue_authority_ids,'divrei-malkiel');
  if(!data.authorities.some(a=>a.id==='divrei-malkiel'))data.authorities.push({
    id:'divrei-malkiel',name:'Divrei Malkiel',pdf_highlight_ids:[divreiMalkielSpans[0].id],
    pdf_pages:[8],required_in_essay_ids:[essay.id],multiple_choice_study_section_ids:[],
    audio_mentions:[],audio_mention_status:'no_confident_word_match'
  });
}

export function applyNoteCorrections(data){
  addDivreiMalkielHighlight(data);
  for(const correction of noteCorrections){
    for(const span of data.highlight_spans){
      if(span.page!==correction.page||!correction.highlightIds.includes(span.id))continue;
      // Retain all original geometry and links for part navigation, but keep the
      // incorrect wording out of the site's search and accessible passage labels.
      span.note_correction_id=correction.id;
      span.text=span.id===correction.highlightIds[0]?correction.text:'';
    }
  }
}

export function pageCorrectionMarkup(page){
  return noteCorrections.filter(c=>c.page===page).map(c=>{
    const [x0,y0,x1,y1]=c.box,[w,h]=c.pageSize;
    return `<button class="pdf-correction" data-highlight="${c.highlightIds[0]}" style="left:${x0/w*100}%;top:${y0/h*100}%;width:${(x1-x0)/w*100}%;height:${(y1-y0)/h*100}%" aria-label="${c.text} Play the linked review passage." title="${c.text}">
      <svg viewBox="0 0 212.5 69.8" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <rect x=".6" y=".6" width="211.3" height="68.6" rx="2" fill="#fff5e9" stroke="#a84e32" stroke-width="1.2"/>
        <g fill="#71351f" font-family="Arial, sans-serif">
          <text x="8" y="12" font-size="7.5" font-weight="700" letter-spacing=".5">CORRECTION · PAGE 16</text>
          <text x="8" y="27" font-size="9.8">Aging Stam Yeinam in your house:</text>
          <text x="8" y="42" font-size="11.5" font-weight="700">ASUR according to SA.</text>
          <text x="8" y="53" font-size="8.5">Shulchan Aruch</text>
          <text x="8" y="64" font-size="7.6">The original paragraph is incorrect.</text>
        </g>
      </svg>
    </button>`;
  }).join('');
}

export function studyCorrectionMarkup(sectionIds){
  return noteCorrections.filter(c=>sectionIds.includes(c.studySection)).map(c=>
    `<aside class="note-correction" aria-label="Correction on page ${c.page}"><strong>Correction · page ${c.page}</strong><p>Aging Stam Yeinam in your house is <b>ASUR</b> according to the Shulchan Aruch (SA). The original paragraph is incorrect.</p></aside>`
  ).join('');
}
