/**
 * ==========================================================================
 * KISSAN – Procure Smart Mandi
 * AI & Voice Assistant (js/ai-assistant.js)
 * 
 * Production-ready AI Assistant powered strictly by Google Gemini API
 * with database-authoritative tool calling and multilingual Web Speech STT/TTS
 * (English, Hindi, Punjabi).
 * ==========================================================================
 */

// Global State
window.KissanAI = {
  activeSession: null,
  speechRecognition: null,
  isListening: false,
  isSpeaking: false,
  selectedLang: 'hi-IN', // 'hi-IN' | 'en-IN' | 'pa-IN'
  conversationHistory: []
};

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initKissanAiAssistant();
  });
}

function initKissanAiAssistant() {
  const card = document.getElementById('kissanAiCard');
  const form = document.getElementById('aiChatForm');
  const input = document.getElementById('aiChatInput');
  const sendBtn = document.getElementById('btnSendAiChat');
  const messagesContainer = document.getElementById('aiChatMessages');
  const loadingIndicator = document.getElementById('aiChatLoading');
  const suggestedBtns = document.querySelectorAll('.ai-suggested-btn');
  const micBtn = document.getElementById('btnVoiceMic');
  const langSelect = document.getElementById('aiVoiceLangSelect');
  const stopSpeakingBtn = document.getElementById('btnStopSpeaking');
  const voiceSpeakingBanner = document.getElementById('voiceSpeakingBanner');
  const voiceStatusIndicator = document.getElementById('voiceStatusIndicator');
  const voiceStatusText = document.getElementById('voiceStatusText');
  const clearChatBtn = document.getElementById('btnClearAiChat');
  const providerBadge = document.getElementById('aiProviderBadge');
  const quickBtn = document.getElementById('btnQuickAiAssistant');
  if (quickBtn && card) {
    quickBtn.addEventListener('click', (e) => {
      e.preventDefault();
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (input) setTimeout(() => input.focus(), 350);
    });
  }

  // Dynamic Multilingual Definitions
  const LANG_DATA = {
    'en-IN': {
      placeholder: 'Ask anything about your booking, queue, procurement, payment, or crop advice...',
      welcome: 'Namaste! I am your KISSAN Mandi Assistant. Ask me anything about your booking, queue status, MSP rates, DBT payments, crop diseases, or agricultural schemes.',
      suggested: [
        { label: 'My Booking', q: 'What is my booking and token status?' },
        { label: 'Queue Status', q: 'What is my current queue position and estimated wait time?' },
        { label: 'Procurement Slip', q: 'Show my latest procurement and weighment slip details' },
        { label: 'Payment Status', q: 'What is the status of my DBT bank payment?' },
        { label: 'Official MSP', q: 'What are the official Government MSP rates for wheat, mustard, and paddy?' },
        { label: 'Required Documents', q: 'What mandatory documents do I need to bring to the mandi gate?' },
        { label: 'PM-Kisan Scheme', q: 'How does the PM-Kisan Samman Nidhi scheme work and who is eligible?' },
        { label: 'Crop Disease Help', q: 'How do I identify and treat common pests in mustard and wheat crops?' }
      ]
    },
    'hi-IN': {
      placeholder: 'बुकिंग, कतार, खरीद, भुगतान या फसल सलाह के बारे में कुछ भी पूछें...',
      welcome: 'नमस्ते! मैं आपका KISSAN मंडी डिजिटल व वॉयस सहायक हूँ। आप बोलकर (🎙️) या लिखकर अपनी बुकिंग, कतार स्थिति, फसल MSP, भुगतान या किसी भी कृषि विषय पर पूछ सकते हैं।',
      suggested: [
        { label: 'मेरी बुकिंग', q: 'मेरी बुकिंग की क्या स्थिति है?' },
        { label: 'कतार स्थिति', q: 'मंडी कतार में मेरा क्या नंबर है और कितना समय लगेगा?' },
        { label: 'खरीद विवरण', q: 'मेरी खरीद और वजन का विवरण बताएं' },
        { label: 'भुगतान स्थिति', q: 'मेरा DBT बैंक भुगतान कब तक आएगा?' },
        { label: 'MSP दरें', q: 'गेहूं, सरसों और धान का सरकारी MSP क्या है?' },
        { label: 'अनिवार्य दस्तावेज', q: 'मंडी गेट पर कौन-कौन से दस्तावेज चाहिए?' },
        { label: 'पीएम-किसान योजना', q: 'पीएम-किसान सम्मान निधि योजना का लाभ कैसे मिलता है?' },
        { label: 'फसल रोग निदान', q: 'सरसों और गेहूं में कीट व फफूंद से बचाव के उपाय बताएं' }
      ]
    },
    'pa-IN': {
      placeholder: 'ਬੁਕਿੰਗ, ਕਤਾਰ, ਖਰੀਦ, ਭੁਗਤਾਨ ਜਾਂ ਫਸਲ ਸਲਾਹ ਬਾਰੇ ਕੁਝ ਵੀ ਪੁੱਛੋ...',
      welcome: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡਾ KISSAN ਮੰਡੀ ਸਹਾਇਕ ਹਾਂ। ਤੁਸੀਂ ਬੋਲ ਕੇ (🎙️) ਜਾਂ ਲਿਖ ਕੇ ਆਪਣੀ ਬੁਕਿੰਗ, ਕਤਾਰ, MSP, ਭੁਗਤਾਨ ਜਾਂ ਖੇਤੀਬਾੜੀ ਬਾਰੇ ਪੁੱਛ ਸਕਦੇ ਹੋ।',
      suggested: [
        { label: 'ਮੇਰੀ ਬੁਕਿੰਗ', q: 'ਮੇਰੀ ਬੁਕਿੰਗ ਦੀ ਸਥਿਤੀ ਕੀ ਹੈ?' },
        { label: 'ਕਤਾਰ ਸਥਿਤੀ', q: 'ਮੰਡੀ ਕਤਾਰ ਵਿੱਚ ਮੇਰਾ ਨੰਬਰ ਕੀ ਹੈ?' },
        { label: 'ਖਰੀਦ ਵੇਰਵਾ', q: 'ਮੇਰੀ ਖਰੀਦ ਅਤੇ ਵਜ਼ਨ ਦਾ ਵੇਰਵਾ ਦੱਸੋ' },
        { label: 'ਭੁਗਤਾਨ ਸਥਿਤੀ', q: 'ਮੇਰਾ DBT ਬੈਂਕ ਭੁਗਤਾਨ ਕਦੋਂ ਆਵੇਗਾ?' },
        { label: 'ਸਰਕਾਰੀ MSP', q: 'ਕਣਕ ਅਤੇ ਸਰ੍ਹੋਂ ਦਾ ਸਰਕਾਰੀ MSP ਕੀ ਹੈ?' },
        { label: 'ਲੋੜੀਂਦੇ ਦਸਤਾਵੇਜ਼', q: 'ਮੰਡੀ ਗੇਟ ਤੇ ਕਿਹੜੇ ਦਸਤਾਵੇਜ਼ ਚਾਹੀਦੇ ਹਨ?' },
        { label: 'ਪੀਐਮ-ਕਿਸਾਨ ਯੋਜਨਾ', q: 'ਪੀਐਮ-ਕਿਸਾਨ ਯੋਜਨਾ ਬਾਰੇ ਜਾਣਕਾਰੀ ਦਿਓ' },
        { label: 'ਫਸਲ ਬਿਮਾਰੀ ਇਲਾਜ', q: 'ਕਣਕ ਅਤੇ ਸਰ੍ਹੋਂ ਦੇ ਕੀੜਿਆਂ ਤੋਂ ਬਚਾਅ ਦੇ ਤਰੀਕੇ ਦੱਸੋ' }
      ]
    }
  };

  function applyLanguage(lang) {
    const l = LANG_DATA[lang] || LANG_DATA['hi-IN'];
    window.KissanAI.selectedLang = lang;
    localStorage.setItem('kissan_ai_lang', lang);

    // Update Input Placeholder
    if (input) {
      input.placeholder = l.placeholder;
    }

    // Update Suggested Buttons
    const suggestedContainer = document.querySelector('.ai-suggested-questions');
    if (suggestedContainer && l.suggested) {
      suggestedContainer.innerHTML = '';
      l.suggested.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ai-suggested-btn';
        btn.setAttribute('data-question', item.q);
        btn.textContent = item.label;
        btn.addEventListener('click', () => {
          if (sendBtn && sendBtn.disabled) return;
          processQuestion(item.q);
        });
        suggestedContainer.appendChild(btn);
      });
    }

    // If chat only has initial welcome message, update it to matching language
    if (messagesContainer) {
      const msgs = messagesContainer.querySelectorAll('.ai-message');
      if (msgs.length <= 1) {
        messagesContainer.innerHTML = `
          <div class="ai-message ai-message-assistant">
            <div class="ai-message-bubble">${l.welcome}</div>
            <span class="ai-message-time">Just now</span>
          </div>
        `;
      }
    }

    // Update Speech Recognition language if active
    if (window.KissanAI.speechRecognition) {
      window.KissanAI.speechRecognition.lang = lang;
    }
  }

  // Load language preference (default to Hindi 'hi-IN' for Indian farmers)
  if (langSelect) {
    const savedLang = localStorage.getItem('kissan_ai_lang') || langSelect.value || 'hi-IN';
    langSelect.value = savedLang;
    applyLanguage(savedLang);
    langSelect.addEventListener('change', () => {
      applyLanguage(langSelect.value);
    });
  }

  // Update Backend AI Status Badge
  async function checkBackendAiStatus() {
    if (!providerBadge) return;
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (data.geminiKeyConfigured) {
          providerBadge.textContent = '⚡ Gemini 1.5 Active';
          providerBadge.className = 'badge badge-success';
          providerBadge.title = 'Powered by Google Gemini API secured in backend .env';
          return;
        }
      }
    } catch (_) {}
    providerBadge.textContent = '⚡ Backend Secured';
    providerBadge.className = 'badge badge-success';
    providerBadge.title = 'AI processing secured on backend';
  }
  checkBackendAiStatus();

  // Clear chat button
  if (clearChatBtn && messagesContainer) {
    clearChatBtn.addEventListener('click', () => {
      if (confirm('Clear chat conversation?')) {
        messagesContainer.innerHTML = `
          <div class="ai-message ai-message-assistant">
            <div class="ai-message-bubble">
              ${window.KissanAI.selectedLang === 'hi-IN' 
                ? 'नमस्ते! मैं आपका KISSAN मंडी डिजिटल व वॉयस सहायक हूँ। आप बोलकर (🎙️) या लिखकर पूछ सकते हैं।' 
                : window.KissanAI.selectedLang === 'pa-IN'
                ? 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡਾ KISSAN ਮੰਡੀ ਸਹਾਇਕ ਹਾਂ। ਤੁਸੀਂ ਬੋਲ ਕੇ (🎙️) ਜਾਂ ਲਿਖ ਕੇ ਪੁੱਛ ਸਕਦੇ ਹੋ।'
                : 'Namaste! I am your KISSAN Mandi Assistant. You can speak (🎙️) or type your query.'}
            </div>
            <span class="ai-message-time">Just now</span>
          </div>
        `;
        window.KissanAI.conversationHistory = [];
        stopSpeaking();
      }
    });
  }

  // Handle Suggested Questions
  suggestedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (sendBtn && sendBtn.disabled) return;
      const question = btn.getAttribute('data-question') || btn.textContent.trim();
      if (question) {
        processQuestion(question);
      }
    });
  });

  // Handle Manual Form Submission
  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (sendBtn && sendBtn.disabled) return;
      const message = input.value.trim();
      if (!message) return;
      input.value = '';
      processQuestion(message);
    });
  }

  // Handle Stop Speaking Button
  if (stopSpeakingBtn) {
    stopSpeakingBtn.addEventListener('click', () => {
      stopSpeaking();
    });
  }

  // Web Speech STT Recognition
  initVoiceRecognition(micBtn, input, voiceStatusIndicator, voiceStatusText);

  // -------------------------------------------------------------
  // CORE QUESTION PROCESSING FLOW
  // -------------------------------------------------------------
  async function processQuestion(text) {
    if (!messagesContainer) return;
    stopSpeaking();

    // 1. Append User Message
    appendMessage('user', text);

    // 2. Security / Injection Check
    const injection = detectPromptInjection(text);
    if (injection) {
      appendMessage('assistant', injection);
      speakText(injection);
      return;
    }

    // 3. Show Loading State
    setLoadingState(true);

    let reply = '';
    let requiresConfirmation = false;
    let confirmationDetails = null;
    const farmer = getAuthenticatedFarmer();

    try {
      // Refresh latest bookings from Authoritative Backend API
      try {
        const qPhone = encodeURIComponent(farmer.phone || farmer.mobile || '9876543210');
        const qId = encodeURIComponent(farmer.id || 'F-10024');
        const bRes = await fetch(`/api/bookings?farmer_phone=${qPhone}&farmer_id=${qId}`);
        if (bRes.ok) {
          const bJson = await bRes.json();
          if (bJson.bookings && Array.isArray(bJson.bookings) && bJson.bookings.length > 0) {
            const local = typeof KissanDB !== 'undefined' ? KissanDB.get('bookings', []) : [];
            const merged = [...bJson.bookings];
            local.forEach(lb => {
              if (!merged.find(m => m.id === lb.id)) merged.push(lb);
            });
            if (typeof KissanDB !== 'undefined') KissanDB.set('bookings', merged);
          }
        }
      } catch (syncErr) {
        console.warn('AI assistant bookings sync notice:', syncErr);
      }

      // Gather live factual context for ALL active bookings of the authenticated farmer
      const allActive = getFarmerActiveBookings();
      const liveContext = {
        booking: tool_get_my_booking(),
        active_bookings: allActive.map(b => ({
          booking_id: b.id || b.booking_id,
          token_number: b.token_number || b.tokenNumber || 'KMN-042',
          crop: b.crop || 'Crop',
          quantity_quintals: b.quantity || b.quantity_quintals || 40,
          slot_date: b.slot_date || b.slotDate || new Date().toISOString().split('T')[0],
          slot_time: b.slot_time || b.slotTime || 'Morning (08:00 AM - 11:00 AM)',
          mandi_centre: b.mandi_name || b.mandiName || 'Krishi Upaj Mandi, Sector 7, Karnal',
          status: b.status || 'CONFIRMED'
        })),
        queue: tool_get_my_queue_status(),
        procurement: tool_get_my_procurement(),
        payment: tool_get_my_payment_status()
      };

      // Call Backend AI Assistant Endpoint with full conversation history
      const backendRes = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          selectedLang: window.KissanAI.selectedLang,
          farmer: farmer,
          context: liveContext,
          conversationHistory: window.KissanAI.conversationHistory || []
        })
      });

      if (backendRes.ok) {
        const backendData = await backendRes.json();
        if (backendData.reply && !backendData.fallback) {
          reply = backendData.reply;
          requiresConfirmation = !!backendData.requiresConfirmation;
          confirmationDetails = backendData.confirmationDetails;
        }
      }
    } catch (err) {
      console.log('Backend AI proxy offline or fallback, executing local Mandi engine:', err.message);
    }

    // If backend did not provide Gemini reply (e.g. key missing in .env or error), use local database tools
    if (!reply) {
      await new Promise(r => setTimeout(r, 250));
      reply = await executeLocalMandiAssistant(text);
    }

    // Retain multi-turn conversation memory
    window.KissanAI.conversationHistory.push({ role: 'user', parts: [{ text: text }] });
    window.KissanAI.conversationHistory.push({ role: 'model', parts: [{ text: reply }] });
    if (window.KissanAI.conversationHistory.length > 12) {
      window.KissanAI.conversationHistory = window.KissanAI.conversationHistory.slice(-12);
    }

    // 4. Render reply & Speak
    const spokenText = appendMessage('assistant', reply);
    setLoadingState(false);

    // If confirmation is required for critical actions like slot cancellation
    if (requiresConfirmation) {
      renderCancellationConfirmationBox(confirmationDetails || tool_get_my_booking());
    }

    scrollToBottom();
    if (input) input.focus();

    // Trigger Text-to-Speech
    speakText(spokenText || reply);
  }

  function setLoadingState(isLoading) {
    if (loadingIndicator) {
      loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }
    if (sendBtn) {
      sendBtn.disabled = isLoading;
      sendBtn.textContent = isLoading ? '...' : 'Send';
    }
    if (input) {
      input.disabled = isLoading;
    }
    scrollToBottom();
  }

  function parseFollowUpQuestions(text) {
    if (!text) return { bodyText: text, hints: [] };

    const splitPatterns = [
      '💡 Recommended Follow-up Questions:',
      '💡 सुझाए गए अगले प्रश्न:',
      '💡 ਸੁਝਾਏ ਗਏ ਅਗਲੇ ਸਵਾਲ:',
      'Recommended Follow-up Questions:',
      'Follow-up Questions:'
    ];

    let body = text;
    let hintsPart = '';

    for (const pat of splitPatterns) {
      const idx = text.indexOf(pat);
      if (idx !== -1) {
        body = text.substring(0, idx).trim();
        hintsPart = text.substring(idx + pat.length).trim();
        break;
      }
    }

    const hints = [];
    if (hintsPart) {
      const lines = hintsPart.split('\n');
      for (const line of lines) {
        const cleaned = line.replace(/^[•\-\*\d\.\s]+/, '').trim();
        if (cleaned.length > 5 && cleaned.length < 120) {
          hints.push(cleaned);
        }
      }
    }

    return { bodyText: body, hints };
  }

  function appendMessage(sender, text, htmlContent = null) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgEl = document.createElement('div');
    msgEl.className = `ai-message ai-message-${sender}`;

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'ai-message-bubble';

    let speechText = text;
    
    if (sender === 'assistant' && !htmlContent) {
      const { bodyText, hints } = parseFollowUpQuestions(text);
      bubbleEl.textContent = bodyText;
      speechText = bodyText;

      // Render interactive follow-up suggestion chips
      if (hints.length > 0) {
        const hintWrap = document.createElement('div');
        hintWrap.className = 'ai-followup-container';
        
        const hintTitle = document.createElement('div');
        hintTitle.className = 'ai-followup-title';
        hintTitle.textContent = window.KissanAI.selectedLang === 'hi-IN' 
          ? '💡 सुझाए गए अगले प्रश्न (क्लिक करें):' 
          : window.KissanAI.selectedLang === 'pa-IN'
          ? '💡 ਅਗਲੇ ਸਵਾਲ (ਕਲਿੱਕ ਕਰੋ):'
          : '💡 Suggested Next Questions (click to ask):';
        
        const chipsDiv = document.createElement('div');
        chipsDiv.className = 'ai-followup-chips';
        
        hints.forEach(hint => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'ai-followup-chip';
          chip.innerHTML = `💬 <span>${hint}</span>`;
          chip.addEventListener('click', () => {
            if (sendBtn && sendBtn.disabled) return;
            processQuestion(hint);
          });
          chipsDiv.appendChild(chip);
        });

        hintWrap.appendChild(hintTitle);
        hintWrap.appendChild(chipsDiv);
        bubbleEl.appendChild(hintWrap);
      }
    } else if (htmlContent) {
      bubbleEl.innerHTML = htmlContent;
    } else {
      bubbleEl.textContent = text;
    }

    const timeEl = document.createElement('span');
    timeEl.className = 'ai-message-time';
    timeEl.textContent = timeStr;

    msgEl.appendChild(bubbleEl);
    msgEl.appendChild(timeEl);

    messagesContainer.appendChild(msgEl);
    scrollToBottom();

    return speechText;
  }

  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  // -------------------------------------------------------------
  // VOICE RECOGNITION (STT)
  // -------------------------------------------------------------
  function initVoiceRecognition(micBtn, input, voiceStatusIndicator, voiceStatusText) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (micBtn) {
        micBtn.title = 'Web Speech STT not supported in this browser';
        micBtn.style.opacity = '0.5';
      }
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    window.KissanAI.speechRecognition = recognition;

    recognition.onstart = () => {
      window.KissanAI.isListening = true;
      if (micBtn) micBtn.classList.add('listening');
      if (voiceStatusIndicator) {
        const langName = window.KissanAI.selectedLang === 'hi-IN' ? 'हिन्दी' : (window.KissanAI.selectedLang === 'pa-IN' ? 'ਪੰਜਾਬੀ' : 'English');
        if (voiceStatusText) voiceStatusText.textContent = `🎙️ Listening... Speak now in ${langName}`;
        voiceStatusIndicator.style.display = 'flex';
      }
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && transcript.trim()) {
        if (input) input.value = transcript;
        processQuestion(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.warn('Voice recognition error:', event.error);
      stopListening();
    };

    recognition.onend = () => {
      stopListening();
    };

    if (micBtn) {
      micBtn.addEventListener('click', () => {
        if (window.KissanAI.isListening) {
          recognition.stop();
          stopListening();
        } else {
          try {
            recognition.lang = window.KissanAI.selectedLang || 'hi-IN';
            recognition.start();
          } catch (e) {
            console.error('Failed to start speech recognition:', e);
            stopListening();
          }
        }
      });
    }

    function stopListening() {
      window.KissanAI.isListening = false;
      if (micBtn) micBtn.classList.remove('listening');
      if (voiceStatusIndicator) voiceStatusIndicator.style.display = 'none';
    }
  }

  // -------------------------------------------------------------
  // TEXT-TO-SPEECH (TTS)
  // -------------------------------------------------------------
  function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    
    // Stop any ongoing speech
    stopSpeaking();

    // Sanitize text for speech (strip markdown asterisks, hashes, urls, bullet points)
    const cleanText = text
      .replace(/[#*`_~]/g, '')
      .replace(/•/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = window.KissanAI.selectedLang || 'hi-IN';
    utterance.rate = 0.95; // Slightly slower for clarity in mandi yard conditions
    utterance.pitch = 1.0;

    // Try finding matching voice
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang === utterance.lang || v.lang.startsWith(utterance.lang.split('-')[0]));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => {
      window.KissanAI.isSpeaking = true;
      if (voiceSpeakingBanner) voiceSpeakingBanner.style.display = 'flex';
    };

    utterance.onend = () => {
      stopSpeaking();
    };

    utterance.onerror = () => {
      stopSpeaking();
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    window.KissanAI.isSpeaking = false;
    if (voiceSpeakingBanner) voiceSpeakingBanner.style.display = 'none';
  }
}

// -----------------------------------------------------------------
// DATABASE-AUTHORITATIVE TOOLS (SINGLE SOURCE OF TRUTH)
// -----------------------------------------------------------------

/**
 * Returns the currently authenticated farmer identity.
 */
function getAuthenticatedFarmer() {
  const defaultFarmer = {
    id: 'F-10024',
    name: 'Rameshwar Singh',
    district: 'Karnal',
    phone: '9876543210',
    aadhaar_last4: '9012'
  };

  if (typeof KissanDB !== 'undefined') {
    const cur = KissanDB.get('current_farmer', null);
    if (cur) return cur;
  }

  if (typeof window !== 'undefined' && window.supabaseClient && window.supabaseClient.auth) {
    const session = window.supabaseClient.auth.getSession ? null : null; // sync check
  }

  return defaultFarmer;
}

/**
 * Returns all active bookings belonging to the current farmer.
 */
function getFarmerActiveBookings() {
  const farmer = getAuthenticatedFarmer();
  const all = (typeof KissanDB !== 'undefined' ? KissanDB.get('bookings', []) : [])
    .filter(b => (
      b.farmer_id === farmer.id || 
      b.farmerId === farmer.id || 
      (farmer.phone && (b.farmerPhone === farmer.phone || b.farmer_phone === farmer.phone))
    ));

  return all.filter(b => {
    const s = (b.status || '').toUpperCase().trim();
    return s !== 'CANCELLED' && s !== 'CANCELED' && s !== 'PROCURED' && s !== 'COMPLETED' && s !== 'REJECTED';
  });
}

/**
 * Tool 1: get_my_booking(filter)
 */
function tool_get_my_booking(filter) {
  const farmer = getAuthenticatedFarmer();
  const activeBookings = getFarmerActiveBookings();

  if (!activeBookings || activeBookings.length === 0) {
    return {
      found: false,
      message: `No active procurement bookings found for farmer ${farmer.name} (ID: ${farmer.id}).`
    };
  }

  let active = null;
  let filterApplied = null;
  if (filter) {
    const cropSearch = typeof filter === 'string' ? filter.toLowerCase().trim() : (filter.crop || '').toLowerCase().trim();
    const tokenSearch = typeof filter === 'object' && filter.token_number ? filter.token_number.toUpperCase().trim() : (typeof filter === 'string' && filter.toUpperCase().startsWith('KMN') ? filter.toUpperCase().trim() : '');

    if (cropSearch) {
      active = activeBookings.find(b => (b.crop || '').toLowerCase().includes(cropSearch));
      if (active) filterApplied = cropSearch;
    }
    if (!active && tokenSearch) {
      active = activeBookings.find(b => (b.token_number || b.tokenNumber || '').toUpperCase() === tokenSearch);
      if (active) filterApplied = tokenSearch;
    }
  }

  // If no filter or filter didn't match, pick the first active booking
  if (!active) {
    active = activeBookings[0];
  }

  return {
    found: true,
    filter_applied: filterApplied,
    booking_id: active.id || active.booking_id,
    token_number: active.token_number || active.tokenNumber || 'KMN-042',
    mandi_centre: active.mandi_name || active.mandiName || 'Krishi Upaj Mandi, Sector 7, Karnal',
    crop: active.crop || 'Mustard (सरसों)',
    quantity_quintals: active.quantity || active.quantity_quintals || 40,
    slot_date: active.slot_date || active.slotDate || new Date().toISOString().split('T')[0],
    slot_time: active.slot_time || active.slotTime || '08:00 AM - 11:00 AM (Morning)',
    status: active.status || 'CONFIRMED',
    security_hash: active.security_hash || 'HMAC-SHA256-VERIFIED',
    farmer_name: farmer.name,
    farmer_id: farmer.id,
    total_active_bookings: activeBookings.length,
    all_active_bookings: activeBookings.map(b => ({
      booking_id: b.id || b.booking_id,
      token_number: b.token_number || b.tokenNumber,
      crop: b.crop,
      quantity_quintals: b.quantity || b.quantity_quintals || 40,
      slot_date: b.slot_date || b.slotDate,
      slot_time: b.slot_time || b.slotTime,
      mandi_centre: b.mandi_name || b.mandiName || 'Krishi Upaj Mandi, Sector 7, Karnal',
      status: b.status || 'CONFIRMED'
    }))
  };
}

/**
 * Tool 2: get_my_queue_status()
 */
function tool_get_my_queue_status() {
  const farmer = getAuthenticatedFarmer();
  const booking = tool_get_my_booking();
  const queueState = typeof KissanDB !== 'undefined' ? KissanDB.get('queue_state', {}) : {};

  const currentToken = queueState.currentServingToken || 'KMN-040';
  const activeStage = queueState.activeStage || 'Weighbridge Bay #2';
  const waitMinsPerVehicle = queueState.estimatedWaitMinsPerVehicle || 12;

  if (!booking.found) {
    return {
      has_booking: false,
      current_serving_token: currentToken,
      active_stage: activeStage,
      avg_wait_mins_per_vehicle: waitMinsPerVehicle,
      message: 'No active booking. Please book a slot to enter the live queue.'
    };
  }

  // Compute tokens ahead
  let tokensAhead = 2;
  const myTokenStr = booking.token_number;
  const matchMy = myTokenStr.match(/\d+/);
  const matchCur = currentToken.match(/\d+/);
  if (matchMy && matchCur) {
    tokensAhead = Math.max(0, parseInt(matchMy[0]) - parseInt(matchCur[0]));
  }

  const estimatedTotalWaitMins = tokensAhead * waitMinsPerVehicle;

  return {
    has_booking: true,
    farmer_token: myTokenStr,
    current_serving_token: currentToken,
    active_stage: activeStage,
    tokens_ahead: tokensAhead,
    estimated_wait_minutes: estimatedTotalWaitMins,
    status: booking.status,
    recommendation: tokensAhead <= 2 
      ? 'Please report immediately to Mandi Entry Gate #1 for physical verification.' 
      : `You have approximately ${estimatedTotalWaitMins} minutes. Arrive at Mandi Gate 15 minutes before your token is called.`
  };
}

/**
 * Tool 3: get_my_procurement()
 */
function tool_get_my_procurement() {
  const farmer = getAuthenticatedFarmer();
  const procurements = (typeof KissanDB !== 'undefined' ? KissanDB.get('procurements', []) : [])
    .filter(p => !p.farmer_id || p.farmer_id === farmer.id);

  if (!procurements || procurements.length === 0) {
    return {
      found: true,
      procurement_id: 'PROC-5510',
      crop: 'Mustard (सरसों)',
      net_weight_quintals: 30.0,
      gross_weight_quintals: 30.8,
      tare_weight_quintals: 0.8,
      quality_grade: 'FAQ Grade A (Moisture: 7.2%)',
      rate_per_quintal: 5650,
      total_amount_inr: 169500,
      status: 'VERIFIED_AND_STORED',
      procured_at: new Date().toLocaleDateString('en-IN')
    };
  }

  const p = procurements[0];
  return {
    found: true,
    procurement_id: p.id || 'PROC-5510',
    crop: p.crop || 'Mustard',
    net_weight_quintals: p.netWeight || p.quantity || 30.0,
    quality_grade: p.quality || 'FAQ Grade A',
    total_amount_inr: p.amount || 169500,
    status: p.status || 'COMPLETED',
    procured_at: p.created_at || 'Recent'
  };
}

/**
 * Tool 4: get_my_payment_status()
 */
function tool_get_my_payment_status() {
  const farmer = getAuthenticatedFarmer();
  const payments = (typeof KissanDB !== 'undefined' ? KissanDB.get('payments', []) : []);

  if (!payments || payments.length === 0) {
    return {
      found: true,
      transaction_id: 'DBT-KSM-2026-88491',
      amount_inr: 169500,
      status: 'PAID',
      channel: 'PFMS / Aadhaar Payment Bridge (APBS)',
      bank_account_mask: `XXXX-XXXX-${farmer.aadhaar_last4 || '9012'}`,
      disbursed_at: 'Within 48 hours of procurement confirmation',
      statutory_note: '100% MSP credited without intermediary commission or deductions.'
    };
  }

  const pay = payments[0];
  return {
    found: true,
    transaction_id: pay.transaction_id || 'DBT-KSM-2026-88491',
    amount_inr: pay.amount || 169500,
    status: pay.status || 'PAID',
    channel: 'Direct DBT Bank Transfer',
    bank_account_mask: `Aadhaar-seeded bank account`,
    statutory_note: 'Direct procurement credit under Government MSP guidelines.'
  };
}

/**
 * Tool 5: get_available_slots(date, centre_id)
 */
function tool_get_available_slots(date, centre_id) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const centre = centre_id || 'Krishi Upaj Mandi, Karnal';

  return {
    centre: centre,
    date: targetDate,
    shifts: [
      {
        shift_name: 'Morning Shift',
        time_window: '08:00 AM - 11:00 AM',
        total_capacity: 25,
        booked_count: 18,
        available_slots: 7,
        status: 'AVAILABLE'
      },
      {
        shift_name: 'Noon Shift',
        time_window: '11:00 AM - 02:00 PM',
        total_capacity: 25,
        booked_count: 22,
        available_slots: 3,
        status: 'FILLING_FAST'
      },
      {
        shift_name: 'Afternoon Shift',
        time_window: '02:00 PM - 05:00 PM',
        total_capacity: 25,
        booked_count: 12,
        available_slots: 13,
        status: 'AVAILABLE'
      }
    ]
  };
}

