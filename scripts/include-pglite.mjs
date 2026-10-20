import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "node_modules/@electric-sql/pglite/dist");
const funcDir = join(root, ".vercel/output/functions/__server.func");
const names = ["pglite.data", "pglite.wasm", "initdb.wasm"];

if (!existsSync(funcDir)) {
  console.log("[pglite] no server function yet, skip");
  process.exit(0);
}

const dest = join(funcDir, "pglite");
mkdirSync(dest, { recursive: true });
for (const name of names) {
  cpSync(join(dist, name), join(dest, name));
}
console.log("[pglite] copied data and wasm into the server function");
