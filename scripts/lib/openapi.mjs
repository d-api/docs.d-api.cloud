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
// Todos os eventos que `webhookConfig.events` aceita (WhatsAppEventType no
// backend): [evento, descrição, ligado no exemplo]. Os de volume alto ou brutos
// ficam desligados no exemplo para não inundar o webhook de quem copia.
const WEBHOOK_EVENTS = [
  ["messages.received", "Mensagem recebida.", true],
  ["messages.sent", "Mensagem enviada pela conexão (API, painel ou celular).", true],
  ["message.delivered", "Mensagem entregue ao destinatário.", true],
  ["message.read", "Mensagem lida pelo destinatário.", true],
  ["message.update", "Mensagem editada ou com status alterado.", true],
  ["message.deleted", "Mensagem apagada.", true],
  ["contacts.upsert", "Contato novo.", true],
  ["contacts.update", "Contato atualizado (nome, foto).", true],
  ["chats.upsert", "Conversa nova.", true],
  ["chats.update", "Conversa atualizada (arquivada, fixada, silenciada).", true],
  ["presence", "Digitando, gravando áudio, online.", true],
  ["groups_participants.join", "Participante entrou no grupo.", true],
  ["groups_participants.leave", "Participante saiu ou foi removido do grupo.", true],
  ["groups_participants.promote", "Participante virou admin.", true],
  ["groups_participants.demote", "Participante deixou de ser admin.", true],
  ["group_participants.join-request", "Pedido para entrar no grupo.", true],
  ["group_participants.join-request.approved", "Pedido de entrada aprovado.", true],
  ["group_participants.join-request.revoked", "Pedido de entrada cancelado.", true],
  ["labels.edit", "Etiqueta criada, editada ou apagada.", true],
  ["labels.association.chat", "Etiqueta aplicada ou removida de uma conversa.", true],
  ["labels.association.message", "Etiqueta aplicada ou removida de uma mensagem.", true],
  ["appstate.label.edit", "Etiqueta alterada (evento bruto do WhatsApp).", false],
  ["appstate.label.association.chat", "Etiqueta em conversa (evento bruto do WhatsApp).", false],
  ["appstate.label.association.message", "Etiqueta em mensagem (evento bruto do WhatsApp).", false],
  ["appstate.agent.update", "Agente do WhatsApp Business alterado (evento bruto).", false],
  ["history_sync", "Progresso da sincronização de histórico (exige historySync).", true],
  ["history.message.upsert", "Mensagem do histórico sincronizado.", false],
  ["history.message.received", "Mensagem recebida vinda do histórico.", false],
  ["history.messages.sent", "Mensagem enviada vinda do histórico.", false],
  ["connection.qrcode", "Novo QR Code para parear.", true],
  ["connection.paircode", "Código de pareamento (connectionMode pair).", true],
  ["connection.status", "Conexão mudou de status (conectada, desconectada).", true],
  ["logged_out", "O número foi desconectado do aparelho.", true],
  ["call.offer", "Ligação recebida tocando (exige receiveCalls).", true],
  ["call.accepted", "Ligação recebida atendida em outro aparelho.", true],
  ["call.rejected", "Ligação recebida recusada.", true],
  ["call.ringing", "Ligação feita está tocando no destino.", true],
  ["call.connected", "Ligação atendida, áudio ativo.", true],
  ["call.ended", "Ligação encerrada.", true],
  ["call.not_answered", "Ligação feita não foi atendida.", true],
  ["call.audio", "Trechos de áudio da ligação (volume alto; habilite só se for gravar).", false],
];

const EXAMPLE_WEBHOOK = "https://seu.webhook.com";

const CREATE_SESSION_BODY = {
  type: "object",
  required: ["sessionId"],
  properties: {
    sessionId: {
      type: "string",
      minLength: 1,
      description: "Identificador da conexão, escolhido por você. Use o mesmo valor nas demais rotas.",
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
    webhookUrl: {
      type: "string",
      description: "URL que recebe os eventos da conexão (mensagens, status, chamadas).",
    },
    webhookConfig: {
      type: "object",
      required: ["enabled", "type", "events"],
      description: "Quais eventos o webhook recebe e para qual URL. Evento ausente ou com `enabled: false` não é enviado.",
      properties: {
        enabled: { type: "boolean", description: "Liga o envio de eventos por webhook." },
        type: {
          type: "string",
          enum: ["single", "per_event"],
          description: "`single`: todos os eventos vão para a mesma URL. `per_event`: cada evento tem a sua `webhookUrl`.",
        },
        events: {
          type: "object",
          description: "Um item por tipo de evento.",
          properties: Object.fromEntries(
            WEBHOOK_EVENTS.map(([event, description]) => [
              event,
              {
                type: "object",
                description,
                required: ["enabled", "webhookUrl"],
                properties: { enabled: { type: "boolean" }, webhookUrl: { type: "string" } },
              },
            ]),
          ),
        },
      },
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
    historySync: {
      type: "boolean",
      default: false,
      description: "Sincroniza o histórico de conversas do aparelho ao conectar.",
    },
    receiveCalls: {
      type: "boolean",
      default: false,
      description: "Recebe as ligações feitas para o número (eventos `call.offer`) para atender ou recusar pela API.",
    },
  },
};

const CREATE_SESSION_EXAMPLE = {
  sessionId: "teste-12345",
  connectionMode: "qr",
  webhookUrl: EXAMPLE_WEBHOOK,
  webhookConfig: {
    enabled: true,
    type: "single",
    events: Object.fromEntries(
      WEBHOOK_EVENTS.map(([event, , enabled]) => [event, { enabled, webhookUrl: EXAMPLE_WEBHOOK }]),
    ),
  },
  ignoreGroups: true,
  ignoreStatus: true,
  historySync: true,
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
          example: CREATE_SESSION_EXAMPLE,
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