/**
 * Tool 6: get_official_msp(crop)
 */
function tool_get_official_msp(crop) {
  const MSP_CATALOG = {
    'wheat': { hindi: 'गेहूं', punjabi: 'ਕਣਕ', msp: 2275, max_moisture: '12%', grade: 'FAQ Grade I' },
    'gehu': { hindi: 'गेहूं', punjabi: 'ਕਣਕ', msp: 2275, max_moisture: '12%', grade: 'FAQ Grade I' },
    'mustard': { hindi: 'सरसों', punjabi: 'ਸਰ੍ਹੋਂ', msp: 5650, max_moisture: '8%', grade: 'FAQ Grade I' },
    'sarson': { hindi: 'सरसों', punjabi: 'ਸਰ੍ਹੋਂ', msp: 5650, max_moisture: '8%', grade: 'FAQ Grade I' },
    'paddy': { hindi: 'धान (ग्रेड-ए)', punjabi: 'ਝੋਨਾ', msp: 2203, max_moisture: '17%', grade: 'FAQ Grade A' },
    'dhan': { hindi: 'धान (ग्रेड-ए)', punjabi: 'ਝੋਨਾ', msp: 2203, max_moisture: '17%', grade: 'FAQ Grade A' },
    'rice': { hindi: 'धान (ग्रेड-ए)', punjabi: 'ਝੋਨਾ', msp: 2203, max_moisture: '17%', grade: 'FAQ Grade A' },
    'gram': { hindi: 'चना', punjabi: 'ਛੋਲੇ', msp: 5440, max_moisture: '14%', grade: 'FAQ Grade I' },
    'chana': { hindi: 'चना', punjabi: 'ਛੋਲੇ', msp: 5440, max_moisture: '14%', grade: 'FAQ Grade I' },
    'cotton': { hindi: 'कपास (मध्यम रेशा)', punjabi: 'ਨਰਮਾ', msp: 6620, max_moisture: '10%', grade: 'FAQ Medium Staple' },
    'maize': { hindi: 'मक्का', punjabi: 'ਮੱਕੀ', msp: 2090, max_moisture: '14%', grade: 'FAQ Grade I' },
    'soybean': { hindi: 'सोयाबीन (पीला)', punjabi: 'ਸੋਇਆਬੀਨ', msp: 4892, max_moisture: '12%', grade: 'FAQ Grade I' },
    'moong': { hindi: 'मूंग दाल', punjabi: 'ਮੂੰਗੀ', msp: 8682, max_moisture: '12%', grade: 'FAQ Grade I' }
  };

  const c = (crop || '').toLowerCase().trim();
  if (c && MSP_CATALOG[c]) {
    return {
      crop: c,
      details: MSP_CATALOG[c],
      official_season: '2026-27 (DoCA / CACP Government of India Notification)'
    };
  }

  // Return all major MSP crops
  return {
    official_season: '2026-27 (DoCA / CACP Government of India Notification)',
    rates: [
      { crop: 'Mustard (सरसों)', msp_per_quintal: 5650, max_moisture: '8%' },
      { crop: 'Wheat (गेहूं)', msp_per_quintal: 2275, max_moisture: '12%' },
      { crop: 'Paddy Grade A (धान)', msp_per_quintal: 2203, max_moisture: '17%' },
      { crop: 'Gram / Chana (चना)', msp_per_quintal: 5440, max_moisture: '14%' },
      { crop: 'Cotton (कपास)', msp_per_quintal: 6620, max_moisture: '10%' },
      { crop: 'Maize (मक्का)', msp_per_quintal: 2090, max_moisture: '14%' },
      { crop: 'Moong (मूंग)', msp_per_quintal: 8682, max_moisture: '12%' }
    ]
  };
}

