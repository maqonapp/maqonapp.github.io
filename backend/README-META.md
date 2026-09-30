# MAQON — Backend seguro Meta API

Este backend é a camada que permite à página estática do MAQON conectar Facebook/Instagram sem expor `META_APP_SECRET` ou tokens no `app.js`.

## O que já está implementado

- OAuth Meta com `state` assinado e expiração.
- App Secret e tokens somente no servidor.
- Tokens e leads persistidos em arquivo criptografado AES-256-GCM.
- Lista de Páginas autorizadas e conta profissional do Instagram vinculada.
- Seleção de Página pelo painel MAQON.
- Inscrição da Página no webhook `leadgen`.
- Verificação de `hub.verify_token` e assinatura `X-Hub-Signature-256`.
- Sincronização manual de formulários/Leads Ads.
- Recebimento de novos leads por webhook.
- Importação para o CRM MAQON com deduplicação pelo `metaLeadId`.
- CORS limitado ao domínio configurado em `FRONTEND_URL` e rotas administrativas protegidas por `MAQON_ADMIN_TOKEN`.

## 1. Instalar e testar

```bash
cd backend
cp .env.example .env
npm install
npm run check
npm start
```

Teste: `GET /health`.

## 2. Variáveis obrigatórias

Preencha `.env` com a URL pública do MAQON, credenciais do App Meta e chaves aleatórias. Não faça commit do arquivo `.env`.

`META_GRAPH_VERSION` vem preparado para `v26.0`. Antes de futuras atualizações, confira a versão atual da Graph API.

## 3. Configuração no Meta for Developers

No App da Meta, configure a URL de redirecionamento exatamente igual a `META_REDIRECT_URI` e o webhook da Page como:

`https://SEU-BACKEND/api/meta/webhook`

Use no painel da Meta o mesmo valor de `META_WEBHOOK_VERIFY_TOKEN`.

Para Lead Ads, as permissões e níveis de acesso dependem do tipo do App e do App Review. O arquivo `.env.example` traz o conjunto usado pelo MAQON; ajuste `META_SCOPES` somente conforme o caso de uso aprovado pela Meta.

A API do Instagram por Facebook Login só funciona com conta profissional (Business/Creator) vinculada a uma Página. Se o Instagram for conta pessoal, converta-a para profissional antes da conexão.

## 4. No painel MAQON

Na tela **Integrações**:

1. Informe a URL pública HTTPS deste backend.
2. Informe a mesma `MAQON_ADMIN_TOKEN` no campo “Chave local do painel MAQON”.
3. Clique em **Salvar integrações**.
4. Clique em **Conectar Meta**.
5. Autorize Facebook/Instagram.
6. Escolha a Página correta e clique em **Usar página**.
7. Clique em **Sincronizar Leads**.

O navegador nunca recebe `META_APP_SECRET`, Page Access Token ou User Access Token.

## Produção

O arquivo criptografado precisa ficar em armazenamento persistente. Em hospedagens com filesystem efêmero, use volume persistente ou substitua o pequeno adaptador `readStore`/`writeStore` por banco/secret store gerenciado antes de operar em escala.
