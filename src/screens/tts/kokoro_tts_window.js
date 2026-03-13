import {
  listKokoroVoices,
  generateSingleAudio,
  generateBatchAudio
} from "../../services/kokoro-tts-service.js";

renderKokoroTtsWindow();
loadVoices();

const ttsState = {
  lastGeneratedAudioPath: "",
  audioElement: null,
  isGenerating: false
};
const { open, save } = window.__TAURI__.dialog;
const { copyFile } = window.__TAURI__.fs;
const { convertFileSrc } = window.__TAURI__.core;
const { path } = window.__TAURI__;

function renderKokoroTtsWindow() {
  const app = document.querySelector("#app");
  if (!app) return;

  app.innerHTML = `
    <main class="tts-page">
      <section class="tts-shell">
        <header class="tts-header">
          <h1 class="tts-title">Welcome to Kokoro-TTS</h1>
        </header>

        <section class="tts-section">
          <div class="tts-row two-cols">
            <div class="tts-field">
              <label class="tts-label">Language</label>
              <select class="tts-input" id="tts-language">
                <option value="en">English</option>
              </select>
            </div>

            <div class="tts-field">
              <label class="tts-label">Voice</label>
              <select class="tts-input" id="tts-voice">
                <option value="">Select voice</option>
              </select>
            </div>
          </div>

          <div class="tts-status" id="tts-status">
            Voices loaded. Ready.
          </div>
        </section>

        <section class="tts-section">
          <h2 class="tts-subtitle">Audio Settings</h2>

     <div class="tts-slider-row">
  <label class="tts-slider-label" for="tts-speed">Speed</label>
  <input
    type="range"
    min="1.0"
    max="2.0"
    step="0.1"
    value="1.0"
    id="tts-speed"
  />
  <span class="tts-slider-value" id="tts-speed-value">1.0x</span>
</div>

          <div class="tts-options-row">
            <label class="tts-checkbox-row">
              <input type="checkbox" id="tts-remove-silence" checked />
              <span>Remove Silence</span>
            </label>

            <div class="tts-output-format">
              <span>Output Format:</span>
              <select class="tts-small-input" id="tts-format">
                <option value="wav">wav</option>
                <option value="mp3">mp3</option>
              </select>
            </div>
          </div>
        </section>

        <section class="tts-section">
         <div class="tts-tab-row">
  <button class="tts-tab active" id="tts-single-tab">Single Generate</button>
  <button class="tts-tab" id="tts-batch-tab">Batch Generate</button>
</div>

<div class="tts-mode-panel" id="tts-single-panel">

  <div class="tts-field">
    <label class="tts-label">Input Text</label>
    <textarea class="tts-textarea" id="tts-input-text"></textarea>
  </div>

<div class="tts-progress-wrap">
  <div class="tts-progress-bar">
    <div class="tts-progress-fill" id="tts-progress-fill"></div>
  </div>
  <div class="tts-progress-text" id="tts-progress-text">Idle</div>
</div>

<div class="tts-player-wrap">
  <button class="tts-secondary-btn" id="tts-audio-toggle-btn">Play</button>
  <button class="tts-secondary-btn" id="tts-audio-replay-btn">Replay</button>

  <input
    type="range"
    min="0"
    max="100"
    value="0"
    id="tts-audio-seek"
    class="tts-audio-seek"
  />

  <div class="tts-audio-time" id="tts-audio-time">00:00 / 00:00</div>
</div>
<div class="tts-action-row">
  <button class="tts-primary-btn" id="tts-generate-btn">Generate Audio</button>
  <button class="tts-secondary-btn" id="tts-save-btn">Save Audio</button>
</div>
</div>

<div class="tts-mode-panel hidden" id="tts-batch-panel">

  <div class="tts-batch-row">
    <label class="tts-batch-label">Input Text File:</label>

    <input
      class="tts-batch-path"
      id="tts-batch-input-file"
      type="text"
      placeholder="No text file selected"
      readonly
    />

    <button class="tts-batch-browse-btn" id="tts-batch-input-browse">
      Browse
    </button>
  </div>

  <div class="tts-batch-row">
    <label class="tts-batch-label">Output Folder:</label>

    <input
      class="tts-batch-path"
      id="tts-batch-output-folder"
      type="text"
      placeholder="No output folder selected"
      readonly
    />

    <button class="tts-batch-browse-btn" id="tts-batch-output-browse">
      Browse
    </button>
  </div>

  <div class="tts-batch-actions">
    <button class="tts-primary-btn-batch" id="tts-batch-generate-btn">
      Generate Batch Audio
    </button>
<br>

   
  </div>
 <br>
  <div class="tts-progress-wrap">
  <div class="tts-progress-bar">
    <div class="tts-progress-fill" id="tts-batch-progress-fill"></div>
  </div>
  <div class="tts-progress-text" id="tts-batch-progress-text">Idle</div>
</div>
  <div class="tts-log-area" id="tts-batch-log"></div>

</div>
        </section>
      </section>
    </main>
  `;

  bindTtsUi();
  bindBatchGenerateUi();
  bindTtsEvents();
}

