const { readDir } = window.__TAURI__.fs;

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "ogg"];

export async function loadImageFolderFiles(folderPath) {
  const entries = await readDir(folderPath);

  const files = entries
    .filter((entry) => entry && !entry.children && isAllowedExtension(entry.name, IMAGE_EXTENSIONS))
    .map((entry) => ({
      path: entry.path,
      name: entry.name
    }));

  return naturalSortFiles(files);
}

export async function loadAudioFolderFiles(folderPath) {
  const entries = await readDir(folderPath);

  const files = entries
    .filter((entry) => entry && !entry.children && isAllowedExtension(entry.name, AUDIO_EXTENSIONS))
    .map((entry) => ({
      path: entry.path,
      name: entry.name
    }));

  return naturalSortFiles(files);
}

export function validateAndBuildPairs(imageFiles, audioFiles) {
  if (!imageFiles.length) {
    return {
      valid: false,
      message: "No image files found in selected image folder.",
      pairs: []
    };
  }

  if (!audioFiles.length) {
    return {
      valid: false,
      message: "No audio files found in selected audio folder.",
      pairs: []
    };
  }

  if (imageFiles.length !== audioFiles.length) {
    return {
      valid: false,
      message: `Image/audio count mismatch. Images: ${imageFiles.length}, Audio: ${audioFiles.length}`,
      pairs: []
    };
  }

  const pairs = imageFiles.map((image, index) => ({
    index,
    image,
    audio: audioFiles[index]
  }));

  return {
    valid: true,
    message: `Validation passed. ${pairs.length} image/audio pairs ready.`,
    pairs
  };
}

function naturalSortFiles(files) {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function isAllowedExtension(fileName, allowedExtensions) {
  if (!fileName || !fileName.includes(".")) return false;

  const ext = fileName.split(".").pop().toLowerCase();
  return allowedExtensions.includes(ext);
}