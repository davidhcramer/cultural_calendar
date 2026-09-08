export function mountDiary({DATA,store,userId,userEmail,onCache,signOut,connection}){
const LABELS={global:'Major exhibitions',circuit:'London circuit',collecting:'Studios & collecting',theatre:'Literary theatre'};
const DECISIONS={unreviewed:'Not reviewed',considering:'Considering',will_book_need_date:'Will book, need a date',booked:'Booked',seen:'Seen',would_go_but_cant:'Would go, but can’t',pass:'Pass'};
const DECISION_MARKERS={seen:'✓',will_book_need_date:'→',booked:'▣',considering:'?',would_go_but_cant:'−',pass:'×'};
const STORE='culture-cloud-'+userId;
const DRAFT_STORE=STORE+'-drafts', FILTER_STORE=STORE+'-hide-reviewed', CONSIDERING_STORE=STORE+'-still-considering';
const DAY=86400000;
const parseDate=s=>s?new Date(s+'T12:00:00Z'):null;
const today=new Date(); const todayISO=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(today);
const asOf=todayISO;
const dateFormat=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const fullFormat=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>/^https?:\/\//.test(u||'')?u:'#';
const link=(u,t)=>`<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`;
const events=DATA.calendar.events;
const byId=new Map(events.map(e=>[e.id,e]));
let choices={...DATA.decisions};
const renderedChoices={};
const ARTIST_STORE=STORE+'-artists', ARTIST_DRAFT_STORE=ARTIST_STORE+'-draft';
let artists={...(DATA.artists||{})};
function validArtist(a){return a&&typeof a.name==='string'&&a.name.trim()&&typeof(a.notes??'')==='string'&&typeof(a.url??'')==='string'&&(!a.url||/^https?:\/\//.test(a.url))&&typeof a.following==='boolean'&&typeof a.updated_at==='string';}
function mergeArtists(incoming){for(const [id,a] of Object.entries(incoming||{})){if(validArtist(a)&&(!artists[id]||a.updated_at>=artists[id].updated_at))artists[id]=a;}}

function mergeChoices(incoming){for(const [id,item] of Object.entries(incoming||{})){if(item&&Object.hasOwn(DECISIONS,item.status)&&typeof(item.notes??'')==='string'&&(!choices[id]||(item.updated_at||'')>=(choices[id].updated_at||'')))choices[id]=item;}}
let category='all',view='all',detailEventId=null,hideReviewed=true,stillConsidering=false;
let drafts={};
try{hideReviewed=localStorage.getItem(FILTER_STORE)!=='false';}catch(e){}
try{stillConsidering=localStorage.getItem(CONSIDERING_STORE)==='true';}catch(e){}
try{const savedDrafts=JSON.parse(localStorage.getItem(DRAFT_STORE)||'{}');for(const [id,item] of Object.entries(savedDrafts||{})){if(byId.has(id)&&item&&Object.hasOwn(DECISIONS,item.status)&&typeof item.notes==='string')drafts[id]=item;}}catch(e){}
const isReviewed=e=>choice(e)!=='unreviewed';
function passesReviewFilter(e){if(view==='seen')return choice(e)==='seen';if(view==='booking')return choice(e)==='will_book_need_date';if(stillConsidering)return choice(e)==='considering';if(view==='reviewed')return isReviewed(e);return ['shortlist','archive'].includes(view)||!hideReviewed||!isReviewed(e);}
function saveDrafts(){try{localStorage.setItem(DRAFT_STORE,JSON.stringify(drafts));}catch(e){/* Draft remains available for this session. */}}
const active=e=>!['cancelled','superseded'].includes(e.status)&&(!e.end_date||e.end_date>=asOf);
const choice=e=>choices[e.id]?.status||'unreviewed';
const age=e=>Math.floor((parseDate(asOf)-parseDate(e.verified_on))/DAY);
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
document.getElementById('run-meta').textContent=`Researched ${fullFormat.format(parseDate(DATA.calendar.last_run_on))}. Manual weekly refresh; no background monitoring.`;
const researchAge=Math.floor((parseDate(asOf)-parseDate(DATA.calendar.last_run_on))/DAY);
if(researchAge>7){const b=document.getElementById('stale-banner');b.classList.remove('hidden');b.textContent=`This diary was researched ${researchAge} days ago. Run the weekly refresh before relying on booking details. Past dates are hidden from the forward view.`;}
const monthSet=new Set();
const firstMonth=[asOf.slice(0,7),...events.filter(e=>e.start_date).map(e=>e.start_date.slice(0,7))].sort()[0];
const horizon=new Date(asOf.slice(0,7)+'-01T12:00:00Z');horizon.setUTCMonth(horizon.getUTCMonth()+18);
const lastMonth=[horizon.toISOString().slice(0,7),...events.filter(e=>e.end_date).map(e=>e.end_date.slice(0,7))].sort().at(-1);
for(let d=new Date(firstMonth+'-01T12:00:00Z');d.toISOString().slice(0,7)<=lastMonth;d.setUTCMonth(d.getUTCMonth()+1))monthSet.add(d.toISOString().slice(0,7));
const monthOptions=[...monthSet].sort();
for(const m of monthOptions){const option=document.createElement('option');option.value=m;option.textContent=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(parseDate(m+'-01'));document.getElementById('month').append(option);}
function renderControls(){const reviewExempt=['shortlist','booking','reviewed','archive','seen','artists'].includes(view);document.getElementById('hide-reviewed').checked=hideReviewed;document.getElementById('hide-reviewed').disabled=reviewExempt||stillConsidering;document.getElementById('still-considering').checked=stillConsidering;document.getElementById('still-considering').disabled=['booking','seen'].includes(view);document.getElementById('review-filter-note').textContent=view==='booking'?'Committed to going; choose a date and book.':stillConsidering?'Showing saved decisions marked Considering.':reviewExempt?'This view includes saved decisions.':'Save a decision to clear it from this view.';const cats={all:'All four strands',...LABELS};document.getElementById('category-filters').innerHTML=Object.entries(cats).map(([key,label])=>`<button data-category="${key}" class="${key===category?'active':''}" aria-pressed="${key===category}">${label}<span>${events.filter(e=>(view==='archive'?!active(e):['reviewed','seen'].includes(view)||active(e))&&passesReviewFilter(e)&&(key==='all'||e.category===key)).length}</span></button>`).join('');document.getElementById('view-filters').innerHTML=Object.entries({all:'Forward diary',daily:'Calendar by day',shortlist:'My shortlist',booking:'Choose dates',reviewed:'Reviewed',seen:'Seen / visit notes',artists:'Artists to follow',closing:'Closing within 30 days',new:'New this run',watchlist:'Dates unannounced',archive:'Past / withdrawn'}).map(([key,label])=>`<button data-view="${key}" class="${view===key?'active':''}" aria-pressed="${view===key}">${label}</button>`).join('');}
function range(e){if(!e.start_date)return esc(e.date_note||'Dates unannounced');const a=parseDate(e.start_date),b=parseDate(e.end_date);if(e.start_date===e.end_date)return `<strong>${dateFormat.format(a)}</strong><span>${a.getUTCFullYear()}</span>`;if(e.start_date<asOf&&e.end_date>=asOf)return `<span>On now, until</span><strong>${dateFormat.format(b)}</strong><span>${b.getUTCFullYear()}</span>`;return `<strong>${dateFormat.format(a)}</strong><span>to ${dateFormat.format(b)}</span><span>${a.getUTCFullYear()===b.getUTCFullYear()?a.getUTCFullYear():a.getUTCFullYear()+' / '+b.getUTCFullYear()}</span>`;}
function decisionBadge(status){if(!Object.hasOwn(DECISION_MARKERS,status))return '';return `<span class="decision-badge decision-${status}" data-decision-status="${status}"><span class="decision-icon" aria-hidden="true">${DECISION_MARKERS[status]}</span><span><span class="sr-only">Saved decision: </span>${esc(DECISIONS[status])}</span></span>`;}
function attentionDates(e){
  if(!active(e)||['seen','pass','would_go_but_cant'].includes(choice(e)))return [];
  const dates=[];
  for(const [field,label] of [['action_date',e.action_label||'Booking milestone'],['end_date',e.start_date===e.end_date?'Event date':'Closes']]){
    const date=e[field];
    if(date&&date>=asOf&&parseDate(date)-parseDate(asOf)<=14*DAY)dates.push({date,label});
  }
  return dates.sort((a,b)=>a.date.localeCompare(b.date));
}
function eventHTML(e,attention=[]){const saved=choices[e.id]||{status:'unreviewed',notes:''},state=drafts[e.id]||saved;renderedChoices[e.id]={...saved};let tags=[decisionBadge(saved.status),...attention.map(({date,label})=>`<span class="tag warn"><time datetime="${esc(date)}">${dateFormat.format(parseDate(date))}</time>: ${esc(label)}</span>`),`<span class="tag">${esc(LABELS[e.category])}</span>`];if(e.access_note)tags.push(`<span class="tag warn">${esc(e.access_note)}</span>`);if(e.highlight_start_date)tags.push(`<span class="tag warn">Key works: ${dateFormat.format(parseDate(e.highlight_start_date))}–${dateFormat.format(parseDate(e.highlight_end_date))}</span>`);if(age(e)>14)tags.push(`<span class="tag warn">Checked ${age(e)} days ago</span>`);if(e.status==='watchlist')tags.push('<span class="tag warn">Watchlist</span>');if(['cancelled','superseded'].includes(e.status))tags.push(`<span class="tag warn">${esc(e.status)}</span>`);return `<details class="event" id="event-${e.id}"><summary><div class="event-date">${range(e)}</div><div class="event-heading"><h3>${esc(e.title)}</h3><div class="venue">${esc(e.venue)} · ${esc(e.city)}</div><div class="tags">${tags.join('')}</div></div><div class="priority"><b>${e.priority}</b><span class="word">${{A:'Decide',B:'Consider',C:'Explore'}[e.priority]}</span></div></summary><div class="event-body"><p class="event-overview">${esc(e.overview||e.priority_reason||'')}</p><p><strong>Next step.</strong> ${esc(e.action)}</p>${e.action_date?`<p><strong>${fullFormat.format(parseDate(e.action_date))}:</strong> ${esc(e.action_label)}</p>`:''}<p><strong>Booking.</strong> ${esc(e.booking_status)} ${e.booking_url?link(e.booking_url,'Check official page'):''}</p><p><strong>Cost.</strong> ${esc(e.cost_note)}</p>${e.notes?`<p class="small">${esc(e.notes)}</p>`:''}<p class="source-links">${e.source_urls.map((u,i)=>link(u,`Source ${i+1}`)).join(' · ')}. Checked ${esc(e.verified_on)}.</p><div class="decision"><div><label for="choice-${e.id}">Your decision</label><select id="choice-${e.id}" data-choice="${e.id}">${Object.entries(DECISIONS).map(([k,v])=>`<option value="${k}" ${k===state.status?'selected':''}>${v}</option>`).join('')}</select></div><div><label for="notes-${e.id}">Planning notes</label><textarea id="notes-${e.id}" data-notes="${e.id}" placeholder="A date to try, someone to go with, what caught your eye">${esc(state.notes)}</textarea></div><div class="visit-fields"><label for="visit-date-${e.id}">Date attended (optional)</label><input id="visit-date-${e.id}" type="date" data-visit-date="${e.id}" value="${esc(state.visited_on||'')}" max="${todayISO}"><label for="visit-notes-${e.id}">After your visit</label><textarea id="visit-notes-${e.id}" data-visit-notes="${e.id}" placeholder="What stayed with you? Favourite works, discoveries, things to revisit.">${esc(state.visit_notes||'')}</textarea><p class="small">Mark your decision Seen to find this in Seen / visit notes.</p></div><div class="decision-actions"><button class="decision-save" data-save-choice="${e.id}">Save</button><span class="small" id="draft-status-${e.id}" role="status">${drafts[e.id]?'Unsaved changes. Click Save when ready.':'Choose a decision, add any notes, then Save.'}</span></div></div></div></details>`;}
function filtered(){const term=document.getElementById('search').value.toLocaleLowerCase(),priority=document.getElementById('priority').value,month=document.getElementById('month').value;return events.filter(e=>{if(!passesReviewFilter(e))return false;if(category!=='all'&&e.category!==category)return false;if(priority!=='all'&&e.priority!==priority)return false;if(term&&!JSON.stringify([e.title,e.venue,e.city,e.country,e.overview,e.personal_fit,e.notes,e.tags,choices[e.id]?.notes,choices[e.id]?.visit_notes]).toLocaleLowerCase().includes(term))return false;if(view==='archive'){if(active(e))return false;}else if(!['reviewed','seen'].includes(view)&&!active(e))return false;if(view==='shortlist'&&!['considering','will_book_need_date','booked'].includes(choice(e)))return false;if(view==='closing'&&(!e.end_date||parseDate(e.end_date)-parseDate(asOf)>30*DAY))return false;if(view==='new'&&!DATA.report.new_ids.includes(e.id))return false;if(view==='watchlist'&&e.start_date)return false;if(month!=='all'&&(!e.start_date||e.start_date.slice(0,7)>month||e.end_date.slice(0,7)<month))return false;return true;}).sort((a,b)=>{const aKey=a.start_date?(a.start_date<asOf&&a.end_date>=asOf?'0000':a.start_date):'9999';const bKey=b.start_date?(b.start_date<asOf&&b.end_date>=asOf?'0000':b.start_date):'9999';return aKey.localeCompare(bKey)||a.priority.localeCompare(b.priority)||a.title.localeCompare(b.title);});}
function matchesBasicFilters(e){const term=document.getElementById('search').value.toLocaleLowerCase(),priority=document.getElementById('priority').value;return passesReviewFilter(e)&&(category==='all'||e.category===category)&&(priority==='all'||e.priority===priority)&&(!term||JSON.stringify([e.title,e.venue,e.city,e.country,e.overview,e.personal_fit,e.notes,e.tags,choices[e.id]?.notes,choices[e.id]?.visit_notes]).toLocaleLowerCase().includes(term));}
function occursOn(e,day){
  if(!e.start_date||!e.end_date||['cancelled','superseded'].includes(e.status)||day<e.start_date||day>e.end_date)return false;
  if(Array.isArray(e.excluded_dates)&&e.excluded_dates.includes(day))return false;
  if(Array.isArray(e.occurrence_dates))return e.occurrence_dates.includes(day);
  if(Array.isArray(e.open_weekdays)){const weekday=parseDate(day).getUTCDay()||7;return e.open_weekdays.includes(weekday);}
  return true;
}
function daysInMonth(month){const [y,m]=month.split('-').map(Number);return Array.from({length:new Date(Date.UTC(y,m,0)).getUTCDate()},(_,i)=>month+'-'+String(i+1).padStart(2,'0'));}
function scheduleLabel(e){
  if(e.access_note)return e.access_note;
  if(e.start_date===e.end_date||Array.isArray(e.occurrence_dates))return 'Confirmed event date';
  if(Array.isArray(e.open_weekdays))return e.schedule_note||'Published opening days; check holiday exceptions';
  return e.category==='theatre'?'Run dates only; performance not verified for this day':'Run dates only; check opening hours';
}
function dayEventHTML(e,day){let labels=[scheduleLabel(e)];if(e.start_date===day)labels.push('Run starts');if(e.end_date===day&&e.start_date!==e.end_date)labels.push('Last day of run');if(e.highlight_start_date&&day>=e.highlight_start_date&&day<=e.highlight_end_date)labels.push('Key display window');const badge=decisionBadge(choice(e));return `<li class="day-event"><button data-open-event="${e.id}" aria-label="View ${esc(e.title)} on ${day}">${esc(e.title)}</button><span class="day-priority" title="Priority ${e.priority}">${e.priority}</span><span class="day-meta">${esc(e.venue)} · ${esc(e.city)} · ${esc(LABELS[e.category])}</span><span class="day-labels">${labels.map(esc).join(' · ')}</span>${badge?`<span class="day-decision">${badge}</span>`:''}</li>`;}
function renderDaily(){
  const picker=document.getElementById('month');if(picker.value==='all'||!picker.value)picker.value=asOf.slice(0,7);
  const month=picker.value,days=daysInMonth(month),candidates=events.filter(e=>matchesBasicFilters(e)&&e.start_date&&e.start_date<=days.at(-1)&&e.end_date>=days[0]&&!['cancelled','superseded'].includes(e.status)).sort((a,b)=>a.priority.localeCompare(b.priority)||a.title.localeCompare(b.title));
  const represented=new Set();
  const output=days.map(day=>{const d=parseDate(day),dayEvents=candidates.filter(e=>occursOn(e,day));dayEvents.forEach(e=>represented.add(e.id));return `<section class="calendar-day${[0,6].includes(d.getUTCDay())?' weekend':''}${day===asOf?' today':''}${day<asOf?' is-past':''}" data-day="${day}" aria-label="${fullFormat.format(d)}"><h3 class="day-heading"><time datetime="${day}">${d.getUTCDate()}<small>${new Intl.DateTimeFormat('en-GB',{weekday:'long',timeZone:'UTC'}).format(d)}</small></time>${day===asOf?'<small class="today-label">Today</small>':''}<span class="day-count">${dayEvents.length} ${dayEvents.length===1?'event':'events'}</span></h3>${dayEvents.length?`<ul class="day-items">${dayEvents.map(e=>dayEventHTML(e,day)).join('')}</ul>`:'<p class="no-day-events">No listed events match these filters.</p>'}</section>`;}).join('');
  document.getElementById('calendar-month-title').textContent=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(parseDate(month+'-01'));
  document.getElementById('previous-month').disabled=monthOptions.indexOf(month)<=0;
  document.getElementById('next-month').disabled=monthOptions.indexOf(month)>=monthOptions.length-1;
  document.getElementById('result-count').textContent=`${days.length} days · ${represented.size} distinct ${represented.size===1?'event':'events'} across the month. Open an event for details.`;
  document.getElementById('events').innerHTML=output;
}
function render(){
  document.getElementById('review-feedback').textContent='';
  renderControls();const daily=view==='daily',artistView=view==='artists';
  document.getElementById('artists-panel').hidden=!artistView;
  for(const id of ['event-toolbar','event-review-options','events','result-count'])document.getElementById(id).hidden=artistView;
  document.getElementById('priority').disabled=artistView;
  document.getElementById('category-filters').hidden=artistView;
  document.getElementById('calendar-controls').hidden=!daily;
  document.getElementById('calendar-explanation').hidden=!daily;
  if(artistView){renderArtists();return;}
  if(daily){renderDaily();return;}
  const visible=filtered();
  document.getElementById('result-count').textContent=`${visible.length} ${visible.length===1?'event':'events'} shown. Open an entry for evidence, booking details and your decision.`;
  const attention=['reviewed','archive','seen'].includes(view)?[]:visible.map(e=>({e,dates:attentionDates(e)})).filter(item=>item.dates.length).sort((a,b)=>a.dates[0].date.localeCompare(b.dates[0].date)||a.e.priority.localeCompare(b.e.priority)||a.e.title.localeCompare(b.e.title));
  const attentionIds=new Set(attention.map(item=>item.e.id));
  let group='',out='';
  if(attention.length){
    out='<section class="attention-group" aria-labelledby="attention-title"><h2 class="month" id="attention-title">Dates needing attention</h2><p class="attention-note">Event dates, closings and booking milestones in the next 14 days.</p>';
    out+=attention.map(({e,dates})=>eventHTML(e,dates)).join('')+'</section>';
  }
  for(const e of visible){
    if(attentionIds.has(e.id))continue;
    const g=!e.start_date?'Dates unannounced':e.start_date<asOf&&e.end_date>=asOf?'On now':new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(parseDate(e.start_date));
    if(g!==group){out+=`<h2 class="month">${esc(g)}</h2>`;group=g;}
    out+=eventHTML(e);
  }
  document.getElementById('events').innerHTML=out||'<div class="empty">No events match these filters. Turn off Hide reviewed, open Reviewed, or change the month and search.</div>';
}
function showEvent(id){const e=byId.get(id);if(!e)return;detailEventId=id;document.getElementById('event-dialog-body').innerHTML=eventHTML(e).replace('<details class="event"','<details open class="event"');const dialog=document.getElementById('event-dialog');if(!dialog.open)dialog.showModal();}
document.getElementById('close-event-dialog').onclick=()=>document.getElementById('event-dialog').close();
document.getElementById('event-dialog').addEventListener('close',()=>{detailEventId=null;document.getElementById('event-dialog-body').innerHTML='';});
document.addEventListener('click',event=>{const c=event.target.closest('[data-category]'),v=event.target.closest('[data-view]'),detail=event.target.closest('[data-open-event]'),save=event.target.closest('[data-save-choice]');if(save){commitChoice(save.dataset.saveChoice);return;}if(c){category=c.dataset.category;render();}if(v){view=v.dataset.view;if(['booking','seen'].includes(view)){stillConsidering=false;try{localStorage.setItem(CONSIDERING_STORE,'false');}catch(e){}}if(['watchlist','reviewed','booking','seen'].includes(view))document.getElementById('month').value='all';render();}if(detail)showEvent(detail.dataset.openEvent);});
for(const id of ['search','month','priority'])document.getElementById(id).addEventListener(id==='search'?'input':'change',render);
function stepMonth(step){const picker=document.getElementById('month'),i=monthOptions.indexOf(picker.value);if(monthOptions[i+step]){picker.value=monthOptions[i+step];render();}}
document.getElementById('previous-month').onclick=()=>stepMonth(-1);
document.getElementById('next-month').onclick=()=>stepMonth(1);
function draftChoice(event){
  const id=event.target.dataset.choice||event.target.dataset.notes||event.target.dataset.visitDate||event.target.dataset.visitNotes;if(!id||!byId.has(id))return;
  const saved=renderedChoices[id]||choices[id]||{status:'unreviewed',notes:''};
  const draft={...(drafts[id]||saved),base_updated_at:saved.updated_at||'',base_version:drafts[id]?.base_version??saved.version??0};
  if(event.target.dataset.choice){if(!Object.hasOwn(DECISIONS,event.target.value))return;draft.status=event.target.value;}else if(event.target.dataset.visitDate)draft.visited_on=event.target.value;else if(event.target.dataset.visitNotes)draft.visit_notes=event.target.value;else draft.notes=event.target.value;
  drafts[id]=draft;saveDrafts();
  document.getElementById('draft-status-'+id).textContent='Unsaved changes. Click Save when ready.';
}
const pendingChoices=new Set();
async function commitChoice(id){
  if(!byId.has(id)||pendingChoices.has(id))return false;
  const old=choices[id],draft=drafts[id]||renderedChoices[id]||old||{status:'unreviewed',notes:''};
  const next={...draft,status:draft.status,notes:draft.notes||''};
  const status=document.getElementById('draft-status-'+id);
  if(next.visited_on&&next.visited_on>todayISO){status.textContent='Choose an attendance date no later than today.';return false;}
  if(!navigator.onLine){status.textContent='Offline. Your draft is kept on this device. Save when connected.';return false;}
  pendingChoices.add(id);status.textContent='Saving…';
  try{
    const saved=await store.save('decision',id,next,draft.base_version??draft.version??0);
    choices[id]=saved;
    if(drafts[id]===draft){delete drafts[id];}else if(drafts[id]){drafts[id].base_version=saved.version;drafts[id].base_updated_at=saved.updated_at;}
    saveDrafts();cacheState();
    if(detailEventId===id&&!drafts[id])document.getElementById('event-dialog').close();
    render();connection('Saved. Available on your other devices.');
    document.getElementById('review-feedback').textContent='Saved: '+byId.get(id).title+'.';
    return true;
  }catch(error){
    if(!drafts[id])drafts[id]={...next,base_version:old?.version??0};saveDrafts();
    if(error.code==='40001'){
      status.innerHTML='Changed on another device. Your draft is kept. <button class="inline-link" data-review-conflict="'+esc(id)+'">Review the saved version</button>';
    }else status.textContent='Not synced. Your draft is kept. '+error.message;
    connection('Not synced. Your changes are still on this device.');return false;
  }finally{pendingChoices.delete(id);}
}
document.addEventListener('click',async event=>{const button=event.target.closest('[data-review-conflict]');if(!button)return;const id=button.dataset.reviewConflict;try{await sync(false);const current=choices[id]||{};const draft=drafts[id];const status=document.getElementById('draft-status-'+id);status.innerHTML='<div class="conflict"><strong>Saved on another device</strong><p>'+esc(DECISIONS[current.status])+'</p><p>'+esc(current.notes||'No planning notes')+'</p><p>'+esc(current.visited_on||'')+'</p><p>'+esc(current.visit_notes||'No visit notes')+'</p><button data-use-current="'+esc(id)+'">Use saved version</button> <button data-rebase-draft="'+esc(id)+'">Keep my draft and review</button></div>';}catch(error){connection('Could not load the saved version. '+error.message);}});
document.addEventListener('click',event=>{const use=event.target.closest('[data-use-current]'),keep=event.target.closest('[data-rebase-draft]');if(use){delete drafts[use.dataset.useCurrent];saveDrafts();if(detailEventId)showEvent(detailEventId);else render();}if(keep){const id=keep.dataset.rebaseDraft;drafts[id].base_version=choices[id]?.version??0;drafts[id].base_updated_at=choices[id]?.updated_at||'';saveDrafts();document.getElementById('draft-status-'+id).textContent='Draft kept. Review it, then Save to replace the saved version.';}});
for(const id of ['events','event-dialog-body']){document.getElementById(id).addEventListener('input',draftChoice);document.getElementById(id).addEventListener('change',draftChoice);}
document.getElementById('hide-reviewed').addEventListener('change',event=>{hideReviewed=event.target.checked;try{localStorage.setItem(FILTER_STORE,String(hideReviewed));}catch(e){}render();});
document.getElementById('still-considering').addEventListener('change',event=>{stillConsidering=event.target.checked;try{localStorage.setItem(CONSIDERING_STORE,String(stillConsidering));}catch(e){}render();});
const counts={};for(const s of DATA.registry.sources)counts[s.check_status]=(counts[s.check_status]||0)+1;
document.getElementById('coverage-summary').textContent=`Source coverage: ${counts.checked||0} checked, ${counts.partial||0} partial, ${counts.blocked||0} blocked, ${counts.not_checked||0} unchecked`;
document.getElementById('sources').innerHTML=DATA.registry.sources.slice().sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name)).map(s=>`<tr><td>${link(s.url,s.name)}</td><td class="status">${esc(s.check_status.replace('_',' '))}</td><td>${esc(s.checked_on||'—')}</td><td>${esc(s.notes||'')}</td></tr>`).join('');
document.getElementById('export-decisions').onclick=()=>{
  const exportChoices={...choices};
  for(const [id,draft]of Object.entries(drafts))exportChoices[id]={...draft,status:draft.status,notes:draft.notes||'',updated_at:new Date().toISOString()};
  download('cultural-calendar-backup.json',JSON.stringify({schema_version:1,saved_on:new Date().toISOString(),decisions:exportChoices,artists,artist_draft:readArtistForm()},null,2),'application/json');
  document.getElementById('saved-status').textContent=Object.keys(drafts).length?'Exported decisions, visit notes, artists and current drafts. Drafts stay visible until Save.':'Exported decisions, visit notes and artists to file.';
};
document.getElementById('import-decisions').onclick=()=>document.getElementById('decision-file').click();
document.getElementById('decision-file').onchange=async event=>{
  const feedback=document.getElementById('saved-status');
  try{
    const file=event.target.files[0];if(!file)return;const payload=JSON.parse(await file.text());
    if(!isRecord(payload.decisions))throw new Error('Choose an old diary export or a calendar backup.');
    let imported=0,skipped=0;
    for(const [id,item] of Object.entries(payload.decisions)){
      if(!byId.has(id)||choices[id]){skipped++;continue;}
      choices[id]=await store.save('decision',id,item,0);imported++;
    }
    for(const [id,item] of Object.entries(payload.artists||{})){
      if(artists[id]){skipped++;continue;}
      artists[id]=await store.save('artist',id,item,0);imported++;
    }
    cacheState();render();feedback.textContent='Imported '+imported+' records. '+skipped+' existing or unknown records kept unchanged.';
  }catch(error){cacheState();render();feedback.textContent='Import stopped. Records already saved are kept; retry safely. '+error.message;}
  event.target.value='';
};
function isRecord(x){return x&&typeof x==='object'&&!Array.isArray(x);}
function readArtistForm(){return Object.fromEntries(['id','name','url','notes','version'].map(k=>[k,document.getElementById('artist-'+k).value]));}
function keepArtistDraft(){try{localStorage.setItem(ARTIST_DRAFT_STORE,JSON.stringify(readArtistForm()));}catch(e){}}
function fillArtistForm(a={}){for(const k of ['id','name','url','notes','version'])document.getElementById('artist-'+k).value=a[k]||'';keepArtistDraft();}
try{const d=JSON.parse(localStorage.getItem(ARTIST_DRAFT_STORE)||'null');if(d)fillArtistForm(d);}catch(e){}
document.getElementById('artist-form').addEventListener('input',keepArtistDraft);
document.getElementById('artist-cancel').onclick=()=>fillArtistForm();
let savingArtist=false;
async function saveArtist(){
  if(savingArtist)return false;
  const form=readArtistForm(),name=form.name.trim(),url=form.url.trim();
  const feedback=document.getElementById('artist-feedback');
  if(!name){feedback.textContent='Enter an artist name.';return false;}
  if(url){try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))throw Error();}catch(e){feedback.textContent='Use a complete http or https link.';return false;}}
  const duplicate=Object.entries(artists).find(([id,a])=>id!==form.id&&a.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase());
  if(duplicate){feedback.textContent='That name is already in your list. Edit or resume the existing artist, or distinguish the names.';return false;}
  const id=form.id||'artist-'+crypto.randomUUID(),old=artists[id];
  savingArtist=true;feedback.textContent='Saving…';
  try{
    artists[id]=await store.save('artist',id,{name,url,notes:form.notes,following:old?.following??true},Number(form.version||0));
    if(JSON.stringify(readArtistForm())===JSON.stringify(form))fillArtistForm();
    else {document.getElementById('artist-id').value=id;document.getElementById('artist-version').value=artists[id].version;keepArtistDraft();}
    cacheState();renderArtists();feedback.textContent='Saved '+name+'. Included in your next refresh.';connection('Saved. Available on your other devices.');return true;
  }catch(error){feedback.textContent='Not synced. Your form is kept. '+error.message;if(error.code==='40001'){await sync(false);const current=artists[id];feedback.innerHTML='<div class="conflict"><p>Saved on another device: '+esc(current.name)+'</p><p>'+esc(current.notes)+'</p><p>'+esc(current.url)+'</p><button id="artist-keep-draft">Keep my draft and review</button> <button id="artist-use-saved">Use saved version</button></div>';document.getElementById('artist-keep-draft').onclick=()=>{document.getElementById('artist-version').value=current.version;keepArtistDraft();feedback.textContent='Review your draft, then Save to replace the saved version.';};document.getElementById('artist-use-saved').onclick=()=>{fillArtistForm({id,...current});feedback.textContent='Loaded the saved version.';};}return false;
  }finally{savingArtist=false;}
}
document.getElementById('artist-form').addEventListener('submit',e=>{e.preventDefault();saveArtist();});
const pendingArtists=new Set();
async function toggleArtist(id){const old=artists[id];if(!old||pendingArtists.has(id))return;pendingArtists.add(id);try{artists[id]=await store.save('artist',id,{...old,following:!old.following},old.version);cacheState();renderArtists();}catch(error){document.getElementById('artist-feedback').textContent='Not synced. '+error.message;if(error.code==='40001')await sync(false);}finally{pendingArtists.delete(id);}}
document.getElementById('artist-list').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-artist]'),toggle=e.target.closest('[data-toggle-artist]');if(edit){fillArtistForm({id:edit.dataset.editArtist,...artists[edit.dataset.editArtist]});document.getElementById('artist-name').focus();}if(toggle)toggleArtist(toggle.dataset.toggleArtist);});
function renderArtists(){
  const rows=Object.entries(artists).sort((a,b)=>Number(b[1].following)-Number(a[1].following)||a[1].name.localeCompare(b[1].name));
  document.getElementById('artist-list').innerHTML=rows.length?rows.map(([id,a])=>{
    const checks=(DATA.artist_checks||[]).filter(c=>c.artist_id===id).sort((a,b)=>b.checked_on.localeCompare(a.checked_on)),last=checks[0];
    return `<article class="artist-card${a.following?'':' artist-paused'}"><h3>${esc(a.name)}</h3><p class="small">${a.following?'Following':'Paused'}${a.url?' · '+link(a.url,'Website / gallery'):''}</p>${a.notes?`<p>${esc(a.notes)}</p>`:''}<div class="artist-actions"><button data-edit-artist="${esc(id)}">Edit</button><button data-toggle-artist="${esc(id)}">${a.following?'Pause following':'Resume following'}</button></div><p class="small">${last?'Last checked '+esc(last.checked_on)+' · '+esc(last.status)+'. '+esc(last.notes):'Not yet researched. Included in the next refresh while following.'}</p>${checks.flatMap(c=>c.findings||[]).filter((f,i,all)=>all.findIndex(x=>x.url===f.url&&x.title===f.title)===i).map(f=>`<p>${link(f.url,f.title)} <span class="small">${esc(f.kind)}${f.date?' · '+esc(f.date):''}</span>${f.event_id&&byId.has(f.event_id)?` · <button class="inline-link" data-open-event="${esc(f.event_id)}">View event</button>`:''}</p>`).join('')}</article>`;
  }).join(''):'<div class="empty">No artists followed yet. Add your first artist above.</div>';
}

