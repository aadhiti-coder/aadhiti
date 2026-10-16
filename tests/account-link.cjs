const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),ts=require('typescript');
function load(file,deps){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>deps[n]||require(n),Date,console});return module.exports;}
test('Cross-channel linking requires an unexpired single-use code AND the SMS-verified phone identity',async()=>{
 let code,link;const db={collection:name=>({updateOne:async(q,u)=>{if(name==='account_link_codes')code={_id:q._id,...u.$set};else link={_id:q._id,...u.$set};},findOneAndDelete:async q=>{if(!code||q._id!==code._id||q.hash!==code.hash||code.expiresAt<=q.expiresAt.$gt)return null;const old=code;code=null;return old;}})};
 const api=load('lib/server/accountLink.ts',{'./mongo':{mongoDb:async()=>db},'./auth':{keyed:x=>x,normalizePhone:x=>x}});
 const token=await api.issueLink('account:phone:911234567890');assert.notEqual(code.hash,token);
 assert.equal(await api.acceptLink('919999999999','other',token),false);assert.equal(link,undefined);
 assert.equal(await api.acceptLink('911234567890','wa',token),true);assert.equal(link.userKey,'wa');assert.ok(link.consentedAt);assert.equal(await api.acceptLink('911234567890','wa',token),false);
 const expired=await api.issueLink('account:phone:911234567890');code.expiresAt=new Date(0);assert.equal(await api.acceptLink('911234567890','wa',expired),false);
});
test('Provider receipts ignore unknown events, deduplicate and exclude private message bodies',async()=>{
 const writes=[];const api=load('lib/server/delivery.ts',{'./mongo':{mongoDb:async()=>({collection:()=>({updateOne:async(q,u)=>writes.push({q,u})})})}});
 assert.equal(await api.saveDeliveryReceipt({eventType:'message',text:'private'}),false);
 const event={eventType:'sentMessageREAD_v2',localMessageId:'local',text:'private'};await api.saveDeliveryReceipt(event);await api.saveDeliveryReceipt(event);assert.equal(writes[0].q._id,writes[1].q._id);assert.equal(writes[0].u.$setOnInsert.status,'read');assert.equal(writes[0].u.$setOnInsert.text,undefined);
});
