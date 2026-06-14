import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSpec, withServers, pickLatestExport } from "./lib/openapi.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(repoRoot, "api-reference", "openapi.json");

function resolveSource(arg) {
  if (arg) return arg;
  const downloads = join(homedir(), "Downloads");
  const entries = readdirSync(downloads).map((name) => ({
    name,
    mtimeMs: statSync(join(downloads, name)).mtimeMs,
  }));
  const latest = pickLatestExport(entries);
  if (!latest) {
    throw new Error(
      `Nenhum arquivo api*.json encontrado em ${downloads}. ` +
        `Passe o caminho do export como argumento: npm run import:openapi -- /caminho/api.json`,
    );
  }
  return join(downloads, latest);
}

function main() {
  const source = resolveSource(process.argv[2]);
  const spec = JSON.parse(readFileSync(source, "utf8"));
  validateSpec(spec);
  const withUrl = withServers(spec);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(withUrl, null, 2) + "\n");
  const pathCount = Object.keys(spec.paths).length;
  console.log(`✓ Importado de: ${source}`);
  console.log(`✓ servers definido para: ${withUrl.servers[0].url}`);
  console.log(`✓ Escrito em: ${OUT} (${pathCount} paths)`);
}

try {
  main();
} catch (err) {
  console.error(`✗ Falha no import: ${err.message}`);
  process.exit(1);
}
