const { Command } = window.__TAURI__.shell;

function getWorkerPath() {
  return "../worker/main.py";
}

function parseWorkerJson(result) {
  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();

  console.log("Python worker stdout:", stdout);
  console.log("Python worker stderr:", stderr);

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

export async function listKokoroVoices() {
  const command = Command.create("python-worker", [
    "-u",
    getWorkerPath(),
    "list-voices"
  ]);

  const result = await command.execute();
  return parseWorkerJson(result);
}
export async function generateSingleAudio({
  text,
  voice,
  speed,
  output,
  removeSilence,
  format
}) {
  const args = [
    "-u",
    getWorkerPath(),
    "generate-single",
    "--text",
    text,
    "--voice",
    voice,
    "--speed",
    String(speed),
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


export async function generateBatchAudio({
  inputTxt,
  outputDir,
  voice,
  speed,
  removeSilence,
  format
}) {
  const args = [
    "-u",
    getWorkerPath(),
    "generate-batch",
    "--input-txt",
    inputTxt,
    "--output-dir",
    outputDir,
    "--voice",
    voice,
    "--speed",
    String(speed),
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
