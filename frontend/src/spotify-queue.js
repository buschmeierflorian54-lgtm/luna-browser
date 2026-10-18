export function initQueueDrop({enqueue, toast}) {
 const zone=document.createElement('div');zone.className='music-queue-drop';zone.hidden=true;
 zone.setAttribute('role','status');zone.setAttribute('aria-live','polite');
 zone.innerHTML='<svg viewBox="0 0 32 32" width="38" height="38" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 7h20M5 13h15M5 19h10M23 18v12M17 24h12"/></svg><b>Zur Warteschlange</b><span>Song hier ablegen</span>';
 document.body.append(zone);
 let track=null,busy=false;
 const clear=()=>{track=null;zone.hidden=true;zone.classList.remove('over');document.querySelectorAll('.queue-dragging').forEach(e=>e.classList.remove('queue-dragging'))};
 document.addEventListener('dragstart',e=>{
  const row=e.target.closest('[data-queue-uri]');if(!row||busy)return;
  if(!/^spotify:track:[A-Za-z0-9]{22}$/.test(row.dataset.queueUri))return;
  track={uri:row.dataset.queueUri,title:row.dataset.queueTitle};
  e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData('text/plain',track.uri);
  zone.hidden=false;requestAnimationFrame(()=>row.classList.add('queue-dragging'));
 });
 zone.addEventListener('dragover',e=>{if(!track||busy)return;e.preventDefault();e.dataTransfer.dropEffect='copy';zone.classList.add('over')});
 zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('over')});
 zone.addEventListener('drop',async e=>{
  if(!track||busy)return;e.preventDefault();e.stopPropagation();const song=track;clear();busy=true;
  toast('Wird zur Warteschlange hinzugefügt …');
  try{await enqueue(song.uri,song.title)}catch(error){toast(String(error?.message||error),10000)}finally{busy=false}
 });
 document.addEventListener('dragend',clear);window.addEventListener('blur',clear);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')clear()});
}
