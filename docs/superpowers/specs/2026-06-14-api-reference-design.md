# API Reference D-API — Design

**Data:** 2026-06-14
**Status:** Aprovado para planejamento

## Problema

A tab "API Reference" hoje é só um placeholder (`api-reference/introduction.mdx`).
Precisamos de uma referência completa dos 92 endpoints REST da D-API que seja
**simples de atualizar quando a API mudar** (direto via OpenAPI JSON exportado do
Swagger do backend), porém com **textos, exemplos e informações melhoradas** em
relação ao que o Swagger entrega cru.

## Restrição central

O `openapi.json` vem do **Swagger do backend, exportado manualmente**. Logo, ele é
**reexportado periodicamente e qualquer edição feita dentro dele é perdida**. Toda
prosa melhorada precisa viver **fora do JSON**, em arquivos MDX que o Mintlify
sobrepõe ao spec.

## Decisões

- **Abordagem:** Híbrido (C) — auto-gerar todos os 92 endpoints a partir do spec +
  overlays MDX ricos em ~7 endpoints de maior valor + páginas de visão geral curadas.
- **Sincronização:** script de import (`npm run import:openapi`) que copia o export,
  injeta `servers` (base URL) e valida o spec.
- **Fonte do export:** argumento opcional; sem argumento, pega o `api*.json` mais
  recente em `~/Downloads`.

## Arquitetura

```
api-reference/
  openapi.json            # fonte de schema (gerado pelo script, NÃO editar à mão)
  introduction.mdx        # reescrito: base URL, auth, erros, rate limits, paginação
  quickstart.mdx          # do zero ao primeiro envio
  endpoints/              # overlays MDX dos ~7 endpoints-chave
    criar-sessao.mdx
    conectar-qr.mdx
    enviar-texto.mdx
    enviar-imagem.mdx
    enviar-lista.mdx
    criar-grupo.mdx
    baixar-midia.mdx
scripts/
  import-openapi.mjs       # copia + injeta servers + valida
```

O `openapi.json` é a única fonte de schema. O Mintlify auto-gera a estrutura de
endpoints a partir dele. A prosa melhorada vive em MDX e referencia endpoints por
`MÉTODO /path` (não por schema), então sobrevive a reexportações.

## Componentes

### 1. Script de import — `scripts/import-openapi.mjs`

Executado via `npm run import:openapi [caminho-do-export]`.

Responsabilidades:
1. **Resolver a fonte:** usa o argumento se fornecido; senão, seleciona o
   `api*.json` mais recente (mtime) em `~/Downloads`. Falha com mensagem clara se
   nada for encontrado.
2. **Injetar servers:** define
   `servers: [{ "url": "https://api.d-api.cloud", "description": "Produção" }]`.
   Necessário porque, sem `servers`, o playground do Mintlify opera em "simple
   mode" e não envia requisições.
3. **Validar:** confere estrutura mínima (`openapi`, `paths` não-vazio,
   `components`). Falha com erro descritivo se o JSON estiver inválido/incompleto.
4. **Escrever** `api-reference/openapi.json` formatado (idempotente).

Sem dependências externas além do Node (usa `node:fs`, `node:path`, `node:os`).
O arquivo recebe um cabeçalho-comentário lógico no README indicando que é gerado.

### 2. Navegação — `docs.json`, tab "API Reference"

- `"openapi": "api-reference/openapi.json"` no nível da tab → auto-gera os 92
  endpoints, agrupados pelas tags do spec: Início, Mensagens, Cloud API, Mensagens
  Interativas, Etiquetas, Catálogo, Histórico, Calls, Newsletters, Account, Grupos,
  Chat, Mídia, Sessões, Contacts.
- Grupo **"Começando"** (MDX curado), antes dos grupos auto-gerados:
  - `api-reference/introduction` — reescrito.
  - `api-reference/quickstart` — fluxo do primeiro envio.
- Os 7 overlays MDX entram na navegação posicionados junto aos seus grupos
  (a fiação exata — interleave com auto-gen vs. grupo próprio "Guias" — é decidida
  na implementação, verificando o comportamento do Mintlify com `mint dev`).

### 3. Páginas curadas (prosa, estáveis)

- **`introduction.mdx`** (reescrita): base URL `https://api.d-api.cloud`,
  autenticação via header `Authorization` (ApiKeyAuth, formato `<API_KEY>`),
  formato padrão de erro, rate limits, paginação, links para os produtos.
- **`quickstart.mdx`**: criar sessão → ler QR → conectar → enviar primeira
  mensagem de texto. Fluxo narrado com exemplos.

### 4. Overlays MDX — ~7 endpoints de maior valor

Cada um: frontmatter `openapi: "/api-reference/openapi.json MÉTODO /path"` +
seções de contexto, casos de uso e exemplo comentado. Lista:

| Arquivo | Endpoint | Por quê |
|---|---|---|
| `criar-sessao.mdx` | `POST /api/v1/sessions` | porta de entrada |
| `conectar-qr.mdx` | `GET /api/v1/sessions/{sessionId}/qr` | onboarding/conexão |
| `enviar-texto.mdx` | `POST /api/v1/messages/send/text` | "hello world" da API |
| `enviar-imagem.mdx` | `POST /api/v1/messages/send/image` | envio de mídia |
| `enviar-lista.mdx` | `POST /api/v1/interactive/send/list` | mensagens interativas |
| `criar-grupo.mdx` | `POST /api/v1/groups/create` | gestão de grupos |
| `baixar-midia.mdx` | `POST /api/v1/media/download` | mídia recebida |

## Fluxo de atualização (objetivo central)

```
API mudou → reexporta o Swagger → npm run import:openapi → git commit
```

Endpoints novos aparecem automaticamente na navegação. Overviews e overlays
continuam válidos porque referenciam por método+path, não por schema.

## Testes / verificação

- O próprio `import:openapi` valida o spec na importação (estrutura mínima + servers).
- `mint dev` para build local; verificação de links quebrados antes do commit.
- Conferir que o playground envia requisições (prova de que `servers` foi injetado).

## Fora de escopo

- Melhorar descrições/exemplos *por endpoint* no nível do schema (isso é feito nos
  decorators do Swagger no backend, fora deste repo, e persiste nos exports).
- Overlays MDX para os demais ~85 endpoints (auto-gerados ficam disponíveis; novos
  overlays podem ser adicionados sob demanda seguindo o mesmo padrão).
- Versionamento multi-spec (v1/v2) — só há v1 hoje.

## Idioma

Todo o conteúdo em PT-BR, seguindo o tom das páginas de webhooks existentes.
