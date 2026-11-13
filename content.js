/**
 * NPF-Simulator: content.js
 * Injected script som manipulerar DOM och lägger på visuella filter
 * för Dyslexi, ADHD, Sensorisk överbelastning och Motmedel (Stokastisk resonans).
 */

(function() {
  // --- GLOBALS & STATE ---
  let currentState = null;
  let wordScrambleIntervalId = null;
  let textNodes = []; // Sparar ursprungliga textnoder för återställning

  // ADHD Spotlight
  let spotlightOverlay = null;
  let onMouseMoveSpotlight = null;

  // ADHD Distraktioner
  let distractionsContainer = null;

  // ADHD Notiser & Oväntade infall (Krokodilen)
  let notificationIntervalId = null;
  let intruderIntervalId = null;

  // Motmedel: Stokastisk resonans (Canvas Noise Engine)
  let stochasticCanvas = null;
  let stochasticCtx = null;
  let stochasticAnimIntervalId = null;
  let stochasticResizeHandler = null;
  let noisePatterns = [];
  let currentNoiseFrame = 0;

  // --- INITIALIZATION & MEDDELANDEHANTERING ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "APPLY_FILTERS") {
      currentState = message.state;
      applyAllFilters();
      sendResponse({ status: "applied" });
    } else if (message.type === "RESET_FILTERS") {
      resetAllFilters();
      sendResponse({ status: "reset" });
    } else if (message.type === "TRIGGER_CROCODILE") {
      triggerIntruder("crocodile");
      sendResponse({ status: "crocodile_triggered" });
    } else if (message.type === "QUERY_ENVIRONMENT") {
      const isDocsCanvas = !!document.querySelector(".kix-appview");
      sendResponse({
        isDocsCanvas,
        isClassroom: window.location.hostname.includes("classroom.google.com")
      });
    }
  });

  // Hämta sparat tillstånd vid laddning
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
    if (response && response.state) {
      currentState = response.state;
      applyAllFilters();
    }
  });

  function applyAllFilters() {
    if (!currentState) return;
    resetAllFilters(false); // Rensa UI först, behåll currentState

    if (currentState.dyslexia && currentState.dyslexia.enabled) {
      applyDyslexiaFilters();
    }
    if (currentState.adhd && currentState.adhd.enabled) {
      applyADHDFilters();
    }
    if (currentState.sensory && currentState.sensory.enabled) {
      applySensoryFilters();
    }
    if (currentState.stochastic && currentState.stochastic.enabled) {
      applyStochasticFilter();
    }
  }

  function resetAllFilters(clearState = true) {
    if (clearState) {
      currentState = null;
    }

    // 1. Dyslexi Återställning
    document.documentElement.classList.remove("npf-crowding-active", "npf-contrast-active");
    stopWordScramble();

    // Google Docs Canvas Fallback Cleanup
    const kixAppview = document.querySelector(".kix-appview");
    if (kixAppview) {
      kixAppview.classList.remove("npf-docs-optical-filter");
    }

    // 2. ADHD Återställning
    if (spotlightOverlay) {
      spotlightOverlay.remove();
      spotlightOverlay = null;
    }
    if (onMouseMoveSpotlight) {
      document.removeEventListener("mousemove", onMouseMoveSpotlight);
      onMouseMoveSpotlight = null;
    }
    if (distractionsContainer) {
      distractionsContainer.remove();
      distractionsContainer = null;
    }
    if (notificationIntervalId) {
      clearInterval(notificationIntervalId);
      notificationIntervalId = null;
    }
    if (intruderIntervalId) {
      clearTimeout(intruderIntervalId);
      clearInterval(intruderIntervalId);
      intruderIntervalId = null;
    }
    document.querySelectorAll(".npf-notification-toast, .npf-intruder-container").forEach(el => el.remove());

    // 3. Sensorisk Återställning
    document.documentElement.classList.remove("npf-sensory-overload", "npf-sensory-flicker");
    document.documentElement.style.removeProperty("--npf-sensory-brightness");
    document.documentElement.style.removeProperty("--npf-sensory-contrast");
    document.documentElement.style.removeProperty("--npf-sensory-saturate");

    // 4. Stokastisk Resonans Återställning
    stopDynamicNoise();
    if (stochasticResizeHandler) {
      window.removeEventListener("resize", stochasticResizeHandler);
      stochasticResizeHandler = null;
    }
    if (stochasticCanvas) {
      stochasticCanvas.remove();
      stochasticCanvas = null;
      stochasticCtx = null;
    }
    document.documentElement.style.removeProperty("--npf-stochastic-opacity");
    noisePatterns = [];
  }

  // ==========================================================================
  // DYSLEXI-FILTER
  // ==========================================================================
  function applyDyslexiaFilters() {
    const d = currentState.dyslexia;
    if (d.crowding) {
      document.documentElement.classList.add("npf-crowding-active");
    }
    if (d.lowContrast) {
      document.documentElement.classList.add("npf-contrast-active");
    }

    // Google Docs specialhantering: text ritas på canvas
    const kixAppview = document.querySelector(".kix-appview");
    if (kixAppview) {
      kixAppview.classList.add("npf-docs-optical-filter");
      return; // Ersätts med optiskt filter
    }

    if (d.scrambleIntensity > 0) {
      startWordScramble(d.scrambleIntensity, d.frequencyMs || 500);
    }
  }

  function startWordScramble(intensity, frequencyMs) {
    textNodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement &&
          ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "CODE", "PRE"].includes(node.parentElement.tagName)) {
        continue;
      }
      if (node.parentElement && node.parentElement.closest(".npf-ignore, #npf-spotlight-overlay, .npf-notification-toast, .npf-intruder-container")) {
        continue;
      }

      const text = node.nodeValue;
      if (text.trim().length > 3) {
        textNodes.push({
          node: node,
          originalText: text
        });
      }
    }

    wordScrambleIntervalId = setInterval(() => {
      if (textNodes.length === 0) return;
      const nodesToScramble = Math.max(1, Math.floor(textNodes.length * (intensity / 100)));

      for (let i = 0; i < nodesToScramble; i++) {
        const randIndex = Math.floor(Math.random() * textNodes.length);
        const item = textNodes[randIndex];
        if (item && item.node && item.node.parentNode) {
          item.node.nodeValue = scrambleWords(item.originalText, intensity);
        }
      }

      // Återställ slumpmässiga noder för dynamiskt "flytande" läsintryck
      for (let i = 0; i < nodesToScramble; i++) {
        const randIndex = Math.floor(Math.random() * textNodes.length);
        const item = textNodes[randIndex];
        if (item && item.node && item.node.parentNode) {
          item.node.nodeValue = item.originalText;
        }
      }
    }, frequencyMs);
  }

  function stopWordScramble() {
    if (wordScrambleIntervalId) {
      clearInterval(wordScrambleIntervalId);
      wordScrambleIntervalId = null;
    }
    textNodes.forEach(item => {
      if (item.node && item.node.parentNode) {
        item.node.nodeValue = item.originalText;
      }
    });
    textNodes = [];
  }

  function scrambleWords(text, intensity) {
    return text.split(/(\s+)/).map(word => {
      if (word.length <= 3 || !/^[A-Za-zÅÄÖåäö]+$/.test(word)) return word;
      if (Math.random() * 10 > intensity) return word;

      const first = word[0];
      const last = word[word.length - 1];
      let middle = word.substring(1, word.length - 1).split('');

      // Fisher-Yates slumpomkastning
      for (let i = middle.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [middle[i], middle[j]] = [middle[j], middle[i]];
      }
      return first + middle.join('') + last;
    }).join('');
  }

  // ==========================================================================
  // ADHD-FILTER
  // ==========================================================================
  function applyADHDFilters() {
    const a = currentState.adhd;

    // 1. Spotlight / Tunnelseende
    if (a.spotlight) {
      spotlightOverlay = document.createElement("div");
      spotlightOverlay.id = "npf-spotlight-overlay";
      spotlightOverlay.style.setProperty("--npf-spotlight-blur", `${a.blurAmount}px`);
      document.body.appendChild(spotlightOverlay);

      onMouseMoveSpotlight = (e) => {
        spotlightOverlay.style.setProperty("--npf-spotlight-x", `${e.clientX}px`);
        spotlightOverlay.style.setProperty("--npf-spotlight-y", `${e.clientY}px`);
      };
      document.addEventListener("mousemove", onMouseMoveSpotlight);

      spotlightOverlay.style.setProperty("--npf-spotlight-x", `${window.innerWidth / 2}px`);
      spotlightOverlay.style.setProperty("--npf-spotlight-y", `${window.innerHeight / 2}px`);
    }

    // 2. Perifera rörelser
    if (a.distractions) {
      distractionsContainer = document.createElement("div");
      distractionsContainer.id = "npf-distractions-container";

      for (let i = 0; i < 4; i++) {
        const dot = document.createElement("div");
        dot.className = "npf-distraction-dot";
        dot.style.top = `${Math.random() * 80 + 10}vh`;
        dot.style[i % 2 === 0 ? "left" : "right"] = `${Math.random() * 10}vw`;
        dot.style.animationDelay = `${Math.random() * 2}s`;
        distractionsContainer.appendChild(dot);
      }
      for (let i = 0; i < 3; i++) {
        const bar = document.createElement("div");
        bar.className = "npf-distraction-bar";
        bar.style.top = `${Math.random() * 80 + 10}vh`;
        bar.style[i % 2 === 0 ? "right" : "left"] = `${Math.random() * 10}vw`;
        bar.style.animationDelay = `${Math.random() * 2}s`;
        distractionsContainer.appendChild(bar);
      }

      document.body.appendChild(distractionsContainer);
    }

    // 3. Simulerade notiser (Arbetsminnesavbrott)
    if (a.fakeNotifications) {
      notificationIntervalId = setInterval(showFakeNotification, 14000 + Math.random() * 6000);
    }

    // 4. Oväntade infall: Krokodilen som spatserar förbi
    if (a.crocodile !== false) {
      // Första infallet dyker upp efter 8–12 sekunder så läraren slipper vänta, därefter var 25–45:e sekund
      intruderIntervalId = setTimeout(function spawnIntruderLoop() {
        triggerIntruder();
        intruderIntervalId = setTimeout(spawnIntruderLoop, 25000 + Math.random() * 20000);
      }, 8000 + Math.random() * 4000);
    }
  }

  function showFakeNotification() {
    const titles = ["Ny uppdatering krävs", "Oläst meddelande i Classroom", "Kalenderpåminnelse", "Synkronisering pausad"];
    const bodies = [
      "Klicka här för att installera rekommenderade säkerhetsuppdateringar.",
      "En elev har lämnat in en sen uppgift i Biologi 8A.",
      "Personalmöte i aulan börjar om 10 minuter.",
      "Ändringar kunde inte sparas automatiskt i molnet."
    ];

    const r = Math.floor(Math.random() * titles.length);

    const toast = document.createElement("div");
    toast.className = "npf-notification-toast";
    toast.innerHTML = `
      <div class="npf-toast-header">
        <span class="npf-toast-app">Systemnotis</span>
        <button class="npf-toast-close">&times;</button>
      </div>
      <div class="npf-toast-title">${titles[r]}</div>
      <div class="npf-toast-body">${bodies[r]}</div>
    `;

    toast.querySelector(".npf-toast-close").addEventListener("click", () => {
      toast.remove();
    });

    document.body.appendChild(toast);

    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.remove();
      }
    }, 6000);
  }

  // --- OVÄNTADE INFALL ("KROKODILEN" M.FL.) ---
  function triggerIntruder(forcedType = null) {
    const types = ["crocodile", "crocodile", "ufo", "cat", "flamingo"];
    const type = forcedType || types[Math.floor(Math.random() * types.length)];

    // Rensa eventuella tidigare infall så skärmen inte blir översvämmad vid snabba klick
    if (forcedType) {
      document.querySelectorAll(".npf-intruder-container").forEach(el => el.remove());
    }

    const container = document.createElement("div");
    container.className = `npf-intruder-container npf-intruder-${type}`;

    if (type === "crocodile") {
      const phrases = [
        "🐊 Bara en krokodil som spatserar förbi...",
        "🐊 Kom du ihåg att titta på inlämningsdatumet?",
        "🐊 Helt plötsligt tänker hjärnan på krokodiler!",
        "🐊 Vad handlade texten om nyss egentligen?"
      ];
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      container.innerHTML = `
        <span class="npf-intruder-figure">🐊</span>
        <div class="npf-intruder-bubble">${phrase}</div>
      `;
    } else if (type === "ufo") {
      container.innerHTML = `
        <span class="npf-intruder-figure">🛸</span>
        <div class="npf-intruder-bubble">🛸 *Bzzzt...* Strålar upp din koncentration!</div>
      `;
    } else if (type === "cat") {
      container.innerHTML = `
        <span class="npf-intruder-figure">🐈</span>
        <div class="npf-intruder-bubble">🐈 Smyger bara förbi... Mjau! Vad läste du nu igen?</div>
      `;
    } else if (type === "flamingo") {
      container.innerHTML = `
        <span class="npf-intruder-figure">🦩</span>
        <div class="npf-intruder-bubble">🦩 Balanserar lugnt förbi medan du försöker fokusera...</div>
      `;
    }

    document.body.appendChild(container);

    // Ta bort efter avslutad animation (15 sekunder)
    setTimeout(() => {
      if (document.body.contains(container)) {
        container.remove();
      }
    }, 15000);
  }

  // ==========================================================================
  // SENSORISK ÖVERBELASTNING
  // ==========================================================================
  function applySensoryFilters() {
    const s = currentState.sensory;

    if (s.overexposure) {
      document.documentElement.classList.add("npf-sensory-overload");

      const val = s.intensity || 130;
      const brightness = val / 100;
      const contrast = 1 + ((val - 100) / 100) * 1.5;
      const saturate = 1 + ((val - 100) / 100) * 2;

      document.documentElement.style.setProperty("--npf-sensory-brightness", brightness);
      document.documentElement.style.setProperty("--npf-sensory-contrast", contrast);
      document.documentElement.style.setProperty("--npf-sensory-saturate", saturate);
    }

    if (s.flicker) {
      document.documentElement.classList.add("npf-sensory-flicker");
    }
  }

  // ==========================================================================
  // MOTMEDEL: STOKASTISK RESONANS (VISUELLT BRUS)
  // Högpresterande Canvas Engine med förrenderade mönster för Chromebooks
  // ==========================================================================
  function applyStochasticFilter() {
    const st = currentState.stochastic;
    if (!st || !st.enabled) return;

    if (!stochasticCanvas) {
      stochasticCanvas = document.createElement("canvas");
      stochasticCanvas.id = "npf-stochastic-canvas";
      document.body.appendChild(stochasticCanvas);
      stochasticCtx = stochasticCanvas.getContext("2d", { alpha: false });

      stochasticResizeHandler = () => resizeStochasticCanvas();
      window.addEventListener("resize", stochasticResizeHandler);
    }

    resizeStochasticCanvas();

    // Sätt opacitet (0 - 30%)
    const opacityVal = Math.min(0.30, Math.max(0.01, (st.opacity || 8) / 100));
    document.documentElement.style.setProperty("--npf-stochastic-opacity", opacityVal);

    // Skapa mönsterbuffertar baserat på vald kornstorlek
    generateNoisePatterns(st.grainSize || 2);

    if (st.dynamic) {
      startDynamicNoise(st.fps || 20);
    } else {
      stopDynamicNoise();
      drawNoiseFrame(0);
    }
  }

  function resizeStochasticCanvas() {
    if (!stochasticCanvas) return;
    stochasticCanvas.width = window.innerWidth;
    stochasticCanvas.height = window.innerHeight;
    if (noisePatterns.length > 0) {
      drawNoiseFrame(currentNoiseFrame);
    }
  }

  /**
   * Genererar 4 små off-screen brusmönster (128x128).
   * Genom att cykla mellan dessa uppnås 60 fps TV-statik med <0.1% CPU!
   */
  function generateNoisePatterns(grainSize) {
    if (!stochasticCtx) return;
    noisePatterns = [];

    const tileSize = 128;
    const grainsPerTile = Math.floor(tileSize / grainSize);

    for (let p = 0; p < 4; p++) {
      const offCanvas = document.createElement("canvas");
      offCanvas.width = tileSize;
      offCanvas.height = tileSize;
      const offCtx = offCanvas.getContext("2d");

      const imgData = offCtx.createImageData(tileSize, tileSize);
      const data = imgData.data;

      // Fyll med slumpmässiga gråskalepixlar i block av grainSize
      for (let gy = 0; gy < grainsPerTile; gy++) {
        for (let gx = 0; gx < grainsPerTile; gx++) {
          const shade = Math.random() > 0.5 ? 255 : (Math.random() * 160 | 0);
          const startX = gx * grainSize;
          const startY = gy * grainSize;

          for (let py = 0; py < grainSize; py++) {
            for (let px = 0; px < grainSize; px++) {
              const idx = ((startY + py) * tileSize + (startX + px)) * 4;
              data[idx] = shade;
              data[idx + 1] = shade;
              data[idx + 2] = shade;
              data[idx + 3] = 255;
            }
          }
        }
      }

      offCtx.putImageData(imgData, 0, 0);
      const pattern = stochasticCtx.createPattern(offCanvas, "repeat");
      noisePatterns.push(pattern);
    }
  }

  function drawNoiseFrame(index) {
    if (!stochasticCtx || noisePatterns.length === 0) return;
    const pat = noisePatterns[index % noisePatterns.length];
    stochasticCtx.fillStyle = pat;
    stochasticCtx.fillRect(0, 0, stochasticCanvas.width, stochasticCanvas.height);
  }

  function startDynamicNoise(fps) {
    stopDynamicNoise();
    const intervalMs = Math.max(16, Math.floor(1000 / fps));

    stochasticAnimIntervalId = setInterval(() => {
      currentNoiseFrame = (currentNoiseFrame + 1) % noisePatterns.length;
      drawNoiseFrame(currentNoiseFrame);
    }, intervalMs);
  }

  function stopDynamicNoise() {
    if (stochasticAnimIntervalId) {
      clearInterval(stochasticAnimIntervalId);
      stochasticAnimIntervalId = null;
    }
  }

})();
