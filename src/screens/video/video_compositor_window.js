import {
  loadImageFolderFiles,
  loadAudioFolderFiles,
  validateAndBuildPairs
} from "../../services/video-compositor-service.js";
import { generateBatchVideos } from "../../services/video-compositor-render-service.js";

const { open } = window.__TAURI__.dialog;

const compositorState = {
  imageFolder: "",
  audioFolder: "",
  imageFiles: [],
  audioFiles: [],
  pairs: []
};

renderVideoCompositorWindow();

function renderVideoCompositorWindow() {
  const app = document.querySelector("#app");
  if (!app) return;

  app.innerHTML = `
<main class="vc-page">
  <div class="vc-layout">

    <section class="vc-left">

      <!-- LOAD MEDIA -->
      <section class="vc-card">
        <h2 class="vc-section-title">1. Load Media</h2>

        <div class="vc-load-row">
          <button class="vc-primary-btn" id="vc-load-image-folder">Load Image Folder</button>
          <span class="vc-status-text" id="vc-image-folder-status">No images loaded</span>
        </div>

        <div class="vc-load-row">
          <button class="vc-primary-btn" id="vc-load-audio-folder">Load Audio Folder</button>
          <span class="vc-status-text" id="vc-audio-folder-status">No audio loaded</span>
        </div>
      </section>


      <!-- ANIMATION OPTIONS -->
      <section class="vc-card">
        <h2 class="vc-section-title">2. Animation Options</h2>

        <div class="vc-animation-grid">

          <label class="vc-checkbox-row">
            <input type="checkbox" id="vc-anim-zoom-in"checked>
            <span>Zoom In</span>
          </label>

          <label class="vc-checkbox-row">
            <input type="checkbox" id="vc-anim-zoom-out"checked>
            <span>Zoom Out</span>
          </label>

          <label class="vc-checkbox-row">
            <input type="checkbox" id="vc-anim-pan-left"checked>
            <span>Pan Left</span>
          </label>

          <label class="vc-checkbox-row">
            <input type="checkbox" id="vc-anim-pan-right" checked>
            <span>Pan Right</span>
          </label>

          <label class="vc-checkbox-row">
            <input type="checkbox" id="vc-anim-pan-up"checked>
            <span>Pan Up</span>
          </label>

          <label class="vc-checkbox-row">
            <input type="checkbox" id="vc-anim-pan-down"checked>
            <span>Pan Down</span>
          </label>

        </div>
      </section>


      <!-- GENERATE VIDEO -->
      <section class="vc-card">
        <div class="vc-generate-row">
          <button class="vc-generate-btn" id="vc-generate-video">Generate Video</button>
        </div>
      </section>

    </section>


    <!-- CONSOLE -->
    <section class="vc-right">
      <section class="vc-console-card">
        <h2 class="vc-console-title">Console Output</h2>
        <div class="vc-console" id="vc-console">Console output will appear here...</div>
      </section>
    </section>

  </div>
</main>
`;

  bindVideoCompositorUi();
}

function bindVideoCompositorUi() {
  document.querySelector("#vc-load-image-folder")?.addEventListener("click", async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select image folder"
      });

      if (!selected || Array.isArray(selected)) return;

      compositorState.imageFolder = selected;
      compositorState.imageFiles = await loadImageFolderFiles(selected);

      document.querySelector("#vc-image-folder-status").textContent =
        `${compositorState.imageFiles.length} image files loaded`;

      appendConsole(`Loaded image folder: ${selected}`);
      appendConsole(`Found ${compositorState.imageFiles.length} image files`);

      runValidation();
    } catch (error) {
      console.error("Failed to load image folder:", error);
      appendConsole(`Failed to load image folder: ${String(error)}`);
    }
  });

  document.querySelector("#vc-load-audio-folder")?.addEventListener("click", async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select audio folder"
      });

      if (!selected || Array.isArray(selected)) return;

      compositorState.audioFolder = selected;
      compositorState.audioFiles = await loadAudioFolderFiles(selected);

      document.querySelector("#vc-audio-folder-status").textContent =
        `${compositorState.audioFiles.length} audio files loaded`;

      appendConsole(`Loaded audio folder: ${selected}`);
      appendConsole(`Found ${compositorState.audioFiles.length} audio files`);

      runValidation();
    } catch (error) {
      console.error("Failed to load audio folder:", error);
      appendConsole(`Failed to load audio folder: ${String(error)}`);
    }
  });
