const { open } = window.__TAURI__.dialog;
const { convertFileSrc } = window.__TAURI__.core;
import { exportPanelsInWorkspaceOrder } from "../../services/panel-export-service.js";
import { exportNarrationInWorkspaceOrder } from "../../services/narration-export-service.js";



let currentZoom = 1;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.15;

let panX = 0;
let panY = 0;
let panels = [];

export function renderHomeScreen(container) {
  container.innerHTML = `
  <main class="home-page">
    <header class="top-toolbar">
      <button class="toolbar-btn" id="load-chapter-btn">Load Chapter & Review Panel</button>
      <button class="toolbar-btn" id="export-panels-btn">Export Panels</button>
      <button class="toolbar-btn" id="export-narration-btn">Export Narration</button>
      <button class="toolbar-btn" id="kokoro-tts-btn">Kokoro-TTS</button>
      <button class="toolbar-btn">Video Compositor</button>
    </header>

    <section class="workspace-shell">
      <div class="workspace-canvas" id="workspace-canvas">
        <div class="workspace-placeholder" id="workspace-placeholder">
          <h2 class="workspace-title">Workspace</h2>
          <p class="workspace-hint">
            Imported chapter images and generated text will appear here.
          </p>
        </div>
      </div>
    </section>

  <div class="image-dialog hidden" id="image-dialog">
  <div class="image-dialog-header" id="image-dialog-header">
    <span class="image-dialog-title" id="image-dialog-title">Preview</span>
    <button class="image-dialog-close" id="image-dialog-close">×</button>
  </div>

  <div class="image-dialog-body" id="image-dialog-body">
    <div class="image-dialog-stage" id="image-dialog-stage">
      <img class="image-dialog-preview" id="image-dialog-preview" alt="Preview" />
    </div>
  </div>

  <div class="image-dialog-footer" id="image-dialog-caption"></div>

  <div class="image-dialog-resizer" id="image-dialog-resizer"></div>
</div>
  </main>
`;

  bindHomeScreenEvents(container);
}







function bindHomeScreenEvents(container) {
  const loadButton = container.querySelector("#load-chapter-btn");
  const dialogClose = container.querySelector("#image-dialog-close");
  const exportPanelsButton = container.querySelector("#export-panels-btn");
  const exportNarrationButton = container.querySelector("#export-narration-btn");
  const kokoroTtsButton = container.querySelector("#kokoro-tts-btn");

  dialogClose?.addEventListener("click", closeImageDialog);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeImageDialog();
    }
  });

  if (loadButton) {
    loadButton.addEventListener("click", async () => {
      try {
        const selected = await open({
          multiple: true,
          directory: false,
          title: "Select chapter images",
          filters: [
            { name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }
          ]
        });

        if (!selected || !Array.isArray(selected) || selected.length === 0) {
          return;
        }

        const sortedPaths = [...selected].sort((a, b) =>
          getFileName(a).localeCompare(getFileName(b), undefined, {
            numeric: true,
            sensitivity: "base"
          })
        );

        panels = sortedPaths.map((imagePath) => ({
          id: crypto.randomUUID(),
          path: imagePath,
          fileName: getFileName(imagePath),
          text: ""
        }));

        renderPanels(container);
      } catch (error) {
        console.error("Failed to load chapter images:", error);
      }
    });
  }


  if (exportPanelsButton) {
    exportPanelsButton.addEventListener("click", async () => {
      try {
        await exportPanelsInWorkspaceOrder(panels);
      } catch (error) {
        console.error("Failed to export panels:", error);
        alert("Failed to export panels. Check console for details.");
      }
    });
  }

  if (kokoroTtsButton) {
    kokoroTtsButton.addEventListener("click", async () => {
      await openKokoroTtsWindow();
    });
  }
  if (exportNarrationButton) {
    exportNarrationButton.addEventListener("click", async () => {
      try {
        await exportNarrationInWorkspaceOrder(panels);
      } catch (error) {
        console.error("Failed to export narration:", error);
        alert("Failed to export narration. Check console for details.");
      }
    });
  }


  makeDialogDraggable();
  makeDialogResizable();
  enablePreviewZoom();
  enablePreviewPan();
}

