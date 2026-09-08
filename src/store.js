export function recordMap(rows, idField) {
  return Object.fromEntries(rows.map(row => [row[idField], {...row.payload, version: row.version, updated_at: row.updated_at}]));
}
export function cleanPayload(record) {
  const {version, updated_at, base_updated_at, base_version, ...payload} = record;
  return payload;
}
export function createStore(client) {
  return {
    async load() {
      const results = await Promise.all([
        client.from('calendar_research').select('payload,revision').eq('id','main').maybeSingle(),
        client.from('calendar_decisions').select('*'), client.from('calendar_artists').select('*')
      ]);
      for (const result of results) if (result.error) throw result.error;
      if (!results[0].data) throw new Error('Your account has not been admitted to this calendar, or its data has not been loaded yet.');
      return {...results[0].data.payload, revision:results[0].data.revision,
        decisions:recordMap(results[1].data,'event_id'), artists:recordMap(results[2].data,'artist_id')};
    },
    async save(kind, id, record, version) {
      const {data,error} = await client.rpc('save_calendar_record', {
        record_kind:kind,record_id:id,expected_version:version,new_payload:cleanPayload(record)
      });
      if (error) throw error;
      return {...data.payload,version:data.version,updated_at:data.updated_at};
    }
  };
}
