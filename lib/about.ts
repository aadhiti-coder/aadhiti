import type { AiAnswer } from './ai';
import type { Lang } from './kb/types';
import { leader } from './leader';

/** Identity questions only; mentioning a name in a help request is not an about request. */
export function aboutIntent(text: string): 'service' | 'person' | null {
  const q = text.trim();
  const question = /about|who|what is|tell me|माहिती|कोण|काय आहे|बद्दल|परिचय|बारे|कौन|क्या है|kaun|kya hai|batao|baddal|mahiti/i.test(q);
  const person = /\baditi\b|आदिती|अदिति|अदिती|तटकरे|tatkare/i.test(q);
  const service = /aadhi\s*ti|aadhi|आधी\s*ती|this (app|bot)|इस (ऐप|बॉट)|हे अ‍?ॅप/i.test(q);
  if (person && (question || /^(aditi(?: tatkare)?|आदिती|अदिति|आदिती तटकरे)[.!? ]*$/i.test(q))) return 'person';
  if ((service && question) || /^(about|aadhi\s*ti|आधी\s*ती)[.!? ]*$/i.test(q)) return 'service';
  return null;
}

export function aboutAnswer(kind: 'service' | 'person', lang: Lang): AiAnswer {
  const service = {
    mr: ['‘आधी ती’ ही महिलांसाठी माहिती आणि मार्गदर्शन देणारी AI सहाय्यक आहे. सुरक्षितता, योजना, आरोग्य, हक्क, शिक्षण आणि कौशल्यांबद्दल मराठी, हिंदी किंवा इंग्रजीत विचारा.', 'ती मंत्री स्वतः किंवा आपत्कालीन प्रतिसाद पथक नाही. ती तुमचे लोकेशन पाहू शकत नाही किंवा मदत पथक पाठवू शकत नाही.'],
    hi: ['‘आधी ती’ महिलाओं को जानकारी और मार्गदर्शन देने वाली AI सहायिका है। सुरक्षा, योजनाओं, सेहत, अधिकारों, शिक्षा और कौशल के बारे में मराठी, हिंदी या अंग्रेज़ी में पूछें।', 'यह मंत्री स्वयं या आपातकालीन सहायता टीम नहीं है। यह आपकी लोकेशन नहीं देख सकती और मदद के लिए टीम नहीं भेज सकती।'],
    en: ['AADHI TI is an AI information and guidance assistant for women. Ask about safety, schemes, health, rights, education and skills in Marathi, Hindi or English.', 'It is not the minister herself or an emergency response team. It cannot see your location or dispatch help.'],
  };
  return {intent:'LEARN',risk:'P3',understand:'',answer:kind==='service'?service[lang]:[leader.name[lang],leader.roles.map(r=>r[lang]).join('. '),leader.whyApp[lang]],safetyCheck:'',nextStep:'',options:[],helplines:[],module:'none',source:lang==='en'?'AADHI TI service information':lang==='hi'?'आधी ती की जानकारी':'आधी तीची माहिती',verify:'',lang,topicId:null};
}
