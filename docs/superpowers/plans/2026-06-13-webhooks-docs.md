# D-API Docs — Webhooks por produto + Identidade Visual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the Mintlify starter site to D-API and document every customer-facing webhook for the WhatsApp (não oficial), SMS and URA products, with PT-BR pages and JSON examples verified against the real backend emitters.

**Architecture:** Mintlify docs site (`docs.json` + `.mdx` pages). One top-level tab per product. Each product has a Webhooks group. All payload shapes/examples are verified against the backend (`applications/backend/src`) — where the shared TypeScript types differ from what is actually emitted, the emitted shape wins.

**Tech Stack:** Mintlify (`mint` CLI), MDX, JSON. Backend reference only (TypeScript, not modified).

**Source-of-truth files in backend (read-only references):**
- WhatsApp emitter: `applications/backend/src/services/whatsapp/bridge-event-handler.service.ts`
- WhatsApp delivery/retry: `applications/backend/src/jobs/handlers/webhook.handler.ts`, `src/services/.../webhook.service.ts`, `webhook-circuit-breaker.service.ts`; config types: `src/types/event-config.types.ts`
- SMS: `src/services/sms/sms-events.service.ts`, `src/routes/api/sms-webhooks.routes.ts`, `src/services/notifications/account-webhook.service.ts`
- URA/Voice: `src/consumers/voice-events-consumer.ts`, `src/routes/voice.routes.ts`, `src/services/notifications/account-webhook.service.ts`
- Brand: `applications/panel-v2/public/img/logo-horizontal.png`, `logo-square.png`; primary `#00B7CD`

**Verified facts already established (use these, do not re-derive):**
- WhatsApp webhook envelope: `{ event, sessionId, data, timestamp (ISO), traceId? }`. No HMAC; headers `Content-Type: application/json`, `User-Agent: Deliverify-Webhook/1.0`.
- WhatsApp `media_data` is normalized before dispatch (`normalizeMediaData`, bridge-event-handler.service.ts:181-207): `file_size`→`file_length`, `mime_type`→`mimetype`; `base64_data` and `thumbnail` are removed. **Examples MUST use `file_length` and `mimetype`** (the current messages.received doc is stale on this).
- Group join-request variants actually emitted: `group_participants.join-request`, `group_participants.join-request.revoked`, `group_participants.join-request.approved` (NOT `-rejected`). Verify the exact emitted event strings at bridge-event-handler.service.ts:3484-3551 and 5176+.
- `logged_out` is dispatched as event `connection.status` with `data.status: "logged_out"` (bridge-event-handler.service.ts:2866).
- SMS/URA envelope (account-level): `{ event, channel: "sms"|"voice", data, timestamp }`. Headers add `X-DAPI-Webhook-Channel` and `X-DAPI-Signature` (HMAC-SHA256 hex of body, when a secret is set). account-webhook.service.ts:163-182.
- SMS campaign-level envelope: `{ event, campaignId, recipientId, to, status, errorCode, segments, timestamp }`. sms-events.service.ts:267-313.
- SMS `sms.sent` is NOT delivered to customers; product is outbound-only (no inbound/MO event).
- URA `data` fields: `callId, bulkCallId, to, answered, talkSeconds, digits, cause, causeDescription, timestamp`. voice-events-consumer.ts:32-126.

**Excluded:** WhatsApp Cloud API/oficial events (`connection.health.degraded`, `interactive_data`), `datacrazy`, and full send/REST docs.

**Verification for every content task (no unit tests in docs):**
1. Open the cited emitter `file:line` and confirm field names/types/optionality match the page.
2. Run the link/structure check: `cd applications/docs.d-api.cloud && npx mint@latest broken-links` — expect no broken links.
3. (Optional, when iterating locally) `npx mint@latest dev` and eyeball the page renders.

---

## File Structure

**Modified:**
- `docs.json` — branding + full navigation.
- `logo/light.svg`, `logo/dark.svg`, `favicon.svg` — replaced by D-API assets (new `.png` files; old `.svg` removed).
- `home.mdx`, `api-reference/introduction.mdx` — minimal rebrand.

**Created:**
- `logo/dapi-horizontal.png`, `logo/dapi-square.png`
- `whatsapp/introducao.mdx`
- `whatsapp/webhooks/visao-geral.mdx`
- `whatsapp/webhooks/messages-received.mdx`
- `whatsapp/webhooks/messages-sent.mdx`
- `whatsapp/webhooks/status-de-mensagens.mdx`
- `whatsapp/webhooks/conexao.mdx`
- `whatsapp/webhooks/chats-contatos-presenca.mdx`
- `whatsapp/webhooks/grupos.mdx`
- `sms/webhooks/visao-geral.mdx`
- `sms/webhooks/eventos.mdx`
- `ura/webhooks/visao-geral.mdx`
- `ura/webhooks/eventos.mdx`

