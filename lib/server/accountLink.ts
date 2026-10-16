import {createHash,randomBytes} from 'node:crypto';
import {mongoDb} from './mongo';
import {keyed,normalizePhone} from './auth';
type Code={_id:string;hash:string;expiresAt:Date};
export type AccountLink={_id:string;userKey:string;consentedAt:Date;verifiedAt:Date;expiresAt:Date};
export async function issueLink(customerId:string){
 const code=randomBytes(16).toString('hex');
 await(await mongoDb()).collection<Code>('account_link_codes').updateOne({_id:customerId},{$set:{hash:createHash('sha256').update(code).digest('hex'),expiresAt:new Date(Date.now()+10*60000)}},{upsert:true});return code;
}
export async function acceptLink(waId:string,userKey:string,code:string){
 if(!/^[a-f0-9]{32}$/.test(code))return false;
 const id='account:'+keyed('phone:'+normalizePhone(waId)),db=await mongoDb();
 // The webhook's WhatsApp number must match the SMS-verified website account, not just a code.
 const match=await db.collection<Code>('account_link_codes').findOneAndDelete({_id:id,hash:createHash('sha256').update(code).digest('hex'),expiresAt:{$gt:new Date()}});
 if(!match)return false;
 await db.collection<AccountLink>('account_links').updateOne({_id:id},{$set:{userKey,consentedAt:new Date(),verifiedAt:new Date(),expiresAt:new Date(Date.now()+30*86400000)}},{upsert:true});return true;
}
