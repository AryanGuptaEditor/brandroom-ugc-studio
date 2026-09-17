/**
 * Brandroom AI UGC Creator Studio
 * 3-Shot Lookbook Pack & Master Prompt Engine
 */

// Application State
const state = {
  preferredProvider: 'auto',
  apiKeys: {
    openai: '',
    gemini: '',
    claude: ''
  },
  models: {
    openai: 'gpt-4o',
    gemini: 'gemini-1.5-flash',
    claude: 'claude-3-5-sonnet-20241022'
  },
  aspectRatio: '9:16',
  uploadedCharacters: [],
  activeUploadedCharacterId: null,
  hideUploadedImages: false,
  useUploadedCharacter: false,
  activeOutputTab: 'lookbook',
  generatedData: null,
  activeMainView: 'studio',
  creatorMemories: [],
  chatHistory: [],
  revisionCount: 1,
  productImageBase64: null,
  productImageFileName: null,
  productSuggestedCreators: [],
  activeProductCreatorIndex: null,
  productSuggestionBatch: 1,
  productPreviousArchetypes: []
};

// -----------------------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadStoredKeys();
  loadCreatorMemories();
  loadUploadedCharacters();
  updateModelIdentityBadge();
  setGender('Female');
  setAspectRatio('9:16');
  suggestCreatorFromProduct();
  setupDragAndDrop();
  updateHidePreviewUI();
  setupContentEditableSync();
});

// Setup drag and drop for upload box
function setupDragAndDrop() {
  const dropZone = document.getElementById('uploadDropZone');
  if (!dropZone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('border-blue-500', 'bg-slate-900/60');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-blue-500', 'bg-slate-900/60');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
      processImageFile(files[0]);
    }
  }, false);

  // Setup drag and drop for product image drop zone
  const prodDropZone = document.getElementById('productDropZone');
  if (prodDropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      prodDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        prodDropZone.classList.add('border-blue-500', 'bg-slate-900/60');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      prodDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        prodDropZone.classList.remove('border-blue-500', 'bg-slate-900/60');
      }, false);
    });

    prodDropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length) {
        processProductImageFile(files[0]);
      }
    }, false);
  }
}

// -----------------------------------------------------------------------------
// GENDER, AGE & ASPECT RATIO CONTROLS
// -----------------------------------------------------------------------------
function setGender(g) {
  state.gender = g;
  const input = document.getElementById('inputGender');
  if (input) input.value = g;

  const btnFemale = document.getElementById('genderBtnFemale');
  const btnMale = document.getElementById('genderBtnMale');
  const btnNonBinary = document.getElementById('genderBtnNonBinary');

  const gLower = (g || '').toLowerCase();
  if (btnFemale) {
    if (gLower.includes('female')) {
      btnFemale.className = 'gender-pill px-1.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white transition flex items-center justify-center gap-1 shadow-sm';
    } else {
      btnFemale.className = 'gender-pill px-1.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition flex items-center justify-center gap-1';
    }
  }
  if (btnMale) {
    if (!gLower.includes('female') && (gLower.includes('male') || gLower.includes('man'))) {
      btnMale.className = 'gender-pill px-1.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white transition flex items-center justify-center gap-1 shadow-sm';
    } else {
      btnMale.className = 'gender-pill px-1.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition flex items-center justify-center gap-1';
    }
  }
  if (btnNonBinary) {
    if (gLower.includes('non') || gLower.includes('binary') || gLower.includes('other') || gLower.includes('andro')) {
      btnNonBinary.className = 'gender-pill px-1.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white transition flex items-center justify-center gap-1 shadow-sm';
    } else {
      btnNonBinary.className = 'gender-pill px-1.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition flex items-center justify-center gap-1';
    }
  }
}

function setAge(a) {
  const input = document.getElementById('inputAge');
  if (input) input.value = a;
}

function setAspectRatio(ar) {
  state.aspectRatio = ar;
  const input = document.getElementById('inputAspectRatio');
  if (input) input.value = ar;

  const btnV = document.getElementById('arBtnVertical');
  const btnH = document.getElementById('arBtnHorizontal');
  const btnS = document.getElementById('arBtnSquare');
  const label = document.getElementById('activeArLabel');
  const badge = document.getElementById('outFormatBadge');

  if (btnV) btnV.className = ar === '9:16'
    ? 'ar-pill px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white transition flex flex-col items-center gap-0.5 shadow-md shadow-blue-600/20'
    : 'ar-pill px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition flex flex-col items-center gap-0.5';

  if (btnH) btnH.className = ar === '16:9'
    ? 'ar-pill px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white transition flex flex-col items-center gap-0.5 shadow-md shadow-blue-600/20'
    : 'ar-pill px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition flex flex-col items-center gap-0.5';

  if (btnS) btnS.className = ar === '1:1'
    ? 'ar-pill px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white transition flex flex-col items-center gap-0.5 shadow-md shadow-blue-600/20'
    : 'ar-pill px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition flex flex-col items-center gap-0.5';

  if (ar === '16:9') {
    if (label) label.textContent = '🖥️ 16:9 Horizontal';
    if (badge) badge.textContent = '🖥️ 16:9 Horizontal';
  } else if (ar === '1:1') {
    if (label) label.textContent = '◻️ 1:1 Square';
    if (badge) badge.textContent = '◻️ 1:1 Square';
  } else {
    if (label) label.textContent = '📱 9:16 Vertical';
    if (badge) badge.textContent = '📱 9:16 Vertical';
  }
}

function parseGender(raw) {
  if (!raw) return 'Female';
  const s = String(raw).toLowerCase();
  if (s.includes('female') || s.includes('woman') || s.includes('girl') || s.includes('lady')) {
    return 'Female';
  }
  if (s.includes('male') || s.includes('man') || s.includes('boy') || s.includes('guy') || s.includes('gentleman')) {
    return 'Male';
  }
  if (s.includes('non-binary') || s.includes('androgynous')) {
    return 'Non-Binary';
  }
  return 'Female';
}

