// Corrections supplied by the course owner, kept separate from the source PDF.
const agingCorrection={
  id:'page16-aging-stam-yeinam',page:16,studySection:'study-044',
  highlightIds:['highlight-0672','highlight-0673','highlight-0674','highlight-0675','highlight-0676','highlight-0677'],
  text:'Correction on page 16: Aging Stam Yeinam in your house is ASUR according to the Shulchan Aruch (SA). The original paragraph is incorrect.',
  // PDF points, measured around only the incorrect paragraph in the left column.
  box:[77.5,146.7,290,216.5],pageSize:[612,792]
};
export const noteCorrections=[agingCorrection];

export function applyNoteCorrections(data){
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