**Removed:**
- `essentials/` (all), `ai-tools/` (all), `api-reference/endpoint/` (all), `development.mdx`, `snippets/`, unused `images/hero-*.png`, `images/checks-passed.png`.
- Old `guides/getting-started/webhooks/eventos-de-mensagem-recebida-messages-received.mdx` (content migrates to `whatsapp/webhooks/messages-received.mdx`).

---

## Phase A — Identidade visual, navegação e limpeza

### Task A1: Copiar assets de logo da D-API

**Files:**
- Create: `logo/dapi-horizontal.png`, `logo/dapi-square.png`

- [ ] **Step 1: Copiar os PNGs reais do painel**

```bash
cd /Users/joaoartur/Documents/Projects/d-api/applications/docs.d-api.cloud
cp ../panel-v2/public/img/logo-horizontal.png logo/dapi-horizontal.png
cp ../panel-v2/public/img/logo-square.png logo/dapi-square.png
```

- [ ] **Step 2: Conferir que os arquivos existem e são PNG**

Run: `file logo/dapi-horizontal.png logo/dapi-square.png`
Expected: ambos `PNG image data`.

- [ ] **Step 3: Remover os SVGs do starter (Mint wordmark)**

```bash
git rm logo/light.svg logo/dark.svg favicon.svg
cp logo/dapi-square.png favicon.png
```

- [ ] **Step 4: Commit**

```bash
git add logo/dapi-horizontal.png logo/dapi-square.png favicon.png
git commit -m "docs: adicionar logo e favicon da D-API"
```

### Task A2: Reescrever `docs.json` (branding + navegação completa)

**Files:**
- Modify: `docs.json` (full replacement)

- [ ] **Step 1: Substituir o conteúdo de `docs.json` por:**

```json
{
  "$schema": "https://mintlify.com/docs.json",
  "theme": "mint",
  "name": "D-API",
  "colors": {
    "primary": "#00B7CD",
    "light": "#2DD4E0",
    "dark": "#0E8FA3"
  },
  "favicon": "/favicon.png",
  "navigation": {
    "tabs": [
      {
        "tab": "WhatsApp",
        "groups": [
          {
            "group": "Introdução",
            "pages": [
              "whatsapp/introducao"
            ]
          },
          {
            "group": "Webhooks",
            "pages": [
              "whatsapp/webhooks/visao-geral",
              "whatsapp/webhooks/messages-received",
              "whatsapp/webhooks/messages-sent",
              "whatsapp/webhooks/status-de-mensagens",
              "whatsapp/webhooks/conexao",
              "whatsapp/webhooks/chats-contatos-presenca",
              "whatsapp/webhooks/grupos"
            ]
          }
        ]
      },
      {
        "tab": "SMS",
        "groups": [
          {
            "group": "Webhooks",
            "pages": [
              "sms/webhooks/visao-geral",
              "sms/webhooks/eventos"
            ]
          }
        ]
      },
      {
        "tab": "URA",
        "groups": [
          {
            "group": "Webhooks",
            "pages": [
              "ura/webhooks/visao-geral",
              "ura/webhooks/eventos"
            ]
          }
        ]
      },
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
    ]
  },
  "logo": {
    "light": "/logo/dapi-horizontal.png",
    "dark": "/logo/dapi-horizontal.png"
  },
  "navbar": {
    "links": [
      {
        "label": "Suporte",
        "href": "https://wa.me/5551920018823?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20a%20documenta%C3%A7%C3%A3o%20da%20D-API"
      }
    ],
    "primary": {
      "type": "button",
      "label": "Painel",
      "href": "https://app.d-api.cloud"
    }
  },
  "contextual": {
    "options": ["copy", "view", "chatgpt", "claude", "mcp", "cursor", "vscode"]
  },
  "footer": {
    "links": [
      {
        "header": "D-API",
        "items": [
          { "label": "Painel", "href": "https://app.d-api.cloud" },
          { "label": "Suporte", "href": "https://wa.me/5551920018823?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20a%20documenta%C3%A7%C3%A3o%20da%20D-API" }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Validar JSON**

Run: `npx --yes json5 < docs.json > /dev/null 2>&1 || python3 -c "import json;json.load(open('docs.json'))" && echo OK`
Expected: `OK` (JSON válido).

- [ ] **Step 3: Commit**

```bash
git add docs.json
git commit -m "docs: aplicar identidade visual e navegação por produto da D-API"
```

### Task A3: Remover páginas do starter kit Mintlify

**Files:**
- Remove: `essentials/`, `ai-tools/`, `api-reference/endpoint/`, `development.mdx`, `snippets/`, `images/hero-light.png`, `images/hero-dark.png`, `images/checks-passed.png`

- [ ] **Step 1: Remover arquivos**

```bash
cd /Users/joaoartur/Documents/Projects/d-api/applications/docs.d-api.cloud
git rm -r essentials ai-tools api-reference/endpoint development.mdx snippets \
  images/hero-light.png images/hero-dark.png images/checks-passed.png