// -----------------------------------------------------------------------------
// QUICK AI 1-SENTENCE COMMAND BAR
// -----------------------------------------------------------------------------
async function executeQuickPrompt() {
  const input = document.getElementById('quickPromptInput');
  const btn = document.getElementById('btnQuickPrompt');
  const btnText = document.getElementById('btnQuickPromptText');
  if (!input) return;

  const promptText = input.value.trim();
  if (!promptText) {
    showToast('Please enter a brief sentence describing your creator!');
    input.focus();
    return;
  }

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'AI Parsing & Generating...';

  try {
    let brief = null;
    try {
      const res = await fetch('/api/quick-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          provider: state.preferredProvider,
          apiKeys: state.apiKeys,
          apiKey: state.apiKeys.gemini || state.apiKeys.openai || state.apiKeys.claude
        })
      });
      if (res.ok) {
        const data = await res.json();
        brief = data.brief;
      }
    } catch (e) {
      console.warn('Backend quick-prompt call failed, using client parser:', e);
    }

    if (!brief) {
      brief = parseQuickPromptClient(promptText);
    }

    // Populate studio form
    if (brief.brandName) setInputValue('inputBrandName', brief.brandName);
    if (brief.productName) setInputValue('inputProductName', brief.productName);
    if (brief.productCategory) setInputValue('selectCategory', brief.productCategory);
    if (brief.productOrigin) setInputValue('inputProductOrigin', brief.productOrigin);
    if (brief.gender) setGender(brief.gender);
    if (brief.age) setInputValue('inputAge', brief.age);
    if (brief.ethnicity) setInputValue('inputEthnicity', brief.ethnicity);
    if (brief.hair) setInputValue('inputHair', brief.hair);
    if (brief.faceFeatures) setInputValue('inputFacialFeatures', brief.faceFeatures);
    if (brief.wardrobe) setInputValue('inputWardrobe', brief.wardrobe);
    if (brief.environment) {
      setInputValue('selectEnvironment', brief.environment);
      setInputValue('inputEnvironment', brief.environment);
    }
    if (brief.lighting) {
      setInputValue('selectLighting', brief.lighting);
      setInputValue('inputLighting', brief.lighting);
    }
    if (brief.action) setInputValue('inputAction', brief.action);
    if (brief.fineTune) setInputValue('inputFineTune', brief.fineTune);
    if (brief.aspectRatio) setAspectRatio(brief.aspectRatio);

    detachUploadedCharacter();

    // Auto generate 3-shot lookbook
    await generateMasterPrompt();
    showToast(`✓ Auto-filled brief & generated lookbook in ${brief.aspectRatio || '9:16'} format!`);
  } catch (err) {
    showToast(`Notice: ${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Auto-Fill & Generate';
  }
}

function parseQuickPromptClient(promptText) {
  const pLower = promptText.toLowerCase();
  let age = '23';
  const ageMatch = pLower.match(/\b(1[6-9]|[2-8][0-9])\s*(?:yo|years?\s*(?:old)?|yr|y\/o)?\b/);
  if (ageMatch) age = ageMatch[1];

  let gender = 'Female';
  if (pLower.includes('male') || pLower.includes(' man ') || pLower.includes('guy') || pLower.includes('boy')) {
    if (!pLower.includes('female')) gender = 'Male';
  }
  if (pLower.includes('non-binary') || pLower.includes('androgynous')) gender = 'Non-Binary';

  let ar = '9:16';
  if (pLower.includes('horizontal') || pLower.includes('16:9') || pLower.includes('landscape') || pLower.includes('wide')) {
    ar = '16:9';
  } else if (pLower.includes('square') || pLower.includes('1:1')) {
    ar = '1:1';
  }

  let eth = 'South Asian / Indian — Warm golden medium complexion with radiant undertones';
  let orig = 'India — Urban Metro (Mumbai / Delhi / Bengaluru)';
  if (pLower.includes('european') || pLower.includes('white') || pLower.includes('caucasian') || pLower.includes('fair')) {
    eth = 'European / Fair with natural subtle freckles';
    orig = 'Global / Universal International';
  } else if (pLower.includes('east asian') || pLower.includes('korean') || pLower.includes('japanese')) {
    eth = 'East Asian / Korean-Japanese — Smooth porcelain skin with subtle warm undertone';
    orig = 'South Korea / Seoul Clean Aesthetic';
  } else if (pLower.includes('black') || pLower.includes('afro')) {
    eth = 'Afro-descendant / Black — Deep rich melanin with natural radiant skin sheen';
    orig = 'Global / Universal International';
  }

  let wardrobe = gender === 'Female'
    ? 'Relaxed breathable sage-green linen kurti with rolled cuffs, slim off-white cigarette trousers, clean minimalist leather sandals'
    : 'Minimalist black textured mandarin-collar long-sleeve shirt, tailored black straight trousers, polished black leather derby shoes';
  if (pLower.includes('linen') || pLower.includes('shirt')) {
    wardrobe = 'Relaxed breathable white linen shirt with rolled cuffs, tailored straight off-white trousers, clean leather slides';
  }

  let cat = 'Fashion & Apparel (Streetwear & Casual)';
  let prod = 'Minimalist Linen Outfit';
  if (pLower.includes('serum') || pLower.includes('skincare') || pLower.includes('glow')) {
    cat = 'Beauty / Clean Skincare & Serums';
    prod = 'Radiance Botanical Glow Serum';
  } else if (pLower.includes('hair') || pLower.includes('oil')) {
    cat = 'Haircare, Scalp Treatments & Oils';
    prod = 'Nourishing Hair & Scalp Oil';
  }

  return {
    brandName: 'Brandroom Studio',
    productName: prod,
    productCategory: cat,
    productOrigin: orig,
    gender,
    age,
    ethnicity: eth,
    hair: gender === 'Female' ? 'Long glossy dark-brown hair with loose effortless waves' : 'Neat textured short taper fade with clean hairline',
    faceFeatures: gender === 'Female' ? 'Softly defined oval face, warm almond deep-brown eyes, radiant golden undertone, authentic unretouched skin micro-pores' : 'Clean defined jawline, direct calm frontal gaze, authentic micro-pores, natural skin grain',
    wardrobe,
    environment: 'Seamless neutral light-gray studio backdrop with soft floor contact shadows',
    lighting: 'Clean diffused commercial softbox studio daylight with realistic micro-shadows',
    action: 'Holding product delicately toward camera with authentic friendly curiosity',
    fineTune: 'Balanced Commercial Lookbook Standards (Neutral Exposure, Sharp Garment Weave, Zero Airbrushing)',
    aspectRatio: ar
  };
}

// Backward compatibility helpers
function syncCategoryPreset(v) { if (v && v !== 'custom') setInputValue('selectCategory', v); }
function syncOriginPreset(v) { if (v && v !== 'custom') { setInputValue('inputProductOrigin', v); suggestCreatorFromProduct(); } }
function syncAgePreset(v) { if (v && v !== 'custom') setInputValue('inputAge', v); }
function syncEthnicityPreset(v) { if (v && v !== 'custom') setInputValue('inputEthnicity', v); }
function syncHairPreset(v) { if (v && v !== 'custom') setInputValue('inputHair', v); }
function syncFacePreset(v) { if (v && v !== 'custom') setInputValue('inputFacialFeatures', v); }
function syncWardrobePreset(v) { if (v && v !== 'custom') setInputValue('inputWardrobe', v); }
function syncEnvPreset(v) { if (v && v !== 'custom') { setInputValue('selectEnvironment', v); setInputValue('inputEnvironment', v); } }
function syncLightingPreset(v) { if (v && v !== 'custom') { setInputValue('selectLighting', v); setInputValue('inputLighting', v); } }
function syncFineTunePreset(v) { if (v && v !== 'custom') setInputValue('inputFineTune', v); }

// -----------------------------------------------------------------------------
// VIEW SWITCHING (STUDIO vs CHAT DIRECTOR)
// -----------------------------------------------------------------------------
function switchMainView(view) {
  state.activeMainView = view;
  const studioBtn = document.getElementById('navTabStudioBtn');
  const chatBtn = document.getElementById('navTabChatBtn');
  const studioView = document.getElementById('viewStudio');
  const chatView = document.getElementById('viewChat');

  if (view === 'studio') {
    if (studioBtn) studioBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white flex items-center gap-2 transition shadow-md';
    if (chatBtn) chatBtn.className = 'px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-2 transition';
    if (studioView) studioView.classList.remove('hidden');
    if (chatView) chatView.classList.add('hidden');
  } else {
    if (chatBtn) chatBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 text-white flex items-center gap-2 transition shadow-md';
    if (studioBtn) studioBtn.className = 'px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-2 transition';
    if (chatView) chatView.classList.remove('hidden');
    if (studioView) studioView.classList.add('hidden');
    
    const pInput = document.getElementById('inputProductName');
    const pName = pInput ? pInput.value : 'your product';
    const chatTitle = document.getElementById('chatBriefProduct');
    if (chatTitle) chatTitle.textContent = pName;
  }
}

// -----------------------------------------------------------------------------
// MODEL TRANSPARENCY & API KEYS
// -----------------------------------------------------------------------------
function loadStoredKeys() {
  state.apiKeys.openai = localStorage.getItem('brandroom_openai_key') || '';
  state.apiKeys.gemini = localStorage.getItem('brandroom_gemini_key') || '';
  state.apiKeys.claude = localStorage.getItem('brandroom_claude_key') || '';
  state.preferredProvider = localStorage.getItem('brandroom_preferred_provider') || 'auto';
  
  const prefSelect = document.getElementById('selectPreferredProvider');
  if (prefSelect) prefSelect.value = state.preferredProvider;
}

function setPreferredProvider(val) {
  state.preferredProvider = val;
  localStorage.setItem('brandroom_preferred_provider', val);

  const prefSelect = document.getElementById('selectPreferredProvider');
  if (prefSelect) prefSelect.value = val;

  updateModelIdentityBadge();

  const names = {
    gemini: 'Google Gemini (1.5 Flash / Pro)',
    openai: 'ChatGPT (OpenAI GPT-4o)',
    claude: 'Anthropic Claude (3.5 Sonnet)',
    auto: 'Auto-Engine (Best Available)'
  };
  showToast(`✓ Switched AI Engine to ${names[val] || val}`);
}

function updateModelIdentityBadge() {
  const current = state.preferredProvider || 'auto';

  // 1. Update button states in all 3 switchers (header, CTA bar, chat)
  const buttonGroups = [
    { prefix: 'headerBtn', baseClass: 'model-switch-btn px-2.5 py-1 rounded-md transition flex items-center gap-1.5' },
    { prefix: 'ctaBtn', baseClass: 'px-2.5 py-1 rounded-lg transition flex items-center gap-1' },
    { prefix: 'chatBtn', baseClass: 'px-2 py-0.5 rounded-lg transition' }
  ];

  const providerStyles = {
    gemini: 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-500/30',
    openai: 'bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-500/30',
    claude: 'bg-purple-600 text-white font-bold shadow-sm shadow-purple-500/30',
    auto: 'bg-amber-600 text-white font-bold shadow-sm shadow-amber-500/30'
  };

  const inactiveStyle = 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-medium';

  ['gemini', 'openai', 'claude', 'auto'].forEach(prov => {
    buttonGroups.forEach(grp => {
      const capId = prov === 'auto' ? 'Auto' : prov === 'openai' ? 'OpenAI' : prov.charAt(0).toUpperCase() + prov.slice(1);
      const btn = document.getElementById(grp.prefix + capId);
      if (btn) {
        if (current === prov) {
          btn.className = `${grp.baseClass} ${providerStyles[prov]}`;
        } else {
          btn.className = `${grp.baseClass} ${inactiveStyle}`;
        }
      }
    });
  });

  // 2. Update status dot color
  const dot = document.getElementById('activeModelStatusDot');
  if (dot) {
    if (current === 'gemini') {
      dot.className = 'w-2 h-2 rounded-full bg-blue-400 animate-pulse';
    } else if (current === 'openai') {
      dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    } else if (current === 'claude') {
      dot.className = 'w-2 h-2 rounded-full bg-purple-400 animate-pulse';
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
    }
  }

  // 3. Update descriptive labels
  const labelText = document.getElementById('activeModelLabelText');
  if (labelText) {
    if (current === 'gemini') {
      labelText.textContent = 'Google Gemini (1.5 Flash/Pro) Active';
      labelText.className = 'text-[11px] text-blue-300 font-semibold hidden md:inline-block';
    } else if (current === 'openai') {
      labelText.textContent = 'ChatGPT (GPT-4o) Active';
      labelText.className = 'text-[11px] text-emerald-300 font-semibold hidden md:inline-block';
    } else if (current === 'claude') {
      labelText.textContent = 'Claude 3.5 Sonnet Active';
      labelText.className = 'text-[11px] text-purple-300 font-semibold hidden md:inline-block';
    } else {
      labelText.textContent = 'Auto-Engine Active';
      labelText.className = 'text-[11px] text-amber-300 font-semibold hidden md:inline-block';
    }
  }

  const chatIndicator = document.getElementById('chatModelIndicator');
  if (chatIndicator) {
    const chatNames = {
      gemini: 'Gemini 1.5',
      openai: 'ChatGPT-4o',
      claude: 'Claude 3.5',
      auto: 'Auto Engine'
    };
    chatIndicator.textContent = chatNames[current] || 'Online';
    if (current === 'gemini') {
      chatIndicator.className = 'text-xs bg-slate-950 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full font-mono';
    } else if (current === 'openai') {
      chatIndicator.className = 'text-xs bg-slate-950 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-mono';
    } else if (current === 'claude') {
      chatIndicator.className = 'text-xs bg-slate-950 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full font-mono';
    } else {
      chatIndicator.className = 'text-xs bg-slate-950 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full font-mono';
    }
  }
}

function openApiKeysModal() {
  const kO = document.getElementById('keyOpenAI');
  const kG = document.getElementById('keyGemini');
  const kC = document.getElementById('keyClaude');
  if (kO) kO.value = state.apiKeys.openai;
  if (kG) kG.value = state.apiKeys.gemini;
  if (kC) kC.value = state.apiKeys.claude;
  
  const resDiv = document.getElementById('keyTestResult');
  if (resDiv) resDiv.classList.add('hidden');
  
  const modal = document.getElementById('modalApiKeys');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeApiKeysModal() {
  const modal = document.getElementById('modalApiKeys');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function saveApiKeys() {
  const kO = document.getElementById('keyOpenAI');
  const kG = document.getElementById('keyGemini');
  const kC = document.getElementById('keyClaude');
  
  state.apiKeys.openai = kO ? kO.value.trim() : '';
  state.apiKeys.gemini = kG ? kG.value.trim() : '';
  state.apiKeys.claude = kC ? kC.value.trim() : '';

  localStorage.setItem('brandroom_openai_key', state.apiKeys.openai);
  localStorage.setItem('brandroom_gemini_key', state.apiKeys.gemini);
  localStorage.setItem('brandroom_claude_key', state.apiKeys.claude);

  updateModelIdentityBadge();
  closeApiKeysModal();
  showToast('AI Provider Keys updated & active!');
}

async function testKey(provider) {
  const inputMap = {
    openai: 'keyOpenAI',
    gemini: 'keyGemini',
    claude: 'keyClaude'
  };
  const el = document.getElementById(inputMap[provider]);
  const key = el ? el.value.trim() : '';
  const resDiv = document.getElementById('keyTestResult');

  if (!key) {
    if (resDiv) {
      resDiv.className = 'p-2.5 rounded-xl text-xs font-mono bg-red-950/60 text-red-300 border border-red-800';
      resDiv.textContent = `Please enter an API key for ${provider.toUpperCase()} first.`;
      resDiv.classList.remove('hidden');
    }
    return;
  }

  if (resDiv) {
    resDiv.className = 'p-2.5 rounded-xl text-xs font-mono bg-slate-950 text-slate-300 border border-slate-800 flex items-center gap-2';
    resDiv.innerHTML = `<span class="animate-spin inline-block">⏳</span> Verifying connection to ${provider.toUpperCase()}...`;
    resDiv.classList.remove('hidden');
  }

  try {
    const response = await fetch('/api/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        apiKey: key,
        model: state.models[provider]
      })
    });
    const data = await response.json();
    if (data.success) {
      if (resDiv) {
        resDiv.className = 'p-2.5 rounded-xl text-xs font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800';
        resDiv.innerHTML = `✓ Connected to ${provider.toUpperCase()}! Model ready.`;
      }
    } else {
      throw new Error(data.error || 'Check failed');
    }
  } catch (err) {
    if (resDiv) {
      resDiv.className = 'p-2.5 rounded-xl text-xs font-mono bg-red-950/60 text-red-300 border border-red-800';
      resDiv.textContent = `Notice: ${err.message}. Ready for requests.`;
    }
  }
}

// -----------------------------------------------------------------------------
// CREATOR MEMORY VAULT (PRESETS)
// -----------------------------------------------------------------------------
function loadCreatorMemories() {
  try {
    const saved = localStorage.getItem('brandroom_creator_memories');
    if (saved) {
      let memories = JSON.parse(saved);
      // Clean out any old hardcoded reference memories
      memories = memories.filter(m => m.id !== 'mem_ref_lookbook' && !(m.name && m.name.toLowerCase().includes('lucas')));
      state.creatorMemories = memories;
      saveMemoriesToStorage();
    } else {
      state.creatorMemories = [];
      saveMemoriesToStorage();
    }
  } catch (e) {
    state.creatorMemories = [];
  }
  renderMemoryVault();
}

function saveMemoriesToStorage() {
  localStorage.setItem('brandroom_creator_memories', JSON.stringify(state.creatorMemories));
}

function saveToMemoryVault(creator) {
  const existing = state.creatorMemories.find(m => m.name.toLowerCase() === creator.name.toLowerCase());
  if (!existing) {
    state.creatorMemories.unshift({
      id: 'mem_' + Date.now(),
      name: creator.name || `${creator.origin || 'Custom'} Character`,
      origin: creator.origin || 'Global',
      age: creator.age || '24',
      gender: creator.gender || 'Male',
      hair: creator.hair || '',
      facialFeatures: creator.facialFeatures || '',
      wardrobe: creator.wardrobe || ''
    });
    if (state.creatorMemories.length > 12) state.creatorMemories.pop();
    saveMemoriesToStorage();
    renderMemoryVault();
    showToast(`Saved "${creator.name}" to Memory Vault!`);
  }
}

function renderMemoryVault() {
  const container = document.getElementById('creatorMemoryList');
  if (!container) return;
  container.innerHTML = '';

  if (state.creatorMemories.length === 0) {
    container.innerHTML = '<span class="text-[11px] text-slate-500 italic">No saved presets yet.</span>';
    return;
  }

  state.creatorMemories.forEach(mem => {
    const chip = document.createElement('div');
    chip.className = 'group inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/50 rounded-lg text-[11px] text-slate-200 cursor-pointer transition';
    chip.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
      <span class="truncate max-w-[150px]">${mem.name}</span>
      <button onclick="event.stopPropagation(); deleteMemory('${mem.id}')" class="text-slate-500 hover:text-red-400 ml-1 opacity-60 hover:opacity-100">&times;</button>
    `;
    chip.onclick = () => applyMemory(mem);
    container.appendChild(chip);
  });
}

