import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { translateSpec } from "./lib/openapi.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(repoRoot, "api-reference", "openapi.json");
const DICTIONARY = join(repoRoot, "api-reference", "openapi.en.strings.json");
const OUT = join(repoRoot, "api-reference", "openapi.en.json");

export function writeEnglishSpec(spec) {
  const dictionary = JSON.parse(readFileSync(DICTIONARY, "utf8"));
  const { spec: translated, missing } = translateSpec(spec, dictionary);
  // Minificado pelo mesmo motivo do openapi.json (ver import-openapi.mjs).
  writeFileSync(OUT, JSON.stringify(translated) + "\n");
  console.log(`✓ Escrito em: ${OUT}`);
  if (missing.length > 0) {
    console.warn(`⚠ ${missing.length} texto(s) sem tradução em ${DICTIONARY} (ficaram em português):`);
    for (const text of missing) console.warn(`  - ${JSON.stringify(text)}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    writeEnglishSpec(JSON.parse(readFileSync(SOURCE, "utf8")));
  } catch (err) {
    console.error(`✗ Falha ao gerar o spec em inglês: ${err.message}`);
    process.exit(1);
  }
}
