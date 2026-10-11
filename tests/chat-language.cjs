const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const scope = {exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/detectLang.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,scope);
const {detectLang,conversationLang}=scope.exports;
test('romanised Indian languages work with English UI',()=>{
 assert.equal(detectLang('mala shikaycha aahe','en'),'mr');
 assert.equal(detectLang('mujhe madad chahiye','en'),'hi');
 assert.equal(detectLang('Where can I study?','mr'),'en');
});
test('short replies preserve the preceding answer language',()=>{
 assert.equal(conversationLang('yes','en',[{role:'assistant',text:'तुम्हाला कोणता कोर्स पाहिजे?'}]),'mr');
 assert.equal(conversationLang('documents','en',[{role:'assistant',text:'तुम्हाला अर्जासाठी कोणती कागदपत्रं लागतात हे सांगू का?'}]),'mr');
 assert.equal(conversationLang('16','en',[{role:'assistant',text:'आपकी उम्र क्या है?'}]),'hi');
 assert.equal(conversationLang('Reply in English','mr',[{role:'assistant',text:'काय पाहिजे?'}]),'en');
});

test('switch language with each clear new reply',()=>{
 const h=[{role:'assistant',text:'तुम्हाला काय पाहिजे?'}];
 assert.equal(conversationLang('मुझे योजना की जानकारी चाहिए','mr',h),'hi');
 assert.equal(conversationLang('Where can I apply?','hi',h),'en');
 assert.equal(conversationLang('मला अर्ज कुठे मिळेल','en',h),'mr');
 assert.equal(conversationLang('aap batao','en',[]),'hi');
});

test('Hindi nasal verb is not mistaken for Marathi; scheme names do not override English',()=>{
 assert.equal(detectLang('मुझे सिलाई आती है। घर से कमाई कैसे शुरू करूँ?','hi'),'hi');
 assert.equal(conversationLang('documents?','en',[{role:'assistant',text:'You can apply for Mukhyamantri Majhi Ladki Bahin Yojana. Would you like to learn more?'}]),'en');
});
