const { open } = window.__TAURI__.dialog;
const { readFile, writeFile } = window.__TAURI__.fs;
const { join } = window.__TAURI__.path;

export async function exportPanelsInWorkspaceOrder(panels) {
  if (!panels.length) {
    alert("There are no panels to export.");
    return;
  }

  const destination = await open({
    directory: true,
    multiple: false,
    title: "Choose export folder"
  });

  if (!destination || Array.isArray(destination)) {
    return;
  }

  const baseNameInput = window.prompt(
    "Enter base filename for exported panels:",
    "panel_"
  );

  if (!baseNameInput) return;

  const baseName = baseNameInput.trim();

  if (!baseName) {
    alert("Base filename cannot be empty.");
    return;
  }

  for (let index = 0; index < panels.length; index++) {
    const panel = panels[index];

    const extension = getFileExtension(panel.fileName);
    const numberedName = `${baseName}${String(index).padStart(3, "0")}.${extension}`;

    const targetPath = await join(destination, numberedName);
    const fileBytes = await readFile(panel.path);

    await writeFile(targetPath, fileBytes);
  }

  alert(`Exported ${panels.length} panels successfully.`);
}

function getFileExtension(fileName) {
  const parts = fileName.split(".");
  if (parts.length < 2) return "png";
  return parts.pop().toLowerCase();
}