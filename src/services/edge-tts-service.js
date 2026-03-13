const { Command } = window.__TAURI__.shell;

function getWorkerPath() {
  return "../worker/edge_main.py";
}

function parseWorkerJson(result) {
  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();

  console.log("Edge worker stdout:", stdout);
  console.log("Edge worker stderr:", stderr);

  if (!stdout) {
    throw new Error(
      stderr
        ? `Python worker returned no stdout. stderr: ${stderr}`
        : "Python worker returned empty output."
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Invalid JSON from worker. stdout: ${stdout}`);
  }

  if (!parsed.ok) {
    throw new Error(parsed.error || "Worker returned an unknown error.");
  }

  return parsed;
}

export async function listEdgeVoices({ language = "en" } = {}) {
  const command = Command.create("python-worker", [
    "-u",
    getWorkerPath(),
    "list-voices",
    "--language",
    language
  ]);

  const result = await command.execute();
  return parseWorkerJson(result);
}

export async function generateSingleEdgeAudio({
  language = "en",
  text,
  voice,
  rate,
  pitch,
  volume,
  output,
  removeSilence,
  format
}) {
  const args = [
    "-u",
    getWorkerPath(),
    "generate-single",
    "--language",
    language,
    "--text",
    text,
    "--voice",
    voice,
    "--rate",
    rate,
    "--pitch",
    pitch,
    "--volume",
    volume,
    "--output",
    output,
    "--format",
    format
  ];

  if (removeSilence) {
    args.push("--remove-silence");
  }

  const command = Command.create("python-worker", args);
  const result = await command.execute();
  return parseWorkerJson(result);
}

export async function generateBatchEdgeAudio({
  language = "en",
  inputTxt,
  outputDir,
  voice,
  rate,
  pitch,
  volume,
  removeSilence,
  format
}) {
  const args = [
    "-u",
    getWorkerPath(),
    "generate-batch",
    "--language",
    language,
    "--input-txt",
    inputTxt,
    "--output-dir",
    outputDir,
    "--voice",
    voice,
    "--rate",
    rate,
    "--pitch",
    pitch,
    "--volume",
    volume,
    "--format",
    format
  ];

  if (removeSilence) {
    args.push("--remove-silence");
  }

  const command = Command.create("python-worker", args);
  const result = await command.execute();
  return parseWorkerJson(result);
}
