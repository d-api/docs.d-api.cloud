export const BASE_URL = "https://api.d-api.cloud";

// O export do Swagger declara 3.0.3 mas usa construções de JSON Schema 2020-12
// (const em anyOf, examples plural). Elas só são válidas em OpenAPI 3.1, então
// normalizamos a versão declarada para que o validador do Mintlify aceite o spec.
export const OPENAPI_VERSION = "3.1.0";

export function setOpenApiVersion(spec) {
  spec.openapi = OPENAPI_VERSION;
  return replaceNullable(spec);
}

// `nullable` é do OpenAPI 3.0. Como declaramos 3.1, um `nullable` vindo do
// Swagger (ex.: t.Number({ nullable: true }) no backend) é erro `struct` e o
// Mintlify recusa o spec inteiro. Em 3.1 o equivalente é incluir "null" no type.
function replaceNullable(node) {
  if (Array.isArray(node)) {
    node.forEach(replaceNullable);
    return node;
  }
  if (!node || typeof node !== "object") return node;
  if ("nullable" in node && typeof node.nullable === "boolean") {
    if (node.nullable && typeof node.type === "string") node.type = [node.type, "null"];
    delete node.nullable;
  }
  Object.values(node).forEach(replaceNullable);
  return node;
}

const HTTP_METHODS = new Set(["get", "post", "put", "delete", "patch", "options", "head", "trace"]);

function defaultResponseDescription(statusCode) {
  if (statusCode.startsWith("2")) return "Resposta bem-sucedida";
  if (statusCode.startsWith("4")) return "Erro na requisição";
  if (statusCode.startsWith("5")) return "Erro interno do servidor";
  return "Resposta";
}

export function normalizeResponses(spec) {
  for (const pathItem of Object.values(spec.paths ?? {})) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      // Elysia leaks the route's `detail.hide` flag into the operation object
      // when a route sets `hide: false` explicitly. `hide` is not a valid
      // OpenAPI operation field and makes strict parsers (e.g. Mintlify) reject
      // the whole spec. Strip it defensively here so a stray flag can't break
      // the docs build.
      if (operation && typeof operation === "object" && "hide" in operation) {
        delete operation.hide;
      }
      const responses = operation?.responses;
      if (!responses || typeof responses !== "object") continue;
      for (const [code, response] of Object.entries(responses)) {
        if (!response || typeof response !== "object" || response.$ref) continue;
        if (typeof response.description !== "string") {
          response.description = defaultResponseDescription(code);
        }
      }
    }
  }
  return spec;
}

export function validateSpec(spec) {
  if (!spec || typeof spec !== "object") {
    throw new Error("Spec inválido: não é um objeto JSON.");
  }
  if (typeof spec.openapi !== "string") {
    throw new Error("Spec inválido: campo 'openapi' ausente ou não-string.");
  }
  if (!spec.paths || typeof spec.paths !== "object" || Array.isArray(spec.paths) || Object.keys(spec.paths).length === 0) {
    throw new Error("Spec inválido: 'paths' ausente ou vazio.");
  }
  if (!spec.components || typeof spec.components !== "object") {
    throw new Error("Spec inválido: 'components' ausente.");
  }
  return spec;
}

export function withServers(spec) {
  return { ...spec, servers: [{ url: BASE_URL, description: "Produção" }] };
}

export function pickLatestExport(entries) {
  const matches = entries.filter((e) => /^api.*\.json$/i.test(e.name));
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (b.mtimeMs > a.mtimeMs ? b : a)).name;
}

const TRANSLATABLE_FIELDS = new Set(["summary", "description", "title"]);
// Valores de exemplo, enum e default são dados que o cliente envia ou recebe:
// traduzi-los mudaria o contrato documentado, não só a prosa.
const DATA_FIELDS = new Set(["example", "examples", "default", "enum", "const"]);

