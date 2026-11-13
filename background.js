/**
 * NPF-Simulator: background.js (Service Worker - Manifest V3)
 * Hanterar extensionens livscykel, standardtillstånd och sidopanelens beteende.
 */

// Standardkonfiguration för alla simulatorfilter
const DEFAULT_STATE = {
  active: false,
  dyslexia: {
    enabled: false,
    scrambleIntensity: 5,   // 1-10
    crowding: false,         // Minskat rad- och teckenavstånd
    lowContrast: false,      // Seriffer och sänkt kontrast
    frequencyMs: 500         // Intervall för dynamisk omkastning
  },
  adhd: {
    enabled: false,
    spotlight: false,        // Tunnelseende/fokuslampa
    blurAmount: 6,           // Oskärpa i pixlar runt fokusytan
    distractions: false,     // Perifera rörliga element
    crocodile: true,         // Oväntade infall / krokodiler som vandrar förbi
    fakeNotifications: false // Simulerade distraherande notiser
  },
  sensory: {
    enabled: false,
    overexposure: false,     // Överexponerade färger/ljus
    intensity: 130,          // % ljusstyrka/kontrast
    flicker: false           // Subtilt lysrörsflimmer
  },
  stochastic: {
    enabled: false,          // Motmedel: Stokastisk resonans (visuellt brus)
    opacity: 8,              // 0-30%
    grainSize: 2,            // 1-4px
    dynamic: true,           // dynamisk animering vs stillastående textur
    fps: 20                  // 5-60 fps
  }
};

// 1. Installation och initiering
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[NPF Simulator] Installerad/Uppdaterad:', details.reason);

  // Aktivera att sidopanelen öppnas direkt vid klick på extension-ikonen
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('[NPF Simulator] Fel vid konfiguration av sidopanel:', error));
  }

  // Spara standardtillstånd om det inte redan finns
  const current = await chrome.storage.local.get('npf_state');
  if (!current.npf_state) {
    await chrome.storage.local.set({ npf_state: DEFAULT_STATE });
  }
});

// 2. Meddelandehantering mellan Sidopanel, Service Worker och Content Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    chrome.storage.local.get('npf_state').then((res) => {
      sendResponse({ state: res.npf_state || DEFAULT_STATE });
    });
    return true; // Asynkront svar
  }

  if (message.type === 'UPDATE_STATE') {
    // Spara i storage och skicka vidare till den aktiva fliken
    chrome.storage.local.set({ npf_state: message.state }).then(() => {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab && tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'APPLY_FILTERS',
            state: message.state
          }).catch(() => {
            // Fliken kanske inte har content script laddat (t.ex. chrome:// sidor)
          });
        }
      });
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'TRIGGER_CROCODILE') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'TRIGGER_CROCODILE'
        }).catch(() => {});
      }
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'RESET_ALL') {
    const resetState = JSON.parse(JSON.stringify(DEFAULT_STATE));
    chrome.storage.local.set({ npf_state: resetState }).then(() => {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab && tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'RESET_FILTERS'
          }).catch(() => {});
        }
      });
      sendResponse({ success: true, state: resetState });
    });
    return true;
  }
});

// 3. Vid flikbyte eller omladdning: Informera fliken om tillståndet om filter är igång
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    chrome.storage.local.get('npf_state').then((res) => {
      const state = res.npf_state;
      if (state && (state.dyslexia?.enabled || state.adhd?.enabled || state.sensory?.enabled || state.stochastic?.enabled)) {
        chrome.tabs.sendMessage(tabId, {
          type: 'APPLY_FILTERS',
          state: state
        }).catch(() => {
          // Normalt om sidan inte tillåter skriptinjektion
        });
      }
    });
  }
});