async function getPreviewOutputPath(format) {
  const cacheDir = await path.appCacheDir();
  return await path.join(cacheDir, `kokoro_preview.${format}`);
}


function bindTtsEvents() {
  document.querySelector("#tts-generate-btn")?.addEventListener("click", handleSingleGenerate);
  document.querySelector("#tts-batch-generate-btn")?.addEventListener("click", handleBatchGenerate);

  document.querySelector("#tts-audio-toggle-btn")?.addEventListener("click", toggleAudioPlayback);
  document.querySelector("#tts-audio-replay-btn")?.addEventListener("click", replayAudio);
  document.querySelector("#tts-audio-seek")?.addEventListener("input", seekAudio);
  document.querySelector("#tts-save-btn")?.addEventListener("click", handleSaveAudio);
}
function bindTtsUi() {
  const singleTab = document.querySelector("#tts-single-tab");
  const batchTab = document.querySelector("#tts-batch-tab");
  const singlePanel = document.querySelector("#tts-single-panel");
  const batchPanel = document.querySelector("#tts-batch-panel");

  const speedSlider = document.querySelector("#tts-speed");
  const speedValue = document.querySelector("#tts-speed-value");

  if (speedSlider && speedValue) {
    speedValue.textContent = `${Number(speedSlider.value).toFixed(1)}x`;

    speedSlider.addEventListener("input", () => {
      speedValue.textContent = `${Number(speedSlider.value).toFixed(1)}x`;
    });
  }

  singleTab?.addEventListener("click", () => {
    singleTab.classList.add("active");
    batchTab?.classList.remove("active");
    singlePanel?.classList.remove("hidden");
    batchPanel?.classList.add("hidden");
  });

  batchTab?.addEventListener("click", () => {
    batchTab.classList.add("active");
    singleTab?.classList.remove("active");
    batchPanel?.classList.remove("hidden");
    singlePanel?.classList.add("hidden");
  });
}


async function loadVoices() {
  const voiceSelect = document.querySelector("#tts-voice");
  const status = document.querySelector("#tts-status");

  if (!voiceSelect) return;

  try {
    if (status) {
      status.textContent = "Loading voices...";
    }

    const result = await listKokoroVoices();

    voiceSelect.innerHTML = "";

    result.voices.forEach((voice) => {
      const option = document.createElement("option");
      option.value = voice;
      option.textContent = voice;
      voiceSelect.appendChild(option);
    });

    if (result.voices.includes("am_eric")) {
      voiceSelect.value = "am_eric";
    } else if (result.voices.length > 0) {
      voiceSelect.value = result.voices[0];
    }

    if (status) {
      status.textContent = `Loaded ${result.voices.length} voices. Ready.`;
    }
  } catch (error) {
    console.error("Failed to load voices:", error);

    if (status) {
      status.textContent = `Failed to load voices: ${error.message || error}`;
    }
  }
}


