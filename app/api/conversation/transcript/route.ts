import {currentSession,sameOrigin} from '@/lib/server/auth';
import {mongoDb} from '@/lib/server/mongo';
import type {TranscriptRecord} from '@/lib/server/transcripts';
import {rateLimited} from '@/lib/server/rateLimit';
export async function POST(req:Request){
 if(!sameOrigin(req))return Response.json({error:'ORIGIN'},{status:403});
 const session=await currentSession();if(!session)return Response.json({error:'AUTH_REQUIRED'},{status:401});
 if(await rateLimited(req,'call-transcripts',180))return Response.json({error:'LIMIT'},{status:429});
 let input;try{const raw=await req.text();if(raw.length>10000)throw Error();input=JSON.parse(raw);
 if(!/^[a-f0-9-]{36}$/.test(input.id)||typeof input.eventId!=='string'||input.eventId.length>100||!['user','agent'].includes(input.role)||typeof input.text!=='string'||!input.text.trim()||input.text.length>6000)throw Error();
 }catch{return Response.json({error:'INVALID'},{status:400});}
 const col=(await mongoDb()).collection<TranscriptRecord>('operation_calls');
 const result=await col.updateOne({_id:input.id,customerId:session.customerId,transcriptConsent:true,expiresAt:{$gt:new Date()},'transcript.id':{$ne:input.eventId}},{$push:{transcript:{$each:[{id:input.eventId,role:input.role,text:input.text,createdAt:new Date()}],$slice:-500}}});
 return Response.json({saved:result.modifiedCount===1});
}