function applyMemory(mem) {
  switchCreatorTab('manual');
  if (mem.age) setInputValue('inputAge', mem.age);
  if (mem.gender) setInputValue('inputGender', mem.gender);
  if (mem.origin) setInputValue('inputEthnicity', mem.origin);
  if (mem.hair) setInputValue('inputHair', mem.hair);
  if (mem.facialFeatures) setInputValue('inputFacialFeatures', mem.facialFeatures);
  if (mem.wardrobe) setInputValue('inputWardrobe', mem.wardrobe);

  detachUploadedCharacter();
  showToast(`Restored "${mem.name}"!`);
}

function deleteMemory(id) {
  state.creatorMemories = state.creatorMemories.filter(m => m.id !== id);
  saveMemoriesToStorage();
  renderMemoryVault();
}

// -----------------------------------------------------------------------------
// CREATOR CASTING: 3 MODES (MANUAL, SUGGEST, UPLOAD)
// -----------------------------------------------------------------------------
function switchCreatorTab(tab) {
  const manualBtn = document.getElementById('tabManualBtn');
  const suggestBtn = document.getElementById('tabSuggestBtn');
  const uploadBtn = document.getElementById('tabUploadBtn');

  const manualPanel = document.getElementById('panelManualCreator');
  const suggestPanel = document.getElementById('panelSuggestCreator');
  const uploadPanel = document.getElementById('panelUploadCreator');

  const activeClass = 'px-2.5 py-1.5 rounded-lg bg-slate-800 text-white font-semibold transition flex items-center gap-1';
  const inactiveClass = 'px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white font-medium transition flex items-center gap-1';

  if (manualBtn) manualBtn.className = inactiveClass;
  if (suggestBtn) suggestBtn.className = inactiveClass;
  if (uploadBtn) uploadBtn.className = inactiveClass;

  if (manualPanel) manualPanel.classList.add('hidden');
  if (suggestPanel) suggestPanel.classList.add('hidden');
  if (uploadPanel) uploadPanel.classList.add('hidden');

  if (tab === 'manual') {
    if (manualBtn) manualBtn.className = activeClass;
    if (manualPanel) manualPanel.classList.remove('hidden');
  } else if (tab === 'suggest') {
    if (suggestBtn) suggestBtn.className = activeClass;
    if (suggestPanel) suggestPanel.classList.remove('hidden');
    suggestCreatorFromProduct();
  } else if (tab === 'upload') {
    if (uploadBtn) uploadBtn.className = activeClass;
    if (uploadPanel) uploadPanel.classList.remove('hidden');
    renderUploadedCharactersGallery();
  }
}

// -----------------------------------------------------------------------------
// UPLOADED CHARACTERS VAULT & IMAGE GALLERY
// -----------------------------------------------------------------------------
function loadUploadedCharacters() {
  try {
    const saved = localStorage.getItem('brandroom_uploaded_characters');
    if (saved) {
      let chars = JSON.parse(saved);
      // Clean out any old hardcoded default characters
      chars = chars.filter(c => c.id !== 'char_default_lucas' && !(c.name && c.name.toLowerCase().includes('lucas')));
      state.uploadedCharacters = chars;
      saveUploadedCharactersToStorage();
    } else {
      state.uploadedCharacters = [];
      saveUploadedCharactersToStorage();
    }
  } catch (e) {
    state.uploadedCharacters = [];
  }

  const hidePref = localStorage.getItem('brandroom_hide_uploaded_images');
  state.hideUploadedImages = hidePref === 'true';

  renderUploadedCharactersGallery();
}

function saveUploadedCharactersToStorage() {
  localStorage.setItem('brandroom_uploaded_characters', JSON.stringify(state.uploadedCharacters));
}

function toggleHideUploadedImages(forceVal) {
  if (forceVal !== undefined) {
    state.hideUploadedImages = Boolean(forceVal);
  } else {
    state.hideUploadedImages = !state.hideUploadedImages;
  }
  localStorage.setItem('brandroom_hide_uploaded_images', state.hideUploadedImages ? 'true' : 'false');
  updateHidePreviewUI();
  renderUploadedCharactersGallery();

  if (state.hideUploadedImages) {
    showToast('Character images hidden on frontend (stored in memory)');
  } else {
    showToast('Character images visible on frontend');
  }
}

function updateHidePreviewUI() {
  const btn = document.getElementById('btnToggleHidePreview');
  const text = document.getElementById('textTogglePreview');
  const icon = document.getElementById('iconTogglePreview');
  const previewContainer = document.getElementById('uploadPreviewContainer');

  if (state.hideUploadedImages) {
    if (text) text.textContent = 'Show Preview on Screen';
    if (icon) icon.setAttribute('data-lucide', 'eye-off');
    if (btn) btn.className = 'text-[11px] px-2.5 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900 text-blue-300 flex items-center gap-1.5 border border-blue-800 transition';
    if (previewContainer) {
      const img = document.getElementById('imagePreview');
      if (img) img.classList.add('hidden');
    }
  } else {
    if (text) text.textContent = 'Hide Preview on Screen';
    if (icon) icon.setAttribute('data-lucide', 'eye');
    if (btn) btn.className = 'text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 border border-slate-700 transition';
    if (previewContainer) {
      const img = document.getElementById('imagePreview');
      if (img) img.classList.remove('hidden');
    }
  }

  if (window.lucide) lucide.createIcons();
}

function renderUploadedCharactersGallery() {
  const container = document.getElementById('uploadedCharactersGallery');
  const badge = document.getElementById('uploadedCountBadge');
  if (badge) badge.textContent = state.uploadedCharacters.length;

  if (!container) return;
  container.innerHTML = '';

  if (state.uploadedCharacters.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 p-4 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
        No reference characters uploaded yet. Upload a character image above to save into your vault.
      </div>
    `;
    return;
  }

  state.uploadedCharacters.forEach(char => {
    const isActive = state.useUploadedCharacter && state.activeUploadedCharacterId === char.id;
    const card = document.createElement('div');
    card.className = `character-vault-card p-3 rounded-xl bg-slate-950 border ${isActive ? 'active-character border-blue-500' : 'border-slate-800'} text-xs space-y-2`;

    // Image thumbnail or hidden image badge
    let imgBlock = '';
    if (!state.hideUploadedImages && char.imageUrl) {
      imgBlock = `<img src="${char.imageUrl}" class="w-14 h-16 object-cover rounded-lg border border-slate-700 shrink-0 shadow">`;
    } else if (char.imageUrl) {
      imgBlock = `
        <div class="w-14 h-16 rounded-lg bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-[9px] text-slate-400 shrink-0 text-center px-1">
          <i data-lucide="shield-check" class="w-4 h-4 text-blue-400 mb-0.5"></i>
          <span>In Memory</span>
        </div>
      `;
    } else {
      imgBlock = `
        <div class="w-14 h-16 rounded-lg bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-[9px] text-slate-400 shrink-0 text-center px-1">
          <i data-lucide="user" class="w-4 h-4 text-cyan-400 mb-0.5"></i>
          <span>Preset</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="flex items-start gap-2.5">
        ${imgBlock}
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1">
            <span class="font-bold text-slate-200 text-[11px] truncate">${char.name}</span>
            ${isActive ? '<span class="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[9px] font-bold">Active ✓</span>' : ''}
          </div>
          <p class="text-[10px] text-blue-400 font-medium truncate mt-0.5">${char.origin || 'Detected Origin'}</p>
          <p class="text-[9px] text-slate-400 line-clamp-1 mt-0.5">${char.apparentAge ? char.apparentAge + 'yo, ' : ''}${char.gender || ''}</p>
          <p class="text-[9px] text-slate-500 line-clamp-1">${char.hair || 'Natural Hair'}</p>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-900">
        <button type="button" onclick="useUploadedCharacter('${char.id}')" class="flex-1 py-1 px-2 rounded-lg ${isActive ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium'} text-[10px] transition text-center">
          ${isActive ? '✓ Selected Character' : 'Use This Character'}
        </button>
        <button type="button" onclick="deleteUploadedCharacter('${char.id}')" title="Delete character" class="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-900 transition">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

function useUploadedCharacter(id) {
  const char = state.uploadedCharacters.find(c => c.id === id);
  if (!char) return;

  state.activeUploadedCharacterId = id;
  state.useUploadedCharacter = true;

  // Populate studio form
  if (char.gender) {
    setGender(parseGender(char.gender));
  }
  if (char.apparentAge) {
    const ageNum = char.apparentAge.toString().replace(/[^0-9]/g, '').slice(0, 2);
    if (ageNum) setAge(ageNum);
  }
  if (char.origin) setInputValue('inputEthnicity', char.origin);
  if (char.hair) setInputValue('inputHair', char.hair);
  if (char.facialFeatures) setInputValue('inputFacialFeatures', char.facialFeatures);
  if (char.wardrobe) setInputValue('inputWardrobe', char.wardrobe);

  updateActiveCharacterBanner();
  renderUploadedCharactersGallery();
  showToast(`Using "${char.name}" in Prompt Generation!`);
}

function detachUploadedCharacter() {
  state.useUploadedCharacter = false;
  state.activeUploadedCharacterId = null;
  updateActiveCharacterBanner();
  renderUploadedCharactersGallery();
  showToast('Switched to manual character mode');
}

function updateActiveCharacterBanner() {
  const banner = document.getElementById('activeCharacterBanner');
  const bannerText = document.getElementById('activeCharacterBannerText');
  if (!banner) return;

  if (state.useUploadedCharacter && state.activeUploadedCharacterId) {
    const char = state.uploadedCharacters.find(c => c.id === state.activeUploadedCharacterId);
    if (char) {
      if (bannerText) bannerText.textContent = `Using Uploaded Character: ${char.name} (Visual anchor active)`;
      banner.classList.remove('hidden');
      return;
    }
  }
  banner.classList.add('hidden');
}

function deleteUploadedCharacter(id) {
  state.uploadedCharacters = state.uploadedCharacters.filter(c => c.id !== id);
  if (state.activeUploadedCharacterId === id) {
    detachUploadedCharacter();
  }
  saveUploadedCharactersToStorage();
  renderUploadedCharactersGallery();
  showToast('Character removed from library');
}

function useCurrentUploadedImage() {
  if (state.activeUploadedCharacterId) {
    useUploadedCharacter(state.activeUploadedCharacterId);
  }
}

// -----------------------------------------------------------------------------
// IMAGE UPLOAD & VISION ANALYSIS
// -----------------------------------------------------------------------------
function handleImageUpload(event) {
  const file = event.target.files[0];
  if (file) {
    processImageFile(file);
  }
}

function processImageFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const fullDataUrl = e.target.result;
    const base64String = fullDataUrl.split(',')[1];

    const activeGender = getInputValue('inputGender', 'Female');
    const activeAge = getInputValue('inputAge', '23');

    const newChar = {
      id: 'char_' + Date.now(),
      name: `Uploaded ${file.name.replace(/\.[^/.]+$/, "").slice(0, 15)}`,
      origin: 'Detecting...',
      apparentAge: activeAge,
      gender: activeGender,
      hair: 'Natural hair texture',
      facialFeatures: 'Authentic real human facial features',
      wardrobe: 'Contemporary minimalist outfit',
      imageUrl: fullDataUrl,
      imageBase64: base64String,
      isHideImage: state.hideUploadedImages
    };

    state.uploadedCharacters.unshift(newChar);
    state.activeUploadedCharacterId = newChar.id;
    state.useUploadedCharacter = true;

    saveUploadedCharactersToStorage();
    renderUploadedCharactersGallery();
    updateActiveCharacterBanner();

    // Show upload preview container
    const placeholder = document.getElementById('uploadPlaceholder');
    const previewContainer = document.getElementById('uploadPreviewContainer');
    const imagePreview = document.getElementById('imagePreview');

    if (placeholder) placeholder.classList.add('hidden');
    if (previewContainer) previewContainer.classList.remove('hidden');
    if (imagePreview) {
      imagePreview.src = fullDataUrl;
      if (state.hideUploadedImages) imagePreview.classList.add('hidden');
    }

    triggerVisionAnalysis(newChar.id, base64String);
  };
  reader.readAsDataURL(file);
}

