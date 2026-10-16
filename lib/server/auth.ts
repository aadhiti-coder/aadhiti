import {createHash,createHmac,randomBytes,randomInt} from 'node:crypto';
import {cookies} from 'next/headers';
import {mongoDb} from './mongo';
export const SESSION_COOKIE='aadhi-session';
const CHALLENGE_COOKIE='aadhi-otp';
const SESSION_SECONDS=7*24*60*60;
export const authConfigured=()=>Boolean(process.env.MONGODB_URI&&process.env.AUTH_SECRET&&process.env.AUTH_SECRET.length>=32&&process.env.USE_TWILLIO==='true'&&process.env.TWILLIO_CHANNEL==='sms'&&process.env.TWILLIO_API_KEY&&process.env.TWILLIO_API_SECRET&&process.env.TWILLIO_ACCOUNT_SID&&process.env.TWILLIO_PHONE_NUMBER);
export function keyed(value:string){const secret=process.env.AUTH_SECRET;if(!secret||secret.length<32)throw Error('Auth unavailable');return createHmac('sha256',secret).update(value).digest('hex');}
export function normalizePhone(value:unknown){if(typeof value!=='string')throw Error('phone');let p=value.replace(/[\s()+-]/g,'');if(/^[6-9]\d{9}$/.test(p))p='91'+p;if(!/^[1-9]\d{7,14}$/.test(p))throw Error('phone');return p;}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
type Contact={name:string;phone:string;consentedAt:Date;version:1};
type Challenge={contact?:Contact|null;_id:string;phoneKey:string;last4:string;codeHash:string;attempts:number;ready:boolean;expiresAt:Date};
type AuthUser={contact?:Contact|null;_id:string;last4:string;phoneVerified:true;authMethod:'sms_otp';createdAt:Date;lastLoginAt:Date;loginCount:number};
type Session={_id:string;customerId:string;last4:string;expiresAt:Date};
let indexes:Promise<unknown>|undefined;
async function collections(){const db=await mongoDb();if(!indexes)indexes=Promise.all(['auth_challenges','auth_sessions','auth_limits'].map(n=>db.collection(n).createIndex({expiresAt:1},{expireAfterSeconds:0}))).catch(e=>{indexes=undefined;throw e;});await indexes;return {users:db.collection<AuthUser>('users'),challenges:db.collection<Challenge>('auth_challenges'),sessions:db.collection<Session>('auth_sessions'),limits:db.collection<{_id:string;count:number;expiresAt:Date}>('auth_limits')};}
export async function currentSession(){
 const token=(await cookies()).get(SESSION_COOKIE)?.value;if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const {sessions}=await collections();return sessions.findOne({_id:hash(token),expiresAt:{$gt:new Date()}});
}
export async function requireAuth(){try{return await currentSession()?null:Response.json({error:'Sign in with your phone number to continue',code:'AUTH_REQUIRED'},{status:401});}catch{return Response.json({error:'Sign-in service unavailable'},{status:503});}}
export function sameOrigin(req:Request){return req.headers.get('origin')===new URL(req.url).origin;}
async function cooldown(phoneKey:string){
 const {limits}=await collections();try{await limits.findOneAndUpdate({_id:'cooldown:'+phoneKey,expiresAt:{$lte:new Date()}},{$set:{count:1,expiresAt:new Date(Date.now()+60000)}},{upsert:true});return true;}catch(e){if((e as {code?:number}).code===11000)return false;throw e;}
}
async function budget(key:string,max:number,seconds:number){
 const {limits}=await collections();const window=Math.floor(Date.now()/(seconds*1000));const doc=await limits.findOneAndUpdate({_id:key+':'+window},{$inc:{count:1},$setOnInsert:{expiresAt:new Date((window+2)*seconds*1000)}},{upsert:true,returnDocument:'after'});return !!doc&&doc.count<=max;
}
export async function startOtp(phone:string,send:(phone:string,code:string)=>Promise<boolean>,contact?:{name:string;consent:boolean}){
 const name=contact?.name.trim()??'';
 if(contact?.consent&&(!name||name.length>80||/[\u0000-\u001f\u007f]/.test(name)))return {status:400,error:'NAME'};
 const phoneKey=keyed('phone:'+phone);
 if(!await budget('phone:'+phoneKey,5,3600)||!await cooldown(phoneKey))return {status:429,error:'LIMIT'};
 const {challenges}=await collections();const id=randomBytes(32).toString('hex');const code=String(randomInt(100000,1000000));
 // Only one active code per phone: replacement invalidates a previous code immediately.
 await challenges.updateOne({_id:phoneKey},{$set:{contact:contact?.consent?{name,phone:'+'+phone,consentedAt:new Date(),version:1}:null,phoneKey,last4:phone.slice(-4),codeHash:keyed(id+':'+code),attempts:0,ready:false,expiresAt:new Date(Date.now()+5*60*1000)}},{upsert:true});
 let sent=false;try{sent=await send(phone,code);}catch{}
 if(!sent){await challenges.deleteOne({_id:phoneKey,codeHash:keyed(id+':'+code)});return {status:503,error:'SEND_FAILED'};}
 await challenges.updateOne({_id:phoneKey,codeHash:keyed(id+':'+code)},{$set:{ready:true}});
 (await cookies()).set(CHALLENGE_COOKIE,id+'.'+phoneKey,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:300});
 return {status:200,accepted:true};
}
export async function verifyOtp(code:string){
 if(!/^\d{6}$/.test(code))return false;
 const raw=(await cookies()).get(CHALLENGE_COOKIE)?.value??'';if(!/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(raw))return false;
 const [id,phoneKey]=raw.split('.');const {challenges,sessions,users}=await collections();
 const attempt=await challenges.findOneAndUpdate({_id:phoneKey,ready:true,expiresAt:{$gt:new Date()},attempts:{$lt:5}},{$inc:{attempts:1}},{returnDocument:'after'});
 if(!attempt)return false;
 // Compare-and-delete atomically consumes the code; concurrent requests cannot replay it.
 const consumed=await challenges.findOneAndDelete({_id:phoneKey,ready:true,expiresAt:{$gt:new Date()},attempts:{$lte:5},codeHash:keyed(id+':'+code)});
 if(!consumed)return false;
 // Durable account directory, independent of optional profile/history consent and session TTL.
 const now=new Date();
 await users.updateOne({_id:'account:'+phoneKey},{
  $set:{contact:consumed.contact??null,last4:consumed.last4,phoneVerified:true,authMethod:'sms_otp',lastLoginAt:now},
  $setOnInsert:{createdAt:now},$inc:{loginCount:1},
 },{upsert:true});
 const token=randomBytes(32).toString('hex'),jar=await cookies();const old=jar.get(SESSION_COOKIE)?.value;
 if(old)await sessions.deleteOne({_id:hash(old)});
 await sessions.insertOne({_id:hash(token),customerId:'account:'+phoneKey,last4:consumed.last4,expiresAt:new Date(Date.now()+SESSION_SECONDS*1000)});
 jar.set(SESSION_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:SESSION_SECONDS});jar.delete(CHALLENGE_COOKIE);return true;
}
export async function signOut(){const jar=await cookies();const token=jar.get(SESSION_COOKIE)?.value;if(token){const {sessions}=await collections();await sessions.deleteOne({_id:hash(token)});}jar.delete(SESSION_COOKIE);jar.delete(CHALLENGE_COOKIE);}

/** Account-scoped limits, shared across deployments through MongoDB. Never keyed by IP. */
export async function accountRateLimited(customerId:string,bucket:string,limit:number,seconds:number){
 return !await budget('account:'+customerId+':'+bucket,limit,seconds);
}
