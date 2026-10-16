const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const vm=require('vm');const ts=require('typescript');
function load(file,mocks={}){const module={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(js,{module,exports:module.exports,require:n=>n in mocks?mocks[n]:require(n),Response,Request,URL,Buffer,process,console,Date});return module.exports;}
const validation=load('lib/customerValidation.ts');
const profile={name:'Customer',taluka:'shrivardhan',age:'30',language:'mr',answerMode:'text'};
test('Customer profile strips extra sensitive fields and validates input',()=>{const p=validation.parseCustomerProfile({...profile,stage:'pregnant',phone:'123',_id:'injected'});assert.equal(p.stage,undefined);assert.equal(p.phone,undefined);assert.throws(()=>validation.parseCustomerProfile({...profile,name:{$gt:''}}));assert.throws(()=>validation.parseCustomerProfile({...profile,age:'unexpected'}));assert.throws(()=>validation.parseSavedTurn({id:'bad',question:'x',answer:'y'}));});
test('Customer routes require origin and explicit consent, scope writes and cap history',async()=>{
 let configured=true,cookie='a'.repeat(64),calls=[];
 const col={findOne:async()=>null,updateOne:async(...args)=>{calls.push(args);return {modifiedCount:1}},deleteOne:async(...args)=>{calls.push(args)}};
 const route=load('app/api/customer/route.ts',{'next/headers':{cookies:async()=>({get:()=>cookie?{value:cookie}:undefined,set:()=>{},delete:()=>{cookie=null}})},'@/lib/server/auth':{currentSession:async()=>cookie?{customerId:'account:'+cookie}:null},'@/lib/server/mongo':{mongoConfigured:()=>configured,customerCollection:async()=>col,mongoDb:async()=>({collection:()=>({...col,updateMany:async()=>({})})})},'@/lib/customerValidation':validation,'@/lib/server/rateLimit':{rateLimited:()=>false}});
 const req=(method,data,origin='https://example.test')=>new Request('https://example.test/api/customer',{method,headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
 assert.equal((await route.PUT(req('PUT',{profile,profileConsent:true,historyConsent:true},'https://attacker.test'))).status,403);
 assert.equal((await route.PUT(req('PUT',{profile,profileConsent:false,historyConsent:true}))).status,400);assert.equal(calls.length,0);
 assert.equal((await route.PUT(req('PUT',{profile,profileConsent:true,historyConsent:false}))).status,200);assert.equal(calls[0][1].$set.consent.history,false);assert.equal(calls[0][1].$set.history.length,0);
 await route.POST(req('POST',{id:'12345678-abcd',question:'Question',answer:'Answer'}));const [filter,update]=calls[1];assert.equal(filter['consent.history'],true);assert.equal(filter._id.length,72);assert.notEqual(filter._id,cookie);assert.equal(update.$push.history.$slice,-100);assert.equal(filter['history.id'].$ne,'12345678-abcd');
 await route.DELETE(req('DELETE',{}));assert.equal(cookie,null);assert.equal(calls[2][0]._id,filter._id);
 configured=false;assert.equal((await route.GET(new Request('https://example.test/api/customer')).then(r=>r.json())).configured,false);
});
