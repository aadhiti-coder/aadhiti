const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),ts=require('typescript');
test('Support capture is bounded, deduplicated and tied to a retained request; call storage contains no audio',async()=>{
 const writes=[];const db={collection:name=>({insertOne:async d=>writes.push({name,doc:d}),updateOne:async(q,u,o)=>writes.push({name,q,u,o})})};const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/server/operations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>n==='./mongo'?{mongoDb:async()=>db}:require(n),Date,console});
 const api=module.exports;await api.createCall('account:test');assert.equal(writes[0].doc.customerId,'account:test');assert.equal(writes[0].doc.status,'requested');assert.equal(writes[0].doc.audio,undefined);assert.ok(writes[0].doc.expiresAt>new Date());
 await api.supportRequest('test','910000000000');assert.equal(writes[1].u.$set.status,'pending');assert.ok(writes[1].u.$set.consentedAt);
 await api.supportMessage('test','message-1','incoming','x'.repeat(5000));const w=writes[2];assert.equal(w.q['messages.id'].$ne,'message-1');assert.ok(w.q.expiresAt.$gt);assert.equal(w.u.$push.messages.$slice,-100);assert.equal(w.u.$push.messages.$each[0].text.length,4000);assert.equal(w.o,undefined);
 await api.supportStatus('test','accepted');assert.equal(writes[3].u.$set.status,'accepted');
});