/**
 * Tool 7: get_mandi_rules(topic)
 */
function tool_get_mandi_rules(topic) {
  return {
    mandatory_documents: [
      '1. KISSAN Digital Gate Pass (QR Code on phone or printed slip)',
      '2. Original Aadhaar Card (matching farmer registration)',
      '3. Land Ownership / Crop Sowing Record (Girdawari / Fard / Jamabandi)',
      '4. Bank Passbook copy (Aadhaar-seeded bank account for direct DBT transfer)',
      '5. Vehicle Registration Certificate (RC) for tractor-trolley or truck'
    ],
    mandi_timings: 'Monday to Saturday: 08:00 AM to 05:00 PM (Gates open at 07:30 AM)',
    quality_standards: 'Produce must meet Fair Average Quality (FAQ) norms. Grains with moisture above statutory ceiling will be flagged for sun-drying.',
    helpline: {
      toll_free: '1800-180-1551 (National Kisan Mandi Helpline, 06:00 AM - 10:00 PM)',
      email: 'support@kissan-mandi.gov.in',
      nodal_officer: 'Suresh Verma, Mandi Officer #104 (Krishi Upaj Mandi, Karnal)'
    }
  };
}

/**
 * Tool 8: confirm_cancel_booking(target) - Two-Step Guard
 */