async function openKokoroTtsWindow() {
  const { webviewWindow } = window.__TAURI__;

  const existing = await webviewWindow.WebviewWindow.getByLabel("kokoro-tts");

  if (existing) {
    await existing.setFocus();
    return;
  }

  const ttsWindow = new webviewWindow.WebviewWindow("kokoro-tts", {
    title: "Kokoro-TTS",
    url: "tts.html",
    width: 1000,
    height: 760,
    resizable: true,
    center: true
  });

  ttsWindow.once("tauri://created", () => {
    console.log("Kokoro-TTS window created");
  });

  ttsWindow.once("tauri://error", (e) => {
    console.error("Failed to create Kokoro-TTS window", e);
  });
}


function renderPanels(container) {
  const workspace = container.querySelector("#workspace-canvas");
  const placeholder = container.querySelector("#workspace-placeholder");
  if (!workspace) return;

  placeholder?.remove();
  workspace.querySelector(".image-grid")?.remove();

  const grid = document.createElement("div");
  grid.className = "image-grid";

  panels.forEach((panel, index) => {
    const item = document.createElement("div");
    item.className = "image-card";

    const label = document.createElement("div");
    label.className = "image-label";
    label.textContent = `${index + 1}. ${panel.fileName}`;

    const frame = document.createElement("div");
    frame.className = "image-thumb-frame";

    const img = document.createElement("img");
    img.className = "image-preview";
    img.alt = panel.fileName;
    img.loading = "lazy";
    img.src = convertFileSrc(panel.path);

    img.addEventListener("click", () => {
      openImageDialog(panel.path, panel.fileName);
    });

    img.onerror = () => {
      console.error("Image failed to load:", panel.path, img.src);
    };

    frame.appendChild(img);

    const editorArea = document.createElement("div");
    editorArea.className = "panel-editor";

    const textarea = document.createElement("textarea");
    textarea.className = "panel-textarea";
    textarea.placeholder = "Write narration / dialogue for this panel...";
    textarea.value = panel.text || "";

    textarea.addEventListener("input", (event) => {
      updatePanelText(panel.id, event.target.value);
    });

    editorArea.appendChild(textarea);

    const actions = document.createElement("div");
    actions.className = "panel-actions";

    const moveUpBtn = document.createElement("button");
    moveUpBtn.className = "panel-action-btn";
    moveUpBtn.textContent = "Move Up";
    moveUpBtn.disabled = index === 0;
    moveUpBtn.addEventListener("click", () => {
      movePanelUp(container, index);
    });

    const moveDownBtn = document.createElement("button");
    moveDownBtn.className = "panel-action-btn";
    moveDownBtn.textContent = "Move Down";
    moveDownBtn.disabled = index === panels.length - 1;
    moveDownBtn.addEventListener("click", () => {
      movePanelDown(container, index);
    });

    const insertBtn = document.createElement("button");
    insertBtn.className = "panel-action-btn";
    insertBtn.textContent = "Insert After";
    insertBtn.addEventListener("click", () => {
      insertPanelAfter(container, index);
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "panel-action-btn danger";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      removePanel(container, panel.id);
    });

    actions.appendChild(moveUpBtn);
    actions.appendChild(moveDownBtn);
    actions.appendChild(insertBtn);
    actions.appendChild(removeBtn);

    item.appendChild(label);
    item.appendChild(frame);
    item.appendChild(editorArea);
    item.appendChild(actions);

    grid.appendChild(item);
  });

  workspace.appendChild(grid);
}


function movePanelUp(container, index) {
  if (index <= 0) return;

  [panels[index - 1], panels[index]] = [panels[index], panels[index - 1]];
  renderPanels(container);
}

function movePanelDown(container, index) {
  if (index >= panels.length - 1) return;

  [panels[index], panels[index + 1]] = [panels[index + 1], panels[index]];
  renderPanels(container);
}


function removePanel(container, panelId) {
  panels = panels.filter((panel) => panel.id !== panelId);
  renderPanels(container);
}

async function insertPanelAfter(container, index) {
  try {
    const selected = await open({
      multiple: true,
      directory: false,
      title: "Insert panel after selected item",
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }
      ]
    });

    if (!selected || !Array.isArray(selected) || selected.length === 0) {
      return;
    }

    const newPanels = [...selected]
      .sort((a, b) =>
        getFileName(a).localeCompare(getFileName(b), undefined, {
          numeric: true,
          sensitivity: "base"
        })
      )
      .map((imagePath) => ({
        id: crypto.randomUUID(),
        path: imagePath,
        fileName: getFileName(imagePath),
        text: ""

      }));

    panels.splice(index + 1, 0, ...newPanels);
    renderPanels(container);
  } catch (error) {
    console.error("Failed to insert panel:", error);
  }
}

