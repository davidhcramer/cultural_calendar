// Credentials stay in the invoking process. This script never writes personal records.
import {readFileSync,writeFileSync} from 'node:fs';
const [command,path,revision]=process.argv.slice(2);
const base=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!base?.startsWith('https://')||!key)throw Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY privately in this process.');
const headers={apikey:key,'Content-Type':'application/json'};
if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
async function request(route,options={}){
  const response=await fetch(base+'/rest/v1/'+route,{...options,headers});
  const body=await response.text();if(!response.ok)throw Error('Database request failed ('+response.status+').');
  return body?JSON.parse(body):null;
}
if(command==='pull'&&path){
  const [research,artists,decisions]=await Promise.all([request('calendar_research?id=eq.main&select=*'),request('calendar_artists?select=*'),request('calendar_decisions?select=*')]);
  writeFileSync(path,JSON.stringify({research:research[0],artists,decisions},null,2),{mode:0o600});
  console.log('Saved private snapshot: '+artists.length+' artist records and '+decisions.length+' decisions.');
}else if(command==='publish'&&path&&/^\d+$/.test(revision||'')){
  const payload=JSON.parse(readFileSync(path,'utf8'));
  if(!Array.isArray(payload.calendar?.events)||!Array.isArray(payload.registry?.sources)||!payload.report)throw Error('Incomplete research payload.');
  const before=await request('calendar_research?id=eq.main&select=payload,revision');
  const ids=new Set(payload.calendar.events.map(e=>e.id));
  if(ids.size!==payload.calendar.events.length)throw Error('Duplicate event IDs.');
  if(before[0]?.payload.calendar.events.some(e=>!ids.has(e.id)))throw Error('Research must retain existing event IDs.');
  if(Number(revision)!==(before[0]?.revision??0))throw Error('Research revision changed. Pull and reconcile before publishing.');
  const next=await request('rpc/publish_calendar_research',{method:'POST',body:JSON.stringify({new_payload:payload,expected_revision:Number(revision)})});
  console.log('Published research revision '+next+'. Personal records were not written.');
}else throw Error('Usage: node scripts/cloud-refresh.mjs pull PRIVATE_FILE | publish REVIEWED_PAYLOAD EXPECTED_REVISION');