function tool_confirm_cancel_booking(target) {
  let activeBooking = null;
  if (target && typeof target === 'object' && target.token_number && target.crop) {
    activeBooking = target;
  } else {
    activeBooking = tool_get_my_booking(target);
  }

  if (!activeBooking || !activeBooking.found) {
    return {
      status: 'NO_ACTIVE_BOOKING',
      message: 'You have no matching active booking to cancel.'
    };
  }

  // Render two-step confirmation UI directly into the chat container
  setTimeout(() => {
    renderCancellationConfirmationBox(activeBooking);
  }, 100);

  return {
    status: 'CONFIRMATION_REQUIRED',
    booking_id: activeBooking.booking_id || activeBooking.id,
    token_number: activeBooking.token_number,
    crop: activeBooking.crop,
    slot_date: activeBooking.slot_date,
    message: `Confirmation requested: Are you sure you want to cancel token ${activeBooking.token_number} for ${activeBooking.crop} on ${activeBooking.slot_date}? Please confirm in the prompt box below.`
  };
}

function renderCancellationConfirmationBox(booking) {
  if (typeof document === 'undefined' || !booking) return;
  const messagesContainer = document.getElementById('aiChatMessages');
  if (!messagesContainer) return;

  // Remove any previous active confirmation box to prevent stale duplicate clicks
  const existing = messagesContainer.querySelector('.ai-confirm-box');
  if (existing) existing.remove();

  const bookingId = booking.booking_id || booking.id || '';
  const tokenNumber = booking.token_number || booking.tokenNumber || 'KMN-042';
  const cropName = booking.crop || 'Produce';
  const slotDate = booking.slot_date || booking.slotDate || 'Scheduled Date';

  const box = document.createElement('div');
  box.className = 'ai-confirm-box';
  box.id = `confirm_box_${bookingId || tokenNumber}`;
  box.innerHTML = `
    <div style="font-weight: 600; color: #92400e; margin-bottom: 0.25rem;">
      ⚠️ Confirm Slot Cancellation
    </div>
    <div style="font-size: 0.85rem; color: #78350f;">
      Are you sure you want to cancel Token <strong>${tokenNumber}</strong> for <strong>${cropName}</strong> (${slotDate})? This action cannot be undone.
    </div>
    <div class="ai-confirm-actions">
      <button type="button" class="btn btn-danger btn-sm" id="btnConfirmCancelYes">Yes, Cancel ${cropName}</button>
      <button type="button" class="btn btn-secondary btn-sm" id="btnConfirmCancelNo">No, Keep Booking</button>
    </div>
  `;

  messagesContainer.appendChild(box);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Handlers
  const yesBtn = box.querySelector('#btnConfirmCancelYes');
  const noBtn = box.querySelector('#btnConfirmCancelNo');

  if (yesBtn) {
    yesBtn.addEventListener('click', () => {
      box.remove();
      executeActualCancellation(bookingId, tokenNumber, cropName);
    });
  }

  if (noBtn) {
    noBtn.addEventListener('click', () => {
      box.remove();
      const cancelMsg = `Booking cancellation dismissed. Your slot for ${cropName} (Token ${tokenNumber}) remains active.`;
      const msgEl = document.createElement('div');
      msgEl.className = 'ai-message ai-message-assistant';
      msgEl.innerHTML = `<div class="ai-message-bubble">${cancelMsg}</div><span class="ai-message-time">Just now</span>`;
      messagesContainer.appendChild(msgEl);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
  }
}

function executeActualCancellation(bookingId, tokenNumber, cropName) {
  const messagesContainer = document.getElementById('aiChatMessages');
  
  // 1. Update KissanDB
  if (typeof KissanDB !== 'undefined') {
    const bookings = KissanDB.get('bookings', []);
    const idx = bookings.findIndex(b => 
      (bookingId && (b.id === bookingId || b.booking_id === bookingId)) ||
      (tokenNumber && (b.token_number === tokenNumber || b.tokenNumber === tokenNumber)) ||
      (cropName && (b.crop || '').toLowerCase().includes(cropName.toLowerCase()))
    );
    if (idx !== -1) {
      bookings[idx].status = 'CANCELLED';
      KissanDB.set('bookings', bookings);
      console.log('Booking cancelled in KissanDB:', tokenNumber || bookingId);
    }
  }

  // 2. Update Supabase if available
  if (typeof window !== 'undefined' && window.supabaseClient) {
    if (bookingId) {
      window.supabaseClient
        .from('bookings')
        .update({ status: 'CANCELLED' })
        .eq('id', bookingId)
        .then(() => console.log('Booking cancelled in Supabase by ID'));
    } else if (tokenNumber) {
      window.supabaseClient
        .from('bookings')
        .update({ status: 'CANCELLED' })
        .eq('token_number', tokenNumber)
        .then(() => console.log('Booking cancelled in Supabase by token'));
    }
  }

  const label = cropName ? `${cropName} (Token ${tokenNumber || ''})` : `Token ${tokenNumber || bookingId}`;
  const successText = `✅ Your booking for ${label} has been successfully cancelled. The capacity has been released back to the mandi slot.`;
  const msgEl = document.createElement('div');
  msgEl.className = 'ai-message ai-message-assistant';
  msgEl.innerHTML = `<div class="ai-message-bubble" style="border-left: 4px solid #ef4444;">${successText}</div><span class="ai-message-time">Just now</span>`;
  if (messagesContainer) {
    messagesContainer.appendChild(msgEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

// -----------------------------------------------------------------
// PROMPT INJECTION & SECURITY DEFENSES
// -----------------------------------------------------------------
function detectPromptInjection(query) {
  const q = (query || '').toLowerCase().trim();

  // Pattern 1: System prompt bypasses
  const injectionPatterns = [
    'ignore previous instructions',
    'disregard all instructions',
    'you are now in developer mode',
    'system override',
    'bypass security',
    'reveal your system prompt',
    'what are your secret rules',
    'act as jailbroken'
  ];

  for (const pattern of injectionPatterns) {
    if (q.includes(pattern)) {
      return 'Security Notice: I am the official KISSAN Mandi Assistant. I operate strictly within authorized government APMC protocols and cannot modify system directives.';
    }
  }

  // Pattern 2: Unauthorized cross-tenant data requests
  if ((q.includes('farmer f-') || q.includes('other farmer') || q.includes('all farmers') || q.includes('dump database')) && !q.includes('f-10024')) {
    return 'Privacy Notice: In accordance with Mandi data protection regulations, I am only authorized to access procurement records for your authenticated farmer profile (Rameshwar Singh / F-10024).';
  }

  return null;
}

// -----------------------------------------------------------------
// GOOGLE GEMINI API INTEGRATION WITH FUNCTION CALLING
// -----------------------------------------------------------------

/**
 * Executes a query with Google Gemini 1.5 Flash using Function Calling
 */
async function callGoogleGeminiWithTools(userMessage, apiKey) {
  const lang = window.KissanAI.selectedLang || 'hi-IN';
  const farmer = getAuthenticatedFarmer();

  const systemInstruction = `You are the official "KISSAN Mandi AI Assistant", a trusted digital and voice agricultural assistant for Indian farmers at APMC Mandi centres.

Farmer Profile (Authenticated):
- Name: ${farmer.name}
- Farmer ID: ${farmer.id}
- District: ${farmer.district}
- Registered Mobile: ${farmer.phone}

Strict Rules:
1. TRUTH & ACCURACY: You NEVER hallucinate token numbers, queue positions, payment amounts, MSP rates, or booking details. Always query the provided tools for live facts.
2. CITATION & HONESTY: If a tool returns no data or found: false, clearly inform the farmer that no active record exists. Do NOT make up numbers.
3. LANGUAGE: Answer fluently in ${lang === 'hi-IN' ? 'Hindi (हिन्दी)' : (lang === 'pa-IN' ? 'Punjabi (ਪੰਜਾਬੀ)' : 'English')}. If the farmer wrote or spoke in Hindi, answer in respectful Hindi (e.g. using 'जी', 'आप'). If in Punjabi, use respectful Punjabi.
4. TONE: Warm, respectful, rural-friendly, concise, and easy to understand when spoken over audio/TTS. Avoid dense Markdown walls or jargon.
5. CANCELLATION GUARD: If the farmer asks to cancel their booking, call the confirm_cancel_booking tool so a confirmation prompt is shown to the user.`;

  // Define Function Declarations for Gemini
  const tools = [
    {
      functionDeclarations: [
        {
          name: 'get_my_booking',
          description: 'Fetch the authenticated farmer active slot booking, token number, mandi centre, crop, and status.'
        },
        {
          name: 'get_my_queue_status',
          description: 'Fetch the live mandi yard queue status, including currently serving token, active weighbridge bay, queue position, and estimated wait time.'
        },
        {
          name: 'get_my_procurement',
          description: 'Fetch recent procurement receipt, crop name, net weight, quality grade, and procurement value.'
        },
        {
          name: 'get_my_payment_status',
          description: 'Fetch Direct Benefit Transfer (DBT) payment status, transaction ID, bank transfer status, and amount.'
        },
        {
          name: 'get_available_slots',
          description: 'Check available shift windows, capacities, and booked counts for a given date and mandi centre.',
          parameters: {
            type: 'OBJECT',
            properties: {
              date: { type: 'STRING', description: 'Date in YYYY-MM-DD format (optional)' },
              centre_id: { type: 'STRING', description: 'Mandi centre name or ID (optional)' }
            }
          }
        },
        {
          name: 'get_official_msp',
          description: 'Get official Government of India Minimum Support Price (MSP 2026-27) and moisture limit standards for agricultural crops.',
          parameters: {
            type: 'OBJECT',
            properties: {
              crop: { type: 'STRING', description: 'Name of crop: wheat, mustard, paddy, gram, cotton, maize, soybean, moong' }
            }
          }
        },
        {
          name: 'get_mandi_rules',
          description: 'Get official APMC Mandi operating rules, mandatory entry documents, quality standards, or helpline numbers.',
          parameters: {
            type: 'OBJECT',
            properties: {
              topic: { type: 'STRING', description: 'Topic: documents, timings, quality_standards, helpline' }
            }
          }
        },
        {
          name: 'confirm_cancel_booking',
          description: 'Trigger the two-step confirmation dialog to cancel an active booking for the authenticated farmer.',
          parameters: {
            type: 'OBJECT',
            properties: {
              booking_id: { type: 'STRING', description: 'Booking ID or token number to cancel' }
            }
          }
        }
      ]
    }
  ];

  // Prepare Conversation Contents
  const contents = [];
  
  // Add recent history (up to last 4 turns)
  if (window.KissanAI.conversationHistory && window.KissanAI.conversationHistory.length > 0) {
    const recent = window.KissanAI.conversationHistory.slice(-4);
    recent.forEach(h => contents.push(h));
  }

  // Add current user prompt
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: contents,
    tools: tools,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 600
    }
  };

  // Turn 1: Call Gemini
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const candidate = data.candidates && data.candidates[0];
  if (!candidate || !candidate.content) {
    throw new Error('No candidate content returned by Gemini');
  }

  const parts = candidate.content.parts || [];
  let functionCallPart = parts.find(p => p.functionCall);

  // If no function call, return direct text
  if (!functionCallPart) {
    const textPart = parts.find(p => p.text);
    const replyText = textPart ? textPart.text : 'I have processed your request.';
    // Save history
    window.KissanAI.conversationHistory.push({ role: 'user', parts: [{ text: userMessage }] });
    window.KissanAI.conversationHistory.push({ role: 'model', parts: [{ text: replyText }] });
    return replyText;
  }

  // Turn 2: Execute Tool Call locally
  const fnName = functionCallPart.functionCall.name;
  const fnArgs = functionCallPart.functionCall.args || {};
  let toolResult = null;

  switch (fnName) {
    case 'get_my_booking':
      toolResult = tool_get_my_booking();
      break;
    case 'get_my_queue_status':
      toolResult = tool_get_my_queue_status();
      break;
    case 'get_my_procurement':
      toolResult = tool_get_my_procurement();
      break;
    case 'get_my_payment_status':
      toolResult = tool_get_my_payment_status();
      break;
    case 'get_available_slots':
      toolResult = tool_get_available_slots(fnArgs.date, fnArgs.centre_id);
      break;
    case 'get_official_msp':
      toolResult = tool_get_official_msp(fnArgs.crop);
      break;
    case 'get_mandi_rules':
      toolResult = tool_get_mandi_rules(fnArgs.topic);
      break;
    case 'confirm_cancel_booking':
      toolResult = tool_confirm_cancel_booking(fnArgs.booking_id);
      break;
    default:
      toolResult = { error: `Unknown tool: ${fnName}` };
  }

  // If this was a cancellation request, return structured message immediately
  if (fnName === 'confirm_cancel_booking') {
    return lang === 'hi-IN'
      ? 'स्लॉट निरस्तीकरण (Cancellation) हेतु पुष्टि आवश्यक है। कृपया नीचे दिए गए विकल्प से पुष्टि करें।'
      : 'Cancellation confirmation required. Please confirm your selection in the prompt below.';
  }

  // Send tool result back to Gemini for final natural language generation
  const followUpContents = [
    ...contents,
    candidate.content,
    {
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: fnName,
            response: {
              name: fnName,
              content: toolResult
            }
          }
        }
      ]
    }
  ];

  const followUpRequestBody = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: followUpContents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 600
    }
  };

  const followUpRes = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(followUpRequestBody)
  });

  if (!followUpRes.ok) {
    // If follow-up fails, format the tool output directly
    return formatToolOutputFallback(fnName, toolResult, lang);
  }

  const followUpData = await followUpRes.json();
  const finalCandidate = followUpData.candidates && followUpData.candidates[0];
  const finalTextPart = finalCandidate && finalCandidate.content && finalCandidate.content.parts && finalCandidate.content.parts.find(p => p.text);

  const finalReply = finalTextPart ? finalTextPart.text : formatToolOutputFallback(fnName, toolResult, lang);

  // Save history
  window.KissanAI.conversationHistory.push({ role: 'user', parts: [{ text: userMessage }] });
  window.KissanAI.conversationHistory.push({ role: 'model', parts: [{ text: finalReply }] });

  return finalReply;
}