```

- [ ] **Step 2: Conferir que `docs.json` não referencia nenhum arquivo removido**

Run: `grep -nE "essentials/|ai-tools/|endpoint/|development|snippet" docs.json`
Expected: nenhuma saída.

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: remover páginas de exemplo do starter Mintlify"
```

### Task A4: Rebrand mínimo de `home.mdx` e `api-reference/introduction.mdx`

**Files:**
- Modify: `home.mdx`, `api-reference/introduction.mdx`

- [ ] **Step 1: Reescrever `home.mdx`**

```mdx
---
title: "Documentação D-API"
description: "APIs de WhatsApp (não oficial), SMS e URA da D-API."
---

A D-API oferece APIs para **WhatsApp (não oficial)**, **SMS** e **URA (voz/IVR)**.
Esta documentação descreve, por produto, os **webhooks** que a plataforma envia
para a sua aplicação.

<CardGroup cols={3}>
  <Card title="WhatsApp" icon="whatsapp" href="/whatsapp/webhooks/visao-geral">
    Eventos de mensagens, conexão, contatos, chats e grupos.
  </Card>
  <Card title="SMS" icon="comment-sms" href="/sms/webhooks/visao-geral">
    Eventos de status de entrega (DLR) das mensagens enviadas.
  </Card>
  <Card title="URA" icon="phone" href="/ura/webhooks/visao-geral">
    Eventos do ciclo de vida da chamada de voz e IVR.
  </Card>
</CardGroup>
```

- [ ] **Step 2: Reescrever `api-reference/introduction.mdx`** (remover textos do starter; manter mínimo)

```mdx
---
title: "Visão geral da API"
description: "Referência da API D-API."
---

A referência completa dos endpoints REST da D-API será publicada aqui.
Por enquanto, consulte a documentação de **webhooks** de cada produto:
WhatsApp, SMS e URA.
```

- [ ] **Step 3: Verificar links**

Run: `npx mint@latest broken-links`
Expected: sem links quebrados (páginas de webhooks ainda podem não existir; rode novamente ao final da Fase D).

- [ ] **Step 4: Commit**

```bash
git add home.mdx api-reference/introduction.mdx
git commit -m "docs: rebrand mínimo de home e introdução da API"
```

---

## Phase B — Webhooks WhatsApp (não oficial)

> Para CADA página desta fase: abrir o trecho citado de `bridge-event-handler.service.ts`
> e confirmar os nomes/tipos dos campos antes de finalizar. Usar `<ResponseField>` para
> tabelas de campos e `<Accordion>`/`<AccordionGroup>` para exemplos JSON. Todo texto em PT-BR.

### Task B1: `whatsapp/introducao.mdx` (Visão geral do produto)

**Files:**
- Create: `whatsapp/introducao.mdx`

- [ ] **Step 1: Criar a página**

Conteúdo (frontmatter + corpo): explicar que é o WhatsApp **não oficial** (baseado em
biblioteca tipo Baileys, conexão via QR code ou código de pareamento), que cada conexão é
uma **sessão** (`sessionId`), e que os eventos chegam via webhook. Linkar para
`whatsapp/webhooks/visao-geral`.

```mdx
---
title: "WhatsApp (não oficial)"
description: "Conexão via QR code ou pareamento, organizada por sessão."
---

O produto **WhatsApp não oficial** conecta um número de WhatsApp à D-API por
**QR code** ou **código de pareamento**. Cada conexão é uma **sessão**,
identificada por `sessionId`, presente em todos os webhooks.

<Card title="Webhooks" icon="webhook" href="/whatsapp/webhooks/visao-geral">
  Como configurar e receber os eventos da sua sessão.
</Card>
```

- [ ] **Step 2: Commit**

```bash
git add whatsapp/introducao.mdx
git commit -m "docs(whatsapp): página de introdução do produto"
```

### Task B2: `whatsapp/webhooks/visao-geral.mdx` (entrega, envelope, retries)

**Files:**
- Create: `whatsapp/webhooks/visao-geral.mdx`
- Reference: `event-config.types.ts` (modo single/per_event), `webhook.handler.ts` (headers/retries), `webhook-circuit-breaker.service.ts`, `webhook.service.ts` (dedup)

- [ ] **Step 1: Confirmar mecânica de entrega no código**

Run: `grep -nE "Deliverify-Webhook|attempts|backoff|WEBHOOK_TIMEOUT|single|per_event" applications/../backend/src/jobs/handlers/webhook.handler.ts applications/../backend/src/types/event-config.types.ts 2>/dev/null | head`
Expected: confirmar `User-Agent: Deliverify-Webhook/1.0`, 7 tentativas, backoff exponencial, modos `single`/`per_event`.

