// Testes com dados fictícios (modo ?demo). Nenhum dado real é usado aqui.
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  // O login do Google não é carregado nos testes.
  await context.route("https://accounts.google.com/**", r => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
});

test("abre o modo de demonstração e navega pelas abas", async ({ page }) => {
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto("./?demo");
  await expect(page.locator(".hero .lbl")).toHaveText("Disponível nas contas");
  for (const tab of ["tx", "rep", "cards", "inv", "more", "home"]) {
    await page.click(`nav [data-tab=${tab}]`);
    await expect(page.locator("#view")).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
});

test("cria um lançamento e ele aparece na lista", async ({ page }) => {
  await page.goto("./?demo");
  await page.click("#fab");
  await page.fill("#txf [name=amount]", "12,34");
  await page.fill("#txf [name=desc]", "Teste automático");
  await page.click("#txf button[type=submit]");
  await page.click("nav [data-tab=tx]");
  await expect(page.locator("#view")).toContainText("Teste automático");
  await expect(page.locator("#view")).toContainText("R$ 12,34");
});

test("sem dados, mostra as boas-vindas", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#view")).toContainText("Bem-vindo ao Bolso");
});
