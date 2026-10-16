import {mongoDb} from './mongo';
import {createHash} from 'node:crypto';
export type TranscriptTurn={id:string;role:'user'|'agent';text:string;createdAt:Date};
export type TranscriptRecord={_id:string;customerId?:string;userKey?:string;transcriptConsent:boolean;transcript:TranscriptTurn[];createdAt:Date;expiresAt:Date;source?:string;status?:string};
export async function voiceConsent(key:string){return !!(await(await mongoDb()).collection<{_id:string;enabled:boolean}>('voice_preferences').findOne({_id:key,enabled:true}));}
export async function setVoiceConsent(key:string,enabled:boolean){const db=await mongoDb();await db.collection<{_id:string;enabled:boolean;updatedAt:Date}>('voice_preferences').updateOne({_id:key},{$set:{enabled,updatedAt:new Date()}},{upsert:true});if(!enabled)await db.collection('operation_voice').deleteMany({userKey:key});}
export async function saveVoiceTurn(key:string,messageId:string,role:'user'|'agent',text:string){
 if(!await voiceConsent(key))return;
 const col=(await mongoDb()).collection<TranscriptRecord>('operation_voice');const id=createHash('sha256').update(key+':'+messageId).digest('hex');const now=new Date();
 await col.updateOne({_id:id},{$setOnInsert:{userKey:key,transcriptConsent:true,transcript:[],createdAt:now,expiresAt:new Date(Date.now()+30*86400000),source:'WhatsApp voice note · automatic transcription',status:'captured'}},{upsert:true});
 await col.updateOne({_id:id,'transcript.id':{$ne:role}},{$push:{transcript:{$each:[{id:role,role,text:text.slice(0,6000),createdAt:now}],$slice:-20}}});
}
