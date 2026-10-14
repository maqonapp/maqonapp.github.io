# MAQON V1.6.3 — Pacote de homologação de autenticação

**NÃO PUBLICAR PARA CLIENTES PAGANTES.** Esta entrega mantém a interface V1.5.14, implementa a tela de login via Supabase Auth e a consulta **somente leitura** de equipamentos da empresa autenticada. Edição de equipamentos em modo nuvem fica bloqueada intencionalmente. CRM, propostas, manutenções, anexos e PDFs continuam com armazenamento local no navegador; NÃO utilizá-los com dados reais de empresas distintas.

## Mudanças no pacote
- `maqon-auth-pilot.js`: login/logout, verificação de vínculo com exatamente uma empresa e consulta RLS ao cadastro de equipamentos.
- `maqon-supabase-config.js`: duas configurações públicas, ainda vazias por segurança.
- `index.html`: carrega biblioteca Supabase e módulo de homologação depois dos scripts existentes.
- `app.js`: mostra equipamentos retornados da nuvem e bloqueia ações de escrita nesse módulo quando o modo Supabase é configurado.
- Outros arquivos V1.5.14 inalterados.

## Para testar (em branch separada)
1. Criar branch `homologacao-v1.6.3` a partir de `main` no GitHub; não substituir imediatamente o site de produção.
2. Preencher `maqon-supabase-config.js` com **Project URL** e **publishable key** do projeto MAQON; estes valores são públicos por design. **Nunca** inserir `service_role`, `sb_secret`, senha do banco ou tokens de integrações.
3. Supabase > Data API > Settings: para o piloto, é preciso expor **apenas** `maqon_usuarios` e `maqon_equipamentos`, mas a interface avisa que selecionar pode substituir grants personalizados. Antes de usar, auditar grants e políticas RLS; não selecionar automaticamente todas as tabelas. A tabela `maqon_usuarios` deve ser SELECT-only para authenticated e não permitir alteração de perfis; `maqon_equipamentos` pode permanecer SELECT-only nesta fase. Não expor `auth.users`.
4. Confira que `authenticated` possui `SELECT` nessas duas tabelas, `anon` não possui permissões, e ambas usam RLS. Autentique as duas contas de homologação em sessões separadas e confirme que o usuário A não vê os registros da empresa B. Verifique a ausência de acesso anônimo à API.
5. Para ativar a consulta de equipamentos na API sem cadastrar dados ainda, há uma tabela vazia para cada cliente, de modo que a lista após login pode estar vazia. Isso é normal.
6. Validar num endereço de homologação, nunca em `main`/domínio de clientes durante estes testes.

## Limitações deliberadas / pendências antes da venda
- Não há cadastro, edição ou exclusão remotos de equipamentos; bloqueamos para prevenir gravação acidental ou misturas.
- Manutenções, fotografias, documentos, propostas e leads ainda não sincronizam com banco; armazenamento local **não** é isolamento empresarial.
- Não existe bucket privado com políticas de download, webhook confiável de cobrança ou ativação/suspensão automática de planos.
- A integração de login aqui não substitui testes com JWT real, autorização por empresa, políticas de escrita, tratamento de sessões e revisão de segurança.
- O backend Render e suas integrações Meta/WhatsApp/HubSpot são preservados e não alterados.

**Próximo pacote necessário**: migração planejada dos dados locais para tabelas próprias com IDs imutáveis, CRUD remoto seguro e armazenamento privado; testes de regressão; pagamentos e ativação de assinaturas.
