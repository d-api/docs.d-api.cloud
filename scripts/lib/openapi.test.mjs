import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSpec, withServers, pickLatestExport, BASE_URL } from "./openapi.mjs";

test("validateSpec aceita um spec mínimo válido", () => {
  const spec = { openapi: "3.0.3", paths: { "/x": {} }, components: {} };
  assert.equal(validateSpec(spec), spec);
});

test("validateSpec rejeita openapi ausente", () => {
  assert.throws(() => validateSpec({ paths: { "/x": {} }, components: {} }), /openapi/);
});

test("validateSpec rejeita paths vazio", () => {
  assert.throws(() => validateSpec({ openapi: "3.0.3", paths: {}, components: {} }), /paths/);
});

test("validateSpec rejeita components ausente", () => {
  assert.throws(() => validateSpec({ openapi: "3.0.3", paths: { "/x": {} } }), /components/);
});

test("withServers injeta a base URL de produção", () => {
  const out = withServers({ openapi: "3.0.3", paths: { "/x": {} }, components: {} });
  assert.deepEqual(out.servers, [{ url: BASE_URL, description: "Produção" }]);
  assert.equal(out.servers[0].url, "https://api.d-api.cloud");
});

test("withServers preserva os demais campos do spec", () => {
  const out = withServers({ openapi: "3.0.3", paths: { "/x": {} }, components: {}, info: { title: "T" } });
  assert.equal(out.info.title, "T");
});

test("pickLatestExport escolhe o api*.json mais recente por mtime", () => {
  const latest = pickLatestExport([
    { name: "api-1.json", mtimeMs: 100 },
    { name: "api-2 (6).json", mtimeMs: 200 },
    { name: "other.json", mtimeMs: 300 },
    { name: "notes.txt", mtimeMs: 400 },
  ]);
  assert.equal(latest, "api-2 (6).json");
});

test("pickLatestExport retorna null quando nada casa", () => {
  assert.equal(pickLatestExport([{ name: "x.txt", mtimeMs: 1 }]), null);
});
