import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSpec, withServers, pickLatestExport, normalizeResponses, BASE_URL, setOpenApiVersion, OPENAPI_VERSION, translateSpec } from "./openapi.mjs";

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

function specToTranslate() {
  return {
    openapi: "3.1.0",
    info: { title: "Título", description: "Descrição da API", version: "1.0.0" },
    servers: [{ url: "https://api.d-api.cloud", description: "Produção" }],
    tags: [{ name: "Mensagens", description: "Envio de mensagens" }],
    paths: {
      "/x": {
        post: {
          tags: ["Mensagens"],
          summary: "Enviar texto",
          requestBody: { content: { "application/json": { schema: {
            type: "object",
            properties: {
              description: { type: "string", description: "Legenda" },
              mode: { type: "string", enum: ["Legenda"], default: "Legenda", example: { description: "Legenda" } },
            },
          } } } },
          responses: { "200": { description: "Resposta bem-sucedida" } },
        },
      },
    },
    components: {},
  };
}

const DICT = {
  "Título": "Title",
  "Descrição da API": "API description",
  "Produção": "Production",
  "Mensagens": "Messages",
  "Envio de mensagens": "Sending messages",
  "Enviar texto": "Send text",
  "Legenda": "Caption",
  "Resposta bem-sucedida": "Successful response",
};

test("translateSpec traduz summary, description, title e tags", () => {
  const { spec } = translateSpec(specToTranslate(), DICT);
  assert.equal(spec.info.title, "Title");
  assert.equal(spec.info.description, "API description");
  assert.equal(spec.servers[0].description, "Production");
  assert.deepEqual(spec.tags[0], { name: "Messages", description: "Sending messages" });
  const op = spec.paths["/x"].post;
  assert.deepEqual(op.tags, ["Messages"]);
  assert.equal(op.summary, "Send text");
  assert.equal(op.responses["200"].description, "Successful response");
  assert.equal(op.requestBody.content["application/json"].schema.properties.description.description, "Caption");
});

test("translateSpec não altera valores de exemplo, enum e default", () => {
  const { spec } = translateSpec(specToTranslate(), DICT);
  const mode = spec.paths["/x"].post.requestBody.content["application/json"].schema.properties.mode;
  assert.deepEqual(mode.enum, ["Legenda"]);
  assert.equal(mode.default, "Legenda");
  assert.deepEqual(mode.example, { description: "Legenda" });
});

test("translateSpec mantém o original e reporta textos sem tradução", () => {
  const { spec, missing } = translateSpec(specToTranslate(), { "Título": "Title" });
  assert.equal(spec.paths["/x"].post.summary, "Enviar texto");
  assert.ok(missing.includes("Enviar texto"));
  assert.ok(missing.includes("Mensagens"));
  assert.ok(!missing.includes("Título"));
  assert.equal(new Set(missing).size, missing.length);
});

test("translateSpec não muta o spec de entrada", () => {
  const input = specToTranslate();
  translateSpec(input, DICT);
  assert.equal(input.paths["/x"].post.summary, "Enviar texto");
  assert.deepEqual(input.paths["/x"].post.tags, ["Mensagens"]);
});