- [ ] **Step 2: Criar a página** cobrindo:
  - Configuração por sessão: modos `single` (uma URL) e `per_event` (URL por evento); cada evento tem `enabled` + `webhookUrl`; evento desabilitado não é enviado.
  - Envelope comum (com bloco JSON):
    ```json
    {
      "event": "messages.received",
      "sessionId": "my-session",
      "data": { "...": "específico do evento" },
      "timestamp": "2026-01-24T22:51:32.601Z",
      "traceId": "c17dee440402792623e3ad6d925cb000"
    }
    ```
  - Headers: `Content-Type: application/json`, `User-Agent: Deliverify-Webhook/1.0`. **Sem assinatura HMAC** neste produto.
  - Retries: 7 tentativas, backoff exponencial (~5s,10s,20s,40s,80s,160s); `404`/`410` = falha permanente.
  - Circuit breaker por URL; deduplicação (Redis, TTL 5min).
  - Tabela com a lista de todos os eventos do produto e link para cada página.
  - Recomendação: responder `2xx` rápido (timeout de 30s por tentativa).

- [ ] **Step 3: Verificar links e commit**

```bash
npx mint@latest broken-links || true
git add whatsapp/webhooks/visao-geral.mdx
git commit -m "docs(whatsapp): visão geral e entrega de webhooks"
```

### Task B3: `whatsapp/webhooks/messages-received.mdx` (migrar + corrigir)

**Files:**
- Create: `whatsapp/webhooks/messages-received.mdx`
- Reference: `bridge-event-handler.service.ts:1899-2558` (montagem), `:181-207` (normalizeMediaData), `:1878+` (CTWA)

- [ ] **Step 1: Migrar o conteúdo existente** de
  `guides/getting-started/webhooks/eventos-de-mensagem-recebida-messages-received.mdx`
  para o novo caminho como base.

- [ ] **Step 2: Corrigir os campos de `media_data`** em TODOS os exemplos e na tabela:
  - Renomear `file_size` → `file_length` e `mime_type` → `mimetype` (o emissor normaliza; ver `normalizeMediaData`).
  - Manter `url`, `width`, `height`, `caption`, `duration`, `is_ptt`, `is_animated`, `filename`.
  - Confirmar contra `:181-207` que `base64_data`/`thumbnail` não aparecem.
  - Exemplo `image` corrigido (referência):
    ```json
    "media_data": {
      "url": "https://mmg.whatsapp.net/...",
      "width": 1179,
      "height": 1127,
      "caption": "",
      "file_length": 108529,
      "mimetype": "image/jpeg"
    }
    ```
  - Aplicar a mesma correção aos exemplos `video`, `audio`, `document`, `sticker`.

- [ ] **Step 3: Confirmar a forma real do bloco CTWA** (`external_ad_reply` no root de `data` e/ou em `context_info`) contra `:1878+` e os tipos `ad_data`. Manter apenas os campos realmente emitidos; ajustar se o código divergir do exemplo atual.

- [ ] **Step 4: Manter** todos os `type` já documentados (text, image, video, audio, document, sticker, contact, location, reaction, list_response, template_button_reply, list, carousel, nativeflow, quoted, CTWA), a tabela "Identificando Tipos" e a tabela de Media URLs.

- [ ] **Step 5: Verificar e commit**

```bash
npx mint@latest broken-links || true
git add whatsapp/webhooks/messages-received.mdx
git commit -m "docs(whatsapp): messages.received (migrado e com media_data corrigido)"
```

### Task B4: `whatsapp/webhooks/messages-sent.mdx`

**Files:**
- Create: `whatsapp/webhooks/messages-sent.mdx`
- Reference: `bridge-event-handler.service.ts:2560-2835`

- [ ] **Step 1: Confirmar a montagem** do payload de `messages.sent` (mesmo shape de `messages.received`, `fromMe: true`, ID em maiúsculas, possível `media_url` vindo de cache).

- [ ] **Step 2: Criar a página** descrevendo: dispara quando uma mensagem é enviada pela sessão (inclusive enviadas por outros dispositivos do mesmo número). Reaproveitar a estrutura de campos de `messages.received` (linkar para ela em vez de duplicar a tabela completa) e dar um exemplo `text` real com `fromMe: true`:

```json
{
  "event": "messages.sent",
  "sessionId": "my-session",
  "timestamp": "2026-01-24T22:55:00.000Z",
  "traceId": "...",
  "data": {
    "id": "AC9831DDA691236BA3CE4909A187B703",
    "type": "text",
    "message": "Olá! Como posso ajudar?",
    "timestamp": 1769295300000,
    "fromMe": true,
    "is_group": false,
    "group_name": "",
    "from": { "jid": "558005915338@s.whatsapp.net", "name": "Minha Empresa" },
    "from_name": "Minha Empresa",
    "to": { "jid": "5511999999999@s.whatsapp.net", "name": "João" },
    "media_url": null
  }
}
```
> Confirmar nomes de campos exatos contra `:2560-2835` antes de finalizar (especialmente `from`/`to` e `media_data`).

