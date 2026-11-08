import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const LIMIT = 5 * 1024 * 1024; // 5 MB, far below Cloudflare's 25 MiB limit
const big = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (s.size > LIMIT) big.push(`${p} (${(s.size / 1048576).toFixed(1)} MB)`);
  }
}

try {
  walk("public");
} catch {}

if (big.length) {
  console.error("\nBUILD STOPPED. These files in public/ are too large:");
  big.forEach((b) => console.error("  - " + b));
  console.error("\nCloudflare rejects files over 25 MiB. Shrink them first.\n");
  process.exit(1);
}
console.log("public/ file sizes OK");