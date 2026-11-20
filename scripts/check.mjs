// Verificações rodadas no CI e antes de publicar.
// 1) sintaxe dos scripts  2) versões iguais em app.js e sw.js  3) nenhum arquivo de dados no repositório
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let fail = false;
const err = m => { console.error("✗ " + m); fail = true; };

for (const f of ["app/app.js", "app/sw.js"]) {
  try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); console.log("✓ sintaxe " + f); }
  catch (e) { err(`erro de sintaxe em ${f}\n${e.stderr}`); }
}

const appV = /const APP_VERSION = "([^"]+)"/.exec(readFileSync("app/app.js", "utf8"))?.[1];
const swV = /const VERSION = "([^"]+)"/.exec(readFileSync("app/sw.js", "utf8"))?.[1];
if (!appV || appV !== swV) err(`APP_VERSION (${appV}) e VERSION do sw.js (${swV}) precisam ser iguais`);
else console.log("✓ versão " + appV);

const ALLOWED_JSON = new Set(["package.json", "package-lock.json"]);
const FORBIDDEN = /(backup|dados|conflito|export|lancamentos)[^/]*\.(json|csv)$|\.(csv|xlsx)$/i;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if ([".git", "node_modules", "test-results", "playwright-report"].includes(name)) continue;
    const p = join(dir, name); const st = statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (FORBIDDEN.test(name)) err(`arquivo com cara de dados financeiros: ${p}`);
    if (name.endsWith(".json") && !ALLOWED_JSON.has(name)) err(`JSON não permitido no repositório: ${p}`);
    if (st.size > 1024 * 1024) err(`arquivo grande demais (>1 MB): ${p}`);
  }
}
walk(".");
if (fail) process.exit(1);
console.log("✓ nenhum arquivo de dados no repositório");
