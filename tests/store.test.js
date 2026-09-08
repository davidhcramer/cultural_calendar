import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,cleanPayload,recordMap} from '../src/store.js';
test('save sends the original server version and strips client-only metadata',async()=>{
  let call;
  const client={rpc:async(name,args)=>{call={name,args};return {data:{payload:args.new_payload,version:8,updated_at:'server-time'}};}};
  const result=await createStore(client).save('decision','event-1',{status:'seen',notes:'plan',visit_notes:'reflection',version:7,updated_at:'client-time',base_version:7,base_updated_at:'old'},7);
  assert.equal(call.args.expected_version,7);assert.deepEqual(call.args.new_payload,{status:'seen',notes:'plan',visit_notes:'reflection'});
  assert.equal(result.version,8);assert.equal(result.updated_at,'server-time');
});
test('a server conflict propagates without a retry that overwrites another device',async()=>{
  let calls=0;const error={code:'40001',message:'conflict'};
  const client={rpc:async()=>{calls++;return {error};}};
  await assert.rejects(createStore(client).save('artist','id',{name:'Artist'},0),e=>e===error);assert.equal(calls,1);
});
test('server-owned versions survive mapping and notes survive saving',()=>{
  assert.deepEqual(recordMap([{event_id:'a',payload:{status:'seen',notes:'x',visit_notes:'y'},version:2,updated_at:'z'}],'event_id'),{a:{status:'seen',notes:'x',visit_notes:'y',version:2,updated_at:'z'}});
  assert.equal(cleanPayload({visited_on:'2026-09-08',visit_notes:'text'}).visit_notes,'text');
});
