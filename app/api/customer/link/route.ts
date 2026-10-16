import {currentSession} from '@/lib/server/auth';
import {mongoDb} from '@/lib/server/mongo';
import {issueLink,type AccountLink} from '@/lib/server/accountLink';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){try{const session=await currentSession();if(!session)return json({error:'Sign in required'},401);const link=await(await mongoDb()).collection<AccountLink>('account_links').findOne({_id:session.customerId,expiresAt:{$gt:new Date()}});return json({linked:!!link,expiresAt:link?.expiresAt});}catch{return json({error:'Service unavailable'},503);}}
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid origin'},403);
 try{const session=await currentSession();if(!session)return json({error:'Sign in required'},401);
 const text=await req.text();if(text.length>500)return json({error:'Invalid request'},400);const data=JSON.parse(text);
 const db=await mongoDb();
 if(data.action==='unlink'){await db.collection<{_id:string}>('account_link_codes').deleteOne({_id:session.customerId});await db.collection<AccountLink>('account_links').deleteOne({_id:session.customerId});return json({linked:false});}
 if(data.consent!==true)return json({error:'Explicit consent required'},400);
 return json({code:await issueLink(session.customerId)});
 }catch{return json({error:'Could not update account link'},503);}
}
