import {mongoDb} from './mongo';
import { getJSON, setJSON } from './store';
export type SupportPresence = { available: boolean; until: number };
export async function supportAvailable() {
 const db=await mongoDb().catch(()=>null);
 if(db){const active=await db.collection('admin_staff').findOne({enabled:true,role:{$in:['admin','support']},availableUntil:{$gt:new Date()}},{projection:{_id:1}});if(active)return true;}
 const p=await getJSON<SupportPresence>('wati:support:presence');
 return !!p?.available && p.until>Date.now();
}
export async function setSupportPresence(available:boolean) {
 await setJSON('wati:support:presence',{available,until:Date.now()+15*60*1000},15*60);
}