- [ ] **Step 3: Verificar e commit**

```bash
npx mint@latest broken-links || true
git add whatsapp/webhooks/messages-sent.mdx
git commit -m "docs(whatsapp): messages.sent"
```

### Task B5: `whatsapp/webhooks/status-de-mensagens.mdx` (read, delivered, deleted, update)

**Files:**
- Create: `whatsapp/webhooks/status-de-mensagens.mdx`
- Reference: `bridge-event-handler.service.ts:3138-3236`

- [ ] **Step 1: Confirmar shapes** dos 4 eventos em `:3138-3236`.

- [ ] **Step 2: Criar a página** com uma seção por evento (`<AccordionGroup>`), campos via `<ResponseField>` e exemplos:

```json
// message.read  (e message.delivered: mesmo shape)
{
  "event": "message.read",
  "sessionId": "my-session",
  "timestamp": "2026-01-24T23:00:00.000Z",
  "data": {
    "message_id": "3EB0F61B5D1F94FAFCD306",
    "remote_jid": "5511999999999@s.whatsapp.net",
    "participant": "",
    "timestamp": 1769295600000
  }
}
```
```json
// message.deleted
{
  "event": "message.deleted",
  "sessionId": "my-session",
  "timestamp": "2026-01-24T23:01:00.000Z",
  "data": {
    "message_id": "3EB0F61B5D1F94FAFCD306",
    "chat_jid": "5511999999999@s.whatsapp.net",
    "sender_jid": "5511999999999@s.whatsapp.net",
    "is_from_me": false,
    "timestamp": 1769295660000
  }
}
```
```json
// message.update  (edição de mensagem)
{
  "event": "message.update",
  "sessionId": "my-session",
  "timestamp": "2026-01-24T23:02:00.000Z",
  "data": {
    "message_id": "3EB0F61B5D1F94FAFCD306",
    "chat_jid": "5511999999999@s.whatsapp.net",
    "sender_jid": "5511999999999@s.whatsapp.net",
    "is_from_me": false,
    "new_text": "Texto corrigido",
    "timestamp": 1769295720000,
    "edit_timestamp": 1769295725000
  }
}
```
> Notas a incluir: `message.read`/`message.delivered` têm dedup de 30s; `participant` só preenchido em grupos.

- [ ] **Step 3: Verificar e commit**

```bash
npx mint@latest broken-links || true
git add whatsapp/webhooks/status-de-mensagens.mdx
git commit -m "docs(whatsapp): status de mensagens (read/delivered/deleted/update)"
```

### Task B6: `whatsapp/webhooks/conexao.mdx` (qrcode, paircode, status, logged_out)

**Files:**
- Create: `whatsapp/webhooks/conexao.mdx`
- Reference: `bridge-event-handler.service.ts:1262-1489` (qrcode/paircode/status) e `:2837-2873` (logged_out)

- [ ] **Step 1: Confirmar shapes** e o fato de que `logged_out` é despachado como `event: "connection.status"` com `data.status: "logged_out"`.

- [ ] **Step 2: Criar a página** com seções e exemplos:

```json
// connection.qrcode
{ "event": "connection.qrcode", "sessionId": "my-session",
  "timestamp": "2026-01-24T22:00:00.000Z",
  "data": { "qr": "2@abc...", "qrImage": "data:image/png;base64,iVBOR..." } }
```
```json
// connection.paircode
{ "event": "connection.paircode", "sessionId": "my-session",
  "timestamp": "2026-01-24T22:00:05.000Z",
  "data": { "code": "ABCD-1234", "phone": "5511999999999" } }
```
```json
// connection.status (conectado)
{ "event": "connection.status", "sessionId": "my-session",
  "timestamp": "2026-01-24T22:00:30.000Z",
  "data": { "status": "connected", "jid": "558005915338@s.whatsapp.net",
            "phone": "558005915338", "name": "Minha Empresa", "connected": true } }
```
```json
// logged_out (despachado como connection.status)
{ "event": "connection.status", "sessionId": "my-session",
  "timestamp": "2026-01-24T22:10:00.000Z",
  "data": { "status": "logged_out", "reason": "device_removed" } }
```
> Documentar campos opcionais de `connection.status`: `profilePictureUrl`, `reason`, `connected`.

- [ ] **Step 3: Verificar e commit**

```bash
npx mint@latest broken-links || true
git add whatsapp/webhooks/conexao.mdx
git commit -m "docs(whatsapp): eventos de conexão (qrcode/paircode/status/logged_out)"
```

### Task B7: `whatsapp/webhooks/chats-contatos-presenca.mdx`

**Files:**
- Create: `whatsapp/webhooks/chats-contatos-presenca.mdx`
- Reference: `bridge-event-handler.service.ts:2876-3136` e `:3238-3402`

