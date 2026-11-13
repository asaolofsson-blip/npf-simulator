/**
 * NPF-Simulator: sidepanel.js
 * Hanterar lärargränssnittet i sidopanelen, synkroniserar inställningar
 * och skickar kommandon till bakgrundsscriptet och den aktiva fliken.
 */

// Grundläggande tillstånd
let currentState = {
  active: false,
  dyslexia: {
    enabled: false,
    scrambleIntensity: 5,
    crowding: false,
    lowContrast: false,
    frequencyMs: 500
  },
  adhd: {
    enabled: false,
    spotlight: false,
    blurAmount: 6,
    distractions: false,
    crocodile: true,
    fakeNotifications: false
  },
  sensory: {
    enabled: false,
    overexposure: false,
    intensity: 130,
    flicker: false
  },
  stochastic: {
    enabled: false,
    opacity: 8,
    grainSize: 2,
    dynamic: true,
    fps: 20
  }
};

// UI Element-referenser
const elements = {
  envBadge: document.getElementById('env-badge'),
  envText: document.getElementById('env-text'),
  docsWarning: document.getElementById('docs-warning'),

  // Dyslexi
  cardDyslexia: document.getElementById('card-dyslexia'),
  dyslexiaMaster: document.getElementById('dyslexia-master'),
  dyslexiaScramble: document.getElementById('dyslexia-scramble'),
  scrambleVal: document.getElementById('scramble-val'),
  dyslexiaCrowding: document.getElementById('dyslexia-crowding'),
  dyslexiaContrast: document.getElementById('dyslexia-contrast'),

  // ADHD
  cardAdhd: document.getElementById('card-adhd'),
  adhdMaster: document.getElementById('adhd-master'),
  adhdSpotlight: document.getElementById('adhd-spotlight'),
  adhdBlur: document.getElementById('adhd-blur'),
  blurVal: document.getElementById('blur-val'),
  adhdDistractions: document.getElementById('adhd-distractions'),
  adhdNotifications: document.getElementById('adhd-notifications'),
  adhdCrocodile: document.getElementById('adhd-crocodile'),
  btnTriggerCrocodile: document.getElementById('btn-trigger-crocodile'),

  // Sensorisk
  cardSensory: document.getElementById('card-sensory'),
  sensoryMaster: document.getElementById('sensory-master'),
  sensoryOverexposure: document.getElementById('sensory-overexposure'),
  sensoryIntensity: document.getElementById('sensory-intensity'),
  sensoryVal: document.getElementById('sensory-val'),
  sensoryFlicker: document.getElementById('sensory-flicker'),

  // Motmedel: Stokastisk resonans
  cardStochastic: document.getElementById('card-stochastic'),
  stochasticMaster: document.getElementById('stochastic-master'),
  stochasticOpacity: document.getElementById('stochastic-opacity'),
  stochasticOpacityVal: document.getElementById('stochastic-opacity-val'),
  stochasticGrain: document.getElementById('stochastic-grain'),
  stochasticGrainVal: document.getElementById('stochastic-grain-val'),
  stochasticDynamic: document.getElementById('stochastic-dynamic'),
  stochasticFps: document.getElementById('stochastic-fps'),
  stochasticFpsVal: document.getElementById('stochastic-fps-val'),
  stochasticFpsGroup: document.getElementById('stochastic-fps-group'),

  // Knappar
  btnReset: document.getElementById('btn-reset'),
  profileDyslexia: document.getElementById('profile-dyslexia'),
  profileAdhd: document.getElementById('profile-adhd'),
  profileSensory: document.getElementById('profile-sensory')
};

// 1. Initiering vid start
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  await checkActiveTab();
  setupEventListeners();
});

// Ladda sparat tillstånd från storage
async function loadState() {
  try {
    const res = await chrome.storage.local.get('npf_state');
    if (res.npf_state) {
      // Slå ihop med default för att säkerställa bakåtkompatibilitet
      currentState = {
        ...currentState,
        ...res.npf_state,
        adhd: { ...currentState.adhd, ...(res.npf_state.adhd || {}) },
        stochastic: { ...currentState.stochastic, ...(res.npf_state.stochastic || {}) }
      };
    }
  } catch (err) {
    console.error('Kunde inte läsa npf_state:', err);
  }
  updateUIFromState();
}

