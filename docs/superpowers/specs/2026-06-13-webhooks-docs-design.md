# Design — Documentação D-API: Webhooks por produto + Identidade Visual

Data: 2026-06-13
Status: aprovação pendente

## Objetivo

Transformar a documentação atual (Mintlify starter kit praticamente vazio, com
um único conteúdo real — `messages.received`) na fundação da documentação
oficial da D-API. Esta primeira rodada entrega:

1. **Identidade visual D-API** (logo, favicon, cores, nome, links).
2. **Documentação completa de webhooks**, organizada por produto:
   - **WhatsApp (não oficial)** — catálogo completo de eventos.
   - **SMS** — eventos de status de entrega.
   - **URA** — eventos de ciclo de vida da chamada.
3. **Limpeza** das páginas de exemplo do starter kit Mintlify.

Idioma: **PT-BR** em todo o conteúdo (mantém o padrão do doc existente).

Regra de ouro (**sem invenções**): cada payload de exemplo é verificado
linha-a-linha contra o código emissor real. Onde os tipos TypeScript
compartilhados divergirem do payload realmente emitido, vale o **emitido**.

## Fora de escopo (esta rodada)

- **WhatsApp Cloud API / oficial**: eventos exclusivos como
  `connection.health.degraded` e o campo `interactive_data` em
  `messages.received` **não** entram (produto é "não oficial apenas").
- **datacrazy**: integração interna de sincronização de CRM, não é webhook de
  produto voltado ao cliente — excluída explicitamente.
- **Envio / REST APIs** além do contexto mínimo necessário para a URA (como uma
  chamada se inicia). Documentação de envio fica para rodadas futuras.

## 1. Identidade visual

Fonte da verdade da marca: `applications/panel-v2`.

- **Cor primária**: `#00B7CD` (ciano D-API; no painel é
  `oklch(0.7141 0.1235 209.89)`). A marca usa gradiente ciano→roxo.
- **`docs.json` `colors`**: `primary: #00B7CD`, `light: #2DD4E0`,
  `dark: #0E8FA3` (tons derivados do ciano da marca; substitui o verde Mintlify).
- **Logo**: copiar os assets reais de `panel-v2/public/img/`:
  - `logo-horizontal.png` (1374×365, RGBA transparente) → `logo/` para a navbar
    (light e dark).
  - `logo-square.png` (426×425) → favicon.
  - Verificar contraste no dark mode; só produzir variante clara dedicada se o
    wordmark roxo ficar de fato ilegível sobre fundo escuro.
- **Metadados `docs.json`**:
  - `name`: `"D-API"`.
  - `navbar.primary` (botão): label `"Painel"`, href `https://app.d-api.cloud`.
  - `navbar.links` Support: href
    `https://wa.me/5551920018823?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20a%20documenta%C3%A7%C3%A3o%20da%20D-API`.
  - Remover âncoras globais Mintlify (Documentation/Blog), `footer.socials`
    (mintlify), e quaisquer URLs `mintlify.com`/`dashboard.mintlify.com`.

## 2. Navegação (`docs.json`)

Uma tab por produto + API Reference:

```
Tabs: [ WhatsApp ] [ SMS ] [ URA ] [ API Reference ]

WhatsApp (não oficial)
  Introdução
    - Visão geral
  Webhooks
    - Visão geral e entrega
    - messages.received
    - messages.sent
    - message.read / message.delivered / message.deleted / message.update
    - connection.qrcode / connection.paircode / connection.status / logged_out
    - chats.update / chats.upsert
    - contacts.update / contacts.upsert
    - presence
    - groups_participants.* e join-request

SMS
  Webhooks
    - Visão geral (account vs campanha, HMAC)
    - sms.delivered / sms.undelivered / sms.failed / sms.expired

URA
  Webhooks
    - Visão geral
    - call.started / call.answered / call.dtmf / call.ended
```

Estrutura pensada para crescer (cada tab de produto ganhará envio, conexão,
flows etc. em rodadas futuras).

## 3. Conteúdo — WhatsApp (não oficial)

Emissor real: `backend/src/services/.../bridge-event-handler.service.ts`.
Despacho/entrega: `event-dispatcher.service.ts`, `jobs/handlers/webhook.handler.ts`,
`webhook.service.ts`, `webhook-circuit-breaker.service.ts`.

