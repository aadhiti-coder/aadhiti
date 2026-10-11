const test=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
global.fetch=async()=>{throw Error('Unexpected network request in tests');};
function loader(overrides={}){const cache={};function load(name,parent=process.cwd()+'/entry.ts'){
 if(name in overrides)return overrides[name];
 if(!name.startsWith('.')&&!name.startsWith('@/'))return require(name);
 let file=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(parent),name);
 file=[file,file+'.ts',file+'.tsx',file+'/index.ts'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
 if(!file)throw Error(name);const alias='@/'+path.relative(process.cwd(),file).replace(/\.tsx?$/,'');if(alias in overrides)return overrides[alias];if(cache[file])return cache[file].exports;
 const mod={exports:{}};cache[file]=mod;
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const fn=vm.runInThisContext('(function(require,module,exports){'+js+'\n})',{filename:file});fn(n=>load(n,file),mod,mod.exports);return mod.exports;
 }return load;}
process.env.WATI_WEBHOOK_SECRET='test-secret';process.env.WATI_REMINDER_KEY='ab'.repeat(32);process.env.WATI_API_TOKEN='test-token';process.env.WATI_SUPPORT_OPERATOR_EMAILS='support@example.test';

test('WhatsApp preferences, guided journeys, checklists, feedback and human acceptance',async()=>{
 let jobs=[],sent=[],audio=0,serial=0,failAudio=false;
 const load=loader({'next/server':{after:fn=>jobs.push(fn)},'@/lib/server/wati':{
 watiConfigured:()=>true,sendText:async(t,text)=>{sent.push(text);return true;},sendInteractive:async(t,m)=>{sent.push(m);return true;},getMedia:async()=>({data:new ArrayBuffer(4),type:'audio/ogg'}),sendFile:async()=>{audio++;return true;},sendFileUrl:async()=>true,handoffConfigured:()=>true,handToHuman:async()=>true},
 '@/lib/server/transcribe':{transcribe:async()=> 'मला शिवणकाम शिकायचे आहे'},'@/lib/server/tts':{synthesize:async()=>failAudio?null:new ArrayBuffer(4)},
 '@/lib/server/answer':{answerQuestion:async()=>({understand:'Understood',answer:['Try a local training centre.'],nextStep:'Which skill?',options:[],risk:'P3',lang:'en',helplines:[],source:'Guidance',verify:'',topicId:null})}});
 const route=load('@/app/api/wati/webhook/route');
 assert.equal((await route.POST(new Request('https://example.test/api/wati/webhook',{method:'POST',body:'{}'}))).status,401);
 async function msg(text,extra={}){sent=[];const res=await route.POST(new Request('https://example.test/api/wati/webhook?token=test-secret',{method:'POST',body:JSON.stringify({eventType:'message',id:'id-'+(++serial),waId:'910000000000',type:'text',text,...extra})}));assert.equal(res.status,200);for(const job of jobs.splice(0))await job();return sent;}
 await msg('hi');assert.equal(sent[0].buttons.length,3);
 await msg('English');assert.equal(audio,1);assert.ok(!sent.some(x=>x.buttons?.[0].id==='mode:text'));
 await msg('voice settings');assert.ok(sent.some(x=>x.buttons?.[0].id==='mode:text'));
 await msg('Text');await msg('Where can I learn tailoring?');assert.ok(sent.some(x=>x.buttons?.[0].id==='feedback:yes'));
 await msg('Yes, helpful');assert.ok(sent.some(x=>typeof x==='string'&&x.includes('Thank you')));
 await msg('menu');assert.ok(sent[0].sections[0].rows.some(x=>x.id==='reminders'));
 await msg('Safety');assert.equal(sent[0].buttons.length,3);
 await msg('menu');await msg('Government schemes');await msg('1');assert.ok(sent[0].kind);
 await msg('menu');await msg('voice settings');await msg('Audio');await msg('',{type:'voice'});assert.equal(audio,2);
 failAudio=true;await msg('Where can I learn tailoring?');assert.ok(sent.some(x=>typeof x==='string'&&x.includes('Try a local')));failAudio=false;
 await msg('voice settings');await msg('Text');
 await msg('What is AADHI TI?');assert.ok(sent.some(x=>typeof x==='string'&&x.includes('AI information')));assert.ok(!sent.some(x=>typeof x==='string'&&x.includes('born in')));
 await msg('Who is Aditi Tatkare?');assert.ok(sent.some(x=>typeof x==='string'&&x.includes('Aditi Varda Sunil Tatkare')));
 await msg('आधी ती बद्दल माहिती सांगा');assert.ok(sent.some(x=>typeof x==='string'&&x.includes('AI सहाय्यक')));
 await msg('आधी ती क्या है');assert.ok(sent.some(x=>typeof x==='string'&&x.includes('AI सहायिका')));
 await msg('What is AADHI TI?');assert.ok(sent.some(x=>typeof x==='string'&&x.includes('AI information')));
 await msg('',{type:'voice'});assert.ok(!sent.some(x=>typeof x==='string'&&x.includes('मला शिवणकाम शिकायचे आहे')));
 await msg('English');
 await msg('Talk to someone');await msg('1');assert.ok(sent.some(x=>typeof x==='string'&&x.includes('No person has accepted')));
 assert.ok(sent.some(x=>typeof x==='string'&&x.includes('Send your current location')&&x.includes('optional')));
 await msg('',{type:'location'});assert.ok(sent.some(x=>typeof x==='string'&&x.includes('Staff still need to confirm')));
 await msg('location');assert.ok(sent.some(x=>typeof x==='string'&&x.includes('Send your current location')));
 await msg('#accept',{owner:true,eventType:'sessionMessageSent_v2',operatorEmail:'unknown@example.test'});assert.equal(sent.length,0);
 await msg('#on-the-way',{owner:true,eventType:'sessionMessageSent_v2',operatorEmail:'support@example.test'});assert.equal(sent.length,0);
 await msg('#accept',{owner:true,eventType:'sessionMessageSent_v2',operatorEmail:'support@example.test'});assert.ok(sent.some(x=>typeof x==='string'&&x.includes('has accepted')));
 await msg('#on-the-way',{owner:true,eventType:'sessionMessageSent_v2',operatorEmail:'unknown@example.test'});assert.equal(sent.length,0);
 await msg('#on-the-way');assert.equal(sent.length,0);
 await msg('#on-the-way',{owner:true,eventType:'sessionMessageSent_v2',operatorEmail:'support@example.test'});assert.ok(sent.some(x=>typeof x==='string'&&x.includes('staff are on the way')&&x.includes('112')));
 await msg('#on-the-way',{owner:true,eventType:'sessionMessageSent_v2',operatorEmail:'support@example.test'});assert.equal(sent.length,0);
 await msg('STOP');assert.ok(sent.some(x=>typeof x==='string'&&x.includes('cancelled')));
 const exp=load('@/lib/server/waExperience');assert.ok(exp.documentsMessage('ladki-bahin','en').includes('not approval'));
 assert.ok(exp.guidedMenu('cat:safety','en').buttons.every(b=>b.id!=='topic:stalking'));
});