function icsEscape(s){return String(s??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
function foldLine(s){let rows=[],line='',bytes=0;for(const c of s){const size=new TextEncoder().encode(c).length;if(bytes+size>75){rows.push(line);line=' ';bytes=1;}line+=c;bytes+=size;}rows.push(line);return rows.join('\r\n');}
function makeICS(){let lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Personal art diary//EN','CALSCALE:GREGORIAN','X-WR-CALNAME:Art diary shortlist milestones'];const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');for(const e of events.filter(e=>active(e)&&['considering','will_book_need_date','booked'].includes(choice(e)))){const milestones=e.start_date===e.end_date?[['start_date','Event date']]:[['start_date','Opens'],['end_date','Closes']];if(e.action_date)milestones.push(['action_date',e.action_label]);if(e.highlight_start_date)milestones.push(['highlight_start_date','Key display opens: '+e.highlight_label],['highlight_end_date','Key display closes: '+e.highlight_label]);for(const [field,label]of milestones){const day=e[field];if(!day||day<asOf)continue;const next=new Date(parseDate(day).getTime()+DAY).toISOString().slice(0,10);lines.push('BEGIN:VEVENT',`UID:${e.id}-${field}@personal-art-diary`,`SEQUENCE:${e.sequence||0}`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${day.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${next.replace(/-/g,'')}`,`SUMMARY:${icsEscape(label+': '+e.title)}`,`LOCATION:${icsEscape(e.venue+', '+e.city)}`,`DESCRIPTION:${icsEscape('Milestone only; no visit reserved. '+e.action+' Booking: '+e.booking_status+' Source checked '+e.verified_on+'. '+(e.booking_url||e.source_urls[0]))}`,`URL:${e.booking_url||e.source_urls[0]}`,'TRANSP:TRANSPARENT','END:VEVENT');}}lines.push('END:VCALENDAR');return lines.map(foldLine).join('\r\n')+'\r\n';}
document.getElementById('export-ics').onclick=()=>{const n=events.filter(e=>active(e)&&['considering','will_book_need_date','booked'].includes(choice(e))).length;document.getElementById('export-summary').textContent=`${n} selected ${n===1?'event':'events'}. Unannounced dates and past milestones are omitted.`;document.getElementById('export-dialog').showModal();};
document.getElementById('cancel-export').onclick=()=>document.getElementById('export-dialog').close();
document.getElementById('confirm-export').onclick=()=>{download('art-diary-shortlist.ics',makeICS(),'text/calendar');document.getElementById('export-dialog').close();};

function cacheState(){onCache({...DATA,decisions:choices,artists});}
let syncing=false;
async function sync(redraw=true){if(syncing)return;syncing=true;try{const fresh=await store.load();choices={...fresh.decisions};artists={...fresh.artists};DATA.artist_checks=fresh.artist_checks||[];cacheState();if(fresh.revision!==DATA.revision){connection('New research is available. Reload the app to see it. Your drafts are kept.');}else connection('Up to date.');if(redraw&&!document.querySelector('.event[open]')&&!document.getElementById('event-dialog').open){render();}}catch(error){connection(navigator.onLine?'Could not sync. '+error.message:'Offline. Viewing the last saved calendar.');}finally{syncing=false;}}
document.getElementById('sync-now').onclick=()=>sync(true);
document.getElementById('sign-out').onclick=signOut;
document.getElementById('account-email').textContent=userEmail;
const mobile=document.createElement('div');mobile.className='mobile-account';mobile.innerHTML='<button id="mobile-sync">Check for updates</button><button id="mobile-sign-out">Sign out</button>';document.querySelector('footer').before(mobile);document.getElementById('mobile-sync').onclick=()=>sync(true);document.getElementById('mobile-sign-out').onclick=signOut;
window.addEventListener('online',()=>sync(true));window.addEventListener('offline',()=>connection('Offline. Viewing the last saved calendar.'));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync(true);});
setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine)sync(true);},60000);
render();
return {sync};

}
