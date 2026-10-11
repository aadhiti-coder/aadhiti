import type { ChatTurn } from '../ai';
import { SCHEMES } from '../schemes';

const aliases: Record<string,string[]> = {
 'ladki-bahin':['ladki bahin','ladki behen','लाडकी बहीण','लाडकी बहिण','लाडकी बहन'],
 lekladki:['lek ladki','लेक लाडकी'], sukanya:['sukanya','सुकन्या'],
 mudra:['mudra','मुद्रा'], pmmvy:['pmmvy','matru vandana','मातृ वंदना','मातृत्व वंदना'],
};
const followUp = /documents?|papers?|eligib|apply|application|deadline|fees?|more|explain|yes|कागद|दस्तावेज|पात्र|अर्ज|आवेदन|अधिक|सविस्तर|होय|हाँ|कसे|कैसे|कुठे|कहाँ/i;
const normalized=(s:string)=>s.toLocaleLowerCase().replace(/[’'“”]/g,'').replace(/\s+/g,' ').trim();
function schemesIn(text:string){const q=normalized(text);return SCHEMES.filter(s=>[...Object.values(s.name),...(aliases[s.id]??[])].some(n=>q.includes(normalized(n))));}
/** Only resolve explicit scheme mentions; never guess from eligibility or personal details. */
export function followUpContext(message:string,history:ChatTurn[]):string {
 const current=schemesIn(message);
 if(current.length>1 && /compare|difference/i.test(message))return "Compare these schemes using their registry records; do not ask which one before comparing: " + JSON.stringify(current.map(s=>({id:s.id,name:s.name,what:s.what,who:s.who,benefit:s.benefit})));
 if(current.length)return record(current);
 if(!/^(?:[\w\s,?.!।\u0900-\u097f-]{1,160})$/.test(message) || !followUp.test(message))return '';
 for(const turn of [...history].reverse()){
  const found=schemesIn(turn.text);
  if(found.length)return record(found);
  if(turn.role === 'user' && !followUp.test(turn.text) && !/^(yes|no|ok|okay|हो|नाही|हाँ|नहीं|\d{1,3})[.!? ]*$/i.test(turn.text.trim()))return '';
 }
 return '';
}
function record(schemes:typeof SCHEMES):string {
 if(schemes.length>1)return 'More than one scheme was mentioned: '+schemes.map(s=>s.name.en).join(', ')+'. Ask which scheme she means before giving a checklist. Do not choose for her.';
 const s=schemes[0];return 'The explicitly named scheme for this turn is '+s.id+'. Use this registry record for the follow-up; do not restart the conversation or invent documents. '+JSON.stringify({name:s.name,documents:s.docs??[],documentsNote:s.docsNote,eligibility:s.who,apply:s.apply,url:s.url,status:s.status,lastChecked:s.lastChecked});
}