### Visão geral e entrega
- **Configuração por sessão** (`event-config.types.ts`): modo `single` (uma URL
  para todos os eventos habilitados) ou `per_event` (URL por tipo de evento);
  cada evento tem flag `enabled` + `webhookUrl`. Evento não habilitado não é
  enfileirado.
- **Envelope**: `{ event, sessionId, data, timestamp (ISO), traceId? }`.
- **Headers**: `Content-Type: application/json`,
  `User-Agent: Deliverify-Webhook/1.0`. **Sem assinatura HMAC** neste produto.
- **Retries**: 7 tentativas (BullMQ), backoff exponencial a partir de 5s
  (~5s,10s,20s,40s,80s,160s). 404/410 → falha permanente (sem retry).
- **Circuit breaker** por URL: abre após limite de falhas; pode ser resetado via
  endpoint admin.
- **Deduplicação** (Redis, TTL 5min) por URL+sessão+evento+messageId+tipo+ts.

### Páginas de eventos
Cada página: descrição (quando dispara) + tabela de campos (`<ResponseField>`)
+ exemplo(s) JSON real(is) em `<Accordion>`/`<AccordionGroup>`.

- **messages.received** — refinar o doc atual. Cobrir todos os `type`: text,
  image, video, audio, document, sticker, contact, location, reaction,
  poll_update, list_response, template_button_reply, list, carousel, nativeflow
  (quick_reply/cta_url), além de quoted/resposta e CTWA. **Verificar nomes reais
  dos campos de `media_data`** (o emissor normaliza — confirmar `file_size` vs
  `file_length`, `mime_type` vs `mimetype`) e a forma real de `external_ad_reply`
  / `context_info` vs `ad_data`.
- **messages.sent** — mesma forma de `messages.received`, `fromMe: true`.
- **message.read**, **message.delivered** — `{message_id, remote_jid,
  participant?, timestamp}`. (Dedup de 30s por messageId.)
- **message.deleted** — `{message_id, chat_jid, sender_jid, is_from_me,
  timestamp}`.
- **message.update** (edição) — `{message_id, chat_jid, sender_jid, is_from_me,
  new_text, timestamp, edit_timestamp}`.
- **connection.qrcode** — `{qr, qrImage?}` (qrImage é data URL base64 gerada).
- **connection.paircode** — `{code, phone}` (modo pareamento, só não oficial).
- **connection.status** — `{status: connected|disconnected, jid?, phone?, name?,
  profilePictureUrl?, connected?, reason?}`. Documentar também `logged_out`
  (despachado como `connection.status` com `status: "logged_out"` — verificar).
- **chats.update / chats.upsert** — `{jid, name?, unread_count?,
  conversation_timestamp?, archived?, pinned?, mute_end_time?}` (upsert com
  debounce de 2s).
- **contacts.update / contacts.upsert** — `{jid, push_name?, full_name?,
  first_name?, business_name?}`.
- **presence** — `{jid, name?, unavailable, last_seen?}` (dedup 5s).
- **groups_participants.join / leave / promote / demote** — `{group_jid,
  group_name?, participants[], timestamp, sender?}`.
- **group_participants.join-request[.revoked / -approved / -rejected]** —
  verificar quais variações o código realmente emite antes de documentar
  (a tipagem lista approved/rejected; o código tem `.revoked` e `-approved`).

## 4. Conteúdo — SMS

Emissores: `sms-events.service.ts` (campanha), `account-webhook.service.ts`
(account-level). Mapeamento de status: `routes/api/sms-webhooks.routes.ts`.

### Visão geral
- **Dois canais**: webhook **account-level** (configurado por usuário, tabela
  `account_webhooks`, dispara para todos os envios) e webhook **por campanha**
  (`sms_campaigns.webhook_config`, só para destinatários da campanha).
- **Envelope account-level**: `{ event, channel: "sms", data: {...}, timestamp }`.
  **Envelope campanha**: `{ event, campaignId, recipientId, to, status,
  errorCode, segments, timestamp }`.
- **Headers**: `Content-Type: application/json`, `X-DAPI-Webhook-Channel: sms`,
  `X-DAPI-Signature` (HMAC-SHA256 do corpo, hex, se houver secret). Documentar
  como validar a assinatura.