function updatePanelText(panelId, value) {
  const panel = panels.find((item) => item.id === panelId);
  if (!panel) return;

  panel.text = value;
}

function getFileName(filePath) {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}


function openImageDialog(imagePath, fileName) {
  const dialog = document.querySelector("#image-dialog");
  const preview = document.querySelector("#image-dialog-preview");
  const caption = document.querySelector("#image-dialog-caption");
  const title = document.querySelector("#image-dialog-title");

  if (!dialog || !preview || !caption || !title) return;

  preview.src = convertFileSrc(imagePath);
  caption.textContent = fileName;
  title.textContent = fileName;

  currentZoom = 1;
  panX = 0;
  panY = 0;
  applyPreviewTransform();

  dialog.classList.remove("hidden");
}


function closeImageDialog() {
  const dialog = document.querySelector("#image-dialog");
  const preview = document.querySelector("#image-dialog-preview");

  if (!dialog || !preview) return;

  dialog.classList.add("hidden");
  preview.src = "";

  currentZoom = 1;
  panX = 0;
  panY = 0;
}


function enablePreviewZoom() {
  const body = document.querySelector("#image-dialog-body");
  if (!body) return;

  body.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey) return;

      event.preventDefault();

      if (event.deltaY < 0) {
        currentZoom += ZOOM_STEP;
      } else {
        currentZoom -= ZOOM_STEP;
      }

      currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom));

      // when zoomed out or back to normal, recenter image
      if (currentZoom <= 1) {
        panX = 0;
        panY = 0;
      }

      applyPreviewTransform();
    },
    { passive: false }
  );
}

function enablePreviewPan() {
  const preview = document.querySelector("#image-dialog-preview");
  if (!preview) return;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startPanX = 0;
  let startPanY = 0;

  preview.addEventListener("mousedown", (event) => {
    // only left mouse button
    if (event.button !== 0) return;

    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startPanX = panX;
    startPanY = panY;

    preview.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    event.preventDefault();
  });

  window.addEventListener("mousemove", (event) => {
    if (!isDragging) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    panX = startPanX + dx;
    panY = startPanY + dy;

    applyPreviewTransform();
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;

    isDragging = false;
    preview.style.cursor = "grab";
    document.body.style.userSelect = "";
  });
}

function applyPreviewTransform() {
  const preview = document.querySelector("#image-dialog-preview");
  if (!preview) return;

  if (currentZoom <= 1) {
    panX = 0;
    panY = 0;
  }

  preview.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  preview.style.cursor = "grab";
}

function makeDialogDraggable() {
  const dialog = document.querySelector("#image-dialog");
  const header = document.querySelector("#image-dialog-header");

  if (!dialog || !header) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header.addEventListener("mousedown", (e) => {
    dragging = true;

    const rect = dialog.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;

    let left = e.clientX - offsetX;
    let top = e.clientY - offsetY;

    const maxLeft = window.innerWidth - dialog.offsetWidth;
    const maxTop = window.innerHeight - dialog.offsetHeight;

    left = Math.max(0, Math.min(left, maxLeft));
    top = Math.max(0, Math.min(top, maxTop));

    dialog.style.left = `${left}px`;
    dialog.style.top = `${top}px`;
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;

    dragging = false;
    document.body.style.userSelect = "";
  });
}

function makeDialogResizable() {
  const dialog = document.querySelector("#image-dialog");
  const resizer = document.querySelector("#image-dialog-resizer");

  if (!dialog || !resizer) return;

  let isResizing = false;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;

  resizer.addEventListener("mousedown", (event) => {
    isResizing = true;
    startX = event.clientX;
    startY = event.clientY;
    startWidth = dialog.offsetWidth;
    startHeight = dialog.offsetHeight;

    event.preventDefault();
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (event) => {
    if (!isResizing) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    const newWidth = Math.max(420, startWidth + dx);
    const newHeight = Math.max(320, startHeight + dy);

    dialog.style.width = `${newWidth}px`;
    dialog.style.height = `${newHeight}px`;
  });

  document.addEventListener("mouseup", () => {
    if (!isResizing) return;

    isResizing = false;
    document.body.style.userSelect = "";
  });
}