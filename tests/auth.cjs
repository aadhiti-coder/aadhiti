const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const ts=require('typescript');
function fixture(){
 const docs=new Map(),jar=new Map();
 function match(d,q){return Object.entries(q).every(([k,v])=>{if(v&&typeof v==='object'&&!(v instanceof Date)){return Object.entries(v).every(([op,x])=>op==='$gt'?d[k]>x:op==='$lte'?d[k]<=x:op==='$lt'?d[k]<x:false);}return d[k]===v;});}
 const db={collection(name){if(!docs.has(name))docs.set(name,new Map());const m=docs.get(name);return {createIndex:async()=>{},findOne:async q=>[...m.values()].find(d=>match(d,q))||null,findOneAndUpdate:async(q,u,opt={})=>{let d=[...m.values()].find(d=>match(d,q));if(!d){if(!opt.upsert)return null;if(m.has(q._id)){const e=Error('duplicate');e.code=11000;throw e;}d={_id:q._id,...u.$setOnInsert};m.set(q._id,d);}Object.assign(d,u.$set);for(const [k,n] of Object.entries(u.$inc||{}))d[k]=(d[k]||0)+n;return {...d};},updateOne:async(q,u,opt)=>db.collection(name).findOneAndUpdate(q,u,opt),findOneAndDelete:async q=>{const d=[...m.values()].find(d=>match(d,q));if(d)m.delete(d._id);return d||null;},deleteOne:async q=>db.collection(name).findOneAndDelete(q),insertOne:async d=>{m.set(d._id,d);}};}};
 const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/server/auth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>n==='next/headers'?{cookies:async()=>({get:k=>jar.has(k)?{value:jar.get(k)}:undefined,set:(k,v)=>jar.set(k,v),delete:k=>jar.delete(k)})}:n==='./mongo'?{mongoDb:async()=>db}:require(n),process:{env:{AUTH_SECRET:'test-secret-'.repeat(5),NODE_ENV:'test'}},Response,URL,Date,console});return {auth:module.exports,docs,jar};
}
test('OTP normalization, single use, session rotation and logout',async()=>{const {auth,jar}=fixture();assert.equal(auth.normalizePhone('98765 43210'),'919876543210');assert.throws(()=>auth.normalizePhone({phone:'123'}));let code;let result=await auth.startOtp('919876543210',async(p,c)=>{code=c;return true;});assert.equal(result.status,200);assert.equal(await auth.verifyOtp(code),true);const s=await auth.currentSession();assert.ok(s.customerId.startsWith('account:'));assert.equal(s.last4,'3210');assert.equal(await auth.verifyOtp(code),false);await auth.signOut();assert.equal(await auth.currentSession(),null);assert.equal(jar.has('aadhi-session'),false);});
test('Wrong code locks after five attempts; cooldown and expiry are enforced',async()=>{const {auth,docs}=fixture();let code;await auth.startOtp('919876543210',async(p,c)=>{code=c;return true;});assert.equal((await auth.startOtp('919876543210',async()=>true)).status,429);const wrong=code==='111111'?'222222':'111111';for(let i=0;i<5;i++)assert.equal(await auth.verifyOtp(wrong),false);assert.equal(await auth.verifyOtp(code),false);const f=fixture();await f.auth.startOtp('919876543211',async(p,c)=>{code=c;return true;});for(const d of f.docs.get('auth_challenges').values())d.expiresAt=new Date(0);assert.equal(await f.auth.verifyOtp(code),false);});
test('Failed delivery never enables a challenge and unauthenticated APIs deny access',async()=>{const {auth,docs}=fixture();assert.equal((await auth.startOtp('919876543212',async()=>false)).status,503);assert.equal(docs.get('auth_challenges').size,0);assert.equal((await auth.requireAuth()).status,401);assert.equal(auth.sameOrigin(new Request('https://a.test/api',{headers:{origin:'https://b.test'}})),false);});

test('Verified users persist after logout; failed OTP creates no user; repeat login updates one account',async()=>{
 const {auth,docs}=fixture();let code;
 await auth.startOtp('919876543210',async(p,c)=>{code=c;return true;});
 assert.equal(docs.get('users').size,0);
 const wrong=code==='111111'?'222222':'111111';
 assert.equal(await auth.verifyOtp(wrong),false);
 assert.equal(docs.get('users').size,0);
 assert.equal(await auth.verifyOtp(code),true);
 const first=[...docs.get('users').values()][0];
 assert.equal(first.loginCount,1);assert.equal(first.phoneVerified,true);
 assert.equal(first.last4,'3210');const createdAt=first.createdAt;
 await auth.signOut();assert.equal(docs.get('users').size,1);
 for(const [key,d] of docs.get('auth_limits'))if(key.startsWith('cooldown:'))d.expiresAt=new Date(0);
 await auth.startOtp('919876543210',async(p,c)=>{code=c;return true;});
 assert.equal(await auth.verifyOtp(code),true);
 assert.equal(docs.get('users').size,1);
 const user=[...docs.get('users').values()][0];assert.equal(user.loginCount,2);
 assert.equal(user.createdAt,createdAt);assert.ok(user.lastLoginAt>=createdAt);
 assert.equal('phone' in user,false);assert.equal('history' in user,false);
});

test('Separate accounts on the same IP have independent persistent quotas',async()=>{
 const {auth,docs}=fixture();let customerId='account:first';
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/server/rateLimit.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:()=>({currentSession:async()=>customerId?{customerId}:null,accountRateLimited:auth.accountRateLimited}),Math});
 const req=new Request('https://a.test/api',{headers:{'x-forwarded-for':'203.0.113.1'}});
 for(let i=0;i<5;i++)assert.equal(await module.exports.rateLimited(req,'call',5),false);
 assert.equal(await module.exports.rateLimited(req,'call',5),true);
 customerId='account:second';assert.equal(await module.exports.rateLimited(req,'call',5),false);
 customerId='account:first';const otherIp=new Request('https://a.test/api',{headers:{'x-forwarded-for':'203.0.113.2'}});assert.equal(await module.exports.rateLimited(otherIp,'call',5),true);
 assert.ok([...docs.get('auth_limits').keys()].every(k=>!k.includes('203.0.113')));
 customerId=null;assert.equal(await module.exports.rateLimited(req,'call',5),false);
});
test('OTP requests for different phone numbers do not share a global IP quota',async()=>{
 const {auth,docs}=fixture();for(let i=0;i<12;i++)assert.equal((await auth.startOtp('9198765432'+String(i).padStart(2,'0'),async()=>true)).status,200);
 assert.ok([...docs.get('auth_limits').keys()].every(k=>!k.startsWith('ip:')));
});
