# Documentação D-API

Documentação oficial da [D-API](https://app.d-api.cloud) — APIs de **WhatsApp (não oficial)**, **SMS** e **URA (voz/IVR)**. Construída com [Mintlify](https://mintlify.com).

## Desenvolvimento

Instale a CLI do Mintlify e rode o servidor local na raiz deste diretório (onde está o `docs.json`):

```
npx mint@latest dev
```

A pré-visualização fica em `http://localhost:3000`.

## Estrutura

- `docs.json` — configuração, identidade visual e navegação (uma aba por produto).
- `whatsapp/` · `sms/` · `ura/` — páginas de documentação por produto.
- `api-reference/` — referência da API. O `openapi.json` é gerado pelo script de import (não editar à mão); a prosa fica nas páginas MDX (`introduction`, `quickstart`, `endpoints/`).
- `en/` — versão em inglês, espelhando os mesmos caminhos (`whatsapp/x.mdx` → `en/whatsapp/x.mdx`). O português é o idioma padrão e não tem prefixo de rota.
- `logo/`, `favicon.png` — identidade visual.

## Verificação

```
npx mint@latest broken-links
```

## Atualizar a API Reference

Quando a API mudar, reexporte o JSON do Swagger do backend e rode:

```
npm run import:openapi -- "/caminho/para/o/export.json"
```

Sem argumento, o script usa o `api*.json` mais recente em `~/Downloads`. Ele injeta a base URL (`servers`) e valida o spec. Depois, faça commit do `api-reference/openapi.json` atualizado. Endpoints novos aparecem automaticamente na navegação.

O import também gera o `api-reference/openapi.en.json` a partir do dicionário `api-reference/openapi.en.strings.json` (texto em português → inglês). Textos novos sem tradução ficam em português e são listados no fim do import: adicione-os ao dicionário e rode `npm run translate:openapi`.

## Idiomas

Toda página nova ou alterada em português precisa da versão em `en/` e da entrada correspondente no idioma `en` do `docs.json`. O `npm test` falha se uma página, um link interno ou um texto da OpenAPI ficar sem tradução.

## Publicação

As mudanças são publicadas automaticamente ao integrar na branch padrão (via app do Mintlify no GitHub).
