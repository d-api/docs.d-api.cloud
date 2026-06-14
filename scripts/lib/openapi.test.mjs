import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSpec, withServers, pickLatestExport, normalizeResponses, BASE_URL, setOpenApiVersion, OPENAPI_VERSION } from "./openapi.mjs";

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

test("validateSpec rejeita paths como array", () => {
  assert.throws(() => validateSpec({ openapi: "3.0.3", paths: ["/x"], components: {} }), /paths/);
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

test("normalizeResponses injeta description em resposta 2xx sem description", () => {
  const spec = { openapi: "3.0.3", components: {}, paths: { "/x": { get: { responses: { "200": { content: {} } } } } } };
  normalizeResponses(spec);
  assert.equal(spec.paths["/x"].get.responses["200"].description, "Resposta bem-sucedida");
});

test("normalizeResponses usa defaults por faixa de status", () => {
  const spec = { openapi: "3.0.3", components: {}, paths: { "/x": { post: { responses: {
    "201": {}, "400": {}, "500": {}, "302": {}
  } } } } };
  normalizeResponses(spec);
  const r = spec.paths["/x"].post.responses;
  assert.equal(r["201"].description, "Resposta bem-sucedida");
  assert.equal(r["400"].description, "Erro na requisição");
  assert.equal(r["500"].description, "Erro interno do servidor");
  assert.equal(r["302"].description, "Resposta");
});

test("normalizeResponses preserva description existente", () => {
  const spec = { openapi: "3.0.3", components: {}, paths: { "/x": { get: { responses: { "200": { description: "OK customizado" } } } } } };
  normalizeResponses(spec);
  assert.equal(spec.paths["/x"].get.responses["200"].description, "OK customizado");
});

test("normalizeResponses ignora responses com $ref e chaves não-HTTP", () => {
  const spec = { openapi: "3.0.3", components: {}, paths: { "/x": {
    parameters: [{ name: "id" }],
    get: { responses: { "200": { $ref: "#/components/responses/Ok" } } }
  } } };
  normalizeResponses(spec);
  // $ref response stays untouched (no description added)
  assert.equal(spec.paths["/x"].get.responses["200"].description, undefined);
  assert.deepEqual(spec.paths["/x"].get.responses["200"], { $ref: "#/components/responses/Ok" });
});

test("normalizeResponses retorna o próprio spec", () => {
  const spec = { openapi: "3.0.3", components: {}, paths: { "/x": { get: { responses: { "200": {} } } } } };
  assert.equal(normalizeResponses(spec), spec);
});

test("setOpenApiVersion força a versão para 3.1.0", () => {
  const spec = { openapi: "3.0.3", paths: {}, components: {} };
  setOpenApiVersion(spec);
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(spec.openapi, OPENAPI_VERSION);
});

test("setOpenApiVersion retorna o próprio spec", () => {
  const spec = { openapi: "3.0.3", paths: {}, components: {} };
  assert.equal(setOpenApiVersion(spec), spec);
});