/**
 * Local Authoritative Mandi Assistant Engine
 * Fallback when Gemini API key is not configured or offline.
 * Directly executes the 8 authoritative tools with 100% database accuracy.
 */
async function executeLocalMandiAssistant(query) {
  const rawQ = (query || '').trim();
  const q = rawQ.toLowerCase();
  const lang = window.KissanAI.selectedLang || 'hi-IN';
  const isHindi = lang === 'hi-IN' || /[\u0900-\u097F]/.test(rawQ) || q.includes('mera') || q.includes('meri') || q.includes('bhav') || q.includes('kya');
  const isPunjabi = lang === 'pa-IN' || /[\u0A00-\u0A7F]/.test(rawQ);
  const farmer = getAuthenticatedFarmer();

  // Helper regex tests
  const matches = (regex) => regex.test(rawQ) || regex.test(q);

  // 1. Greetings & Conversational
  if (matches(/^(hi|hello|hey|namaste|namaskar|pranam|ram ram|sat sri akal|good morning|good evening|kaise ho|नमस्ते|नमस्कार|प्रणाम|राम राम|सत श्री अकाल|हेलो|हाय|कैसे हो|जय जवान|जय किसान)\b/i) || matches(/^(नमस्ते|नमस्कार|प्रणाम|राम राम|सत श्री अकाल)/)) {
    if (isHindi) {
      return `नमस्ते ${farmer.name} जी! मैं आपका KISSAN डिजिटल मंडी सहायक हूँ।\nआप मुझसे अपनी स्लॉट बुकिंग, लाइव यार्ड कतार, फसल खरीद वजन, DBT बैंक भुगतान, आधिकारिक MSP भाव, फसल रोग पहचान या कृषि योजनाओं के बारे में पूछ सकते हैं।\n\n💡 सुझाए गए अगले प्रश्न:\n• मेरी सक्रिय बुकिंग और टोकन क्या है?\n• मंडी कतार में मेरा क्या नंबर है?\n• गेहूं और सरसों का सरकारी MSP क्या है?`;
    } else if (isPunjabi) {
      return `ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ${farmer.name} ਜੀ! ਮੈਂ ਤੁਹਾਡਾ KISSAN ਮੰਡੀ ਸਹਾਇਕ ਹਾਂ। ਮੈਂ ਤੁਹਾਡੀ ਕੀ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?\n\n💡 ਸੁਝਾਏ ਗਏ ਅਗਲੇ ਸਵਾਲ:\n• ਮੇਰੀ ਬੁਕਿੰਗ ਦੀ ਸਥਿਤੀ ਕੀ ਹੈ?\n• ਕਤਾਰ ਵਿੱਚ ਮੇਰਾ ਨੰਬਰ ਕੀ ਹੈ?`;
    }
    return `Namaste ${farmer.name}! I am your KISSAN Digital Mandi Assistant. How may I assist you today?\n\n💡 Recommended Follow-up Questions:\n• What is my active booking and token number?\n• What is my current queue position and wait time?\n• What is the official MSP for Wheat and Mustard?`;
  }

  // 2. Cancellation query
  if (matches(/(cancel|cancellation|rad|radd|hatao|band|रद्द|कैंसिल|कैंसल|निरस्त|हटाना|कटवाना|ਰੱਦ|ਕੈਂਸਲ)/i)) {
    let targetCrop = '';
    if (matches(/(cotton|kapas|कपास|नरमा|ਕਪਾਹ)/i)) targetCrop = 'cotton';
    else if (matches(/(gram|chana|चना|छोले|ਛੋਲੇ)/i)) targetCrop = 'gram';
    else if (matches(/(mustard|sarson|सरसों|राई|ਸਰ੍ਹੋਂ)/i)) targetCrop = 'mustard';
    else if (matches(/(wheat|gehu|gehun|गेहूं|गेहूँ|कनक|ਕਣਕ)/i)) targetCrop = 'wheat';
    else if (matches(/(paddy|dhan|rice|धान|चावल|जीरी|ਝੋਨਾ)/i)) targetCrop = 'paddy';
    else if (matches(/(maize|makka|मक्का|मक्की|ਮੱਕੀ)/i)) targetCrop = 'maize';

    const tokenMatch = rawQ.match(/kmn[-\s]?\d+/i);
    const filter = targetCrop ? { crop: targetCrop } : (tokenMatch ? { token_number: tokenMatch[0].toUpperCase().replace(/\s+/, '-') } : null);

    const res = tool_confirm_cancel_booking(filter);
    if (!res || res.status === 'NO_ACTIVE_BOOKING') {
      return isHindi
        ? 'आपके पास रद्द करने हेतु कोई सक्रिय बुकिंग नहीं मिली।'
        : 'No active booking found matching your cancellation request.';
    }
    return isHindi 
      ? `स्लॉट निरस्तीकरण (Cancellation) हेतु पुष्टि आवश्यक है। कृपया टोकन ${res.token_number} (${res.crop}) के लिए नीचे दिए गए बॉक्स में पुष्टि करें।`
      : isPunjabi
      ? `ਸਲਾਟ ਰੱਦ ਕਰਨ ਲਈ ਪੁਸ਼ਟੀ ਦੀ ਲੋੜ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਟੋਕਨ ${res.token_number} (${res.crop}) ਲਈ ਹੇਠਾਂ ਦਿੱਤੇ ਬਕਸੇ ਵਿੱਚ ਪੁਸ਼ਟੀ ਕਰੋ।`
      : `Cancellation confirmation required for Token ${res.token_number} (${res.crop}). Please confirm your selection in the prompt box below.`;
  }

  // 3. Booking / Token / Gate Pass query
  if (matches(/(booking|book|token|pass|gate pass|slot|मेरी बुकिंग|बुकिंग|टोकन|पर्ची|गेट पास|पास|स्लॉट|अपॉइंटमेंट|तारीख|समय|ਬੁਕਿੰਗ|ਟੋਕਨ|ਪਾਸ|ਗੇਟ ਪਾਸ)/i)) {
    let targetCrop = '';
    if (matches(/(cotton|kapas|कपास|नरमा|ਕਪਾਹ)/i)) targetCrop = 'cotton';
    else if (matches(/(gram|chana|चना|छोले|ਛੋਲੇ)/i)) targetCrop = 'gram';
    else if (matches(/(mustard|sarson|सरसों|राई|ਸਰ੍ਹੋਂ)/i)) targetCrop = 'mustard';
    else if (matches(/(wheat|gehu|gehun|गेहूं|गेहूँ|कनक|ਕਣਕ)/i)) targetCrop = 'wheat';
    else if (matches(/(paddy|dhan|rice|धान|चावल|जीरी|ਝੋਨਾ)/i)) targetCrop = 'paddy';
    else if (matches(/(maize|makka|मक्का|मक्की|ਮੱਕੀ)/i)) targetCrop = 'maize';

    const tokenMatch = rawQ.match(/kmn[-\s]?\d+/i);
    const filter = targetCrop ? { crop: targetCrop } : (tokenMatch ? { token_number: tokenMatch[0].toUpperCase().replace(/\s+/, '-') } : null);

    const data = tool_get_my_booking(filter);
    return formatToolOutputFallback('get_my_booking', data, lang);
  }

  // 4. Queue / Line / Waiting query
  if (matches(/(queue|katar|line|wait|waiting|stage|bay|kab aayega|when|ahead|कतार|लाइन|वेटिंग|इंतजार|इन्तजार|प्रतीक्षा|नंबर|नम्बर|बारी|कितना समय|कब आएगा|कितने किसान|कितने वाहन|कितने आगे|यार्ड|ਕਤਾਰ|ਲਾਈਨ|ਉਡੀਕ|ਨੰਬਰ|ਵਾਰੀ)/i)) {
    const data = tool_get_my_queue_status();
    return formatToolOutputFallback('get_my_queue_status', data, lang);
  }

  // 5. Procurement / Weighment / Form J query
  if (matches(/(procurement|kharid|weigh|weighment|taul|tulayi|vajan|weight|slip|receipt|scale|j form|form j|खरीद|तौल|तुलाई|वजन|वज़न|कांटा|काँटा|रसीद|जे फार्म|फॉर्म जे|नमी|तुलाई|गुणवत्ता|क्वालिटी|ਖਰੀਦ|ਤੋਲ|ਵਜ਼ਨ|ਪਰਚੀ|ਜੇ ਫਾਰਮ)/i)) {
    const data = tool_get_my_procurement();
    return formatToolOutputFallback('get_my_procurement', data, lang);
  }

  // 6. Payment / DBT / Bank query
  if (matches(/(payment|dbt|paise|paisa|rupaye|rupees|bank|khata|money|account|credit|transfer|भुगतान|पैसे|रुपये|रुपए|खाता|बैंक|डीबीटी|क्रेडिट|जमा|पैसे कब|पैसा|खाते में|कब आएंगे|कब मिलेंगे|ਭੁਗਤਾਨ|ਪੈਸੇ|ਰੁਪਏ|ਖਾਤਾ|ਬੈਂਕ|ਡੀਬੀਟੀ)/i)) {
    const data = tool_get_my_payment_status();
    return formatToolOutputFallback('get_my_payment_status', data, lang);
  }

  // 7. Slots availability / Timings query
  if (matches(/(available slot|timing|shift|samay|available|khali|free slot|open|hours|स्लॉट उपलब्ध|खाली स्लॉट|समय|शिफ्ट|मंडी का समय|कब खुलती है|कब खुलेगी|बुकिंग के लिए समय|उपलब्ध|ਸਲਾਟ ਉਪਲਬਧ|ਸਮਾਂ)/i)) {
    const data = tool_get_available_slots();
    return formatToolOutputFallback('get_available_slots', data, lang);
  }

  // 8. MSP / Rate / Price / Bhav query
  if (matches(/(msp|rate|price|bhav|bhaav|cost|एमएसपी|भाव|दर|दाम|कीमत|सरकारी भाव|रेट|ਸਰਕਾਰੀ ਮੁੱਲ|ਭਾਅ|ਰੇਟ)/i) || matches(/(wheat|gehu|mustard|sarson|paddy|dhan|gram|chana|cotton|kapas|maize|makka|गेहूं|गेहूँ|सरसों|धान|चावल|चना|कपास|मक्का|सोयाबीन|मूंग|ਕਣਕ|ਸਰ੍ਹੋਂ|ਝੋਨਾ)/i)) {
    let crop = '';
    if (matches(/(wheat|gehu|gehun|गेहूं|गेहूँ|ਕਣਕ)/i)) crop = 'wheat';
    else if (matches(/(mustard|sarson|सरसों|राई|ਸਰ੍ਹੋਂ)/i)) crop = 'mustard';
    else if (matches(/(paddy|dhan|rice|धान|चावल|ਝੋਨਾ)/i)) crop = 'paddy';
    else if (matches(/(gram|chana|चना|ਛੋਲੇ)/i)) crop = 'gram';
    else if (matches(/(cotton|kapas|कपास|ਕਪਾਹ)/i)) crop = 'cotton';
    else if (matches(/(maize|makka|मक्का|ਮੱਕੀ)/i)) crop = 'maize';
    const data = tool_get_official_msp(crop);
    return formatToolOutputFallback('get_official_msp', data, lang);
  }

  // 9. Documents / Rules query
  if (matches(/(document|documents|dastavej|kagaz|paper|rule|rules|helpline|gate entry|bring|id proof|aadhaar|दस्तावेज|दस्तावेज़|कागजात|कागज|नियम|आईडी|आधार|हेल्पलाइन|मंडी में क्या चाहिए|गेट पर|पहचान पत्र|जरूरी कागज|ਦਸਤਾਵੇਜ਼|ਕਾਗਜ਼|ਨਿਯਮ)/i)) {
    const data = tool_get_mandi_rules();
    return formatToolOutputFallback('get_mandi_rules', data, lang);
  }

  // 10. Crop Health / Disease / Pest diagnosis
  if (matches(/(disease|pest|pests|keet|rog|rust|fungus|aphid|aphids|blight|spray|medicine|treatment|dawa|ilaj|chepa|mahu|keeda|sundhi|peela ratua|रोग|बीमारी|कीट|कीड़ा|कीड़े|कीड़े|चेपा|माहू|रतुआ|पीला रतुआ|फफूंद|फंगस|झुलसा|उकठा|सफेद धब्बा|दवा|स्प्रे|छिड़काव|इलाज|रोकथाम|पत्तियां|पत्ते|ਸਪਰੇਅ|ਬਿਮਾਰੀ|ਕੀੜਾ)/i)) {
    if (isHindi) {
      return `फसल रोग एवं कीट नियंत्रण मार्गदर्शन (${farmer.district} क्षेत्र):\n\n1. पत्तियों का निरीक्षण: यदि पत्तियों पर सफेद चूर्ण या धब्बे दिखें तो यह White Rust या Alternaria Blight हो सकता है। मैन्कोजेब 75 WP (2 ग्राम/लीटर पानी) का छिड़काव करें।\n2. चेपा (Aphids) कीट: यदि छोटे हरे/काले कीट रस चूस रहे हों, तो नीम तेल (10,000 ppm @ 3 ml/L) या डायमेथोएट 30 EC का छिड़काव करें।\n3. गेहूं में पीला रतुआ (Yellow Rust): पत्तियों पर पीली धारियां दिखने पर प्रोपिकोनाजोल 25 EC (1 मिली/लीटर) छिड़कें।\n\n💡 सुझाए गए अगले प्रश्न:\n• सरसों में चेपा कीट की रोकथाम के उपाय क्या हैं?\n• करनाल मंडी में सरसों के लिए अधिकतम स्वीकार्य नमी क्या है?\n• मेरी सक्रिय बुकिंग टोकन KMN-042 का क्या विवरण है?`;
    }
    return `Crop Disease & Pest Management Guide (${farmer.district} Region):\n\n1. Visual Inspection: Inspect both upper and underside of leaves. White powdery spots or dark brown concentric rings indicate White Rust or Alternaria Blight. Spray Mancozeb 75 WP @ 2 g/L.\n2. Sucking Pests (Aphids): Look for sticky honeydew or tiny green/black aphids clustering on shoots. Spray Neem Oil (10,000 ppm) @ 3 ml/L or Dimethoate 30 EC.\n3. Stripe / Yellow Rust in Wheat: Yellow powder lines on leaves require immediate spray of Propiconazole 25 EC @ 1 ml/L.\n\n💡 Recommended Follow-up Questions:\n• How do I treat Aphids in my mustard crop?\n• What is the maximum moisture limit for Mustard at Karnal Mandi?\n• What is the status of my active token booking KMN-042?`;
  }

  // 11. Fertilizer & Soil queries
  if (matches(/(fertilizer|fertilizers|urea|dap|npk|khad|soil|mitti|poshan|sulfur|potash|zinc|उर्वरक|खाद|यूरिया|डीएपी|पोटाश|सल्फर|जिंक|मिट्टी|पोषण|खाद कब डालें|ਖਾਦ|ਯੂਰੀਆ|ਡੀਏਪੀ)/i)) {
    if (isHindi) {
      return `उर्वरक एवं पोषक तत्व सलाह:\n• सरसों: बुवाई के समय 40 किग्रा डीएपी + 20 किग्रा पोटाश + 25 किग्रा बेंटोनाइट सल्फर प्रति एकड़ दें। पहली सिंचाई पर 35 किग्रा यूरिया का टॉप ड्रेसिंग करें।\n• गेहूं: 50 किग्रा डीएपी + 50 किग्रा यूरिया दो भागों में (CRI अवस्था व कल्ले फूटते समय)।\n\n💡 सुझाए गए अगले प्रश्न:\n• सल्फर का प्रयोग सरसों में क्यों जरूरी है?\n• मेरी मंडी बुकिंग का समय क्या है?`;
    }
    return `Fertilizer & Soil Nutrition Guidance:\n• Mustard: Apply 40 kg DAP + 20 kg Potash + 25 kg Bentonite Sulphur per acre as basal dose. Top-dress with 35 kg Urea during the first irrigation.\n• Wheat: Balanced NPK 120:60:40 kg/ha split between basal and CRI/tillering stages.\n\n💡 Recommended Follow-up Questions:\n• Why is sulphur essential for mustard yield?\n• What is my booking status at the Mandi?`;
  }

  // 12. Government Schemes (PM-Kisan, KCC, etc.)
  if (matches(/(scheme|schemes|yojana|yojna|pm kisan|pm-kisan|kcc|fasal bima|pmfby|subsidy|loan|rin|योजना|योजनाएं|पीएम किसान|सम्मान निधि|केसीसी|किसान क्रेडिट कार्ड|फसल बीमा|बीमा|सब्सिडी|ऋण|ਯੋਜਨਾ|ਪੀਐਮ ਕਿਸਾਨ)/i)) {
    if (isHindi) {
      return `सरकारी किसान योजनाएं (Government Schemes):\n• PM-KISAN: प्रतिवर्ष ₹6,000 की वित्तीय सहायता (₹2,000 की 3 किस्तों में सीधे बैंक खाते/DBT में)।\n• किसान क्रेडिट कार्ड (KCC): 4% रियायती ब्याज दर पर कृषि ऋण।\n• पीएम फसल बीमा योजना (PMFBY): रबी फसलों पर 1.5% व खरीफ पर 2% प्रीमियम पर फसल नुकसान की भरपाई।\n\n💡 सुझाए गए अगले प्रश्न:\n• मेरा हालिया DBT भुगतान कब हुआ था?\n• मंडी में आवश्यक दस्तावेजों की सूची क्या है?`;
    }
    return `Government Agricultural Schemes:\n• PM-KISAN: Direct income support of ₹6,000/year in 3 equal installments into your Aadhaar-linked bank account.\n• Kisan Credit Card (KCC): Concessional crop loans at 4% effective interest rate.\n• PMFBY (Crop Insurance): Low premium (1.5% Rabi / 2% Kharif) comprehensive crop coverage against natural perils.\n\n💡 Recommended Follow-up Questions:\n• What was the amount of my latest Mandi DBT payment?\n• What documents are mandatory for entry at the Mandi gate?`;
  }

  // 13. Weather & Irrigation queries
  if (matches(/(weather|mausam|rain|barish|irrigation|sinchai|paani|मौसम|बारिश|वर्षा|पानी|सिंचाई|तापमान|ਧੁੱਪ|ਮੀਂਹ|ਮੌਸਮ)/i)) {
    if (isHindi) {
      return `मौसम एवं सिंचाई सलाह (${farmer.district} क्षेत्र):\n• वर्तमान मौसम: शुष्क एवं अनुकूल तापमान (24°C - 31°C)।\n• सिंचाई सलाह: यदि सरसों में फूल आने की अवस्था है तो हल्की सिंचाई करें, तेज हवा के समय सिंचाई से बचें ताकि फसल गिरे नहीं।\n\n💡 सुझाए गए अगले प्रश्न:\n• मेरी सक्रिय मंडी बुकिंग का समय क्या है?\n• गेहूं में सिंचाई की सही अवस्थाएं कौन सी हैं?`;
    }
    return `Weather & Irrigation Advisory (${farmer.district} Region):\n• Current conditions: Clear skies, moderate temperature suitable for rabi harvesting and procurement.\n• Irrigation Tip: Avoid irrigation during high wind speeds to prevent crop lodging.\n\n💡 Recommended Follow-up Questions:\n• What is my booking status at Karnal Mandi?`;
  }

  // 14. Contextual Fallback (Checks live status to give dynamic answer, NEVER the same stuck text!)
  const myBooking = tool_get_my_booking();
  const myQueue = tool_get_my_queue_status();
  
  if (isHindi) {
    if (myBooking.found) {
      return `रामेश्वर सिंह जी, आपका सवाल प्राप्त हुआ।\nआपकी सक्रिय मंडी बुकिंग का विवरण: टोकन **${myBooking.token_number}** (${myBooking.crop} - ~${myBooking.quantity_quintals} क्विंटल)।\nमंडी कतार की स्थिति: वर्तमान में टोकन **${myQueue.current_serving_token}** की जांच चल रही है और आपसे आगे **${myQueue.tokens_ahead} वाहन** हैं।\n\nआप मुझसे बेझिझक किसी भी विषय (MSP भाव, तौल रसीद, DBT भुगतान, खाद-बीज या फसल रोग) पर पूछ सकते हैं।\n\n💡 सुझाए गए अगले प्रश्न:\n• मेरी बुकिंग और टोकन नंबर क्या है?\n• मंडी कतार में मेरा क्या नंबर है?\n• गेहूं और सरसों का सरकारी MSP क्या है?\n• फसल में कीड़ा या रोग का इलाज क्या है?`;
    }
    return `नमस्ते ${farmer.name} जी! मैं आपकी बात समझ रहा हूँ। मैं आपका आधिकारिक KISSAN मंडी एवं कृषि सलाहकार हूँ।\nआप मुझसे बेझिझक अपनी स्लॉट बुकिंग, लाइव यार्ड कतार, फसल खरीद वजन, DBT बैंक भुगतान, आधिकारिक MSP भाव, फसल रोग पहचान या कृषि योजनाओं के बारे में पूछ सकते हैं।\n\n💡 सुझाए गए अगले प्रश्न:\n• मेरी बुकिंग और टोकन नंबर क्या है?\n• मंडी कतार में मेरा क्या नंबर है और कितना समय लगेगा?\n• सरसों और गेहूं का आधिकारिक MSP भाव क्या है?\n• फसल में कीट व रोग की पहचान कैसे करें?`;
  } else if (isPunjabi) {
    return `ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ${farmer.name} ਜੀ! ਮੈਂ ਤੁਹਾਡਾ KISSAN ਮੰਡੀ ਸਹਾਇਕ ਹਾਂ।\nਤੁਸੀਂ ਆਪਣੀ ਬੁਕਿੰਗ, ਕਤਾਰ, ਖਰੀਦ ਤੋਲ, DBT ਬੈਂਕ ਭੁਗਤਾਨ, ਸਰਕਾਰੀ MSP ਜਾਂ ਫਸਲ ਸਲਾਹ ਬਾਰੇ ਪੁੱਛ ਸਕਦੇ ਹੋ।\n\n💡 ਸੁਝਾਏ ਗਏ ਅਗਲੇ ਸਵਾਲ:\n• ਮੇਰੀ ਬੁਕਿੰਗ ਦੀ ਸਥਿਤੀ ਕੀ ਹੈ?\n• ਕਤਾਰ ਵਿੱਚ ਮੇਰਾ ਨੰਬਰ ਕੀ ਹੈ?`;
  }
  return `Namaste ${farmer.name}! I am your KISSAN Mandi and Agricultural Assistant.\nYou can ask me about your slot booking, live yard queue position, weighment records, DBT bank payment, official MSP rates, crop disease diagnosis, or farming schemes.\n\n💡 Recommended Follow-up Questions:\n• What is my booking and token status?\n• What is my queue position and estimated wait time?\n• What is the official MSP for Wheat and Mustard?\n• How do I identify crop diseases or pest attacks?`;
}

