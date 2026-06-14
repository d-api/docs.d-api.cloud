# API Reference D-API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar a referência completa dos 92 endpoints REST da D-API, auto-gerada a partir do OpenAPI exportado do Swagger, com guias narrativos e exemplos melhorados, e um fluxo de atualização de um comando.

**Architecture:** O `openapi.json` (fonte de schema) é importado por um script Node que injeta a base URL e valida o spec. O Mintlify auto-gera a referência exaustiva a partir dele (grupo "Endpoints"). Prosa melhorada vive em MDX (grupos "Começando" e "Guias"), fora do JSON, sobrevivendo às reexportações.

**Tech Stack:** Mintlify (tema mint, `docs.json`), Node 22 (ESM, `node:test`), MDX.

---

## File Structure

- `package.json` — scripts npm (`import:openapi`, `dev`, `broken-links`, `test`). Não existe hoje; será criado.
- `scripts/lib/openapi.mjs` — funções puras: `validateSpec`, `withServers`, `pickLatestExport`, `BASE_URL`.
- `scripts/lib/openapi.test.mjs` — testes das funções puras (`node:test`).
- `scripts/import-openapi.mjs` — CLI que resolve a fonte, lê, valida, injeta servers e escreve o spec.
- `api-reference/openapi.json` — gerado pelo script (não editar à mão).
- `api-reference/introduction.mdx` — reescrito (base URL, auth, erros, rate limits, paginação).
- `api-reference/quickstart.mdx` — fluxo do primeiro envio.
- `api-reference/endpoints/*.mdx` — 7 overlays narrativos.
- `docs.json` — navegação da tab "API Reference".
- `README.md` — seção de atualização da API Reference.

---

## Task 1: Funções puras de import (lib + testes)

**Files:**
- Create: `scripts/lib/openapi.mjs`
- Test: `scripts/lib/openapi.test.mjs`
- Create: `package.json`

- [ ] **Step 1: Criar `package.json` com o script de teste**

```json
{
  "name": "docs.d-api.cloud",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "import:openapi": "node scripts/import-openapi.mjs",
    "dev": "mint dev",
    "broken-links": "mint broken-links",
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Escrever os testes (falhando)**

`scripts/lib/openapi.test.mjs`:

```js
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
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npm test`
Expected: FAIL — `Cannot find module './openapi.mjs'`.

- [ ] **Step 4: Implementar as funções puras**

`scripts/lib/openapi.mjs`:

```js
export const BASE_URL = "https://api.d-api.cloud";