test('Reminder confirmation, encryption, deduplication and STOP cancellation',async()=>{
 const values=new Map(),queue=new Map(),claims=new Set();
 const store={hasRedis:true,getJSON:async k=>values.get(k)??null,setJSON:async(k,v)=>values.set(k,v),enqueue:async(k,id,due)=>queue.set(id,due),dequeue:async(k,id)=>queue.delete(id),dueJobs:async()=>[...queue.keys()],setOnce:async k=>{if(claims.has(k))return false;claims.add(k);return true;},withLock:async(k,fn)=>fn()};
 const load=loader({'./store':store});const r=load('@/lib/server/waReminders');
 const e={id:'workshop',confirmed:true,title:{en:'Workshop',mr:'कार्यशाळा',hi:'कार्यशाला'},dueAt:new Date(Date.now()+60000).toISOString(),eventAt:new Date(Date.now()+86400000).toISOString(),sourceUrl:'https://example.gov.in/event',template:{en:'reminder_en',mr:'reminder_mr',hi:'reminder_hi'}};
 assert.equal(r.validEvent({...e,confirmed:false}),false);assert.equal(r.validEvent({...e,dueAt:'bad'}),false);
 values.set('wati:events',[e]);await r.subscribe('user','910000000000','workshop','mr');await r.subscribe('user','910000000000','workshop','mr');assert.equal(queue.size,1);
 const job=[...values.values()].find(v=>v?.recipient);assert.ok(!job.recipient.includes('910000'));assert.equal(r.unseal(job.recipient),'910000000000');
 await r.stopReminders('user');assert.equal(queue.size,0);
 await r.subscribe('user','910000000000','workshop','mr');let sends=0;await r.runReminders(async()=>{sends++;return true;});await r.runReminders(async()=>{sends++;return true;});assert.equal(sends,1);
 await r.subscribe('user','910000000000','workshop','mr');await r.runReminders(async()=>{throw Error('timeout');});assert.ok([...values.values()].some(v=>v?.status==='unknown'));
});


test('Operations and scheduler reject missing authentication',async()=>{
 const load=loader();
 const operations=load('@/app/api/wati/operations/route');
 const cron=load('@/app/api/cron/reminders/route');
 assert.equal((await operations.GET(new Request('https://example.test/api/wati/operations'))).status,401);
 assert.equal((await operations.POST(new Request('https://example.test/api/wati/operations',{method:'POST',body:'{}'}))).status,401);
 assert.equal((await cron.GET(new Request('https://example.test/api/cron/reminders'))).status,401);
});


test('scheme follow-ups retain the named scheme without guessing',()=>{
 const context=loader()('@/lib/server/followUp').followUpContext;
 const history=[{role:'user',text:'Tell me about Ladki Bahin'},{role:'assistant',text:'You may need to check your eligibility.'}];
 assert.match(context('documents?',history),/ladki-bahin/);
 assert.match(context('कागदपत्रे कोणती?',history),/ladki-bahin/);
 assert.match(context('दस्तावेज चाहिए',history),/ladki-bahin/);
 assert.equal(context('I have a headache',history),'');
 assert.match(context('How to apply for Sukanya?',history),/sukanya/);
 assert.match(context('documents?',[{role:'user',text:'Compare Sukanya and Ladki Bahin'}]),/Ask which scheme/);
 assert.equal(context('documents?',[...history,{role:'user',text:'I want to learn tailoring'},{role:'assistant',text:'Which skill would you like to learn?'}]),'');
 const directory=loader()('@/lib/localHelp').LOCAL_HELP;
 assert.ok(directory.every(c=>c.url.startsWith('https://')&&c.checked==='2026-10-11'));
});
