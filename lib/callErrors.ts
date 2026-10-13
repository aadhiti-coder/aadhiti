import type { L } from './kb';

export function callErrorMessage(value: unknown): L {
  const error = value as { name?: string; message?: string; closeReason?: string } | null;
  const code = typeof value === 'string' ? value : `${error?.name ?? ''} ${error?.message ?? ''} ${error?.closeReason ?? ''}`;
  if (/NotAllowedError|PermissionDeniedError/.test(code)) return { en:'Microphone access was denied. Allow it in your browser settings, then try again.', mr:'मायक्रोफोनची परवानगी नाकारली आहे. ब्राउझरच्या सेटिंगमध्ये परवानगी देऊन पुन्हा प्रयत्न करा.', hi:'माइक्रोफोन की अनुमति नहीं मिली। ब्राउज़र सेटिंग में अनुमति देकर फिर कोशिश करें।' };
  if (/NotFoundError|NotReadableError/.test(code)) return { en:'Your microphone is unavailable or being used by another app. Check it and try again.', mr:'मायक्रोफोन उपलब्ध नाही किंवा दुसरे ॲप वापरत आहे. तपासून पुन्हा प्रयत्न करा.', hi:'माइक्रोफोन उपलब्ध नहीं है या दूसरे ऐप में इस्तेमाल हो रहा है। जाँचकर फिर कोशिश करें।' };
  if (/UNSUPPORTED/.test(code)) return { en:'Voice calls need a browser with microphone support on HTTPS or localhost.', mr:'व्हॉइस कॉलसाठी मायक्रोफोनला समर्थन देणारा ब्राउझर आणि HTTPS किंवा localhost आवश्यक आहे.', hi:'वॉइस कॉल के लिए माइक्रोफोन वाला ब्राउज़र और HTTPS या localhost ज़रूरी है।' };
  if (/SETUP_REQUIRED|PROVIDER_AUTH|AGENT_NOT_FOUND|override|not allowed/i.test(code)) return { en:'The voice service configuration needs attention. Please use text chat while the administrator checks it.', mr:'व्हॉइस सेवेची सेटिंग तपासणे आवश्यक आहे. तोपर्यंत मजकूर चॅट वापरा.', hi:'वॉइस सेवा की सेटिंग जाँचनी होगी। तब तक टेक्स्ट चैट का इस्तेमाल करें।' };
  if (/LIMIT|quota|credit|concurr|capacity/i.test(code)) return { en:'The voice service has reached a usage or capacity limit. Try later or use text chat.', mr:'व्हॉइस सेवेची वापर किंवा क्षमतेची मर्यादा गाठली आहे. नंतर प्रयत्न करा किंवा मजकूर चॅट वापरा.', hi:'वॉइस सेवा की उपयोग या क्षमता सीमा पूरी हो गई है। बाद में कोशिश करें या टेक्स्ट चैट इस्तेमाल करें।' };
  if (/AUTH_REQUIRED/.test(code)) return { en:'Please sign in again to start a call.', mr:'कॉल सुरू करण्यासाठी पुन्हा साइन इन करा.', hi:'कॉल शुरू करने के लिए फिर साइन इन करें।' };
  return { en:'The voice service could not connect. Check your connection and try again, or use text chat.', mr:'व्हॉइस सेवेशी संपर्क झाला नाही. इंटरनेट तपासून पुन्हा प्रयत्न करा किंवा मजकूर चॅट वापरा.', hi:'वॉइस सेवा से संपर्क नहीं हुआ। इंटरनेट जाँचकर फिर कोशिश करें या टेक्स्ट चैट इस्तेमाल करें।' };
}
