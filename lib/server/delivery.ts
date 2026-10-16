import {createHash} from 'node:crypto';
import {mongoDb} from './mongo';
const events:Record<string,string>={sessionMessageSent_v2:'sent',sentMessageDELIVERED_v2:'delivered',sentMessageREAD_v2:'read',sessionMessageFailed:'failed',sessionMessageFailed_v2:'failed',templateMessageFailed:'failed'};
// Preserve receipts even when they arrive before the send response. Never match by body or phone.
export async function saveDeliveryReceipt(payload:Record<string,unknown>){
 const status=events[String(payload.eventType)];if(!status)return false;
 const ids=[payload.id,payload.localMessageId,payload.whatsappMessageId].filter((x):x is string=>typeof x==='string'&&x.length>0&&x.length<512);
 if(!ids.length)return true;
 const key=createHash('sha256').update(JSON.stringify([payload.eventType,...ids])).digest('hex');
 await (await mongoDb()).collection<{_id:string;ids:string[];status:string;receivedAt:Date;expiresAt:Date}>('delivery_receipts').updateOne({_id:key},{$setOnInsert:{ids,status,receivedAt:new Date(),expiresAt:new Date(Date.now()+30*86400000)}},{upsert:true});
 return true;
}