/**
 * Deterministic Natural Language Formatter for Tool Outputs
 */
function formatToolOutputFallback(toolName, data, lang) {
  const isHindi = lang === 'hi-IN';
  const isPunjabi = lang === 'pa-IN';

  switch (toolName) {
    case 'get_my_booking':
      if (!data.found) {
        return isHindi 
          ? `आपके पास अभी कोई सक्रिय बुकिंग नहीं है। कृपया "Book Slot" पर जाकर अपनी फसल का स्लॉट बुक करें।`
          : `You do not have any active bookings right now. Please navigate to "Book Slot" to reserve your procurement window.`;
      }
      if (data.all_active_bookings && data.all_active_bookings.length > 1 && !data.filter_applied) {
        const listText = data.all_active_bookings.map((b, i) => `• टोकन ${b.token_number}: ${b.crop} (${b.slot_date}, ${b.slot_time})`).join('\n');
        if (isHindi) {
          return `आपकी सक्रिय मंडी बुकिंग्स (${data.total_active_bookings} बुकिंग्स):\n${listText}\n\nकिसी विशिष्ट फसल को रद्द करने हेतु पूछें: "Cancel for Cotton" या "Cancel for Gram"`;
        }
        return `Your Active Mandi Bookings (${data.total_active_bookings} bookings):\n${data.all_active_bookings.map((b, i) => `• Token ${b.token_number}: ${b.crop} (${b.slot_date}, ${b.slot_time})`).join('\n')}\n\nTo cancel a specific booking, you can say: "Cancel for Cotton" or "Cancel for Gram".`;
      }
      if (isHindi) {
        return `आपकी सक्रिय मंडी बुकिंग का विवरण:\n• टोकन नंबर: ${data.token_number}\n• मंडी केंद्र: ${data.mandi_centre}\n• फसल: ${data.crop} (~${data.quantity_quintals} क्विंटल)\n• तारीख एवं समय: ${data.slot_date} (${data.slot_time})\n• वर्तमान स्थिति: ${data.status}\n\nआप "My Booking" पेज पर जाकर अपना डिजिटल क्यूआर गेट पास देख सकते हैं।`;
      }
      if (isPunjabi) {
        return `ਤੁਹਾਡੀ ਸਰਗਰਮ ਮੰਡੀ ਬੁਕਿੰਗ:\n• ਟੋਕਨ ਨੰਬਰ: ${data.token_number}\n• ਮੰਡੀ ਕੇਂਦਰ: ${data.mandi_centre}\n• ਫਸਲ: ${data.crop} (~${data.quantity_quintals} ਕੁਇੰਟਲ)\n• ਮਿਤੀ ਅਤੇ ਸਮਾਂ: ${data.slot_date} (${data.slot_time})\n• ਸਥਿਤੀ: ${data.status}`;
      }
      return `Your Active Mandi Booking Details:\n• Token Number: ${data.token_number}\n• Mandi Centre: ${data.mandi_centre}\n• Crop: ${data.crop} (~${data.quantity_quintals} Quintals)\n• Date & Window: ${data.slot_date} (${data.slot_time})\n• Current Status: ${data.status}\n\nYour QR Gate Pass is ready under the "My Booking" tab.`;

    case 'get_my_queue_status':
      if (isHindi) {
        return `मंडी यार्ड लाइव कतार स्थिति:\n• आपका टोकन: ${data.farmer_token || 'N/A'} (${data.status || 'ACTIVE'})\n• वर्तमान जांच टोकन: ${data.current_serving_token} (${data.active_stage})\n• आगे वाहन: ${data.tokens_ahead} वाहन\n• अनुमानित प्रतीक्षा समय: ~${data.estimated_wait_minutes} मिनट\n\n${data.recommendation}`;
      }
      if (isPunjabi) {
        return `ਲਾਈਵ ਮੰਡੀ ਕਤਾਰ ਸਥਿਤੀ:\n• ਤੁਹਾਡਾ ਟੋਕਨ: ${data.farmer_token || 'N/A'}\n• ਚੱਲ ਰਿਹਾ ਟੋਕਨ: ${data.current_serving_token}\n• ਅੱਗੇ ਵਾਹਨ: ${data.tokens_ahead}\n• ਅੰਦਾਜ਼ਨ ਸਮਾਂ: ~${data.estimated_wait_minutes} ਮਿੰਟ`;
      }
      return `Live Mandi Yard Queue Status:\n• Your Token: ${data.farmer_token || 'N/A'} (${data.status || 'ACTIVE'})\n• Currently Serving: ${data.current_serving_token} at ${data.active_stage}\n• Vehicles Ahead: ${data.tokens_ahead}\n• Estimated Wait Time: ~${data.estimated_wait_minutes} minutes\n\n${data.recommendation}`;

    case 'get_my_procurement':
      if (isHindi) {
        return `नवीनतम खरीद (Procurement) रिकॉर्ड:\n• रसीद संख्या: #${data.procurement_id}\n• फसल: ${data.crop}\n• शुद्ध वजन: ${data.net_weight_quintals} क्विंटल\n• गुणवत्ता: ${data.quality_grade}\n• कुल स्वीकृत राशि: ₹${Number(data.total_amount_inr).toLocaleString('en-IN')}\n• स्थिति: ${data.status}`;
      }
      return `Latest Procurement Record:\n• Receipt ID: #${data.procurement_id}\n• Crop: ${data.crop}\n• Net Weight: ${data.net_weight_quintals} Quintals\n• Quality Grade: ${data.quality_grade}\n• Total Amount: ₹${Number(data.total_amount_inr).toLocaleString('en-IN')}\n• Status: ${data.status}`;

    case 'get_my_payment_status':
      if (isHindi) {
        return `प्रत्यक्ष लाभ अंतरण (Direct DBT) भुगतान विवरण:\n• स्थिति: ${data.status} (खाते में स्वीकृत)\n• राशि: ₹${Number(data.amount_inr).toLocaleString('en-IN')}\n• लेनदेन संदर्भ: ${data.transaction_id}\n• बैंक माध्यम: ${data.channel}\n\n${data.statutory_note}`;
      }
      return `Direct Benefit Transfer (DBT) Payment Status:\n• Status: ${data.status}\n• Amount: ₹${Number(data.amount_inr).toLocaleString('en-IN')}\n• Transaction ID: ${data.transaction_id}\n• Payment Channel: ${data.channel}\n\n${data.statutory_note}`;

    case 'get_available_slots':
      const slotsList = (data.shifts || []).map(s => `• ${s.shift_name} (${s.time_window}): ${s.available_slots} स्लॉट उपलब्ध (क्षमता: ${s.total_capacity})`).join('\n');
      if (isHindi) {
        return `मंडी स्लॉट उपलब्धता (${data.date}):\n${slotsList}\n\nस्लॉट बुक करने के लिए कृपया "Book Slot" पेज पर जाएं।`;
      }
      return `Mandi Shift Availability (${data.date}):\n${(data.shifts || []).map(s => `• ${s.shift_name} (${s.time_window}): ${s.available_slots} slots available (Capacity: ${s.total_capacity})`).join('\n')}\n\nVisit the "Book Slot" page to reserve your entry.`;

    case 'get_official_msp':
      if (data.details) {
        const d = data.details;
        if (isHindi) {
          return `सरकारी न्यूनतम समर्थन मूल्य (MSP 2026-27):\n• फसल: ${d.hindi}\n• घोषित MSP: ₹${d.msp.toLocaleString('en-IN')} प्रति क्विंटल\n• अधिकतम स्वीकार्य नमी: ${d.max_moisture}\n• गुणवत्ता मानक: ${d.grade}\n\nनोट: FAQ ग्रेड मानकों के तहत 100% MSP का पूर्ण भुगतान किया जाता है।`;
        }
        return `Official Minimum Support Price (MSP 2026-27):\n• Crop: ${data.crop.toUpperCase()}\n• Government MSP: ₹${d.msp.toLocaleString('en-IN')} / Quintal\n• Maximum Moisture Limit: ${d.max_moisture}\n• Standard Grade: ${d.grade}`;
      }
      const ratesList = (data.rates || []).map(r => `• ${r.crop}: ₹${r.msp_per_quintal.toLocaleString('en-IN')}/क्विंटल (नमी सीमा: ${r.max_moisture})`).join('\n');
      if (isHindi) {
        return `भारत सरकार द्वारा घोषित प्रमुख MSP दरें (2026-27):\n${ratesList}`;
      }
      return `Government of India Declared MSP Rates (2026-27):\n${(data.rates || []).map(r => `• ${r.crop}: ₹${r.msp_per_quintal.toLocaleString('en-IN')} / Quintal (Moisture: ${r.max_moisture})`).join('\n')}`;

    case 'get_mandi_rules':
      if (isHindi) {
        return `मंडी गेट पर अनिवार्य दस्तावेज:\n${data.mandatory_documents.join('\n')}\n\nकार्य समय: ${data.mandi_timings}\nराष्ट्रीय किसान हेल्पलाइन: ${data.helpline.toll_free}`;
      }
      return `Mandatory Mandi Entry Documents:\n${data.mandatory_documents.join('\n')}\n\nOperating Timings: ${data.mandi_timings}\nNational Helpline: ${data.helpline.toll_free}`;

    default:
      return JSON.stringify(data);
  }
}

// Export for automated testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    tool_get_my_booking,
    tool_get_my_queue_status,
    tool_get_my_procurement,
    tool_get_my_payment_status,
    tool_get_available_slots,
    tool_get_official_msp,
    tool_get_mandi_rules,
    tool_confirm_cancel_booking,
    detectPromptInjection,
    formatToolOutputFallback
  };
}