// Uppdatera UI-kontroller baserat på currentState
function updateUIFromState() {
  // Dyslexi
  elements.dyslexiaMaster.checked = currentState.dyslexia.enabled;
  elements.dyslexiaScramble.value = currentState.dyslexia.scrambleIntensity;
  elements.scrambleVal.textContent = currentState.dyslexia.scrambleIntensity;
  elements.dyslexiaCrowding.checked = currentState.dyslexia.crowding;
  elements.dyslexiaContrast.checked = currentState.dyslexia.lowContrast;
  elements.cardDyslexia.classList.toggle('active', currentState.dyslexia.enabled);

  // ADHD
  elements.adhdMaster.checked = currentState.adhd.enabled;
  elements.adhdSpotlight.checked = currentState.adhd.spotlight;
  elements.adhdBlur.value = currentState.adhd.blurAmount;
  elements.blurVal.textContent = `${currentState.adhd.blurAmount}px`;
  elements.adhdDistractions.checked = currentState.adhd.distractions;
  elements.adhdNotifications.checked = currentState.adhd.fakeNotifications;
  if (elements.adhdCrocodile) {
    elements.adhdCrocodile.checked = currentState.adhd.crocodile !== false;
  }
  elements.cardAdhd.classList.toggle('active', currentState.adhd.enabled);

  // Sensorisk
  elements.sensoryMaster.checked = currentState.sensory.enabled;
  elements.sensoryOverexposure.checked = currentState.sensory.overexposure;
  elements.sensoryIntensity.value = currentState.sensory.intensity;
  elements.sensoryVal.textContent = `${currentState.sensory.intensity}%`;
  elements.sensoryFlicker.checked = currentState.sensory.flicker;
  elements.cardSensory.classList.toggle('active', currentState.sensory.enabled);

  // Motmedel: Stokastisk resonans
  if (elements.cardStochastic) {
    elements.stochasticMaster.checked = currentState.stochastic.enabled;
    elements.stochasticOpacity.value = currentState.stochastic.opacity;
    elements.stochasticOpacityVal.textContent = `${currentState.stochastic.opacity}%`;
    elements.stochasticGrain.value = currentState.stochastic.grainSize;
    elements.stochasticGrainVal.textContent = `${currentState.stochastic.grainSize}px`;
    elements.stochasticDynamic.checked = currentState.stochastic.dynamic;
    elements.stochasticFps.value = currentState.stochastic.fps;
    elements.stochasticFpsVal.textContent = `${currentState.stochastic.fps} fps`;
    elements.stochasticFpsGroup.style.display = currentState.stochastic.dynamic ? 'flex' : 'none';
    elements.cardStochastic.classList.toggle('active', currentState.stochastic.enabled);
  }
}

// 2. Känn av aktiv flik (Classroom, Docs Canvas, etc.)
async function checkActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    elements.envText.textContent = 'Ingen aktiv webbsida';
    return;
  }

  const url = tab.url;
  elements.envBadge.className = 'env-badge';

  if (url.includes('classroom.google.com')) {
    elements.envBadge.classList.add('env-classroom');
    elements.envText.textContent = 'Google Classroom (DOM-optimerad)';
    elements.docsWarning.classList.add('hidden');
  } else if (url.includes('docs.google.com/document')) {
    elements.envBadge.classList.add('env-docs');
    elements.envText.textContent = 'Google Dokument (Canvas-läge)';
    elements.docsWarning.classList.remove('hidden');
  } else {
    elements.envBadge.classList.add('env-generic');
    elements.envText.textContent = 'Webbsida';
    elements.docsWarning.classList.add('hidden');
  }

  // Fråga content-scriptet om det hittat Canvas (kix-appview)
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'QUERY_ENVIRONMENT' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.isDocsCanvas) {
        elements.docsWarning.classList.remove('hidden');
      }
    });
  }
}

// 3. Spara och applicera förändringar
function commitState() {
  chrome.runtime.sendMessage({
    type: 'UPDATE_STATE',
    state: currentState
  });
}