function bindBatchGenerateUi() {
  const inputBrowseBtn = document.querySelector("#tts-batch-input-browse");
  const outputBrowseBtn = document.querySelector("#tts-batch-output-browse");

  const inputFileField = document.querySelector("#tts-batch-input-file");
  const outputFolderField = document.querySelector("#tts-batch-output-folder");



  inputBrowseBtn?.addEventListener("click", async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        title: "Select narration text file",
        filters: [
          {
            name: "Text Files",
            extensions: ["txt"]
          }
        ]
      });

      if (!selected || Array.isArray(selected)) return;

      inputFileField.value = selected;
    } catch (error) {
      console.error("Failed to select input text file:", error);
    }
  });

  outputBrowseBtn?.addEventListener("click", async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: true,
        title: "Select output folder"
      });

      if (!selected || Array.isArray(selected)) return;

      outputFolderField.value = selected;
    } catch (error) {
      console.error("Failed to select output folder:", error);
    }
  });
}
async function handleSingleGenerate() {
  const text = document.querySelector("#tts-input-text")?.value?.trim();
  const voice = document.querySelector("#tts-voice")?.value;
  const speedSlider = document.querySelector("#tts-speed");
  const speed = Number(speedSlider?.value || 1.0);
  const removeSilence = document.querySelector("#tts-remove-silence")?.checked;
  const format = document.querySelector("#tts-format")?.value || "wav";

  if (!text) {
    setGenerationProgress(0, "Please enter text first.");
    return;
  }

  if (!voice) {
    setGenerationProgress(0, "Please select a voice.");
    return;
  }

  const tempOutput = await getPreviewOutputPath(format);

  try {
    ttsState.isGenerating = true;

    console.log("Generating with speed:", speed);
    setGenerationProgress(20, `Preparing generation... Speed: ${speed.toFixed(1)}x`);

    const progressTimer = startIndeterminateProgress();

    const result = await generateSingleAudio({
      text,
      voice,
      speed,
      output: tempOutput,
      removeSilence,
      format
    });

    stopIndeterminateProgress(progressTimer);
    setGenerationProgress(100, `Audio generated successfully. Speed: ${speed.toFixed(1)}x`);

    ttsState.lastGeneratedAudioPath = result.output_path;
    loadGeneratedAudioIntoPlayer(result.output_path);
  } catch (error) {
    console.error("Failed to generate single audio:", error);
    setGenerationProgress(0, `Generation failed: ${error.message || error}`);
  } finally {
    ttsState.isGenerating = false;
  }
}

async function handleSaveAudio() {
  if (!ttsState.lastGeneratedAudioPath) {
    setGenerationProgress(0, "No generated audio to save yet.");
    return;
  }

  try {
    const format = document.querySelector("#tts-format")?.value || "wav";

    let targetPath = await save({
      title: "Save generated audio",
      defaultPath: `generated_audio.${format}`
    });

    if (!targetPath || Array.isArray(targetPath)) {
      return;
    }

    if (!targetPath.toLowerCase().endsWith(`.${format}`)) {
      targetPath = `${targetPath}.${format}`;
    }

    console.log("Saving from:", ttsState.lastGeneratedAudioPath);
    console.log("Saving to:", targetPath);

    await copyFile(ttsState.lastGeneratedAudioPath, targetPath);

    setGenerationProgress(100, `Audio saved to: ${targetPath}`);
  } catch (error) {
    console.error("Failed to save audio:", error);
    setGenerationProgress(0, `Save failed: ${error.message || error}`);
  }
}

