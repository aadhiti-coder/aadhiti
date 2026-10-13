const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, dependencies = {}) {
 const mod = {exports:{}};
 const js = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',js)(name=>dependencies[name] ?? require(name),mod,mod.exports);
 return mod.exports;
}
const {callErrorMessage} = load('lib/callErrors.ts');
test('call failures distinguish microphone permissions from provider failure',()=>{
 assert.match(callErrorMessage({name:'NotAllowedError'}).en,/Microphone access was denied/);
 assert.match(callErrorMessage(new Error('SETUP_REQUIRED')).en,/configuration/);
 assert.match(callErrorMessage(new Error('PROVIDER_LIMIT')).en,/capacity limit/);
 assert.match(callErrorMessage(new Error('UNAVAILABLE')).en,/voice service could not connect/);
 assert.doesNotMatch(callErrorMessage(new Error('UNAVAILABLE')).en,/permission/i);
 for(const lang of ['mr','hi','en'])assert.ok(callErrorMessage('PROVIDER_AUTH')[lang]);
});
test('session endpoint preserves auth and reports provider failures without leaking credentials',async()=>{
 const originalFetch=global.fetch, originalError=console.error;
 const oldKey=process.env.ELEVENLABS_API_KEY, oldAgent=process.env.ELEVENLABS_AGENT_ID;
 let allowed=true,denied=null;
 const {POST}=load('app/api/conversation/route.ts',{
  '@/lib/server/auth':{sameOrigin:()=>allowed,requireAuth:async()=>denied},
  '@/lib/server/rateLimit':{rateLimited:()=>false}
 });
 try {
  console.error=()=>{};
  allowed=false;assert.equal((await POST(new Request('https://example.test'))).status,403);
  allowed=true;denied=new Response('',{status:401});assert.equal((await POST(new Request('https://example.test'))).status,401);denied=null;
  delete process.env.ELEVENLABS_AGENT_ID;assert.equal((await (await POST(new Request('https://example.test'))).json()).error,'SETUP_REQUIRED');
  process.env.ELEVENLABS_API_KEY='test-key';process.env.ELEVENLABS_AGENT_ID='agent_test';
  for(const [status,expected] of [[401,'PROVIDER_AUTH'],[404,'AGENT_NOT_FOUND'],[429,'PROVIDER_LIMIT'],[500,'UNAVAILABLE']]){
   global.fetch=async()=>new Response('private upstream detail',{status});
   const result=await POST(new Request('https://example.test'));assert.equal(result.status,503);assert.deepEqual(await result.json(),{error:expected});
  }
  global.fetch=async()=>{throw new DOMException('timeout','TimeoutError');};assert.equal((await (await POST(new Request('https://example.test'))).json()).error,'UNAVAILABLE');
  global.fetch=async()=>Response.json({signed_url:'wss://example.test/session'});
  const response=await POST(new Request('https://example.test'));assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{signedUrl:'wss://example.test/session'});
 } finally {
  global.fetch=originalFetch;console.error=originalError;
  if(oldKey===undefined)delete process.env.ELEVENLABS_API_KEY;else process.env.ELEVENLABS_API_KEY=oldKey;
  if(oldAgent===undefined)delete process.env.ELEVENLABS_AGENT_ID;else process.env.ELEVENLABS_AGENT_ID=oldAgent;
 }
});
