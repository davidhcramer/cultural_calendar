import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../src/diary.js',import.meta.url),'utf8').replace('export function mountDiary','function mountDiary').replace('return {sync};','return {sync,commitChoice,draftChoice,saveArtist,fillArtistForm,readArtistForm,filtered,render,renderArtists,makeICS,occursOn,choices:()=>choices,drafts:()=>drafts,artists:()=>artists,setView:v=>{view=v;render();}};');
const fixture={id:'test-event',title:'An exhibition',venue:'Gallery',city:'London',country:'UK',category:'circuit',status:'announced',priority:'B',start_date:'2026-09-01',end_date:'2028-01-01',action:'Visit',booking_status:'Open',source_urls:['https://example.org'],verified_on:'2026-09-08'};
function setup(store){
  const dom=new JSDOM(html,{url:'https://example.org/cultural_calendar/',runScripts:'outside-only'});
  dom.window.setInterval=()=>0;dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  dom.window.TextEncoder=TextEncoder;
  vm.runInContext(source,dom.getInternalVMContext());
  const data={calendar:{last_run_on:'2026-09-08',events:[fixture]},registry:{sources:[]},decisions:{},artists:{},report:{new_ids:[]},revision:1};
  const api=dom.window.mountDiary({DATA:data,store,userId:'test',userEmail:'test@example.org',onCache(){},signOut(){},connection(){}});
  return {dom,api,data};
}
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
