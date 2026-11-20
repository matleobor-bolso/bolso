# Bolso

App pessoal de finanças (contas, cartões, limites de gastos, investimentos), feito para o celular.

- **App:** https://matleobor-bolso.github.io/bolso/
- **Dados:** ficam no aparelho e no arquivo `bolso-dados.json` do Google Drive do dono. O app usa apenas o escopo `drive.file`, então só enxerga os arquivos que ele mesmo criou. **Nenhum dado financeiro fica neste repositório.**
- **Segurança:** bloqueio por digital (WebAuthn) no aparelho, política de segurança de conteúdo (CSP) restrita, sem bibliotecas de terceiros além do login do Google.

## Estrutura

| Caminho | O que é |
|---|---|
| `app/` | O site publicado: `index.html`, `app.js`, `app.css`, `sw.js` (offline), manifesto e ícones |
| `scripts/check.mjs` | Verificações: sintaxe, versão e bloqueio de arquivos de dados |
| `tests/` | Testes automáticos com dados fictícios (`?demo`) |
| `.github/workflows/` | `ci.yml` testa cada Pull Request; `deploy.yml` publica a `main` no GitHub Pages |

## Fluxo de mudanças

1. Toda mudança é feita numa branch (`claude/<descrição>`) e chega à `main` por Pull Request.
2. O CI precisa passar; o dono revisa e aprova.
3. Ao entrar na `main`, o GitHub Pages publica sozinho. O app mostra "Nova versão disponível" e o dono escolhe quando atualizar.

## Rodar localmente

```bash
npm ci
npm run serve          # abre em http://localhost:4173/  (use ?demo para dados fictícios)
npm run check
npx playwright test
```
