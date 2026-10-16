import {createCall} from '@/lib/server/operations';
import { requireAuth, sameOrigin, currentSession } from '@/lib/server/auth';
import { rateLimited } from '@/lib/server/rateLimit';
export async function POST(req: Request) {
 if(!sameOrigin(req))return Response.json({error:'ORIGIN'},{status:403});
 const denied=await requireAuth();if(denied)return denied;
 if(await rateLimited(req,'eleven-conversation',5))return Response.json({error:'LIMIT'},{status:429});
 const key=process.env.ELEVENLABS_API_KEY,agent=process.env.ELEVENLABS_AGENT_ID;
 if(!key||!agent)return Response.json({error:'SETUP_REQUIRED'},{status:503});
 let transcriptConsent=false;
 try{const raw=await req.text();if(raw.length>200)throw Error();transcriptConsent=raw?JSON.parse(raw).transcriptConsent===true:false;}catch{return Response.json({error:'INVALID'},{status:400});}
 try {
 const res=await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agent)}`,{headers:{'xi-api-key':key},cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!res.ok){
   const error = res.status===401||res.status===403 ? 'PROVIDER_AUTH' : res.status===404 ? 'AGENT_NOT_FOUND' : res.status===429 ? 'PROVIDER_LIMIT' : 'UNAVAILABLE';
   console.error('ElevenLabs session request failed', {status:res.status,code:error});
   return Response.json({error},{status:503,headers:{'Cache-Control':'no-store'}});
 }
 const data=await res.json();
 if(typeof data.signed_url!=='string')throw Error();
 const session=await currentSession();const activityId=session?await createCall(session.customerId,transcriptConsent):null;
 return Response.json({signedUrl:data.signed_url,activityId},{headers:{'Cache-Control':'no-store'}});
 }catch(cause){console.error('ElevenLabs session request failed', {code:cause instanceof Error ? cause.name : 'UnknownError'});return Response.json({error:'UNAVAILABLE'},{status:503});}
}