document.querySelector("#vc-generate-video")?.addEventListener("click", async () => {
  try {
    if (!compositorState.imageFolder) {
      appendConsole("Cannot generate: image folder is not loaded.");
      return;
    }

    if (!compositorState.audioFolder) {
      appendConsole("Cannot generate: audio folder is not loaded.");
      return;
    }

    const validation = validateAndBuildPairs(
      compositorState.imageFiles,
      compositorState.audioFiles
    );

    if (!validation.valid) {
      appendConsole(`Cannot generate: ${validation.message}`);
      return;
    }

    compositorState.pairs = validation.pairs;

    const outputFolder = await open({
      directory: true,
      multiple: false,
      title: "Select output folder"
    });

    if (!outputFolder || Array.isArray(outputFolder)) {
      appendConsole("Generate cancelled: no output folder selected.");
      return;
    }

    const animations = getSelectedAnimations();

    if (!animations.length) {
      appendConsole("Cannot generate: no animation options selected.");
      return;
    }

    appendConsole("Preparing video generation job...");
    appendConsole(`Output folder: ${outputFolder}`);
    appendConsole(`Pairs ready: ${compositorState.pairs.length}`);
    appendConsole(`Animations enabled: ${animations.join(", ")}`);

    const result = await generateBatchVideos({
      imageDir: compositorState.imageFolder,
      audioDir: compositorState.audioFolder,
      outputDir: outputFolder,
      animations,
      onProgress: (msg) => {
        updateVideoProgress(msg.current, msg.total);
      },
      onLog: (line) => {
        appendConsole(line);
      }
    });

    appendConsole(`Done. Generated ${result.count} video files.`);
    appendConsole("Process complete.");


    
  } catch (error) {
    console.error("Failed to generate videos:", error);
    appendConsole(`Failed to generate videos: ${String(error.message || error)}`);
  }
});
}

function runValidation() {
  if (!compositorState.imageFiles.length || !compositorState.audioFiles.length) {
    return;
  }

  const validation = validateAndBuildPairs(
    compositorState.imageFiles,
    compositorState.audioFiles
  );

  compositorState.pairs = validation.pairs;

  appendConsole(validation.message);
}

function appendConsole(message) {
  const consoleBox = document.querySelector("#vc-console");
  if (!consoleBox) return;

  const current = consoleBox.textContent.trim();

  consoleBox.textContent = current
    ? `${current}\n${message}`
    : message;

  consoleBox.scrollTop = consoleBox.scrollHeight;
}
function getSelectedAnimations() {
  const selected = [];

  if (document.querySelector("#vc-anim-zoom-in")?.checked) {
    selected.push("zoom_in");
  }
  if (document.querySelector("#vc-anim-zoom-out")?.checked) {
    selected.push("zoom_out");
  }
  if (document.querySelector("#vc-anim-pan-left")?.checked) {
    selected.push("pan_left_to_center");
  }
  if (document.querySelector("#vc-anim-pan-right")?.checked) {
    selected.push("pan_right_to_center");
  }
  if (document.querySelector("#vc-anim-pan-up")?.checked) {
    selected.push("pan_up_to_center");
  }
  if (document.querySelector("#vc-anim-pan-down")?.checked) {
    selected.push("pan_down_to_center");
  }

  return selected;
}

function updateVideoProgress(current, total) {
  appendConsole(`Progress: ${current}/${total}`);
}