- **Entrega**: account-level via fila durável `PROCESS_WEBHOOK` (retries +
  circuit breaker + logs); campanha via `fetch` fire-and-forget (sem retry).
- **Notas**: `sms.sent` está nos tipos mas **não é enviado** ao cliente;
  produto é **outbound-only** (sem evento de SMS recebido / inbound MO).

### Páginas de eventos
- **sms.delivered** — chegou ao aparelho. `status: "delivered"`, `errorCode: null`.
- **sms.undelivered** — falha antes do aparelho. `errorCode` preenchido.
- **sms.failed** — falha de rede pós-aceite (já cobrado). Internamente
  `status: "undelivered"`, evento `sms.failed`.
- **sms.expired** — TTL excedido. `status: "expired"`.
- **Tabela de `errorCode` normalizados** (Speedmarket: NETWORK_ERROR,
  INVALID_NUMBER, LANDLINE, BLACKLIST, CANCELED, NO_WHATSAPP, CONTENT_BLOCKED,
  NO_COVERAGE, REJECTED, NOT_RECEIVED; GS Marketing: mapeamento
  DELIVERED/SEND/EXPIRED/FAILED/CANCELED). Campos: `messageId`, `to`, `status`,
  `errorCode`, `segments`, `timestamp`.

## 5. Conteúdo — URA

Emissor: `consumers/voice-events-consumer.ts`. Entrega: `account-webhook.service.ts`.
Início de chamada: `routes/voice.routes.ts`.

### Visão geral
- **Webhook account-level** (canal `voice`). Envelope `{ event, channel:
  "voice", data: {...}, timestamp }`. Headers `X-DAPI-Webhook-Channel: voice` +
  `X-DAPI-Signature` (HMAC-SHA256). Entrega via fila durável `PROCESS_WEBHOOK`.
- **Como a chamada inicia** (contexto mínimo): `POST /api/v1/voice/bulk` (campanha
  em lote, `audioUrl` ou `flowId` para URA interativa) e `POST /api/v1/voice/call`
  (chamada única). Retorna `callId`.

### Páginas de eventos
Campos do `data`: `callId`, `bulkCallId`, `to`, `answered`, `talkSeconds`,
`digits`, `cause`, `causeDescription`, `timestamp`.
- **call.started** — discagem iniciada (demais campos null).
- **call.answered** — atendida (`answered: true`).
- **call.dtmf** — dígito DTMF capturado em menu URA (`digits: "1".."#"`), um
  webhook por tecla.
- **call.ended** — encerrada. `answered: bool|null`, `talkSeconds: number|null`,
  `cause: number|null`, `causeDescription: string|null`.
- **Tabela de `cause`**: códigos Q.850 (0,1,16,17,18,19,20,21,22,27,28,31,34,38,
  41,42,44,50,57,58,65,88,102,111,127) + custom 150 (não atendeu / timeout de
  toque) e 151 (caixa postal), com descrição em PT-BR.

## 6. Limpeza do starter kit

Remover páginas de exemplo Mintlify e suas entradas de navegação:
`essentials/*`, `ai-tools/*`, `api-reference/endpoint/{create,delete,get,webhook}`,
`development.mdx`, `snippets/snippet-intro.mdx`. Manter/ajustar
`api-reference/introduction.mdx` e `home.mdx` (rebrand mínimo). Imagens
`images/hero-*.png` e `checks-passed.png` removidas se não usadas.

## 7. Método de verificação (anti-invenção)

Antes de escrever cada exemplo:
1. Abrir o emissor real (`file:line` já mapeados) e confirmar nomes/tipos de
   campos exatamente como saem no payload.
2. Onde houver payloads reais já capturados (doc `messages.received` atual),
   reutilizá-los; caso contrário, construir o exemplo a partir do shape do
   código (sem campos inventados).
3. Marcar como `?`/opcional apenas campos que o código emite condicionalmente.

## Arquivos afetados (resumo)

- `docs.json` — branding + navegação completa.
- `logo/` + favicon — assets D-API.
- `home.mdx`, `api-reference/introduction.mdx` — rebrand mínimo.
- Novas páginas `whatsapp/webhooks/*.mdx`, `sms/webhooks/*.mdx`,
  `ura/webhooks/*.mdx` + páginas "Visão geral".
- Remoção de `essentials/`, `ai-tools/`, `api-reference/endpoint/`,
  `development.mdx`, `snippets/`.