export function validateSpec(spec) {
  if (!spec || typeof spec !== "object") {
    throw new Error("Spec inválido: não é um objeto JSON.");
  }
  if (typeof spec.openapi !== "string") {
    throw new Error("Spec inválido: campo 'openapi' ausente ou não-string.");
  }
  if (!spec.paths || typeof spec.paths !== "object" || Object.keys(spec.paths).length === 0) {
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
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm test`
Expected: PASS — todos os testes verdes.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/lib/openapi.mjs scripts/lib/openapi.test.mjs
git commit -m "feat: funções puras de import do OpenAPI com testes"
```

---

## Task 2: CLI de import

**Files:**
- Create: `scripts/import-openapi.mjs`

- [ ] **Step 1: Implementar o CLI**

`scripts/import-openapi.mjs`:

```js
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
```

- [ ] **Step 2: Testar caminho de erro (fonte inexistente)**

Run: `npm run import:openapi -- /tmp/nao-existe.json`
Expected: imprime `✗ Falha no import: ...` e sai com código 1 (sem stack trace).

- [ ] **Step 3: Commit**

```bash
git add scripts/import-openapi.mjs
git commit -m "feat: CLI de import do OpenAPI (servers + validação)"
```

---

## Task 3: Importar o spec real

**Files:**
- Create (gerado): `api-reference/openapi.json`

- [ ] **Step 1: Rodar o import com o export atual**

Run: `npm run import:openapi -- "/Users/joaoartur/Downloads/api-1 (6).json"`
Expected: três linhas `✓`, terminando com `(92 paths)`.

- [ ] **Step 2: Confirmar que `servers` foi injetado**

Run: `node -e "const s=require('./api-reference/openapi.json'); console.log(s.servers)"`
Expected: `[ { url: 'https://api.d-api.cloud', description: 'Produção' } ]`

- [ ] **Step 3: Commit**

```bash
git add api-reference/openapi.json
git commit -m "docs: importar OpenAPI da API (92 endpoints)"
```

---

## Task 4: Reescrever a introdução

**Files:**
- Modify: `api-reference/introduction.mdx` (substituir conteúdo completo)

- [ ] **Step 1: Substituir o conteúdo do arquivo**

`api-reference/introduction.mdx`:

````mdx
---
title: "Introdução"
description: "Base URL, autenticação, erros e limites da API REST da D-API."
---

A API REST da D-API permite enviar mensagens, gerenciar sessões do WhatsApp,
grupos, contatos, mídia e muito mais. Esta referência é gerada a partir da
especificação OpenAPI oficial e mantida em sincronia com a API em produção.

## Base URL

Todos os endpoints usam a base URL:

```
https://api.d-api.cloud
```

## Autenticação

A API usa autenticação por **API Key** enviada no header `Authorization`. Gere a
sua chave no [painel](https://app.d-api.cloud).

```bash
curl https://api.d-api.cloud/api/v1/sessions \
  -H "Authorization: SUA_API_KEY"
```

<Warning>
  Nunca exponha sua API Key no front-end ou em repositórios públicos. Trate-a
  como uma senha.
</Warning>

## Formato de erro

Respostas de erro seguem um envelope JSON consistente, com o status HTTP
indicando a categoria (`4xx` para erros do cliente, `5xx` para erros do
servidor).

```json
{
  "success": false,
  "error": "Mensagem descritiva do erro",
  "statusCode": 400
}
```

## Identificadores

A maioria das operações exige um `sessionId` — o identificador da sua sessão do
WhatsApp. Destinatários (`to`) usam o número no formato internacional sem `+`
(ex: `5511999999999`).

## Limites

A API tem alta disponibilidade (99.9% de uptime) e latência inferior a 30ms.
Limites de uso por plano estão disponíveis no endpoint
`GET /api/v1/limits/{sessionId}` e no [painel](https://app.d-api.cloud).

## Próximos passos

<CardGroup cols={2}>
  <Card title="Quickstart" icon="rocket" href="/api-reference/quickstart">
    Do zero ao primeiro envio em poucos minutos.
  </Card>
  <Card title="Endpoints" icon="code" href="/api-reference/openapi.json">
    Referência completa de todos os endpoints.
  </Card>
</CardGroup>
````

- [ ] **Step 2: Commit**

```bash
git add api-reference/introduction.mdx
git commit -m "docs: reescrever introdução da API Reference"
```

---

## Task 5: Página de quickstart

**Files:**
- Create: `api-reference/quickstart.mdx`

- [ ] **Step 1: Criar o arquivo**

`api-reference/quickstart.mdx`:

````mdx
---
title: "Quickstart"
description: "Crie uma sessão, conecte o WhatsApp e envie a primeira mensagem."
---

Este guia leva você do zero ao primeiro envio. Você vai precisar de uma
[API Key](https://app.d-api.cloud).

## 1. Crie uma sessão

Uma **sessão** representa um número de WhatsApp conectado. Crie uma com um
`sessionId` à sua escolha.

```bash
curl -X POST https://api.d-api.cloud/api/v1/sessions \
  -H "Authorization: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "sessionId": "minha-sessao", "type": "unofficial" }'
```

## 2. Conecte lendo o QR code

Obtenha o QR code da sessão e escaneie com o WhatsApp do celular
(**Aparelhos conectados → Conectar um aparelho**).

```bash
curl "https://api.d-api.cloud/api/v1/sessions/minha-sessao/qr?image=1" \
  -H "Authorization: SUA_API_KEY" \
  --output qr.png
```

<Tip>
  Sem o parâmetro `?image=1`, o endpoint retorna os dados do QR em JSON, úteis
  para renderizar o código no seu próprio front-end.
</Tip>

## 3. Envie a primeira mensagem

Com a sessão conectada, envie uma mensagem de texto.

```bash
curl -X POST https://api.d-api.cloud/api/v1/messages/send/text \
  -H "Authorization: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "minha-sessao",
    "to": "5511999999999",
    "text": "Olá do D-API! 🚀"
  }'
```

Pronto — você enviou sua primeira mensagem. Explore os
[guias](/api-reference/endpoints/criar-sessao) e a referência completa de
endpoints para os próximos passos.
````

- [ ] **Step 2: Commit**

```bash
git add api-reference/quickstart.mdx
git commit -m "docs: adicionar quickstart da API Reference"
```

---

## Task 6: Overlays narrativos dos 7 endpoints-chave

**Files:**
- Create: `api-reference/endpoints/criar-sessao.mdx`
- Create: `api-reference/endpoints/conectar-qr.mdx`
- Create: `api-reference/endpoints/enviar-texto.mdx`
- Create: `api-reference/endpoints/enviar-imagem.mdx`
- Create: `api-reference/endpoints/enviar-lista.mdx`
- Create: `api-reference/endpoints/criar-grupo.mdx`
- Create: `api-reference/endpoints/baixar-midia.mdx`

Cada arquivo usa o frontmatter `openapi: "/api-reference/openapi.json MÉTODO /path"`
para embutir o playground a partir do spec, com prosa de contexto acima.

- [ ] **Step 1: `criar-sessao.mdx`**

````mdx
---
title: "Criar uma sessão"
description: "Crie ou inicie uma sessão do WhatsApp."
openapi: "/api-reference/openapi.json POST /api/v1/sessions"
---

Uma **sessão** é um número de WhatsApp gerenciado pela D-API. Use `type:
"unofficial"` para o WhatsApp não oficial (via QR code) ou `type: "cloud_api"`
para a API Oficial.

Você pode já configurar o `webhookUrl` na criação para receber eventos em tempo
real (mensagens, status, conexão). Veja a [documentação de
webhooks](/whatsapp/webhooks/visao-geral).

<Tip>
  Escolha um `sessionId` estável e único por número — ele é usado em
  praticamente todos os outros endpoints.
</Tip>
````

- [ ] **Step 2: `conectar-qr.mdx`**

````mdx
---
title: "Conectar via QR code"
description: "Obtenha o QR code para conectar a sessão ao WhatsApp."
openapi: "/api-reference/openapi.json GET /api/v1/sessions/{sessionId}/qr"
---

Depois de criar uma sessão `unofficial`, conecte-a escaneando o QR code no
WhatsApp do celular (**Aparelhos conectados → Conectar um aparelho**).

Use `?image=1` para receber o QR diretamente como **imagem PNG**. Sem o
parâmetro, a resposta traz os dados do QR em JSON, ideais para renderizar o
código no seu próprio front-end.

<Note>
  O QR code expira em segundos e é renovado automaticamente. Consulte o endpoint
  novamente para obter um código atualizado enquanto a sessão não conecta.
</Note>
````

- [ ] **Step 3: `enviar-texto.mdx`**

````mdx
---
title: "Enviar mensagem de texto"
description: "Envie uma mensagem de texto simples via WhatsApp."
openapi: "/api-reference/openapi.json POST /api/v1/messages/send/text"
---

O endpoint mais básico da API: envia texto para um número (`to`) a partir de uma
sessão conectada (`sessionId`). O número usa o formato internacional sem `+`
(ex: `5511999999999`).

Recursos opcionais:

- `linkPreview` — gera pré-visualização de links no texto.
- `mentionAll` — menciona todos os participantes (em grupos).
- `contextInfo` — responde a uma mensagem (reply), menciona contatos ou
  encaminha, via JSON do ContextInfo do Whatsmeow.

<Tip>
  Para responder a uma mensagem específica, informe o `stanzaId` e o
  `participant` da mensagem original dentro de `contextInfo`.
</Tip>
````

- [ ] **Step 4: `enviar-imagem.mdx`**

````mdx
---
title: "Enviar imagem"
description: "Envie uma mensagem com imagem e legenda."
openapi: "/api-reference/openapi.json POST /api/v1/messages/send/image"
---

Envia uma imagem para o destinatário. O campo `image` aceita uma **URL pública**
ou o conteúdo em **base64**. Use `caption` para adicionar uma legenda.

<Note>
  Formatos suportados incluem JPEG e PNG. Para arquivos grandes, prefira enviar
  por URL — é mais rápido e evita payloads pesados.
</Note>
````

- [ ] **Step 5: `enviar-lista.mdx`**

````mdx
---
title: "Enviar mensagem de lista"
description: "Envie uma mensagem interativa com lista de opções."
openapi: "/api-reference/openapi.json POST /api/v1/interactive/send/list"
---

Mensagens de **lista** apresentam opções organizadas em seções, abertas por um
botão (`buttonText`). Ótimas para menus, catálogos e fluxos de atendimento.

A estrutura mínima exige `description`, `buttonText` e `sections`. Cada seção
tem um título e uma lista de linhas (`rows`), cada uma com `title` e um
identificador retornado quando o usuário seleciona a opção.

<Tip>
  Use `title` e `footerText` para dar contexto ao menu. O identificador de cada
  linha chega no webhook de mensagem recebida quando o usuário escolhe.
</Tip>
````

- [ ] **Step 6: `criar-grupo.mdx`**

````mdx
---
title: "Criar grupo"
description: "Crie um grupo do WhatsApp com participantes e configurações."
openapi: "/api-reference/openapi.json POST /api/v1/groups/create"
---

Cria um grupo com um `name` e uma lista de `participants` (números no formato
internacional). Suporta configurações avançadas na criação:

- `admin_only_messages` — apenas admins enviam mensagens.
- `admin_approval` — entradas exigem aprovação de admin.
- `description`, `picture` — metadados do grupo.
- `disappearing_messages` — mensagens temporárias (`24h`, `7d`, `90d`).

<Note>
  Para grupos grandes, use `async` para criar o grupo de forma assíncrona e
  evitar timeouts. Os participantes são adicionados em segundo plano.
</Note>
````

- [ ] **Step 7: `baixar-midia.mdx`**

````mdx
---
title: "Baixar mídia"
description: "Baixe mídia recebida de forma unificada."
openapi: "/api-reference/openapi.json POST /api/v1/media/download"
---

Baixa a mídia de uma mensagem recebida. O WhatsApp entrega mídias criptografadas;
este endpoint descriptografa usando os metadados que chegam no webhook
(`media_key`, `mimetype`, `direct_path` ou `url`, e os hashes).

Defina `base64: true` para receber o conteúdo embutido na resposta, ou use
`async` para downloads grandes em segundo plano.

<Tip>
  Os campos necessários (`media_key`, `mimetype`, `file_sha256` etc.) vêm no
  payload do webhook de mensagem recebida — repasse-os diretamente para cá.
</Tip>
````

- [ ] **Step 8: Commit**

```bash
git add api-reference/endpoints/
git commit -m "docs: guias narrativos dos endpoints-chave"
```

---

## Task 7: Wire da navegação e verificação final

**Files:**
- Modify: `docs.json:63-73` (substituir a tab "API Reference")
- Modify: `README.md` (seção de estrutura/atualização)

- [ ] **Step 1: Substituir a tab "API Reference" no `docs.json`**

Trocar o bloco atual:

```json
{
  "tab": "API Reference",
  "groups": [
    {
      "group": "API",
      "pages": [
        "api-reference/introduction"
      ]
    }
  ]
}
```

por:

```json
{
  "tab": "API Reference",
  "groups": [
    {
      "group": "Começando",
      "pages": [
        "api-reference/introduction",
        "api-reference/quickstart"
      ]
    },
    {
      "group": "Guias",
      "pages": [
        "api-reference/endpoints/criar-sessao",
        "api-reference/endpoints/conectar-qr",
        "api-reference/endpoints/enviar-texto",
        "api-reference/endpoints/enviar-imagem",
        "api-reference/endpoints/enviar-lista",
        "api-reference/endpoints/criar-grupo",
        "api-reference/endpoints/baixar-midia"
      ]
    },
    {
      "group": "Endpoints",
      "openapi": "api-reference/openapi.json"
    }
  ]
}
```

O grupo "Endpoints" tem `openapi` e **nenhuma** `pages` → o Mintlify auto-gera
todos os 92 endpoints, agrupados pelas tags do spec. "Começando" e "Guias" são
MDX curados.

- [ ] **Step 2: Subir o preview local e verificar a navegação**

Run: `npm run dev`
Expected: servidor em `http://localhost:3000`. Na tab **API Reference**, conferir:
  1. Grupos "Começando", "Guias" e "Endpoints" aparecem.
  2. "Endpoints" lista os endpoints agrupados por tag (Sessões, Mensagens, Grupos, etc.).
  3. Abrir um endpoint (ex: Enviar mensagem de texto) e confirmar que o
     playground mostra a base URL `https://api.d-api.cloud` e o botão de enviar
     requisição (prova de que `servers` foi injetado).
  4. Abrir uma página de "Guias" e confirmar que a prosa aparece acima do
     playground embutido.

Encerrar com `Ctrl+C`.

- [ ] **Step 3: Verificar links quebrados**

Run: `npm run broken-links`
Expected: nenhum link quebrado reportado.

- [ ] **Step 4: Atualizar o README**

Em `README.md`, na seção "## Estrutura", substituir a linha:

```
- `api-reference/` — referência da API (em construção).
```

por:

```
- `api-reference/` — referência da API. O `openapi.json` é gerado pelo script de import (não editar à mão); a prosa fica nas páginas MDX (`introduction`, `quickstart`, `endpoints/`).
```

E adicionar, após a seção "## Verificação", uma nova seção:

```
## Atualizar a API Reference

Quando a API mudar, reexporte o JSON do Swagger do backend e rode:

\`\`\`
npm run import:openapi -- "/caminho/para/o/export.json"
\`\`\`

Sem argumento, o script usa o `api*.json` mais recente em `~/Downloads`. Ele
injeta a base URL (`servers`) e valida o spec. Depois, faça commit do
`api-reference/openapi.json` atualizado. Endpoints novos aparecem
automaticamente na navegação.
```

- [ ] **Step 5: Commit**

```bash
git add docs.json README.md
git commit -m "docs: publicar API Reference (navegação + atualização no README)"
```

---

## Self-Review Notes

- **Cobertura do spec:** script de import (Tasks 1-2) ✓; servers/base URL (Task 1 `withServers`, Task 3 verificação) ✓; auto-gen dos 92 endpoints (Task 7 grupo "Endpoints") ✓; intro reescrita (Task 4) ✓; quickstart (Task 5) ✓; 7 overlays (Task 6) ✓; fluxo de atualização documentado (Task 7 README) ✓; verificação `mint dev`/`broken-links` (Task 7) ✓.
- **Decisão de navegação:** "Guias" (overlays narrativos) e "Endpoints" (referência auto-gerada) coexistem por design — os 7 endpoints aparecem nos dois grupos com propósitos distintos (tutorial vs. referência exaustiva). Isso é determinístico e não depende de dedupe do Mintlify.
- **Consistência de tipos:** `validateSpec`/`withServers`/`pickLatestExport`/`BASE_URL` usados com as mesmas assinaturas em lib, testes e CLI.
- **Fora de escopo (conforme spec):** enriquecer descrições por endpoint no schema (feito no backend), overlays para os demais ~85 endpoints, versionamento multi-spec.
