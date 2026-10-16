import { cookies } from 'next/headers';
import { currentSession } from '@/lib/server/auth';
import { customerCollection, mongoConfigured, mongoDb } from '@/lib/server/mongo';
import { parseCustomerProfile, parseSavedTurn } from '@/lib/customerValidation';
import { rateLimited } from '@/lib/server/rateLimit';
export const runtime='nodejs';
const COOKIE='aadhi-customer';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
async function identity(){return (await currentSession())?.customerId??null;}
async function guard(req:Request){
 if(!req.headers.get('origin')||req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid origin'},403);
 if(await rateLimited(req,'customer',30))return json({error:'Too many requests'},429);
 return null;
}
async function body(req:Request){const text=await req.text();if(text.length>16000)throw new Error('Too large');return JSON.parse(text);}
export async function GET(req:Request){
 if(!mongoConfigured())return json({configured:false,customer:null});
 try{const id=await identity();const c=id?await(await customerCollection()).findOne({_id:id}):null;
 return json({configured:true,customer:c?{profile:c.profile,consent:c.consent,history:new URL(req.url).searchParams.has("consent")?[]:c.history,createdAt:c.createdAt}:null});
 }catch{return json({error:'Database unavailable. Please try again.'},503);}
}
export async function PUT(req:Request){
 const denied=await guard(req);if(denied)return denied;
 if(!mongoConfigured())return json({error:'Database is not connected yet.'},503);
 let input,profile;
 try{input=await body(req);if(input.profileConsent!==true||typeof input.historyConsent!=='boolean')throw Error();profile=parseCustomerProfile(input.profile);}catch{return json({error:'Valid profile and explicit consent required.'},400);}
 try{const id=await identity();if(!id)return json({error:'Sign in required'},401);const now=new Date();const col=await customerCollection();
 await col.updateOne({_id:id},{$set:{profile,consent:{profile:true,history:input.historyConsent,version:1,updatedAt:now},updatedAt:now,...(!input.historyConsent?{history:[]}: {})},$setOnInsert:{createdAt:now,...(input.historyConsent?{history:[]}: {})}},{upsert:true});

 return json({saved:true});
 }catch{return json({error:'Could not save. Please try again.'},503);}
}
export async function POST(req:Request){
 const denied=await guard(req);if(denied)return denied;
 if(!mongoConfigured())return json({saved:false});
 const id=await identity();if(!id)return json({saved:false});
 let turn;try{turn=parseSavedTurn(await body(req));}catch{return json({error:'Invalid conversation'},400);}
 try{const result=await(await customerCollection()).updateOne({_id:id,'consent.history':true,'history.id':{$ne:turn.id}},{$push:{history:{$each:[turn],$slice:-100}},$set:{updatedAt:new Date()}});return json({saved:result.modifiedCount===1});}catch{return json({error:'History could not be saved'},503);}
}
export async function DELETE(req:Request){
 const denied=await guard(req);if(denied)return denied;
 try{const id=await identity();if(id){if(!mongoConfigured())return json({error:'Database unavailable; deletion not completed'},503);await(await customerCollection()).deleteOne({_id:id});await(await mongoDb()).collection<{_id:string}>('account_links').deleteOne({_id:id});await(await mongoDb()).collection<{_id:string}>('account_link_codes').deleteOne({_id:id});await(await mongoDb()).collection('operation_calls').updateMany({customerId:id},{$set:{transcriptConsent:false,transcript:[]},$unset:{summary:1}});await(await mongoDb()).collection<{_id:string;contact:unknown}>('users').updateOne({_id:id},{$set:{contact:null}});}
 (await cookies()).delete(COOKIE);return json({deleted:true});
 }catch{return json({error:'Deletion failed. Please try again.'},503);}
}