- [ ] **Step 1: Confirmar shapes** de `chats.update`/`chats.upsert`, `contacts.update`/`contacts.upsert`, `presence`.

- [ ] **Step 2: Criar a página** com seções e exemplos:

```json
// chats.update (mesmo shape de chats.upsert)
{ "event": "chats.update", "sessionId": "my-session",
  "timestamp": "2026-01-24T23:05:00.000Z",
  "data": { "jid": "5511999999999@s.whatsapp.net", "name": "João",
            "unread_count": 2, "conversation_timestamp": 1769295900,
            "archived": false, "pinned": 0, "mute_end_time": 0 } }
```
```json
// contacts.update (mesmo shape de contacts.upsert)
{ "event": "contacts.update", "sessionId": "my-session",
  "timestamp": "2026-01-24T23:06:00.000Z",
  "data": { "jid": "5511999999999@s.whatsapp.net", "push_name": "João",
            "full_name": "João Silva", "first_name": "João", "business_name": "" } }
```
```json
// presence
{ "event": "presence", "sessionId": "my-session",
  "timestamp": "2026-01-24T23:07:00.000Z",
  "data": { "jid": "5511999999999@s.whatsapp.net", "name": "João",
            "unavailable": false, "last_seen": 1769296020 } }
```
> Notas: `*.upsert` têm debounce de 2s; `presence` tem dedup de 5s.

- [ ] **Step 3: Verificar e commit**

```bash
npx mint@latest broken-links || true
git add whatsapp/webhooks/chats-contatos-presenca.mdx
git commit -m "docs(whatsapp): chats, contatos e presença"
```

### Task B8: `whatsapp/webhooks/grupos.mdx` (participants + join-request)

**Files:**
- Create: `whatsapp/webhooks/grupos.mdx`
- Reference: `bridge-event-handler.service.ts:3404-3551` e `:5176+`

- [ ] **Step 1: Confirmar os event strings exatos** dos eventos de grupo, incluindo as variações de join-request realmente emitidas (`group_participants.join-request`, `.revoked`, `.approved`). Documentar APENAS as emitidas pelo código.

- [ ] **Step 2: Criar a página** com seções e exemplos:

```json
// groups_participants.join (mesmo shape para leave/promote/demote)
{ "event": "groups_participants.join", "sessionId": "my-session",
  "timestamp": "2026-01-24T23:10:00.000Z",
  "data": { "group_jid": "120363000000000000@g.us", "group_name": "Equipe",
            "participants": ["5511999999999@s.whatsapp.net"],
            "timestamp": 1769296200, "sender": "558005915338@s.whatsapp.net" } }
```
```json
// group_participants.join-request
{ "event": "group_participants.join-request", "sessionId": "my-session",
  "timestamp": "2026-01-24T23:11:00.000Z",
  "data": { "group_jid": "120363000000000000@g.us", "group_name": "Equipe",
            "requester_jid": "5511999999999@s.whatsapp.net",
            "requester_name": "João", "timestamp": 1769296260 } }
```
```json
// group_participants.join-request.approved
{ "event": "group_participants.join-request.approved", "sessionId": "my-session",
  "timestamp": "2026-01-24T23:12:00.000Z",
  "data": { "group_jid": "120363000000000000@g.us", "group_name": "Equipe",
            "requester_jid": "5511999999999@s.whatsapp.net",
            "requester_name": "João", "approved_by": "558005915338@s.whatsapp.net",
            "timestamp": 1769296320 } }
```
> Incluir tabela mapeando os 4 eventos de participante (join/leave/promote/demote) ao mesmo shape, e a variação `.revoked`.

- [ ] **Step 3: Verificar e commit**

```bash
npx mint@latest broken-links || true
git add whatsapp/webhooks/grupos.mdx
git commit -m "docs(whatsapp): eventos de grupos e solicitações de entrada"
```

---

## Phase C — Webhooks SMS

### Task C1: `sms/webhooks/visao-geral.mdx`

**Files:**
- Create: `sms/webhooks/visao-geral.mdx`
- Reference: `sms-events.service.ts:115-313`, `account-webhook.service.ts:132-190`, `routes/api/account-webhooks.routes.ts`

- [ ] **Step 1: Confirmar** os dois canais (account-level vs por campanha), os envelopes, headers e assinatura HMAC.

