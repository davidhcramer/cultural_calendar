import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../src/diary.js',import.meta.url),'utf8').replace('export function mountDiary','function mountDiary').replace('return {sync};','return {sync,commitChoice,draftChoice,saveArtist,fillArtistForm,readArtistForm,filtered,render,renderArtists,makeICS,occursOn,choices:()=>choices,drafts:()=>drafts,artists:()=>artists,setView:v=>{view=v;render();}};');
const fixture={id:'test-event',title:'An exhibition',venue:'Gallery',city:'London',country:'UK',category:'circuit',status:'announced',priority:'B',start_date:'2026-09-01',end_date:'2028-01-01',action:'Visit',booking_status:'Open',source_urls:['https://example.org'],verified_on:'2026-09-08'};
function setup(store,overrides={}){
  const dom=new JSDOM(html,{url:'https://example.org/cultural_calendar/',runScripts:'outside-only'});
  dom.window.setInterval=()=>0;dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  dom.window.TextEncoder=TextEncoder;
  vm.runInContext(source,dom.getInternalVMContext());
  const data={calendar:{last_run_on:'2026-09-08',events:[fixture]},registry:{sources:[]},decisions:{},artists:{},report:{new_ids:[]},revision:1,...overrides};
  const api=dom.window.mountDiary({DATA:data,store,userId:'test',userEmail:'test@example.org',onCache(){},signOut(){},connection(){}});
  return {dom,api,data};
}
test('locations encode map queries, preserve branches, and make neighbourhoods searchable',()=>{
  const locations={'test-event':[{name:'Gallery A',address:'3 Duke Street',neighbourhood:'St James’s'},{name:'Gallery B',address:'11 Duke Street',neighbourhood:'St James’s'}]};
  const {api,dom}=setup({}, {locations});
  const links=[...dom.window.document.querySelectorAll('.event-location a')];
  assert.equal(links.length,2);
  assert.equal(new URL(links[0].href).searchParams.get('query'),'Gallery A, 3 Duke Street, London, UK');
  assert.equal(new URL(links[1].href).searchParams.get('query'),'Gallery B, 11 Duke Street, London, UK');
  dom.window.document.getElementById('search').value='St James’s';
  assert.equal(api.filtered().length,1);
  dom.window.document.getElementById('search').value='Mayfair';
  assert.equal(api.filtered().length,0);
});
test('area festivals link to their programme and missing addresses remain venue searches',()=>{
  const {dom}=setup({}, {locations:{'test-event':[{scope:'area',neighbourhood:'East London',programme_url:'https://example.org/programme'}]}});
  assert.equal(dom.window.document.querySelector('.event-location a').href,'https://example.org/programme');
  assert.match(dom.window.document.querySelector('.event-location').textContent,/Several locations \(East London\)/);
  const fallback=setup({}).dom.window.document.querySelector('.event-location a');
  assert.equal(fallback.textContent,'Find venue on Google Maps');
  assert.equal(new URL(fallback.href).searchParams.get('query'),'Gallery, London, UK');
});
test('journal preserves ended events, orders by attendance, and filters by visit month',()=>{
  const es=['older','latest','undated'].map(id=>({...fixture,id,start_date:'2025-01-01',end_date:'2025-02-01'}));
  const decisions={older:{status:'seen',notes:'',visited_on:'2026-05-02'},latest:{status:'seen',notes:'',visited_on:'2026-08-12'},undated:{status:'seen',notes:'',visit_notes:'A memory without a date'}};
  const {api,dom}=setup({}, {calendar:{last_run_on:'2026-09-08',events:es},decisions});
  api.setView('seen');
  assert.deepEqual(Array.from(api.filtered(),e=>e.id),['latest','older','undated']);
  assert.match(dom.window.document.getElementById('events').textContent,/Visit date not recorded/);
  dom.window.document.getElementById('month').value='2026-08';
  assert.deepEqual(Array.from(api.filtered(),e=>e.id),['latest']);
});
test('Go again flags a favourable recurring visit, respects dismissal, and preserves it on planning edits',async()=>{
  let sent;const event={...fixture,title:'Test Open Studios 2026'};
  const store={save:async(k,id,payload)=>{sent=payload;return {...payload,version:1,updated_at:'a'};}};
  const {api,dom}=setup(store,{calendar:{last_run_on:'2026-09-08',events:[event]}});
  api.draftChoice({target:{dataset:{choice:event.id},value:'seen'}});
  api.draftChoice({target:{dataset:{visitRating:event.id},value:'liked'}});
  await api.commitChoice(event.id);
  assert.equal(sent.return_candidate,true);
  api.setView('return');assert.equal(api.filtered().length,1);
  assert.match(dom.window.document.getElementById('events').textContent,/Suggested for next edition/);
  api.setView('reviewed');
  assert.equal(dom.window.document.querySelector('[data-visit-rating]'),null);
  api.draftChoice({target:{dataset:{notes:event.id},value:'Keep this planning note'}});
  await api.commitChoice(event.id);assert.equal(sent.visit_rating,'liked');assert.equal(sent.return_candidate,true);
  api.setView('return');api.draftChoice({target:{dataset:{returnInterest:event.id},value:'dismissed'}});
  await api.commitChoice(event.id);assert.equal(sent.return_candidate,false);assert.equal(api.filtered().length,0);
});
test('Go again does not infer recurrence for ordinary exhibitions or negative reviews',()=>{
  for(const [title,review] of [['An exhibition','Loved it'],['Open Studios','Didn’t enjoy it'],['Open Studios','Not excellent']]){
    const {api}=setup({}, {calendar:{last_run_on:'2026-09-08',events:[{...fixture,title}]},decisions:{'test-event':{status:'seen',notes:'',visit_notes:review}}});
    api.setView('return');assert.equal(api.filtered().length,0);
  }
});
test('artist findings distinguish event dates, realised prices and estimates, retaining the latest evidence',()=>{
  const artists={a:{name:'Test Artist',url:'https://example.org',notes:'',following:true}};
  const artist_checks=[{artist_id:'a',checked_on:'2026-09-08',status:'checked',findings:[
    {id:'future',kind:'exhibition',title:'Future show',start_date:'2099-01-01',end_date:'2099-02-01',url:'https://example.org/future'},
    {id:'past',kind:'exhibition',title:'Past show',start_date:'2000-01-01',end_date:'2000-02-01',url:'https://example.org/past'},
    {id:'partial',kind:'exhibition',title:'Missing closing date',date:'2000-01-01',url:'https://example.org/partial'},
    {id:'sale',kind:'sale',title:'Painting sold',url:'https://example.org/sale',price:{type:'realised',amount:1200,currency:'GBP',date:'2026-09-01',medium:'Oil on canvas',dimensions:'40 × 50 cm',fees_note:'Includes premium'}},
    {id:'estimate',kind:'sale',title:'Estimate only',url:'https://example.org/estimate',price:{type:'estimate',low:800,high:1200,currency:'EUR',date:'2026-09-05'}}
  ]},{artist_id:'a',checked_on:'2026-08-01',status:'checked',findings:[{id:'sale',kind:'sale',title:'Old asking evidence',url:'https://example.org/sale',price:{type:'asking',amount:1000,currency:'GBP'}}]}];
  const {api,dom}=setup({}, {artists,artist_checks});api.setView('artists');
  const groups=[...dom.window.document.querySelectorAll('.artist-findings')];
  assert.match(groups.find(e=>e.querySelector('h4').textContent==='Upcoming events').textContent,/Future show/);
  assert.match(groups.find(e=>e.querySelector('h4').textContent==='Recent events').textContent,/Past show/);
  assert.match(groups.find(e=>e.querySelector('h4').textContent==='Events with incomplete dates').textContent,/Missing closing date/);
  const text=dom.window.document.getElementById('artist-list').textContent;
  assert.match(text,/Realised sale: GBP 1200/);assert.match(text,/Auction estimate: EUR 800–1200/);
  assert.match(text,/Oil on canvas · 40 × 50 cm · Includes premium/);assert.doesNotMatch(text,/Old asking evidence/);
});
test('visit notes commit only after a successful server save and stay accessible in Seen',async()=>{
  let release;const store={save:()=>new Promise(resolve=>{release=resolve;})};
  const {api,dom}=setup(store);
  assert.equal(dom.window.document.querySelector('[data-visit-date]'),null);
  assert.equal(dom.window.document.querySelector('[data-visit-notes]'),null);
  api.draftChoice({target:{dataset:{choice:'test-event'},value:'seen'}});
  api.draftChoice({target:{dataset:{visitNotes:'test-event'},value:'Remember <this> painting'}});
  const pending=api.commitChoice('test-event');assert.equal(api.choices()['test-event'],undefined);
  release({status:'seen',notes:'',visit_notes:'Remember <this> painting',version:1,updated_at:'a'});await pending;
  assert.equal(api.choices()['test-event'].visit_notes,'Remember <this> painting');
  api.setView('seen');assert.equal(api.filtered().length,1);assert(dom.window.document.getElementById('events').innerHTML.includes('Remember &lt;this&gt; painting'));
  assert(dom.window.document.querySelector('[data-visit-date]'));
  assert.equal(dom.window.document.querySelector('[data-visit-notes]').value,'Remember <this> painting');
  api.setView('reviewed');
  assert.equal(dom.window.document.querySelector('[data-visit-notes]'),null);
  api.draftChoice({target:{dataset:{notes:'test-event'},value:'Planning update'}});
  const planningSave=api.commitChoice('test-event');
  assert.equal(api.drafts()['test-event'].visit_notes,'Remember <this> painting');
  release({...api.drafts()['test-event'],version:2,updated_at:'b'});await planningSave;
  api.setView('seen');
  assert.equal(dom.window.document.querySelector('[data-visit-notes]').value,'Remember <this> painting');
});
test('failed save and server conflict preserve the draft and original version',async()=>{
  const {api,dom}=setup({save:async()=>{throw {code:'40001',message:'Changed'};}});
  api.draftChoice({target:{dataset:{notes:'test-event'},value:'Keep my text'}});
  assert.equal(await api.commitChoice('test-event'),false);
  assert.equal(api.drafts()['test-event'].notes,'Keep my text');assert.equal(api.drafts()['test-event'].base_version,0);
  assert.equal(api.choices()['test-event'],undefined);
  assert(dom.window.document.getElementById('draft-status-test-event').textContent.includes('another device'));
});
test('text typed while Save is pending survives as a newer draft',async()=>{
  let release;const {api}=setup({save:()=>new Promise(resolve=>release=resolve)});
  api.draftChoice({target:{dataset:{notes:'test-event'},value:'first'}});
  const pending=api.commitChoice('test-event');
  api.draftChoice({target:{dataset:{notes:'test-event'},value:'second'}});
  release({status:'unreviewed',notes:'first',version:1,updated_at:'server'});await pending;
  assert.equal(api.drafts()['test-event'].notes,'second');assert.equal(api.drafts()['test-event'].base_version,1);
});
test('artist save waits for the database, keeps the form on failure, and does not execute markup',async()=>{
  let shouldFail=true;const {api,dom}=setup({save:async(kind,id,record)=>{if(shouldFail)throw Error('Network failed');return {...record,version:1,updated_at:'a'};}});
  api.fillArtistForm({name:'Artist <test>',notes:'Notes',url:'https://example.org'});
  assert.equal(await api.saveArtist(),false);assert.equal(api.readArtistForm().name,'Artist <test>');assert.equal(Object.keys(api.artists()).length,0);
  shouldFail=false;assert.equal(await api.saveArtist(),true);assert.equal(api.readArtistForm().name,'');
  assert(dom.window.document.getElementById('artist-list').innerHTML.includes('Artist &lt;test&gt;'));
});
test('daily schedule respects published weekdays and exclusions',()=>{
  const {api}=setup({});const event={...fixture,open_weekdays:[2],excluded_dates:['2026-09-08']};
  assert.equal(api.occursOn(event,'2026-09-08'),false);assert.equal(api.occursOn(event,'2026-09-09'),false);assert.equal(api.occursOn(event,'2026-09-15'),true);
});
test('background sync cannot silently rebase an already displayed form',async()=>{
  let fresh,sentVersion;
  const {api,data}=setup({load:async()=>fresh,save:async(k,id,payload,version)=>{sentVersion=version;throw {code:'40001'};}});
  fresh={...data,decisions:{'test-event':{status:'booked',notes:'Changed on phone',version:1,updated_at:'new'}}};
  await api.sync(false);
  api.draftChoice({target:{dataset:{notes:'test-event'},value:'Typed into older displayed form'}});
  await api.commitChoice('test-event');
  assert.equal(sentVersion,0);assert.equal(api.drafts()['test-event'].notes,'Typed into older displayed form');
});