// O dicionário é indexado pelo texto em português, não pelo caminho no spec,
// para que um reexport com rotas reordenadas ou renomeadas reaproveite as
// traduções existentes. Texto sem tradução fica em português e é reportado.
export function translateSpec(spec, dictionary) {
  const missing = new Set();
  const translate = (text) => {
    if (Object.hasOwn(dictionary, text)) return dictionary[text];
    missing.add(text);
    return text;
  };

  const walk = (node, isTagList) => {
    if (Array.isArray(node)) return node.map((item) => walk(item, false));
    if (!node || typeof node !== "object") return node;
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      if (DATA_FIELDS.has(key)) {
        out[key] = structuredClone(value);
      } else if (typeof value === "string" && (TRANSLATABLE_FIELDS.has(key) || (isTagList && key === "name"))) {
        out[key] = translate(value);
      } else if (key === "tags" && Array.isArray(value) && value.every((tag) => typeof tag === "string")) {
        out[key] = value.map(translate);
      } else {
        out[key] = walk(value, false);
      }
    }
    return out;
  };

  const translated = walk(spec, false);
  if (Array.isArray(spec.tags)) {
    translated.tags = spec.tags.map((tag) => walk(tag, true));
  }
  return { spec: translated, missing: [...missing] };
}

// O body de POST /sessions no backend serve conexão não oficial e API Oficial
// (cloud_api) no mesmo schema, mais campos internos. No Swagger, o schema do
// `body` sempre vence o `detail.requestBody`, então o recorte do que o cliente
// precisa enviar para criar uma conexão não oficial é feito aqui, no import.
const CREATE_SESSION_BODY = {
  type: "object",
  required: ["sessionId"],
  properties: {
    sessionId: {
      type: "string",
      minLength: 1,
      description: "Identificador da conexão, escolhido por você. Use o mesmo valor nas demais rotas.",
    },
    webhookUrl: {
      type: "string",
      description: "URL que recebe os eventos da conexão (mensagens, status, chamadas).",
    },
    connectionMode: {
      type: "string",
      enum: ["qr", "pair"],
      default: "qr",
      description: "Como parear o número: `qr` (QR Code) ou `pair` (código de pareamento).",
    },
    pairPhone: {
      type: "string",
      description: "Número a parear com DDI, só dígitos. Obrigatório quando `connectionMode` é `pair`.",
    },
    historySync: {
      type: "boolean",
      default: false,
      description: "Sincroniza o histórico de conversas do aparelho ao conectar.",
    },
    ignoreGroups: {
      type: "boolean",
      default: true,
      description: "Não envia eventos de mensagens de grupos.",
    },
    ignoreStatus: {
      type: "boolean",
      default: true,
      description: "Não envia eventos de status (stories).",
    },
  },
};

const CURATED_OPERATIONS = {
  "post /api/v1/sessions": {
    description:
      "Cria uma conexão de WhatsApp não oficial ou inicia uma existente. Para a API Oficial, use as rotas de conexão Cloud API.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: CREATE_SESSION_BODY,
          example: { sessionId: "minha-conexao", webhookUrl: "https://seu-servidor.com/webhook", connectionMode: "qr" },
        },
      },
    },
  },
};

// Textos do backend que expõem a biblioteca interna da ponte.
const TEXT_REWRITES = {
  "Whatsmeow ContextInfo proto JSON. Supports mentions, replies (quotedMessage), forwarding, ads, and other metadata.":
    "ContextInfo proto JSON. Supports mentions, replies (quotedMessage), forwarding, ads, and other metadata.",
};

function rewriteTexts(node) {
  if (Array.isArray(node)) return node.map(rewriteTexts);
  if (!node || typeof node !== "object") return node;
  for (const [key, value] of Object.entries(node)) {
    node[key] = typeof value === "string" && Object.hasOwn(TEXT_REWRITES, value) ? TEXT_REWRITES[value] : rewriteTexts(value);
  }
  return node;
}

// Respostas de conexão ecoam `provider: "whatsmeow"`, o nome da biblioteca
// interna; o campo não ajuda o cliente, então sai do exemplo e do schema.
function dropInternalProvider(node) {
  if (Array.isArray(node)) return node.forEach(dropInternalProvider);
  if (!node || typeof node !== "object") return;
  if (node.example?.provider === "whatsmeow") {
    delete node.example.provider;
    if (node.schema?.properties) delete node.schema.properties.provider;
    if (Array.isArray(node.schema?.required)) node.schema.required = node.schema.required.filter((f) => f !== "provider");
  }
  Object.values(node).forEach(dropInternalProvider);
}

export function curateSpec(spec) {
  for (const [key, patch] of Object.entries(CURATED_OPERATIONS)) {
    const [method, path] = key.split(" ");
    const operation = spec.paths?.[path]?.[method];
    if (operation) Object.assign(operation, structuredClone(patch));
  }
  dropInternalProvider(spec);
  return rewriteTexts(spec);
}
