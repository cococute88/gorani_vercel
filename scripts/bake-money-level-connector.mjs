import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

// Rebuilds only the fixed connector area. The approved masters remain untouched.
// Each small patch was locally extracted from a weather/time-matched ImageGen edit.
const root = process.cwd();
const review = path.join(root, "art-review", "money-level", "weather-time");
const master = path.join(review, "assets");
const patches = path.join(review, "connector-patches");
const output = path.join(review, "docked");
const production = path.join(root, "public", "money-level", "art", "background");
mkdirSync(output, { recursive: true });

for (const time of ["morning", "day", "evening", "night"]) {
  for (const weather of ["sunny", "cloudy", "rain", "storm"]) {
    const name = `forest-${time}-${weather}`;
    const png = path.join(output, `${name}-docked.png`);
    // 280x170 patch at (892,649). Feathered ellipse restricts the edit to the
    // connector; the rest of the approved painting is sourced from the master.
    const mask = "[1:v]format=gbrap,geq=r=r(X\\,Y):g=g(X\\,Y):b=b(X\\,Y):a=255*max(0\\,min(1\\,(1-pow((X-140)/140\\,2)-pow((Y-85)/85\\,2))/.22))[patch];[0:v][patch]overlay=892:649:format=auto";
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
      "-i", path.join(master, `${name}.png`), "-i", path.join(patches, `${name}.png`),
      "-filter_complex", mask, "-frames:v", "1", png], { stdio: "inherit" });
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", png,
      "-c:v", "libwebp", "-quality", "94", "-compression_level", "6", "-frames:v", "1",
      path.join(production, `${name}-docked.webp`)], { stdio: "inherit" });
    console.log(name);
  }
}
