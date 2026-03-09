const { open } = window.__TAURI__.dialog;
const { writeTextFile } = window.__TAURI__.fs;
const { join } = window.__TAURI__.path;

export async function exportNarrationInWorkspaceOrder(panels) {
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
    "Enter filename for narration export:",
    "narration"
  );

  if (!baseNameInput) {
    return;
  }

  const baseName = baseNameInput.trim();

  if (!baseName) {
    alert("Filename cannot be empty.");
    return;
  }

  const outputName = `${baseName}.txt`;
  const targetPath = await join(destination, outputName);

  const textBlocks = panels
    .map((panel) => normalizePanelText(panel.text || ""))
    .filter((text) => text.length > 0)

  const finalText = textBlocks.join("\n");

  await writeTextFile(targetPath, finalText);

  alert(`Narration exported successfully:\n${outputName}`);
}
function normalizePanelText(text) {
  return text
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}