function loadGeneratedAudioIntoPlayer(filePath) {
  const audioUrl = `${convertFileSrc(filePath)}?t=${Date.now()}`;

  const toggleBtn = document.querySelector("#tts-audio-toggle-btn");
  const seek = document.querySelector("#tts-audio-seek");
  const time = document.querySelector("#tts-audio-time");

  if (ttsState.audioElement) {
    ttsState.audioElement.pause();
    ttsState.audioElement.src = "";
  }

  const audio = new Audio();
  audio.preload = "auto";
  audio.src = audioUrl;
  audio.load();

  ttsState.audioElement = audio;

  let audioReady = false;

  if (toggleBtn) toggleBtn.textContent = "Play";
  if (seek) seek.value = 0;
  if (time) time.textContent = "00:00 / 00:00";

  audio.addEventListener("loadedmetadata", () => {
    audioReady = true;
    updateAudioTime();
    if (seek) seek.value = 0;
    console.log("Audio metadata loaded:", audio.duration);
  });

  audio.addEventListener("canplaythrough", () => {
    audioReady = true;
    setGenerationProgress(100, "Audio generated and ready for playback.");
  });

  audio.addEventListener("timeupdate", () => {
    if (seek && audio.duration) {
      seek.value = String((audio.currentTime / audio.duration) * 100);
    }
    updateAudioTime();
  });

  audio.addEventListener("ended", () => {
    if (toggleBtn) toggleBtn.textContent = "Play";
    if (seek) seek.value = 100;
    updateAudioTime();
  });

  audio.addEventListener("error", (event) => {
    console.error("Audio load/playback error:", event, audio.src);

    if (!audioReady && audio.readyState === 0) {
      setGenerationProgress(0, "Failed to load generated audio for playback.");
    }
  });

  function updateAudioTime() {
    if (!time) return;
    time.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration || 0)}`;
  }
}

function setGenerationProgress(percent, text) {
  const fill = document.querySelector("#tts-progress-fill");
  const label = document.querySelector("#tts-progress-text");

  if (fill) fill.style.width = `${percent}%`;
  if (label) label.textContent = text;
}

function startIndeterminateProgress() {
  let value = 20;

  return setInterval(() => {
    if (!ttsState.isGenerating) return;

    value += 8;
    if (value > 85) value = 35;

    setGenerationProgress(value, "Generating audio...");
  }, 300);
}

function stopIndeterminateProgress(timer) {
  clearInterval(timer);
}

async function handleBatchGenerate() {
  const inputPath = document.querySelector("#tts-batch-input-file")?.value;
  const outputDir = document.querySelector("#tts-batch-output-folder")?.value;
  const voice = document.querySelector("#tts-voice")?.value;
  const speedSlider = document.querySelector("#tts-speed");
  const speed = Number(speedSlider?.value || 1.0);
  const removeSilence = document.querySelector("#tts-remove-silence")?.checked;
  const format = document.querySelector("#tts-format")?.value || "wav";

  const log = document.querySelector("#tts-batch-log");

  if (!inputPath || !outputDir) {
    log.textContent = "Please select input file and output folder.";
    return;
  }

  try {
    log.textContent = "Generating batch audio...";

    const result = await generateBatchAudio({
      inputTxt: inputPath,
      outputDir,
      voice,
      speed,
      removeSilence,
      format
    });

    log.textContent = `Generated ${result.count} files`;
  } catch (error) {
    console.error(error);
    log.textContent = `Error: ${error.message}`;
  }
}

async function toggleAudioPlayback() {
  const audio = ttsState.audioElement;
  const toggleBtn = document.querySelector("#tts-audio-toggle-btn");

  if (!audio) {
    setGenerationProgress(0, "No generated audio loaded.");
    return;
  }

  try {
    if (audio.paused) {
      await audio.play();
      if (toggleBtn) toggleBtn.textContent = "Pause";
    } else {
      audio.pause();
      if (toggleBtn) toggleBtn.textContent = "Play";
    }
  } catch (error) {
    console.error("Playback failed:", error);
    setGenerationProgress(0, "Playback failed.");
  }
}

async function replayAudio() {
  const audio = ttsState.audioElement;
  const toggleBtn = document.querySelector("#tts-audio-toggle-btn");

  if (!audio) {
    setGenerationProgress(0, "No generated audio loaded.");
    return;
  }

  try {
    audio.pause();
    audio.currentTime = 0;
    await audio.play();
    if (toggleBtn) toggleBtn.textContent = "Pause";
  } catch (error) {
    console.error("Replay failed:", error);
    setGenerationProgress(0, "Replay failed.");
  }
}

function seekAudio(event) {
  const audio = ttsState.audioElement;
  if (!audio || !audio.duration) return;

  const percent = Number(event.target.value);
  audio.currentTime = (percent / 100) * audio.duration;
}

function formatTime(seconds) {
  const safe = Math.floor(seconds || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function updateBatchProgress(current, total, fileName) {
  const fill = document.querySelector("#tts-batch-progress-fill");
  const text = document.querySelector("#tts-batch-progress-text");

  const percent = total > 0 ? (current / total) * 100 : 0;

  if (fill) fill.style.width = `${percent}%`;
  if (text) text.textContent = `Generating ${current}/${total}: ${fileName}`;
}

function finishBatchProgress(count) {
  const fill = document.querySelector("#tts-batch-progress-fill");
  const text = document.querySelector("#tts-batch-progress-text");

  if (fill) fill.style.width = "100%";
  if (text) text.textContent = `Done. Generated ${count} files.`;
}

function appendBatchLog(message) {
  const log = document.querySelector("#tts-batch-log");
  if (!log) return;
  log.textContent += `${message}\n`;
  log.scrollTop = log.scrollHeight;
}
