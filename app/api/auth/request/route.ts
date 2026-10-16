import {authConfigured,normalizePhone,sameOrigin,startOtp} from '@/lib/server/auth';
import {sendOtp} from '@/lib/server/twilioOtp';
export async function POST(req:Request){
 if(!sameOrigin(req))return Response.json({error:'ORIGIN'},{status:403});
 if(!authConfigured())return Response.json({error:'SETUP_REQUIRED'},{status:503});
 try{const raw=await req.text();if(raw.length>800)return Response.json({error:'PHONE'},{status:400});const input=JSON.parse(raw);if(input.consent!==true)return Response.json({error:'CONSENT'},{status:400});
 let phone;try{phone=normalizePhone(input.phone);}catch{return Response.json({error:'PHONE'},{status:400});}
 if(input.contactConsent===true&&(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>80||/[\u0000-\u001f\u007f]/.test(input.name)))return Response.json({error:'NAME'},{status:400});
 const result=await startOtp(phone,sendOtp,{name:typeof input.name==='string'?input.name:'',consent:input.contactConsent===true});return Response.json(result,{status:result.status,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'UNAVAILABLE'},{status:503});}
}
