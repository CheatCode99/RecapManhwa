renderKokoroTtsWindow();
bindBatchGenerateUi();


const { open } = window.__TAURI__.dialog;


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
            <label class="tts-slider-label">Rate</label>
            <input type="range" min="-50" max="100" value="0" id="tts-rate" />
            <span class="tts-slider-value" id="tts-rate-value">+0%</span>
          </div>

          <div class="tts-slider-row">
            <label class="tts-slider-label">Pitch</label>
            <input type="range" min="-12" max="12" value="0" id="tts-pitch" />
            <span class="tts-slider-value" id="tts-pitch-value">+0Hz</span>
          </div>

          <div class="tts-slider-row">
            <label class="tts-slider-label">Volume</label>
            <input type="range" min="-100" max="100" value="0" id="tts-volume" />
            <span class="tts-slider-value" id="tts-volume-value">+0%</span>
          </div>

          <div class="tts-options-row">
            <label class="tts-checkbox-row">
              <input type="checkbox" id="tts-remove-silence" />
              <span>Remove Silence</span>
            </label>

            <div class="tts-output-format">
              <span>Output Format:</span>
              <select class="tts-small-input" id="tts-format">
                <option value="mp3">mp3</option>
                <option value="wav">wav</option>
              </select>
            </div>
          </div>
        </section>

        <section class="tts-section">
         <div class="tts-tab-row">
  <button class="tts-tab active" id="tts-single-tab">Single Generate</button>
  <button class="tts-tab" id="tts-batch-tab">Batch Generate</button>
</div>

<!-- SINGLE GENERATE PANEL -->
<div class="tts-mode-panel" id="tts-single-panel">

  <div class="tts-field">
    <label class="tts-label">Input Text</label>
    <textarea class="tts-textarea" id="tts-input-text"></textarea>
  </div>

  <div class="tts-action-row">
    <button class="tts-primary-btn" id="tts-generate-btn">Generate Audio</button>
    <button class="tts-secondary-btn" id="tts-play-btn">Play Audio</button>
    <button class="tts-secondary-btn" id="tts-save-btn">Save Audio</button>
  </div>

</div>


<!-- BATCH GENERATE PANEL -->
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
   
  </div>
 <br>

  <div class="tts-log-area" id="tts-batch-log"></div>

</div>
        </section>
      </section>
    </main>
  `;

    bindTtsUi();
    bindBatchGenerateUi();
}

function bindTtsUi() {
    const singleTab = document.querySelector("#tts-single-tab");
    const batchTab = document.querySelector("#tts-batch-tab");

    const singlePanel = document.querySelector("#tts-single-panel");
    const batchPanel = document.querySelector("#tts-batch-panel");

    singleTab?.addEventListener("click", () => {

        singleTab.classList.add("active");
        batchTab.classList.remove("active");

        singlePanel.classList.remove("hidden");
        batchPanel.classList.add("hidden");

    });

    batchTab?.addEventListener("click", () => {

        batchTab.classList.add("active");
        singleTab.classList.remove("active");

        batchPanel.classList.remove("hidden");
        singlePanel.classList.add("hidden");

    });


    rate?.addEventListener("input", () => {
        rateValue.textContent = `${Number(rate.value) >= 0 ? "+" : ""}${rate.value}%`;
    });

    pitch?.addEventListener("input", () => {
        pitchValue.textContent = `${Number(pitch.value) >= 0 ? "+" : ""}${pitch.value}Hz`;
    });

    volume?.addEventListener("input", () => {
        volumeValue.textContent = `${Number(volume.value) >= 0 ? "+" : ""}${volume.value}%`;
    });

    document.querySelector("#tts-generate-btn")?.addEventListener("click", () => {
        console.log("Generate Audio clicked");
    });

    document.querySelector("#tts-play-btn")?.addEventListener("click", () => {
        console.log("Play Audio clicked");
    });

    document.querySelector("#tts-save-btn")?.addEventListener("click", () => {
        console.log("Save Audio clicked");
    });
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