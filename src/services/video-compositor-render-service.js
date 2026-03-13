const { Command } = window.__TAURI__.shell;

function getWorkerPath() {
  return "../worker/video_compositor_worker.py";
}

export async function generateBatchVideos({
  imageDir,
  audioDir,
  outputDir,
  animations,
  onProgress,
  onLog
}) {
  return new Promise(async (resolve, reject) => {
    try {
      const args = [
        "-u",
        getWorkerPath(),
        "generate-batch",
        "--image-dir",
        imageDir,
        "--audio-dir",
        audioDir,
        "--output-dir",
        outputDir,
        "--animations",
        animations.join(",")
      ];

      const command = Command.create("python-worker", args);

      let finalDone = null;
      let stderrBuffer = "";

      command.stdout.on("data", (line) => {
        const text = String(line).trim();
        if (!text) return;

        try {
          const msg = JSON.parse(text);

          if (msg.type === "progress") {
            onProgress?.(msg);
            onLog?.(
              `[${msg.current}/${msg.total}] ${msg.image} + ${msg.audio} → ${msg.output} (${msg.animation})`
            );
            return;
          }

          if (msg.type === "done") {
            finalDone = msg;
            return;
          }

          if (msg.ok === false) {
            reject(new Error(msg.error || "Video worker failed."));
            return;
          }
        } catch {
          onLog?.(text);
        }
      });

      command.stderr.on("data", (line) => {
        const text = String(line).trim();
        if (!text) return;

        stderrBuffer += `${text}\n`;
        onLog?.(text);
      });

      const child = await command.spawn();
      await child.write?.("");
      const status = await child.status;

      if (status.code !== 0) {
        reject(new Error(stderrBuffer || `Video worker exited with code ${status.code}`));
        return;
      }

      if (!finalDone || !finalDone.ok) {
        reject(new Error("Video worker finished without a success payload."));
        return;
      }

      resolve(finalDone);
    } catch (error) {
      reject(error);
    }
  });
}