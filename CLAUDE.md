# Instruções para manutenção do Bolso

App de finanças pessoais do Matheus. Site estático em `app/`, publicado no GitHub Pages a partir da `main`.
Conversa com o usuário em **português do Brasil**; textos do app também em português.

## Regras inegociáveis

- **Nunca** colocar dados reais no repositório: backups, exportações, prints com valores, nomes de contas reais em testes. Testes usam só `?demo` e dados inventados. `scripts/check.mjs` barra arquivos suspeitos — não afrouxe essa verificação.
- **Nunca** enviar direto para a `main`. Trabalhar em `claude/<descrição-curta>` e abrir Pull Request descrevendo a mudança, com prints do modo `?demo`.
- **Nunca** adicionar scripts, fontes ou CDNs de terceiros. O único externo permitido é `https://accounts.google.com/gsi/client` (login Google). Se precisar mudar, atualize a CSP em `app/index.html` e explique no PR.
- Escopo do Google: somente `https://www.googleapis.com/auth/drive.file`. Não ampliar.
- Todo texto vindo do usuário passa por `esc()` antes de ir para HTML.
- O `GOOGLE_CLIENT_ID` em `app/app.js` é público por design. Nunca adicionar *client secret* ou tokens.

## A cada mudança

1. Aumentar a versão em **dois lugares iguais**: `APP_VERSION` em `app/app.js` e `VERSION` em `app/sw.js` (o CI confere). Se um arquivo novo precisar funcionar offline, incluí-lo em `SHELL` no `sw.js`.
2. Se o formato dos dados mudar: incrementar `schema` em `snapshot()`, migrar dados antigos ao carregar (ver `migrateInv()`), e garantir backup antes da migração.
3. Rodar `node scripts/check.mjs` e `npx playwright test` antes do PR.

## Arquitetura (resumo)

- `app/app.js`: estado `S` (`cfg` com contas/cartões/categorias/limites; `months` = lançamentos por mês `YYYY-MM`).
- Persistência: IndexedDB no aparelho (`kv`: `data`, `sync`) + Google Drive (`bolso-dados.json`), com controle de versão e diálogo de conflito; backup mensal `bolso-backup-YYYY-MM.json` no Drive.
- Tipos de lançamento: `exp`, `inc`, `tr` (transferência; aporte/resgate quando envolve conta de investimento), `rend` (rendimento).
- Contas têm `kind`: `dia` (dia a dia) ou `inv` (investimento, com `goal`/`goalDate` opcionais).
- Bloqueio por digital: WebAuthn local (`enableLock`/`unlock`), credencial guardada só no `localStorage` do aparelho.
