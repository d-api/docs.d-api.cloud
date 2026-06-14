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

## Publicação

As mudanças são publicadas automaticamente ao integrar na branch padrão (via app do Mintlify no GitHub).
