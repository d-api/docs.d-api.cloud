import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { translateSpec } from "./lib/openapi.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(join(repoRoot, path), "utf8"));

const docs = readJson("docs.json");
const language = (code) => docs.navigation.languages.find((l) => l.language === code);
const pagesOf = (lang) => lang.tabs.flatMap((tab) => tab.groups.flatMap((group) => group.pages));

const ptPages = pagesOf(language("pt-BR"));
const enPages = pagesOf(language("en"));
const DOC_ROOTS = ["whatsapp", "sms", "ura", "api-reference"];

test("toda página em português tem a versão em inglês na navegação", () => {
  assert.deepEqual(enPages, ptPages.map((page) => `en/${page}`));
});

test("toda página da navegação existe em disco", () => {
  const missing = [...ptPages, ...enPages].filter((page) => !existsSync(join(repoRoot, `${page}.mdx`)));
  assert.deepEqual(missing, []);
});

test("páginas em inglês só linkam para rotas em inglês", () => {
  const ptLink = new RegExp(`(\\]\\(|href=")/(${DOC_ROOTS.join("|")})/`, "g");
  const offenders = enPages.flatMap((page) => {
    const content = readFileSync(join(repoRoot, `${page}.mdx`), "utf8");
    return (content.match(ptLink) ?? []).map((link) => `${page}: ${link}`);
  });
  assert.deepEqual(offenders, []);
});

test("páginas em inglês usam o spec em inglês", () => {
  const offenders = enPages.filter((page) =>
    readFileSync(join(repoRoot, `${page}.mdx`), "utf8").includes("/api-reference/openapi.json "),
  );
  assert.deepEqual(offenders, []);
});

test("todo texto do openapi.json tem tradução", () => {
  const { missing } = translateSpec(readJson("api-reference/openapi.json"), readJson("api-reference/openapi.en.strings.json"));
  assert.deepEqual(missing, [], "rode `npm run translate:openapi` e complete api-reference/openapi.en.strings.json");
});

test("openapi.en.json está em dia com openapi.json", () => {
  const { spec } = translateSpec(readJson("api-reference/openapi.json"), readJson("api-reference/openapi.en.strings.json"));
  assert.deepEqual(readJson("api-reference/openapi.en.json"), spec, "rode `npm run translate:openapi`");
});
