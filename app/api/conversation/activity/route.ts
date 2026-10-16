import {currentSession,sameOrigin} from '@/lib/server/auth';
import {mongoDb} from '@/lib/server/mongo';
import {rateLimited} from '@/lib/server/rateLimit';
export async function POST(req:Request){
 if(!sameOrigin(req))return Response.json({error:'ORIGIN'},{status:403});
 const session=await currentSession();if(!session)return Response.json({error:'AUTH_REQUIRED'},{status:401});
 if(await rateLimited(req,'call-activity',60))return Response.json({error:'LIMIT'},{status:429});
 try{const raw=await req.text();if(raw.length>300)throw Error();const {id,status}=JSON.parse(raw);
 if(typeof id!=='string'||! /^[a-f0-9-]{36}$/.test(id)||!['connected','ended','failed'].includes(status))return Response.json({error:'INVALID'},{status:400});
 const col=(await mongoDb()).collection<{_id:string;customerId:string;status:string;updatedAt:Date;connectedAt?:Date;endedAt?:Date}>('operation_calls');const now=new Date();
 await col.updateOne({_id:id,customerId:session.customerId,status:{$in:status==='connected'?['requested']:['requested','connected']}},{$set:{status,updatedAt:now,...(status==='connected'?{connectedAt:now}:{endedAt:now})}});
 return Response.json({ok:true});
 }catch{return Response.json({error:'UNAVAILABLE'},{status:503});}
}