- [ ] **Step 2: Criar a página** cobrindo:
  - **Dois canais**: account-level (`account_webhooks`, dispara para todos os envios) e por campanha (`sms_campaigns.webhook_config`).
  - Envelope account-level:
    ```json
    { "event": "sms.delivered", "channel": "sms",
      "data": { "messageId": "uuid", "to": "+5511999999999",
                "status": "delivered", "errorCode": null,
                "segments": 1, "timestamp": "2026-01-24T23:00:00.000Z" },
      "timestamp": "2026-01-24T23:00:00.000Z" }
    ```
  - Envelope por campanha:
    ```json
    { "event": "sms.delivered", "campaignId": "uuid", "recipientId": "uuid",
      "to": "+5511999999999", "status": "delivered", "errorCode": null,
      "segments": 1, "timestamp": "2026-01-24T23:00:00.000Z" }
    ```
  - Headers: `Content-Type: application/json`, `X-DAPI-Webhook-Channel: sms`, `X-DAPI-Signature` (HMAC-SHA256 hex do corpo, quando há secret). Incluir um snippet de validação:
    ```javascript
    const sig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    // comparar com o header X-DAPI-Signature
    ```
  - Entrega: account-level via fila durável com retries + circuit breaker; campanha via `fetch` fire-and-forget (sem retry).
  - **Notas**: `sms.sent` NÃO é enviado ao cliente; produto é **outbound-only** (não há evento de SMS recebido).
  - Link para `sms/webhooks/eventos`.

- [ ] **Step 3: Verificar e commit**

```bash
npx mint@latest broken-links || true
git add sms/webhooks/visao-geral.mdx
git commit -m "docs(sms): visão geral e entrega de webhooks"
```

### Task C2: `sms/webhooks/eventos.mdx` (delivered/undelivered/failed/expired + errorCode)

**Files:**
- Create: `sms/webhooks/eventos.mdx`
- Reference: `sms-events.service.ts:22-28` (EVENT_TO_STATUS), `routes/api/sms-webhooks.routes.ts:17-68` (mapeamento de status/erros)

- [ ] **Step 1: Confirmar** o mapeamento evento→status e os códigos de erro normalizados.

- [ ] **Step 2: Criar a página** com:
  - Tabela evento → quando dispara → campo `status` resultante:
    - `sms.delivered` → `delivered` (chegou ao aparelho; `errorCode: null`).
    - `sms.undelivered` → `undelivered` (falha antes do aparelho; `errorCode` preenchido).
    - `sms.failed` → `undelivered` (falha de rede pós-aceite; já cobrado).
    - `sms.expired` → `expired` (TTL excedido).
  - Tabela de `errorCode` normalizados (Speedmarket): `NETWORK_ERROR`, `INVALID_NUMBER`, `LANDLINE`, `BLACKLIST`, `CANCELED`, `NO_WHATSAPP`, `CONTENT_BLOCKED`, `NO_COVERAGE`, `REJECTED`, `NOT_RECEIVED` — com a descrição de cada um.
  - Campos do `data` (account-level): `messageId`, `to`, `status`, `errorCode`, `segments`, `timestamp`.
  - Um exemplo JSON por evento (account-level), p.ex.:
    ```json
    { "event": "sms.undelivered", "channel": "sms",
      "data": { "messageId": "uuid", "to": "+5511999999999",
                "status": "undelivered", "errorCode": "INVALID_NUMBER",
                "segments": 1, "timestamp": "2026-01-24T23:01:00.000Z" },
      "timestamp": "2026-01-24T23:01:00.000Z" }
    ```

- [ ] **Step 3: Verificar e commit**

```bash
npx mint@latest broken-links || true
git add sms/webhooks/eventos.mdx
git commit -m "docs(sms): eventos de status de entrega e códigos de erro"
```

---

## Phase D — Webhooks URA

### Task D1: `ura/webhooks/visao-geral.mdx`

**Files:**
- Create: `ura/webhooks/visao-geral.mdx`
- Reference: `voice-events-consumer.ts:85-126`, `account-webhook.service.ts:132-190`, `voice.routes.ts:48-385`

- [ ] **Step 1: Confirmar** o canal `voice`, o envelope e os headers (iguais ao SMS, com `X-DAPI-Webhook-Channel: voice`).

- [ ] **Step 2: Criar a página** cobrindo:
  - Webhook account-level (canal `voice`); envelope:
    ```json
    { "event": "call.started", "channel": "voice",
      "data": { "callId": "uuid", "bulkCallId": "uuid", "to": "+5511999999999",
                "answered": null, "talkSeconds": null, "digits": null,
                "cause": null, "causeDescription": null,
                "timestamp": "2026-01-24T23:00:00.000Z" },
      "timestamp": "2026-01-24T23:00:00.000Z" }
    ```
  - Headers + HMAC `X-DAPI-Signature` (mesma validação do SMS).
  - **Como a chamada inicia** (contexto mínimo): `POST /api/v1/voice/bulk` (lote; `audioUrl` ou `flowId` para URA interativa) e `POST /api/v1/voice/call` (chamada única). Ambos retornam `callId`.
  - Link para `ura/webhooks/eventos`.

- [ ] **Step 3: Verificar e commit**

```bash
npx mint@latest broken-links || true
git add ura/webhooks/visao-geral.mdx
git commit -m "docs(ura): visão geral e entrega de webhooks"
```

