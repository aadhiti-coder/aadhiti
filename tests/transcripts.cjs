const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),ts=require('typescript');
function load(file,dependencies){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>dependencies[n]||require(n),Date,Response,Request,console});return module.exports;}
test('Call transcript endpoint requires owner session and consent; validates and deduplicates turns',async()=>{
 const id='a'.repeat(36);let customerId='account:owner';const record={_id:id,customerId,transcriptConsent:false,expiresAt:new Date(Date.now()+100000),transcript:[]};
 const db={collection:()=>({updateOne:async(q,u)=>{if(q._id!==record._id||q.customerId!==record.customerId||!record.transcriptConsent||record.transcript.some(t=>t.id===q['transcript.id'].$ne))return {modifiedCount:0};record.transcript.push(...u.$push.transcript.$each);return {modifiedCount:1};}})};
 const route=load('app/api/conversation/transcript/route.ts',{'@/lib/server/auth':{currentSession:async()=>customerId?{customerId}:null,sameOrigin:r=>r.headers.get('origin')==='http://test'},'@/lib/server/mongo':{mongoDb:async()=>db},'@/lib/server/rateLimit':{rateLimited:async()=>false}});
 const req=(data,origin='http://test')=>new Request('http://test/api',{method:'POST',headers:{origin},body:JSON.stringify(data)});const data={id,eventId:'user:1',role:'user',text:'Hello'};
 assert.equal((await route.POST(req(data,'http://evil'))).status,403);customerId=null;assert.equal((await route.POST(req(data))).status,401);customerId='account:owner';
 assert.equal((await(await route.POST(req(data))).json()).saved,false);record.transcriptConsent=true;customerId='account:other';assert.equal((await(await route.POST(req(data))).json()).saved,false);customerId='account:owner';
 assert.equal((await(await route.POST(req(data))).json()).saved,true);assert.equal((await(await route.POST(req(data))).json()).saved,false);assert.equal(record.transcript.length,1);
 assert.equal((await route.POST(req({...data,role:'system'}))).status,400);record.transcriptConsent=false;assert.equal((await(await route.POST(req({...data,eventId:'user:2'}))).json()).saved,false);
});
test('WhatsApp voice saving is opt-in; withdrawing consent deletes saved voice records',async()=>{
 let enabled=false,deleted=false,writes=0;
 const db={collection:n=>({findOne:async()=>enabled?{enabled}:null,updateOne:async(q,u)=>{if(n==='voice_preferences')enabled=u.$set.enabled;else writes++;},deleteMany:async q=>{deleted=q.userKey==='test';}})};
 const api=load('lib/server/transcripts.ts',{'./mongo':{mongoDb:async()=>db}});
 await api.saveVoiceTurn('test','message','user','Private');assert.equal(writes,0);await api.setVoiceConsent('test',true);await api.saveVoiceTurn('test','message','user','Consented');assert.equal(writes,2);
 await api.setVoiceConsent('test',false);assert.equal(deleted,true);await api.saveVoiceTurn('test','message2','user','Not saved');assert.equal(writes,2);
});