async function triggerVisionAnalysis(charId, base64String) {
  const originBadge = document.getElementById('detectedOriginBadge');
  const summary = document.getElementById('detectedSummary');

  if (originBadge) {
    originBadge.className = 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse';
    originBadge.textContent = 'Detecting origin & features...';
  }
  if (summary) summary.textContent = 'Scanning facial structure, skin tone, and regional heritage...';

  const catEl = document.getElementById('selectCategory');
  const origEl = document.getElementById('inputProductOrigin');
  const productCategory = catEl ? catEl.value : 'Fashion';
  const productOrigin = origEl ? origEl.value : 'Global';

  try {
    const response = await fetch('/api/analyze-character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: state.preferredProvider,
        apiKeys: state.apiKeys,
        apiKey: state.apiKeys.gemini || state.apiKeys.openai || state.apiKeys.claude,
        imageBase64: base64String,
        productCategory,
        productOrigin
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    applyAnalysisResults(charId, data);
  } catch (err) {
    // Graceful offline fallback
    const fallbackOrigin = productOrigin.toLowerCase().includes('india') ? 'South Asian / Indian' : `${productOrigin} Origin`;
    const curGender = getInputValue('inputGender', 'Female');
    const curAge = getInputValue('inputAge', '23');
    applyAnalysisResults(charId, {
      origin: fallbackOrigin,
      apparentAge: curAge,
      gender: curGender,
      skinTone: "Natural unretouched skin texture with visible micro-pores",
      facialFeatures: "Natural authentic human facial features with fine micro-details",
      hair: curGender === 'Female' ? "Natural wavy dark hair with subtle soft flyaways" : "Natural textured short hair with soft volume",
      outfitRecommendations: [
        {
          title: "Minimalist Linen Set",
          top: curGender === 'Female' ? "Breathable sage-green linen kurti with rolled cuffs" : "Black textured mandarin-collar long-sleeve shirt",
          bottom: curGender === 'Female' ? "Slim off-white cigarette trousers, clean minimalist sandals" : "Tailored black straight trousers, polished black derby shoes",
          vibe: "High-end contemporary editorial lookbook"
        },
        {
          title: "Modern Casual Streetwear",
          top: "Heavyweight drop-shoulder cotton tee",
          bottom: "Relaxed straight-leg raw denim jeans",
          vibe: "Authentic creator everyday review"
        },
        {
          title: "Smart Studio Chic",
          top: "Tailored beige unstructured linen blazer over clean white tee",
          bottom: "Pleated olive chinos, dark loafers",
          vibe: "Authoritative premium product presentation"
        }
      ]
    });
  }
}

function applyAnalysisResults(charId, data) {
  const originBadge = document.getElementById('detectedOriginBadge');
  const summary = document.getElementById('detectedSummary');
  const outfitsSec = document.getElementById('outfitsRecommendationSection');
  const outfitContainer = document.getElementById('outfitCardsContainer');

  const detectedGender = parseGender(data.gender || getInputValue('inputGender', 'Female'));
  const detectedAge = (data.apparentAge || getInputValue('inputAge', '23')).toString().replace(/[^0-9]/g, '').slice(0, 2) || '23';
  const origin = data.origin || 'Detected Character';

  if (originBadge) {
    originBadge.className = 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30';
    originBadge.innerHTML = `📍 Origin: ${origin}`;
  }

  if (summary) {
    summary.textContent = `${detectedGender}, approx. ${detectedAge}yo. ${data.skinTone || ''}`;
  }

  // Update in state
  const char = state.uploadedCharacters.find(c => c.id === charId);
  if (char) {
    char.name = `${detectedGender} (${origin})`;
    char.origin = origin;
    char.apparentAge = detectedAge;
    char.gender = detectedGender;
    char.hair = data.hair || 'Natural texture';
    char.facialFeatures = `${data.facialFeatures || ''}, ${data.skinTone || ''}`;
    if (data.outfitRecommendations && data.outfitRecommendations[0]) {
      char.wardrobe = `${data.outfitRecommendations[0].top}, ${data.outfitRecommendations[0].bottom}`;
    }
    saveUploadedCharactersToStorage();
    renderUploadedCharactersGallery();
  }

  // Populate form with segmented gender and clean inputs
  setGender(detectedGender);
  setAge(detectedAge);
  if (data.origin) setInputValue('inputEthnicity', data.origin);
  if (data.hair) setInputValue('inputHair', data.hair);
  if (data.facialFeatures) setInputValue('inputFacialFeatures', `${data.facialFeatures}, ${data.skinTone || ''}`);

  updateActiveCharacterBanner();

  // Outfits
  if (data.outfitRecommendations && data.outfitRecommendations.length > 0 && outfitContainer && outfitsSec) {
    outfitsSec.classList.remove('hidden');
    outfitContainer.innerHTML = '';

    data.outfitRecommendations.forEach((outfit, index) => {
      const card = document.createElement('div');
      card.className = 'outfit-card p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-xs space-y-1';
      card.onclick = () => selectOutfit(outfit, card);

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="font-bold text-slate-200 text-[11px]">${outfit.title}</span>
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">#${index + 1}</span>
        </div>
        <p class="text-[10px] text-slate-300 leading-snug font-medium">${outfit.top}, ${outfit.bottom}</p>
      `;
      outfitContainer.appendChild(card);
    });

    selectOutfit(data.outfitRecommendations[0], outfitContainer.children[0]);
  }

  if (window.lucide) lucide.createIcons();
}

function selectOutfit(outfit, cardElement) {
  document.querySelectorAll('.outfit-card').forEach(c => c.classList.remove('selected'));
  if (cardElement) cardElement.classList.add('selected');

  const fullWardrobeText = `${outfit.top}, ${outfit.bottom}.`;
  setInputValue('inputWardrobe', fullWardrobeText);
  showToast(`Applied "${outfit.title}"!`);
}

// -----------------------------------------------------------------------------
// PRODUCT ORIGIN -> CREATOR SUGGESTIONS
// -----------------------------------------------------------------------------
async function suggestCreatorFromProduct() {
  const origEl = document.getElementById('inputProductOrigin');
  const catEl = document.getElementById('selectCategory');
  const prodEl = document.getElementById('inputProductName');

  const origin = (origEl ? origEl.value.trim() : '') || 'Global';
  const category = catEl ? catEl.value : 'Fashion';
  const productName = prodEl ? prodEl.value : 'Product';

  const originLabel = document.getElementById('suggestOriginLabel');
  if (originLabel) originLabel.textContent = origin;

  const container = document.getElementById('productPersonaCards');
  if (!container) return;

  container.innerHTML = `
    <div class="col-span-3 py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
      <span class="animate-spin">✨</span>
      <span>Matching authentic creators for ${origin}...</span>
    </div>
  `;

  try {
    const response = await fetch('/api/suggest-character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: state.preferredProvider,
        apiKeys: state.apiKeys,
        apiKey: state.apiKeys.gemini || state.apiKeys.openai || state.apiKeys.claude,
        productName,
        productCategory: category,
        productOrigin: origin,
        targetCustomer: "Modern fashion & lifestyle consumers"
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    renderPersonaCards(data.suggestions || []);
  } catch (err) {
    const fallbackSuggestions = [
      {
        archetype: "Editorial Lookbook Male Model",
        age: "23",
        gender: "Male",
        ethnicity: "European / Fair with natural subtle freckles",
        hair: "Curly short messy brown hair with soft temple volume",
        tone: "Fair natural skin with micro-pores",
        vibe: "Minimalist fashion aesthetic, relaxed calm posture",
        suggestedOutfit: "Minimalist black textured mandarin-collar long-sleeve shirt, tailored black straight trousers, polished black leather derby shoes"
      },
      {
        archetype: "Urban Indian Fashion Creator",
        age: "25",
        gender: "Female",
        ethnicity: "South Asian / Indian",
        hair: "Glossy dark-brown layered waves with subtle flyaways",
        tone: "Warm medium golden undertone with natural radiant skin",
        vibe: "Chic contemporary Indo-Western stylist",
        suggestedOutfit: "Breathable sage-green linen kurti with rolled cuffs, slim off-white cigarette trousers"
      },
      {
        archetype: "Contemporary Streetwear Stylist",
        age: "27",
        gender: "Male",
        ethnicity: "East Asian",
        hair: "Clean textured crop fade",
        tone: "Smooth natural skin with authentic micro-details",
        vibe: "High-fashion minimalist direct-to-camera presenter",
        suggestedOutfit: "Oversized charcoal drop-shoulder shirt, wide-leg pleated black trousers"
      }
    ];
    renderPersonaCards(fallbackSuggestions);
  }
}

function renderPersonaCards(suggestions) {
  const container = document.getElementById('productPersonaCards');
  if (!container) return;
  container.innerHTML = '';

  if (!suggestions || suggestions.length === 0) {
    container.innerHTML = '<div class="col-span-3 text-slate-400 text-xs text-center py-4">No suggestions found.</div>';
    return;
  }

  suggestions.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'persona-card p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-xs space-y-1.5';
    card.onclick = () => applySuggestedPersona(item, card);

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-bold text-slate-200 text-[11px] truncate">${item.archetype}</span>
        <span class="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono">${item.age}yo</span>
      </div>
      <p class="text-[10px] text-slate-400 line-clamp-2">${item.vibe}</p>
      <div class="text-[10px] text-blue-400 font-medium pt-1 border-t border-slate-900 flex items-center justify-between">
        <span>Click to cast</span>
        <span>👉</span>
      </div>
    `;
    container.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

function applySuggestedPersona(item, cardElement) {
  document.querySelectorAll('.persona-card').forEach(c => c.classList.remove('selected'));
  if (cardElement) cardElement.classList.add('selected');

  switchCreatorTab('manual');
  setInputValue('inputAge', item.age || '24');
  setInputValue('inputGender', item.gender || 'Male');
  setInputValue('inputEthnicity', item.ethnicity || 'Global');
  if (item.hair) setInputValue('inputHair', item.hair);
  setInputValue('inputFacialFeatures', `${item.archetype}, ${item.tone || 'natural skin'}`);
  
  if (item.suggestedOutfit) {
    setInputValue('inputWardrobe', item.suggestedOutfit);
  }

  detachUploadedCharacter();

  saveToMemoryVault({
    name: item.archetype,
    origin: item.ethnicity,
    age: item.age,
    gender: item.gender,
    hair: item.hair || '',
    facialFeatures: item.archetype,
    wardrobe: item.suggestedOutfit || ''
  });

  showToast(`Cast "${item.archetype}"!`);
}

// -----------------------------------------------------------------------------
// PRODUCT IMAGE UPLOAD & VISION CHARACTER CASTING
// -----------------------------------------------------------------------------
function handleProductImageUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (file) {
    processProductImageFile(file);
  }
}

function processProductImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert('Please select a valid image file (PNG, JPG, WEBP).');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const fullDataUrl = e.target.result;
    const base64String = fullDataUrl.split(',')[1];

    state.productImageBase64 = base64String;
    state.productImageFileName = file.name;
    state.activeProductCreatorIndex = null;

    const placeholder = document.getElementById('productUploadPlaceholder');
    const preview = document.getElementById('productUploadPreviewContainer');
    const img = document.getElementById('productImagePreview');
    const nameEl = document.getElementById('productFileName');
    const statusEl = document.getElementById('productAnalysisStatus');

    if (placeholder) placeholder.classList.add('hidden');
    if (preview) preview.classList.remove('hidden');
    if (img) img.src = fullDataUrl;
    if (nameEl) nameEl.textContent = file.name;
    if (statusEl) {
      statusEl.textContent = '✨ Ready to analyze';
      statusEl.className = 'text-[10px] text-blue-400 flex items-center gap-1';
    }

    analyzeProductImage();
  };
  reader.readAsDataURL(file);
}

async function analyzeProductImage(isSuggestMore = false) {
  if (!state.productImageBase64) {
    showToast('Please upload a product photo first.');
    return;
  }

  if (!isSuggestMore) {
    state.productSuggestionBatch = 1;
    state.productPreviousArchetypes = [];
  }

  const btn = document.getElementById('btnAnalyzeProduct');
  const btnText = document.getElementById('btnAnalyzeProductText');
  const statusEl = document.getElementById('productAnalysisStatus');

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = isSuggestMore ? 'Refreshing...' : 'Analyzing...';
  if (statusEl) {
    statusEl.textContent = isSuggestMore 
      ? `✨ Generating fresh creator personas (Batch ${state.productSuggestionBatch})...` 
      : '✨ Scanning product & matching creators...';
    statusEl.className = 'text-[10px] text-cyan-400 animate-pulse flex items-center gap-1';
  }

  try {
    const response = await fetch('/api/analyze-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: state.preferredProvider,
        apiKeys: state.apiKeys,
        apiKey: state.apiKeys.gemini || state.apiKeys.openai || state.apiKeys.claude,
        imageBase64: state.productImageBase64,
        productName: getInputValue('inputProductName', ''),
        productCategory: getInputValue('selectCategory', ''),
        productOrigin: getInputValue('inputProductOrigin', ''),
        brandName: getInputValue('inputBrandName', ''),
        cycle: state.productSuggestionBatch || 1,
        excludeArchetypes: state.productPreviousArchetypes || []
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (data.detectedProduct) {
      if (data.detectedProduct.category) {
        const catSelect = document.getElementById('selectCategory');
        if (catSelect) {
          for (let opt of catSelect.options) {
            if (opt.value.toLowerCase().includes(data.detectedProduct.category.toLowerCase().slice(0, 8))) {
              catSelect.value = opt.value;
              break;
            }
          }
        }
      }
      const curName = getInputValue('inputProductName', '');
      if (data.detectedProduct.name && (!curName || curName === 'Linen Summer Outfit' || curName === 'Product')) {
        setInputValue('inputProductName', data.detectedProduct.name);
      }
      const badge = document.getElementById('productDetectedBadge');
      if (badge) {
        badge.textContent = data.detectedProduct.vibe ? data.detectedProduct.vibe.slice(0, 30) : (data.detectedProduct.category || 'Vision Matched');
      }
    }

    const batchBadge = document.getElementById('productBatchBadge');
    if (batchBadge) {
      batchBadge.textContent = `Batch ${data.batch || state.productSuggestionBatch || 1}`;
    }

    state.productSuggestedCreators = data.creators || [];
    (state.productSuggestedCreators || []).forEach(c => {
      if (c.archetype && !state.productPreviousArchetypes.includes(c.archetype)) {
        state.productPreviousArchetypes.push(c.archetype);
      }
    });

    state.activeProductCreatorIndex = null;
    renderProductCreatorSuggestions(state.productSuggestedCreators);

    if (statusEl) {
      statusEl.textContent = `✓ Batch ${state.productSuggestionBatch}: Matched ${state.productSuggestedCreators.length} creator personas`;
      statusEl.className = 'text-[10px] text-blue-400 flex items-center gap-1';
    }

    showToast(isSuggestMore 
      ? `✓ Loaded Batch ${state.productSuggestionBatch} with new creator personas!` 
      : `✓ Recommended ${state.productSuggestedCreators.length} creators for your product!`);

    // Also synchronize to the Auto-Match tab in Section 2
    renderPersonaCards(state.productSuggestedCreators.map(c => ({
      archetype: c.archetype,
      age: c.age,
      gender: c.gender,
      ethnicity: c.ethnicity,
      tone: c.facialFeatures,
      hair: c.hair,
      vibe: c.vibe || c.matchReason,
      suggestedOutfit: c.wardrobe
    })));

  } catch (err) {
    if (statusEl) {
      statusEl.textContent = '✓ Ready for casting';
      statusEl.className = 'text-[10px] text-blue-400 flex items-center gap-1';
    }
    alert(`Product analysis failed: ${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Suggest Creator';
  }
}

async function suggestMoreProductCreators() {
  if (!state.productImageBase64) {
    showToast('Please upload a product photo first.');
    return;
  }
  state.productSuggestionBatch = (state.productSuggestionBatch || 1) + 1;
  const btnSuggest = document.getElementById('btnSuggestMoreCreators');
  const btnText = document.getElementById('btnSuggestMoreText');
  if (btnSuggest) btnSuggest.disabled = true;
  if (btnText) btnText.textContent = 'Refreshing...';
  try {
    await analyzeProductImage(true);
  } finally {
    if (btnSuggest) btnSuggest.disabled = false;
    if (btnText) btnText.textContent = 'Suggest More';
  }
}

function renderProductCreatorSuggestions(creators) {
  const container = document.getElementById('productSuggestionsCards');
  if (!container) return;
  container.innerHTML = '';

  if (!creators || creators.length === 0) {
    container.innerHTML = '<div class="col-span-3 text-slate-400 text-xs text-center py-4">No matching creators found for this product.</div>';
    return;
  }

  creators.forEach((item, idx) => {
    const card = document.createElement('div');
    const isSelected = state.activeProductCreatorIndex === idx;
    card.className = `product-creator-card p-3 rounded-xl ${isSelected ? 'bg-blue-950/30 border-2 border-blue-500 ring-1 ring-blue-400/40' : 'bg-slate-950 border border-slate-800 hover:border-slate-700'} cursor-pointer text-xs space-y-2 relative transition`;
    card.onclick = () => applyProductSuggestedCreator(idx);

    const genderLabel = item.gender === 'Female' ? '👩 Female' : item.gender === 'Male' ? '👨 Male' : '🧑 Non-Binary';

    card.innerHTML = `
      <div class="flex items-start justify-between gap-1.5">
        <div class="min-w-0">
          <p class="font-bold text-slate-100 text-xs truncate">${escapeHtml(item.archetype)}</p>
          <div class="flex items-center gap-1 mt-0.5 flex-wrap">
            <span class="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-300 font-medium">${genderLabel}</span>
            <span class="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 font-mono">${escapeHtml(item.age)}yo</span>
          </div>
        </div>
        <span class="text-[10px] text-slate-500 font-mono shrink-0">#${idx + 1}</span>
      </div>

      <div class="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 space-y-1 text-[11px]">
        <p class="text-blue-400 font-semibold text-[10px] flex items-center gap-1">
          <span>🎯 Why It Matches:</span>
        </p>
        <p class="text-slate-300 leading-snug text-[10px]">${escapeHtml(item.matchReason || item.vibe)}</p>
      </div>

      <div class="text-[10px] text-slate-400 space-y-0.5 pt-0.5">
        <p class="truncate"><span class="text-slate-500 font-medium">Wardrobe:</span> ${escapeHtml(item.wardrobe || 'Clean styling')}</p>
        <p class="truncate"><span class="text-slate-500 font-medium">Setting:</span> ${escapeHtml(item.environment || 'Studio')}</p>
      </div>

      <button type="button" onclick="event.stopPropagation(); applyProductSuggestedCreator(${idx});" class="btn-cast-creator w-full py-1.5 rounded-lg ${isSelected ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white font-semibold'} text-[11px] border border-slate-700 hover:border-blue-500 transition flex items-center justify-center gap-1">
        ${isSelected ? '✓ Cast Active' : '⚡ Cast This Creator'}
      </button>
    `;
    container.appendChild(card);
  });

  const wrapper = document.getElementById('productSuggestionsContainer');
  if (wrapper) wrapper.classList.remove('hidden');

  if (window.lucide) lucide.createIcons();
}

function highlightUpdatedInputs(ids) {
  if (!Array.isArray(ids)) return;
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('ring-2', 'ring-blue-400', 'bg-blue-950/30');
    setTimeout(() => {
      el.classList.remove('ring-2', 'ring-blue-400', 'bg-blue-950/30');
    }, 1800);
  });
}

function applyProductSuggestedCreator(index) {
  const creators = state.productSuggestedCreators;
  if (!creators || !creators[index]) return;
  const creator = creators[index];
  state.activeProductCreatorIndex = index;

  // 1. Auto-fit Section 2 (Character Persona)
  if (creator.gender) {
    setGender(creator.gender);
  }
  if (creator.age) {
    setInputValue('inputAge', creator.age);
  }
  if (creator.ethnicity) {
    setInputValue('inputEthnicity', creator.ethnicity);
  }
  if (creator.facialFeatures) {
    setInputValue('inputFacialFeatures', creator.facialFeatures);
  }
  if (creator.hair) {
    setInputValue('inputHair', creator.hair);
  }
  if (creator.wardrobe) {
    setInputValue('inputWardrobe', creator.wardrobe);
  }

  // 2. Auto-fit Section 3 (Setting, Lighting & Action)
  if (creator.environment) {
    setInputValue('inputEnvironment', creator.environment);
    const selEnv = document.getElementById('selectEnvironment');
    if (selEnv) {
      for (let opt of selEnv.options) {
        if (opt.value === creator.environment || opt.value.toLowerCase().includes(creator.environment.toLowerCase().slice(0, 15))) {
          selEnv.value = opt.value;
          break;
        }
      }
    }
  }
  if (creator.lighting) {
    setInputValue('inputLighting', creator.lighting);
    const selLight = document.getElementById('selectLighting');
    if (selLight) {
      for (let opt of selLight.options) {
        if (opt.value === creator.lighting || opt.value.toLowerCase().includes(creator.lighting.toLowerCase().slice(0, 15))) {
          selLight.value = opt.value;
          break;
        }
      }
    }
  }
  const actionValue = creator.action || (creator.vibe ? `Holding product authentically with ${creator.vibe.toLowerCase()}` : 'Holding product delicately toward camera with authentic friendly curiosity');
  setInputValue('inputAction', actionValue);

  // 3. Auto-fit Section 4 (Fine-Tune Directive)
  const fineTuneValue = creator.fineTune || (creator.matchReason ? `Tailored for ${creator.archetype}: ${creator.matchReason}` : 'Balanced Commercial Lookbook Standards (Neutral Exposure, Sharp Garment Weave, Zero Airbrushing)');
  setInputValue('inputFineTune', fineTuneValue);
  const selFt = document.getElementById('selectFineTuneDropdown');
  if (selFt) {
    for (let opt of selFt.options) {
      if (opt.value === fineTuneValue || (fineTuneValue && opt.value.toLowerCase().includes(fineTuneValue.toLowerCase().slice(0, 20)))) {
        selFt.value = opt.value;
        break;
      }
    }
  }

  detachUploadedCharacter();
  switchCreatorTab('manual');

  saveToMemoryVault({
    name: creator.archetype,
    origin: creator.ethnicity,
    age: creator.age,
    gender: creator.gender,
    hair: creator.hair || '',
    facialFeatures: creator.facialFeatures || '',
    wardrobe: creator.wardrobe || ''
  });

  // Highlight all auto-fitted fields across sections 2, 3 and 4
  highlightUpdatedInputs([
    'inputAge',
    'inputEthnicity',
    'inputFacialFeatures',
    'inputHair',
    'inputWardrobe',
    'inputEnvironment',
    'inputLighting',
    'inputAction',
    'inputFineTune'
  ]);

  document.querySelectorAll('.product-creator-card').forEach((card, idx) => {
    const btn = card.querySelector('.btn-cast-creator');
    if (idx === index) {
      card.className = 'product-creator-card p-3 rounded-xl bg-blue-950/30 border-2 border-blue-500 cursor-pointer text-xs space-y-2 relative shadow-lg shadow-blue-950/40 transition ring-1 ring-blue-400/40';
      if (btn) {
        btn.textContent = '✓ Cast Active';
        btn.className = 'btn-cast-creator w-full py-1.5 rounded-lg bg-blue-600 text-white font-bold text-[11px] shadow-sm transition flex items-center justify-center gap-1';
      }
    } else {
      card.className = 'product-creator-card p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs space-y-2 relative transition';
      if (btn) {
        btn.textContent = '⚡ Cast This Creator';
        btn.className = 'btn-cast-creator w-full py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white font-semibold text-[11px] border border-slate-700 hover:border-blue-500 transition flex items-center justify-center gap-1';
      }
    }
  });

  showToast(`✓ Cast "${creator.archetype}" & auto-fit styling, setting & action!`);
}

function clearProductImage() {
  state.productImageBase64 = null;
  state.productImageFileName = null;
  state.productSuggestedCreators = [];
  state.activeProductCreatorIndex = null;
  state.productSuggestionBatch = 1;
  state.productPreviousArchetypes = [];

  const fileInput = document.getElementById('fileProductImage');
  if (fileInput) fileInput.value = '';

  const placeholder = document.getElementById('productUploadPlaceholder');
  const preview = document.getElementById('productUploadPreviewContainer');
  const suggestions = document.getElementById('productSuggestionsContainer');
  const img = document.getElementById('productImagePreview');

  if (placeholder) placeholder.classList.remove('hidden');
  if (preview) preview.classList.add('hidden');
  if (suggestions) suggestions.classList.add('hidden');
  if (img) img.src = '';
  showToast('Product photo removed.');
}

// -----------------------------------------------------------------------------
// MASTER PROMPT GENERATION (3-SHOT LOOKBOOK + AD)
// -----------------------------------------------------------------------------
async function generateMasterPrompt() {
  const btn = document.getElementById('btnGenerate');
  const btnText = document.getElementById('generateButtonText');

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Synthesizing 3-Shot Lookbook & Prompts...';

  const brief = collectBriefData();

  try {
    let data;
    try {
      const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: state.preferredProvider,
          apiKeys: state.apiKeys,
          apiKey: state.apiKeys.gemini || state.apiKeys.openai || state.apiKeys.claude,
          brief
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    } catch (netErr) {
      data = generateClientSideLocks(brief);
    }
    
    state.generatedData = data;
    renderGeneratedOutputs(data);
    showToast('3-Shot Lookbook & UGC Prompts generated successfully!');
  } catch (err) {
    alert(`Generation failed: ${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Generate 3-Shot Lookbook & UGC Prompts';
  }
}

function collectBriefData() {
  const activeChar = state.uploadedCharacters.find(c => c.id === state.activeUploadedCharacterId);
  return {
    brandName: getInputValue('inputBrandName', 'Brandroom Studio'),
    productName: getInputValue('inputProductName', 'Linen Outfit'),
    productCategory: getInputValue('selectCategory', 'Fashion & Apparel'),
    productOrigin: getInputValue('inputProductOrigin', 'India — Urban Metro'),
    gender: getInputValue('inputGender', 'Female'),
    age: getInputValue('inputAge', '23'),
    ethnicity: getInputValue('inputEthnicity', 'South Asian / Indian — Warm golden medium complexion'),
    hair: getInputValue('inputHair', 'Long glossy dark-brown hair with loose effortless waves'),
    faceFeatures: getInputValue('inputFacialFeatures', 'Softly defined oval face, warm almond deep-brown eyes, radiant golden undertone, authentic unretouched skin micro-pores'),
    wardrobe: getInputValue('inputWardrobe', 'Relaxed breathable sage-green linen kurti with rolled cuffs, slim off-white cigarette trousers, clean minimalist leather sandals'),
    environment: getInputValue('inputEnvironment', getInputValue('selectEnvironment', 'Seamless neutral light-gray studio backdrop with soft floor contact shadows')),
    lighting: getInputValue('inputLighting', getInputValue('selectLighting', 'Clean diffused commercial softbox studio daylight with realistic micro-shadows')),
    action: getInputValue('inputAction', 'Direct calm gaze into lens for face close-up, neutral standing posture for lookbook'),
    fineTune: getInputValue('inputFineTune', ''),
    aspectRatio: state.aspectRatio || getInputValue('inputAspectRatio', '9:16'),
    useUploadedCharacter: Boolean(state.useUploadedCharacter && activeChar),
    uploadedCharacterInfo: (state.useUploadedCharacter && activeChar) ? {
      id: activeChar.id,
      name: activeChar.name,
      origin: activeChar.origin
    } : null,
    visualStyle: 'REAL HUMAN / PHOTOREALISTIC',
    moment: 'SCROLL-STOPPING HOOK',
    platform: (state.aspectRatio === '16:9') ? '16:9 Horizontal' : (state.aspectRatio === '1:1') ? '1:1 Square' : '9:16 Vertical',
    camera: 'Commercial studio lens feel, eye-level, deep focus'
  };
}

function generateClientSideLocks(brief) {
  const age = brief.age || '23';
  const gender = brief.gender || 'Female';
  const eth = brief.ethnicity || 'South Asian / Indian';
  const hair = brief.hair || 'Natural dark-brown hair with soft texture';
  const face = brief.faceFeatures || 'Softly defined oval face, warm almond eyes, natural skin micro-pores';
  const wardrobe = brief.wardrobe || 'Relaxed breathable linen outfit, clean trousers, minimalist sandals';
  const env = brief.environment || 'Seamless neutral light-gray studio backdrop with soft floor contact shadows';
  const light = brief.lighting || 'Clean diffused commercial softbox studio daylight with realistic micro-shadows';
  const brand = brief.brandName || 'Brandroom Studio';
  const product = brief.productName || 'Linen Outfit';
  const fineTune = brief.fineTune ? ` Direct Fine-Tuning: ${brief.fineTune}.` : '';

  const ar = brief.aspectRatio || '9:16';
  let arFraming = 'Framed in 9:16 vertical smartphone ratio, eye-level close-up portrait';
  let arFlag = '--ar 9:16';
  let formatName = '9:16 Vertical';
  if (ar === '16:9') {
    arFraming = 'Framed in 16:9 horizontal widescreen format, eye-level portrait with cinematic studio width';
    arFlag = '--ar 16:9';
    formatName = '16:9 Horizontal';
  } else if (ar === '1:1') {
    arFraming = 'Framed in 1:1 square catalog format, centered portrait';
    arFlag = '--ar 1:1';
    formatName = '1:1 Square';
  }

  const uploadAnchor = (brief.useUploadedCharacter && brief.uploadedCharacterInfo) 
    ? `\nUploaded Character Anchor: Linked to reference photo (${brief.uploadedCharacterInfo.name}). Facial identity locked in memory.`
    : '';

  return {
    aspectRatio: ar,
    shot1Face: `Studio character casting close-up portrait of an adult ${age}-year-old ${eth} ${gender.toLowerCase()} creator with ${face}. ${hair}. Natural direct frontal gaze toward lens, neutral relaxed expression. Authentic unretouched skin micro-texture, visible pores, fine facial asymmetry, realistic eye moisture and subtle catchlights. ${arFraming}, shallow depth of field with sharp facial focus, illuminated by ${light} against ${env}.${fineTune} Zero CGI or waxy skin. ${arFlag}`,
    shot2Front: `Commercial fashion lookbook full-body frontal shot of the ${age}-year-old ${eth} ${gender.toLowerCase()} character standing straight, framed from below the chin down with face completely not visible and out of frame. Showcases the complete front silhouette: ${wardrobe}. Physically accurate fabric drape, authentic material texture, clean seams, paired with minimalist footwear. Full-body standing posture, hands resting naturally at sides, framed head-to-toe with clear shoe contact shadows on a flat gray studio floor, even balanced commercial studio lighting, deep field focus across all garments in ${formatName}.${fineTune} ${arFlag}`,
    shot3Back: `Commercial fashion lookbook full-body rear view shot of the character viewed from directly behind, standing straight. Face completely invisible. Clearly displays the back silhouette and construction of ${wardrobe}, back neckline, rear shoulder drape, back of trousers, and clean heels of footwear. Rear view of ${hair}. Clean posture, standing against an infinity cyclorama neutral light-gray studio background with soft realistic ground contact shadows, professional commercial studio lighting in ${formatName}.${fineTune} ${arFlag}`,
    triptychPrompt: `3-panel split character lookbook reference sheet for fashion and advertising consistency on a clean light-gray studio backdrop: LEFT PANEL: intimate close-up face portrait of adult ${age}-year-old ${eth} ${gender.toLowerCase()} with ${face} and ${hair}; CENTER PANEL: full-body frontal lookbook shot standing straight, cropped below chin with face completely not visible, showcasing ${wardrobe}; RIGHT PANEL: full-body rear view from directly behind, face not visible, displaying the back of the outfit and rear silhouette. High-end commercial catalog photography, sharp focus, physically accurate fabrics, uniform neutral studio illumination in ${formatName}.${fineTune} --ar 16:9`,
    imagePrompt: `Photorealistic genuine smartphone UGC photo of adult ${age}-year-old ${eth} ${gender.toLowerCase()} creator with ${face} and ${hair}. Wearing ${wardrobe}. Delivering an authentic UGC hook while presenting ${product} by ${brand}. Set inside ${env}. Handheld front phone camera perspective, 28mm wide mobile lens aesthetic, natural phone focal roll-off, soft daylight illumination with authentic contact shadows, framed in ${formatName},${fineTune} zero CGI or plastic appearance. ${arFlag}`,
    characterLock: `Visual Style: Real Human Photorealistic\nAge: ${age} (Adult)\nGender: ${gender}\nEthnicity / Origin: ${eth}\nFace: ${face}\nHair: ${hair}\nBody / Build: Natural balanced proportions, upright standing posture${uploadAnchor}`,
    styleLock: `Photorealistic real-human photography, naturally textured skin with epidermal micro-detail, individual hair strands, believable anatomy, physically accurate fabrics and seams, realistic contact shadows, neutral exposure, format ${formatName}, zero CGI or plastic rendering.${brief.fineTune ? '\nFine-Tuning: ' + brief.fineTune : ''}`,
    cameraLock: `Lookbook Shots: 50mm - 85mm clean commercial studio lens, deep focal sharpness, neutral softbox illumination (${formatName}).\nUGC Ad Shots: 28mm smartphone mobile optics, natural perspective, soft daylight (${formatName}).`,
    negativePrompt: `generic AI face, artificial influencer face, uncanny human, waxy skin, plastic skin, porcelain skin, rubber skin, CGI skin, mannequin appearance, overly smooth skin, excessive beauty filter, artificial pore pattern, extreme facial symmetry, face morphing, deformed face, dead eyes, glassy artificial eyes, malformed pupils, badly rendered teeth, floating hair, malformed anatomy, extra arms, missing arms, fused fingers, missing fingers, extra fingers, warped product, melted packaging, distorted label, incorrect logo, misspelled brand name, gibberish text, fake barcode, CGI render, 3D character, anime character, illustration.`
  };
}

function renderGeneratedOutputs(data) {
  setSafeText('outShot1Text', data.shot1Face || 'No shot 1 prompt generated.');
  setSafeText('outShot2Text', data.shot2Front || 'No shot 2 prompt generated.');
  setSafeText('outShot3Text', data.shot3Back || 'No shot 3 prompt generated.');
  setSafeText('outTriptychText', data.triptychPrompt || 'No triptych prompt generated.');
  setSafeText('outProductAdText', data.imagePrompt || 'No ad prompt generated.');
  setSafeText('outCharLockText', data.characterLock || 'No character lock generated.');
  setSafeText('outStyleLockText', data.styleLock || 'No style lock generated.');
  setSafeText('outCamLockText', data.cameraLock || 'No camera lock generated.');
  setSafeText('outNegPromptText', data.negativePrompt || 'No negative prompt generated.');

  const badge = document.getElementById('outFormatBadge');
  if (badge) {
    const ar = data.aspectRatio || state.aspectRatio || '9:16';
    if (ar === '16:9') badge.textContent = '🖥️ 16:9 Horizontal';
    else if (ar === '1:1') badge.textContent = '◻️ 1:1 Square';
    else badge.textContent = '📱 9:16 Vertical';
  }

  switchOutputTab('lookbook');
}

// -----------------------------------------------------------------------------
// IN-PLACE PROMPT REFINEMENT & CORRECTIONS
// -----------------------------------------------------------------------------
function quickAddRefinementTag(tag) {
  const input = document.getElementById('refineCorrectionInput');
  if (!input) return;
  const current = input.value.trim();
  if (!current) {
    input.value = tag;
  } else if (!current.toLowerCase().includes(tag.toLowerCase())) {
    input.value = current + ', ' + tag;
  }
  input.focus();
  if (input.setSelectionRange) {
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

async function applyPromptRefinement(customText) {
  const input = document.getElementById('refineCorrectionInput');
  const correction = (typeof customText === 'string' && customText) ? customText.trim() : (input ? input.value.trim() : '');

  if (!correction) {
    showToast('Please enter a correction or click a quick tweak chip.');
    if (input) input.focus();
    return;
  }

  const btn = document.getElementById('btnApplyRefine');
  const btnText = document.getElementById('btnApplyRefineText');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Applying...';

  const brief = collectBriefData();

  try {
    let data;
    try {
      const response = await fetch('/api/refine-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correction,
          brief,
          provider: state.preferredProvider,
          apiKeys: state.apiKeys,
          apiKey: state.apiKeys.gemini || state.apiKeys.openai || state.apiKeys.claude
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    } catch (netErr) {
      // Client-side offline fallback
      const updatedBrief = JSON.parse(JSON.stringify(brief));
      const cLower = correction.toLowerCase();
      const changes = [];

      if (cLower.includes('glasses') || cLower.includes('spectacles') || cLower.includes('eyewear')) {
        if (!((updatedBrief.faceFeatures || '').toLowerCase().includes('glasses'))) {
          updatedBrief.faceFeatures = ((updatedBrief.faceFeatures || '') + ', stylish thin minimalist wireframe glasses').replace(/^,\s*/, '');
          changes.push('+Glasses');
        }
      } else if (cLower.includes('remove glasses') || cLower.includes('no glasses')) {
        updatedBrief.faceFeatures = (updatedBrief.faceFeatures || '').replace(/,?\s*(?:stylish thin minimalist )?wireframe glasses/gi, '').trim();
        changes.push('-Glasses');
      }

      if (cLower.includes('wardrobe') || cLower.includes('shirt') || cLower.includes('jacket') || cLower.includes('outfit') || cLower.includes('trousers') || cLower.includes('wear') || cLower.includes('wearing') || cLower.includes('blazer') || cLower.includes('kurti')) {
        const match = correction.match(/(?:wardrobe|outfit|clothing|jacket|shirt|wear|wearing|to a|in a)\s+(?:to\s+)?([^.,;]+)/i);
        if (match && match[1].trim().length > 3) {
          updatedBrief.wardrobe = match[1].trim();
        } else {
          updatedBrief.wardrobe = correction;
        }
        changes.push('+Wardrobe updated');
      }

      if (cLower.includes('hair') || cLower.includes('bun') || cLower.includes('curls') || cLower.includes('ponytail') || cLower.includes('braid')) {
        const match = correction.match(/(?:hair|hair to|hair in a?)\s+([^.,;]+)/i);
        if (match && match[1].trim().length > 3) {
          updatedBrief.hair = match[1].trim();
        } else if (cLower.includes('bun')) {
          updatedBrief.hair = 'Messy casual top-knot bun with soft face-framing tendrils';
        } else if (cLower.includes('ponytail')) {
          updatedBrief.hair = 'Sleek middle-parted low ponytail with clean polished edges';
        } else if (cLower.includes('curly') || cLower.includes('curls')) {
          updatedBrief.hair = 'Naturally defined voluminous bouncy curls with soft shine';
        }
        changes.push('+Hair styled');
      }

      if (cLower.includes('golden hour') || cLower.includes('sunset') || cLower.includes('warm light') || cLower.includes('sunlight')) {
        updatedBrief.lighting = 'Golden-hour warm directional sunlight casting soft glowing skin edges';
        changes.push('+Golden hour light');
      } else if (cLower.includes('studio light') || cLower.includes('softbox') || cLower.includes('commercial daylight')) {
        updatedBrief.lighting = 'Clean diffused commercial softbox studio daylight with realistic micro-shadows';
        changes.push('+Studio softbox');
      } else if (cLower.includes('window light') || cLower.includes('morning light')) {
        updatedBrief.lighting = 'Natural soft morning window daylight with flattering organic shadows';
        changes.push('+Window light');
      }

      if (cLower.includes('cafe') || cLower.includes('coffee shop')) {
        updatedBrief.environment = 'Chic contemporary outdoor cafe terrace with softly blurred city street backdrop';
        changes.push('+Cafe backdrop');
      } else if (cLower.includes('bathroom') || cLower.includes('vanity')) {
        updatedBrief.environment = 'Clean modern bathroom with marble vanity, soft subway tile, and subtle warm mirror reflection';
        changes.push('+Bathroom vanity');
      } else if (cLower.includes('bedroom')) {
        updatedBrief.environment = 'Sunlit contemporary apartment bedroom with organic linen bedding and soft bokeh plant';
        changes.push('+Bedroom setting');
      } else if (cLower.includes('studio') || cLower.includes('cyclorama') || cLower.includes('backdrop')) {
        updatedBrief.environment = 'Seamless neutral light-gray studio backdrop with soft floor contact shadows';
        changes.push('+Studio cyclorama');
      }

      if (cLower.includes('smile') || cLower.includes('smiling') || cLower.includes('friendly')) {
        updatedBrief.action = 'Warm friendly engaging smile toward camera with authentic approachable direct eye contact';
        changes.push('+Friendly smile');
      } else if (cLower.includes('serious') || cLower.includes('calm') || cLower.includes('neutral')) {
        updatedBrief.action = 'Calm authoritative neutral gaze into lens with poised posture';
        changes.push('+Neutral calm gaze');
      }

      if (cLower.includes('horizontal') || cLower.includes('16:9') || cLower.includes('landscape') || cLower.includes('widescreen')) {
        updatedBrief.aspectRatio = '16:9';
        changes.push('+16:9 Format');
      } else if (cLower.includes('square') || cLower.includes('1:1')) {
        updatedBrief.aspectRatio = '1:1';
        changes.push('+1:1 Square');
      } else if (cLower.includes('vertical') || cLower.includes('9:16')) {
        updatedBrief.aspectRatio = '9:16';
        changes.push('+9:16 Vertical');
      }

      if (changes.length === 0 || cLower.includes('fine') || cLower.includes('rule')) {
        updatedBrief.fineTune = ((updatedBrief.fineTune || '') + ' Refinement: ' + correction).trim();
        if (changes.length === 0) changes.push('+Refinement applied');
      }

      const clientPrompts = generateClientSideLocks(updatedBrief);
      data = {
        success: true,
        brief: updatedBrief,
        prompts: clientPrompts,
        revisionSummary: changes.join(', ')
      };
    }

    if (data.brief) {
      syncBriefToInputs(data.brief);
    }

    const prompts = data.prompts || data;
    state.generatedData = prompts;
    renderGeneratedOutputs(prompts);

    state.revisionCount = (state.revisionCount || 1) + 1;
    const badge = document.getElementById('refineRevisionBadge');
    if (badge) {
      const summary = data.revisionSummary || correction.slice(0, 24);
      badge.textContent = `v${state.revisionCount} (${summary})`;
      badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-blue-950/90 text-blue-300 border border-blue-700/60 font-mono shadow-sm transition';
    }

    showToast(`✓ Applied: ${data.revisionSummary || 'Prompts updated!'}`);
    if (input) input.value = '';
  } catch (err) {
    alert(`Refinement failed: ${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Apply & Update';
  }
}

function syncBriefToInputs(brief) {
  if (!brief) return;
  if (brief.wardrobe) setInputValue('inputWardrobe', brief.wardrobe);
  if (brief.hair) setInputValue('inputHair', brief.hair);
  if (brief.faceFeatures) setInputValue('inputFacialFeatures', brief.faceFeatures);
  if (brief.lighting) {
    setSelectAndInputValue('selectLighting', 'inputLighting', brief.lighting);
  }
  if (brief.environment) {
    setSelectAndInputValue('selectEnvironment', 'inputEnvironment', brief.environment);
  }
  if (brief.action) setInputValue('inputAction', brief.action);
  if (brief.fineTune !== undefined) setInputValue('inputFineTune', brief.fineTune);
  if (brief.aspectRatio) {
    setAspectRatio(brief.aspectRatio);
  }
  if (brief.gender) {
    setGender(brief.gender);
  }
  if (brief.age) setInputValue('inputAge', brief.age);
  if (brief.ethnicity) setInputValue('inputEthnicity', brief.ethnicity);
}

function setupContentEditableSync() {
  const fields = [
    { id: 'outShot1Text', key: 'shot1Face' },
    { id: 'outShot2Text', key: 'shot2Front' },
    { id: 'outShot3Text', key: 'shot3Back' },
    { id: 'outTriptychText', key: 'triptychPrompt' },
    { id: 'outProductAdText', key: 'imagePrompt' },
    { id: 'outCharLockText', key: 'characterLock' },
    { id: 'outStyleLockText', key: 'styleLock' },
    { id: 'outCamLockText', key: 'cameraLock' },
    { id: 'outNegPromptText', key: 'negativePrompt' }
  ];

  fields.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        if (!state.generatedData) state.generatedData = {};
        state.generatedData[key] = el.innerText || el.textContent;
      });
    }
  });
}

// -----------------------------------------------------------------------------
// OUTPUT TABS & EXPORT
// -----------------------------------------------------------------------------
function switchOutputTab(tab) {
  const tabs = ['lookbook', 'charlock', 'stylelock', 'camlock', 'negprompt'];
  const panelMap = {
    lookbook: 'tabLookbook',
    charlock: 'tabCharLock',
    stylelock: 'tabStyleLock',
    camlock: 'tabCamLock',
    negprompt: 'tabNegPrompt'
  };
  const btnMap = {
    lookbook: 'tabLookbookBtn',
    charlock: 'tabCharBtn',
    stylelock: 'tabStyleBtn',
    camlock: 'tabCamBtn',
    negprompt: 'tabNegBtn'
  };

  tabs.forEach(t => {
    const panel = document.getElementById(panelMap[t]);
    const btn = document.getElementById(btnMap[t]);
    if (t === tab) {
      if (panel) panel.classList.remove('hidden');
      if (btn) btn.className = 'output-tab active text-blue-400 border-b-2 border-blue-500 pb-1 whitespace-nowrap';
    } else {
      if (panel) panel.classList.add('hidden');
      if (btn) btn.className = 'output-tab text-slate-400 hover:text-slate-200 pb-1 whitespace-nowrap';
    }
  });

  state.activeOutputTab = tab;
}

function copyToClipboard(elementId, btnElement) {
  const el = document.getElementById(elementId);
  const text = el ? el.textContent.trim() : '';
  if (!text) return;

  navigator.clipboard.writeText(text).then(() => {
    const origHTML = btnElement.innerHTML;
    btnElement.innerHTML = `✓ Copied!`;
    setTimeout(() => {
      btnElement.innerHTML = origHTML;
    }, 2000);
  });
}

function copyAllOutputs() {
  const shot1 = getSafeText('outShot1Text', state.generatedData ? state.generatedData.shot1Face : '');
  const shot2 = getSafeText('outShot2Text', state.generatedData ? state.generatedData.shot2Front : '');
  const shot3 = getSafeText('outShot3Text', state.generatedData ? state.generatedData.shot3Back : '');
  const triptych = getSafeText('outTriptychText', state.generatedData ? state.generatedData.triptychPrompt : '');
  const productAd = getSafeText('outProductAdText', state.generatedData ? state.generatedData.imagePrompt : '');
  const charLock = getSafeText('outCharLockText', state.generatedData ? state.generatedData.characterLock : '');
  const styleLock = getSafeText('outStyleLockText', state.generatedData ? state.generatedData.styleLock : '');
  const camLock = getSafeText('outCamLockText', state.generatedData ? state.generatedData.cameraLock : '');
  const negPrompt = getSafeText('outNegPromptText', state.generatedData ? state.generatedData.negativePrompt : '');

  if (!shot1 && !state.generatedData) {
    alert('Please generate a prompt first.');
    return;
  }
  const compiled = `
=== 3-SHOT LOOKBOOK REFERENCE PACK ===

[PANEL 1: FACE CLOSE-UP PORTRAIT]
${shot1}

[PANEL 2: FULL-BODY FRONT - FACE NOT VISIBLE]
${shot2}

[PANEL 3: FULL-BODY BACK - REAR VIEW]
${shot3}

[TRIPTYCH COMPOSITE PROMPT]
${triptych}

=== COMMERCIAL UGC PRODUCT AD PROMPT ===
${productAd}

=== CHARACTER LOCK ===
${charLock}

=== STYLE / RENDER LOCK ===
${styleLock}

=== CAMERA LOCK ===
${camLock}

=== NEGATIVE PROMPT ===
${negPrompt}
  `.trim();

  navigator.clipboard.writeText(compiled).then(() => {
    showToast('All lookbook shots, locks & prompts copied to clipboard!');
  });
}

function downloadOutputsTxt() {
  const shot1 = getSafeText('outShot1Text', state.generatedData ? state.generatedData.shot1Face : '');
  const shot2 = getSafeText('outShot2Text', state.generatedData ? state.generatedData.shot2Front : '');
  const shot3 = getSafeText('outShot3Text', state.generatedData ? state.generatedData.shot3Back : '');
  const triptych = getSafeText('outTriptychText', state.generatedData ? state.generatedData.triptychPrompt : '');
  const productAd = getSafeText('outProductAdText', state.generatedData ? state.generatedData.imagePrompt : '');
  const charLock = getSafeText('outCharLockText', state.generatedData ? state.generatedData.characterLock : '');
  const styleLock = getSafeText('outStyleLockText', state.generatedData ? state.generatedData.styleLock : '');
  const camLock = getSafeText('outCamLockText', state.generatedData ? state.generatedData.cameraLock : '');
  const negPrompt = getSafeText('outNegPromptText', state.generatedData ? state.generatedData.negativePrompt : '');

  if (!shot1 && !state.generatedData) {
    alert('Please generate a prompt first.');
    return;
  }
  const pName = getInputValue('inputProductName', 'Lookbook').replace(/\s+/g, '_');
  const compiled = `AI UGC CREATOR 3-SHOT LOOKBOOK & MASTER PROMPT
Product: ${getInputValue('inputProductName', 'Product')}
Brand: ${getInputValue('inputBrandName', 'Brand')}

1. PANEL 1: FACE CLOSE-UP PORTRAIT:
${shot1}

2. PANEL 2: FULL-BODY FRONT (FACE NOT VISIBLE):
${shot2}

3. PANEL 3: FULL-BODY BACK (REAR VIEW):
${shot3}

4. 3-PANEL TRIPTYCH COMPOSITE:
${triptych}

5. COMMERCIAL UGC AD PROMPT:
${productAd}

6. CHARACTER LOCK:
${charLock}

7. STYLE LOCK:
${styleLock}

8. CAMERA OPTICS LOCK:
${camLock}

9. NEGATIVE PROMPT:
${negPrompt}
`;

  const blob = new Blob([compiled], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `3Shot_Lookbook_${pName}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// -----------------------------------------------------------------------------
// ADOBE FIREFLY & MIDJOURNEY EXPORTERS
// -----------------------------------------------------------------------------
function openInAdobeFirefly() {
  if (!state.generatedData || !state.generatedData.shot1Face) {
    const brief = collectBriefData();
    state.generatedData = generateClientSideLocks(brief);
    renderGeneratedOutputs(state.generatedData);
  }

  const prompt = state.generatedData.triptychPrompt || state.generatedData.shot1Face;
  navigator.clipboard.writeText(prompt).then(() => {
    showToast('3-Shot Lookbook prompt copied for Adobe Firefly! Opening...');
    window.open('https://firefly.adobe.com/generate/images', '_blank');
  });
}

function copyForMidjourney() {
  if (!state.generatedData || !state.generatedData.shot1Face) {
    const brief = collectBriefData();
    state.generatedData = generateClientSideLocks(brief);
    renderGeneratedOutputs(state.generatedData);
  }

  const mjPrompt = `/imagine prompt: ${state.generatedData.triptychPrompt || state.generatedData.shot1Face} --ar 16:9 --v 6.1 --style raw`;
  navigator.clipboard.writeText(mjPrompt).then(() => {
    showToast('Midjourney v6.1 triptych prompt copied with parameters!');
  });
}

// -----------------------------------------------------------------------------
// SAMPLE DATA PRELOADER
// -----------------------------------------------------------------------------
function loadSampleData(type) {
  if (type === 'fashion_minimalist') {
    switchCreatorTab('manual');
    setInputValue('inputBrandName', 'Brandroom Studio');
    setInputValue('inputProductName', 'Sage Green Linen Summer Kurti');
    
    setInputValue('selectCategory', 'Fashion & Apparel (Streetwear & Casual)');
    setInputValue('inputProductOrigin', 'India — Urban Metro (Mumbai / Delhi / Bengaluru)');
    setGender('Female');
    setInputValue('inputAge', '23');
    setInputValue('inputEthnicity', 'South Asian / Indian — Warm golden medium complexion with radiant undertones');
    setInputValue('inputHair', 'Long glossy dark-brown hair with loose effortless waves');
    setInputValue('inputFacialFeatures', 'Softly defined oval face, warm almond deep-brown eyes, radiant golden undertone, authentic unretouched skin micro-pores');
    setInputValue('inputWardrobe', 'Relaxed breathable sage-green linen kurti with rolled cuffs, slim off-white cigarette trousers, clean minimalist leather sandals');
    setInputValue('selectEnvironment', 'Seamless neutral light-gray studio backdrop with soft floor contact shadows');
    setInputValue('inputEnvironment', 'Seamless neutral light-gray studio backdrop with soft floor contact shadows');
    setInputValue('selectLighting', 'Clean diffused commercial softbox studio daylight with realistic micro-shadows');
    setInputValue('inputLighting', 'Clean diffused commercial softbox studio daylight with realistic micro-shadows');
    setInputValue('inputAction', 'Direct calm gaze into lens for face close-up, neutral standing posture for lookbook');
    setInputValue('inputFineTune', 'Balanced Commercial Lookbook Standards (Neutral Exposure, Sharp Garment Weave, Zero Airbrushing)');
    setAspectRatio('9:16');

    detachUploadedCharacter();
    showToast('Loaded 3-Shot Lookbook reference demo!');
  }
}

// -----------------------------------------------------------------------------
// AI CREATIVE DIRECTOR CHAT
// -----------------------------------------------------------------------------
function sendQuickChatMessage(text) {
  const input = document.getElementById('chatInputMessage');
  if (input) input.value = text;
  handleSendChatMessage(new Event('submit'));
}

async function handleSendChatMessage(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById('chatInputMessage');
  if (!input) return;
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  const log = document.getElementById('chatMessageLog');
  if (!log) return;

  const userMsgEl = document.createElement('div');
  userMsgEl.className = 'flex gap-3 text-slate-200 justify-end';
  userMsgEl.innerHTML = `
    <div class="space-y-1 bg-blue-950/40 border border-blue-800/40 p-3 rounded-xl max-w-xl text-right">
      <p class="font-semibold text-blue-400 text-[11px]">You</p>
      <p>${escapeHtml(message)}</p>
    </div>
    <div class="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 text-xs font-bold">U</div>
  `;
  log.appendChild(userMsgEl);
  log.scrollTop = log.scrollHeight;

  const loadEl = document.createElement('div');
  loadEl.id = 'chatLoadingIndicator';
  loadEl.className = 'flex gap-3 text-slate-400';
  loadEl.innerHTML = `
    <div class="w-7 h-7 rounded-lg bg-cyan-600/30 text-cyan-400 flex items-center justify-center shrink-0">
      <span class="animate-spin text-xs">⏳</span>
    </div>
    <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs italic">
      Director is analyzing brief...
    </div>
  `;
  log.appendChild(loadEl);
  log.scrollTop = log.scrollHeight;

  const brief = collectBriefData();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        brief,
        provider: state.preferredProvider,
        apiKeys: state.apiKeys
      })
    });

    const data = await response.json();
    loadEl.remove();

    const assistantMsgEl = document.createElement('div');
    assistantMsgEl.className = 'flex gap-3 text-slate-200';
    assistantMsgEl.innerHTML = `
      <div class="w-7 h-7 rounded-lg bg-cyan-600/30 text-cyan-400 flex items-center justify-center shrink-0">
        <i data-lucide="bot" class="w-4 h-4"></i>
      </div>
      <div class="space-y-1 bg-slate-900 p-3.5 rounded-xl border border-slate-800/80 max-w-xl">
        <div class="flex items-center justify-between">
          <p class="font-semibold text-cyan-400 text-[11px]">Creative Director</p>
          <span class="text-[9px] bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800">${data.activeModel || 'Director AI'}</span>
        </div>
        <div class="text-xs leading-relaxed whitespace-pre-wrap">${escapeHtml(data.reply || 'No response')}</div>
      </div>
    `;
    log.appendChild(assistantMsgEl);
    log.scrollTop = log.scrollHeight;
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    loadEl.remove();
    alert(`Chat error: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// DOM UTILITIES
// -----------------------------------------------------------------------------
function getInputValue(id, fallback = '') {
  const el = document.getElementById(id);
  return el ? el.value : fallback;
}

function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function setSelectAndInputValue(selectId, inputId, val) {
  const sel = document.getElementById(selectId);
  const inp = document.getElementById(inputId);
  if (sel) sel.value = val;
  if (inp) inp.value = val;
}

function setSafeText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function getSafeText(id, fallback = '') {
  const el = document.getElementById(id);
  return el ? (el.innerText || el.textContent || '').trim() : fallback;
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// -----------------------------------------------------------------------------
// TOAST NOTIFICATIONS
// -----------------------------------------------------------------------------
function showToast(message) {
  const existing = document.getElementById('brandroom-toast');
  if (existing) {
    if (existing.remove) existing.remove();
    else if (existing.parentNode) existing.parentNode.removeChild(existing);
  }

  const toast = document.createElement('div');
  toast.id = 'brandroom-toast';
  toast.className = 'fixed bottom-6 right-6 bg-blue-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl z-50 flex items-center gap-2 border border-blue-400/30';
  toast.innerHTML = `<span>✨</span> <span>${message}</span>`;
  if (document.body && document.body.appendChild) {
    document.body.appendChild(toast);
  }

  setTimeout(() => {
    if (toast) {
      if (toast.remove) toast.remove();
      else if (toast.parentNode) toast.parentNode.removeChild(toast);
    }
  }, 2800);
}