// 4. Koppla upp alla lyssnare
function setupEventListeners() {
  // Dyslexi
  elements.dyslexiaMaster.addEventListener('change', (e) => {
    currentState.dyslexia.enabled = e.target.checked;
    elements.cardDyslexia.classList.toggle('active', e.target.checked);
    commitState();
  });

  elements.dyslexiaScramble.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    elements.scrambleVal.textContent = val;
    currentState.dyslexia.scrambleIntensity = val;
    commitState();
  });

  elements.dyslexiaCrowding.addEventListener('change', (e) => {
    currentState.dyslexia.crowding = e.target.checked;
    commitState();
  });

  elements.dyslexiaContrast.addEventListener('change', (e) => {
    currentState.dyslexia.lowContrast = e.target.checked;
    commitState();
  });

  // ADHD
  elements.adhdMaster.addEventListener('change', (e) => {
    currentState.adhd.enabled = e.target.checked;
    elements.cardAdhd.classList.toggle('active', e.target.checked);
    commitState();
  });

  elements.adhdSpotlight.addEventListener('change', (e) => {
    currentState.adhd.spotlight = e.target.checked;
    commitState();
  });

  elements.adhdBlur.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    elements.blurVal.textContent = `${val}px`;
    currentState.adhd.blurAmount = val;
    commitState();
  });

  elements.adhdDistractions.addEventListener('change', (e) => {
    currentState.adhd.distractions = e.target.checked;
    commitState();
  });

  elements.adhdNotifications.addEventListener('change', (e) => {
    currentState.adhd.fakeNotifications = e.target.checked;
    commitState();
  });

  if (elements.adhdCrocodile) {
    elements.adhdCrocodile.addEventListener('change', (e) => {
      currentState.adhd.crocodile = e.target.checked;
      commitState();
    });
  }

  if (elements.btnTriggerCrocodile) {
    elements.btnTriggerCrocodile.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_CROCODILE' }).catch(() => {
          chrome.runtime.sendMessage({ type: 'TRIGGER_CROCODILE' });
        });
      } else {
        chrome.runtime.sendMessage({ type: 'TRIGGER_CROCODILE' });
      }
    });
  }

  // Sensorisk
  elements.sensoryMaster.addEventListener('change', (e) => {
    currentState.sensory.enabled = e.target.checked;
    elements.cardSensory.classList.toggle('active', e.target.checked);
    commitState();
  });

  elements.sensoryOverexposure.addEventListener('change', (e) => {
    currentState.sensory.overexposure = e.target.checked;
    commitState();
  });

  elements.sensoryIntensity.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    elements.sensoryVal.textContent = `${val}%`;
    currentState.sensory.intensity = val;
    commitState();
  });

  elements.sensoryFlicker.addEventListener('change', (e) => {
    currentState.sensory.flicker = e.target.checked;
    commitState();
  });

  // Motmedel: Stokastisk resonans
  if (elements.stochasticMaster) {
    elements.stochasticMaster.addEventListener('change', (e) => {
      currentState.stochastic.enabled = e.target.checked;
      elements.cardStochastic.classList.toggle('active', e.target.checked);
      commitState();
    });

    elements.stochasticOpacity.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      elements.stochasticOpacityVal.textContent = `${val}%`;
      currentState.stochastic.opacity = val;
      commitState();
    });

    elements.stochasticGrain.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      elements.stochasticGrainVal.textContent = `${val}px`;
      currentState.stochastic.grainSize = val;
      commitState();
    });

    elements.stochasticDynamic.addEventListener('change', (e) => {
      currentState.stochastic.dynamic = e.target.checked;
      elements.stochasticFpsGroup.style.display = e.target.checked ? 'flex' : 'none';
      commitState();
    });

    elements.stochasticFps.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      elements.stochasticFpsVal.textContent = `${val} fps`;
      currentState.stochastic.fps = val;
      commitState();
    });
  }

  // Snabbprofiler
  elements.profileDyslexia.addEventListener('click', () => {
    currentState.dyslexia.enabled = true;
    currentState.dyslexia.scrambleIntensity = 6;
    currentState.dyslexia.crowding = true;
    currentState.dyslexia.lowContrast = true;

    currentState.adhd.enabled = false;
    currentState.sensory.enabled = false;
    currentState.stochastic.enabled = false;

    updateUIFromState();
    commitState();
  });

  elements.profileAdhd.addEventListener('click', () => {
    currentState.adhd.enabled = true;
    currentState.adhd.spotlight = true;
    currentState.adhd.blurAmount = 7;
    currentState.adhd.distractions = true;
    currentState.adhd.crocodile = true;
    currentState.adhd.fakeNotifications = true;

    currentState.dyslexia.enabled = false;
    currentState.sensory.enabled = false;
    currentState.stochastic.enabled = false;

    updateUIFromState();
    commitState();
  });

  elements.profileSensory.addEventListener('click', () => {
    currentState.sensory.enabled = true;
    currentState.sensory.overexposure = true;
    currentState.sensory.intensity = 140;
    currentState.sensory.flicker = true;

    currentState.dyslexia.enabled = false;
    currentState.adhd.enabled = false;
    currentState.stochastic.enabled = false;

    updateUIFromState();
    commitState();
  });

  // Återställ alla filter
  elements.btnReset.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'RESET_ALL' }, (res) => {
      if (res && res.state) {
        currentState = {
          ...res.state,
          adhd: { ...res.state.adhd, crocodile: true },
          stochastic: res.state.stochastic || {
            enabled: false,
            opacity: 8,
            grainSize: 2,
            dynamic: true,
            fps: 20
          }
        };
        updateUIFromState();
      }
    });
  });
}

// 5. Lyssna på flikbyten i webbläsaren för att uppdatera flikindikatorn
chrome.tabs.onActivated.addListener(() => {
  checkActiveTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    checkActiveTab();
  }
});