### Task D2: `ura/webhooks/eventos.mdx` (call.started/answered/dtmf/ended + cause)

**Files:**
- Create: `ura/webhooks/eventos.mdx`
- Reference: `voice-events-consumer.ts:32-126` (shape) e `:50-78` (tabela de cause)

- [ ] **Step 1: Confirmar** os campos por evento e a tabela de `cause`.

- [ ] **Step 2: Criar a página** com seção por evento + exemplos:

```json
// call.answered
{ "event": "call.answered", "channel": "voice",
  "data": { "callId": "uuid", "bulkCallId": "uuid", "to": "+5511999999999",
            "answered": true, "talkSeconds": null, "digits": null,
            "cause": null, "causeDescription": null,
            "timestamp": "2026-01-24T23:00:10.000Z" },
  "timestamp": "2026-01-24T23:00:10.000Z" }
```
```json
// call.dtmf  (um webhook por tecla)
{ "event": "call.dtmf", "channel": "voice",
  "data": { "callId": "uuid", "bulkCallId": "uuid", "to": "+5511999999999",
            "answered": null, "talkSeconds": null, "digits": "1",
            "cause": null, "causeDescription": null,
            "timestamp": "2026-01-24T23:00:20.000Z" },
  "timestamp": "2026-01-24T23:00:20.000Z" }
```
```json
// call.ended
{ "event": "call.ended", "channel": "voice",
  "data": { "callId": "uuid", "bulkCallId": "uuid", "to": "+5511999999999",
            "answered": true, "talkSeconds": 42, "digits": null,
            "cause": 16, "causeDescription": "Encerramento normal",
            "timestamp": "2026-01-24T23:01:02.000Z" },
  "timestamp": "2026-01-24T23:01:02.000Z" }
```
  - Incluir a **tabela completa de `cause`** (Q.850 + custom 150/151) com descrição PT-BR conforme `:50-78`:
    0 Desconhecido · 1 Número inexistente · 16 Encerramento normal · 17 Ocupado ·
    18 Sem resposta do usuário · 19 Não atendeu · 20 Assinante ausente ·
    21 Chamada rejeitada · 22 Número alterado · 27 Destino fora de serviço ·
    28 Número inválido · 31 Normal, não especificado · 34 Sem canal disponível ·
    38 Rede fora de serviço · 41 Falha temporária · 42 Congestionamento ·
    44 Canal solicitado indisponível · 50 Facilidade não assinada ·
    57 Capacidade não autorizada · 58 Capacidade indisponível ·
    65 Capacidade não implementada · 88 Destino incompatível ·
    102 Expiração de temporizador · 111 Erro de protocolo ·
    127 Interfuncionamento não especificado · 150 Não atendeu (timeout de toque) ·
    151 Caixa postal / secretária eletrônica.

- [ ] **Step 3: Verificar e commit**

```bash
npx mint@latest broken-links || true
git add ura/webhooks/eventos.mdx
git commit -m "docs(ura): eventos do ciclo de vida da chamada e códigos de cause"
```

---

## Phase E — Verificação final

### Task E1: Checagem de links e estrutura

- [ ] **Step 1: Rodar broken-links em todo o site**

Run: `cd /Users/joaoartur/Documents/Projects/d-api/applications/docs.d-api.cloud && npx mint@latest broken-links`
Expected: nenhum link quebrado.

- [ ] **Step 2: Conferir que toda página em `docs.json` existe e que não há órfãos**

Run: `for p in $(grep -oE '"[a-z0-9/-]+/[a-z0-9-]+"' docs.json | tr -d '"'); do [ -f "$p.mdx" ] || echo "FALTA: $p.mdx"; done`
Expected: nenhuma saída `FALTA:`.

- [ ] **Step 3: (Opcional) Subir o dev server e revisar visualmente**

Run: `npx mint@latest dev` e abrir o navegador; conferir logo D-API, cor primária ciano e as 4 tabs.

- [ ] **Step 4: Commit final (se houver ajustes)**

```bash
git add -A
git commit -m "docs: verificação final de links e navegação"
```

---

## Self-Review (preenchido pelo autor do plano)

- **Cobertura do spec:** identidade visual (A1,A2,A4), limpeza (A3), navegação por produto (A2), WhatsApp catálogo completo (B1-B8), SMS (C1,C2), URA (D1,D2), método anti-invenção (verificação por tarefa + Fase E). ✔
- **Exclusões respeitadas:** Cloud API, datacrazy e send/REST fora — nenhuma tarefa os inclui. ✔
- **Placeholders:** exemplos JSON são reais/derivados do shape do código; os passos "confirmar contra file:line" são ações de verificação, não placeholders. ✔
- **Consistência de tipos:** envelopes WhatsApp `{event,sessionId,data,timestamp,traceId}` e SMS/URA `{event,channel,data,timestamp}` usados de forma consistente; `media_data` com `file_length`/`mimetype` em todas as páginas. ✔
