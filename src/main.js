console.log("main.js start");

import { renderHomeScreen } from "./screens/home/home_screen.js";

window.addEventListener("DOMContentLoaded", () => {
  try {
    console.log("DOMContentLoaded fired");

    const app = document.querySelector("#app");

    if (!app) {
      throw new Error("App root #app was not found.");
    }

    renderHomeScreen(app);
    console.log("render success");
  } catch (error) {
    console.error("Render failed:", error);
  }
});