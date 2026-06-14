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
- `api-reference/` — referência da API (em construção).
- `logo/`, `favicon.png` — identidade visual.

## Verificação

```
npx mint@latest broken-links
```

## Publicação

As mudanças são publicadas automaticamente ao integrar na branch padrão (via app do Mintlify no GitHub).
