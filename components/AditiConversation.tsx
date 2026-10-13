'use client';
import { callErrorMessage } from '@/lib/callErrors';
import { leaderNames } from '@/lib/leader';
import { useEffect, useRef, useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { Phone, PhoneOff, Mic, MicOff, AudioLines } from 'lucide-react';
import { useLang } from '@/lib/i18n';
export default function AditiConversation(){return <ConversationProvider><CallAditi/></ConversationProvider>;}
function CallAditi(){
 const {t,lang}=useLang();const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [seconds,setSeconds]=useState(0);
 const pending=useRef(false),mounted=useRef(true);
 const conversation=useConversation({onError:(message)=>{if(mounted.current)setError(t(callErrorMessage(message)));}});
 const end=useRef(conversation.endSession);end.current=conversation.endSession;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;void end.current();};},[]);
 async function start(){if(pending.current)return;pending.current=true;setBusy(true);setError('');try{
 if(!navigator.mediaDevices?.getUserMedia)throw Error('UNSUPPORTED');
 const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});stream.getTracks().forEach(track=>track.stop());
 if(!mounted.current)return;
 const response=await fetch('/api/conversation',{method:'POST',signal:AbortSignal.timeout(20000)});
 if(response.status===401){window.dispatchEvent(new Event('aadhi-auth-required'));throw Error('AUTH_REQUIRED');}
 const data=await response.json().catch(()=>({error:'UNAVAILABLE'}));
 if(!response.ok)throw Error(data.error || 'UNAVAILABLE');
 if(typeof data.signedUrl!=='string')throw Error('UNAVAILABLE');
 if(!mounted.current)return;
 await conversation.startSession({signedUrl:data.signedUrl,connectionType:'websocket',overrides:{agent:{language:lang,firstMessage:t({en:'Hello, I am AADHI TI’s AI assistant. What would you like help with today?',mr:'नमस्कार, मी आधी तीची एआय सहाय्यक आहे. आज तुम्हाला कशासाठी मदत हवी आहे?',hi:'नमस्ते, मैं आधी ती की एआई सहायिका हूँ। आज आपको किस बारे में मदद चाहिए?'})}}});
 if(!mounted.current)await end.current();
 }catch(cause){if(mounted.current)setError(t(callErrorMessage(cause)));}finally{pending.current=false;if(mounted.current)setBusy(false);}}
 const active=conversation.status==='connected';
 useEffect(()=>{if(!active)return;setSeconds(0);const began=Date.now();const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-began)/1000)),1000);return()=>clearInterval(timer);},[active]);
 const connecting=busy||conversation.status==='connecting';
 const muted=conversation.isMuted;
 const status=active?(muted?t({en:'Microphone muted',mr:'मायक्रोफोन बंद आहे',hi:'माइक्रोफोन बंद है'}):conversation.isSpeaking?t({en:'AADHI TI is speaking',mr:'आधी ती बोलत आहे',hi:'आधी ती बोल रही है'}):t({en:'Listening to you',mr:'तुमचे ऐकत आहे',hi:'आपकी बात सुन रही है'})):connecting?t({en:'Connecting…',mr:'जोडत आहे…',hi:'जोड़ रहे हैं…'}):t({en:'Ready when you are',mr:'तुमच्याशी बोलायला तयार',hi:'आपसे बात करने के लिए तैयार'});
 return <section className="relative isolate flex min-h-[620px] flex-col overflow-hidden rounded-[2rem] bg-kokum-900 px-5 py-7 text-center text-white shadow-xl sm:px-10 sm:py-9">
 <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 -z-10 size-96 -translate-x-1/2 rounded-full bg-kokum-500/20 blur-3xl"/>
 <div className="flex items-center justify-center gap-2 text-xs font-semibold tracking-widest text-kokum-200"><AudioLines size={15}/>{t({en:'AADHI TI · AI VOICE CALL',mr:'आधी ती · एआय व्हॉइस कॉल',hi:'आधी ती · एआई वॉइस कॉल'})}</div>
 <div className="relative mx-auto mt-9 grid size-28 place-items-center rounded-full border border-white/20 bg-white/10 shadow-[0_0_0_12px_#ffffff05] sm:size-32">
 {active&&<span aria-hidden="true" className="absolute -inset-3 rounded-full border border-white/20 motion-safe:animate-pulse"/>}
 <span aria-hidden="true" className="font-serif text-2xl text-pink-100">आधी ती</span>
 </div>
 <h1 className="mt-6 font-display text-3xl font-bold sm:text-4xl">{t({en:'Call AADHI TI',mr:'‘आधी ती’ला कॉल करा',hi:'‘आधी ती’ को कॉल करें'})}</h1>
 <p className="mt-2 text-sm text-kokum-200">{t({en:'Your AADHI TI AI assistant',mr:'तुमची आधी ती एआय सहाय्यक',hi:'आपकी आधी ती एआई सहायिका'})}</p>
 <p className="mt-3 text-sm leading-relaxed text-kokum-200">{t({mr: "‘आधी ती’शी मराठी, हिंदी किंवा इंग्रजीमध्ये बोला. हे फक्त AI द्वारे  मार्गदर्शन आहे; लोकेशन ट्रॅकिंग किंवा आपत्कालीन मदत पाठवण्याची सुविधा उपलब्ध नाही.",en: "Speak with AADHI TI in Marathi, Hindi or English. This is AI guidance only; location tracking and emergency dispatch are not available.",hi: "‘आधी ती’ से मराठी, हिंदी या अंग्रेज़ी में बात करें। यह केवल AI मार्गदर्शन है; लोकेशन ट्रैक करने या आपातकालीन मदद भेजने की सुविधा उपलब्ध नहीं है।",})}</p>
 <p className="mt-5 font-mono text-2xl tabular-nums text-white/90">{active?`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`:'— : —'}</p>
 <p role="status" className="mt-2 min-h-6 text-sm text-pink-100">{status}</p>
 {error&&<div role="alert" className="mt-4 rounded-xl bg-white/10 p-3 text-sm text-pink-100"><p>{error}</p><a href="/chat" className="mt-2 inline-flex min-h-11 items-center underline">{t({en:"Use text chat",mr:"मजकूर चॅट वापरा",hi:"टेक्स्ट चैट इस्तेमाल करें"})}</a></div>}
 <div className="mt-auto flex justify-center gap-10 pt-9 pb-6">
 {active&&<div className="flex flex-col items-center gap-3"><button aria-pressed={muted} aria-label={t({en:muted?'Unmute microphone':'Mute microphone',mr:muted?'मायक्रोफोन सुरू करा':'मायक्रोफोन बंद करा',hi:muted?'माइक्रोफोन चालू करें':'माइक्रोफोन बंद करें'})} onClick={()=>conversation.setMuted(!muted)} className={`grid size-16 place-items-center rounded-full transition ${muted?'bg-white text-kokum-900':'bg-white/15 text-white hover:bg-white/25'}`}>{muted?<MicOff size={25}/>:<Mic size={25}/>}</button><span className="text-xs text-kokum-100">{t({en:muted?'Unmute':'Mute',mr:muted?'आवाज सुरू':'मूक करा',hi:muted?'आवाज़ चालू':'म्यूट'})}</span></div>}
 <div className="flex flex-col items-center gap-3"><button onClick={active?()=>void conversation.endSession():start} disabled={!active&&(connecting||conversation.status!=='disconnected')} aria-label={t({en:active?'End call':'Start call',mr:active?'कॉल बंद करा':'कॉल सुरू करा',hi:active?'कॉल बंद करें':'कॉल शुरू करें'})} className={`grid size-16 place-items-center rounded-full shadow-lg transition active:scale-95 disabled:opacity-50 ${active?'bg-red-600 hover:bg-red-500':'bg-emerald-600 hover:bg-emerald-500'}`}>{active?<PhoneOff size={27}/>:<Phone size={27}/>}</button><span className="text-xs text-kokum-100">{t({en:active?'End call':'Start call',mr:active?'कॉल बंद करा':'कॉल सुरू करा',hi:active?'कॉल बंद करें':'कॉल शुरू करें'})}</span></div>
 </div>
 <div className="border-t border-white/10 pt-4">
 <p className="text-xs leading-relaxed text-kokum-200">{t({en:`An AI conversation, not a call to ${leaderNames.full.en}.`,mr:`हा एआय संवाद आहे, ${leaderNames.full.mr} यांना कॉल नाही.`,hi:`यह एआई बातचीत है, ${leaderNames.full.hi} को कॉल नहीं।`})}</p>
 <p className="mt-3 text-xs leading-relaxed text-kokum-200">{t({en:'Starting the call shares your microphone audio with ElevenLabs to respond. Audio recording is off; transcripts may remain with the provider for one day. End the call at any time.',mr:'कॉल सुरू केल्यावर उत्तर देण्यासाठी तुमचा आवाज ElevenLabs कडे जातो. आवाजाचे रेकॉर्डिंग बंद आहे; संभाषणाचा मजकूर सेवेकडे एक दिवस राहू शकतो. कॉल कधीही बंद करता येतो.',hi:'कॉल शुरू करने पर जवाब देने के लिए आपकी आवाज़ ElevenLabs को भेजी जाती है। आवाज़ की रिकॉर्डिंग बंद है; बातचीत का लिखित रूप सेवा के पास एक दिन रह सकता है। कॉल कभी भी बंद कर सकते हैं।'})}</p>

 <a href="tel:112" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-white underline underline-offset-4">{t({en:'Emergency? Call 112',mr:'आणीबाणी? 112 वर कॉल करा',hi:'आपातकाल? 112 पर कॉल करें'})}</a>
 </div>
 </section>;
}
