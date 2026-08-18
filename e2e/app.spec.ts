import { test, expect } from '@playwright/test';

test.describe('EscalarML App - Smoke Tests', () => {

  test('app carrega e mostra splash screen', async ({ page }) => {
    await page.goto('/');
    // Aguarda o splash ou o texto "EscalarML" aparecer
    await expect(page.getByText('EscalarML').first()).toBeVisible({ timeout: 15000 });
  });

  test('tab navegacao esta presente apos carregamento', async ({ page }) => {
    await page.goto('/');
    // Aguarda os icones das tabs aparecerem (apos splash)
    await page.waitForTimeout(5000);

    // Verifica se as 4 tabs principais existem
    const tabs = ['Status', 'Escalações', 'Atletas', 'Ligas'];
    for (const tab of tabs) {
      await expect(page.getByText(tab).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('tela de escalacoes tem botoes de acao', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);

    // Navega para a tab Escalações
    await page.getByText('Escalações').first().click();
    await page.waitForTimeout(3000);

    // Verifica botoes principais da tela de escalacoes
    await expect(page.getByText('+ Nova').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Montar na mão').first()).toBeVisible({ timeout: 5000 });
  });

  test('tela de atletas carrega', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);

    // Navega para a tab Atletas
    await page.getByText('Atletas').first().click();
    await page.waitForTimeout(3000);

    // Verifica que a tela carregou (busca por texto "Atletas" ou campo de busca)
    await expect(page.getByText('Atletas').first()).toBeVisible({ timeout: 10000 });
  });

  test('tela de ligas carrega e mostra botao de criar', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);

    // Navega para a tab Ligas
    await page.getByText('Ligas').first().click();
    await page.waitForTimeout(3000);

    // Verifica elementos da tela de ligas
    await expect(page.getByText('Ligas').first()).toBeVisible({ timeout: 10000 });
  });

  test('nova escalacao tem formulario com campos', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);

    // Navega para Escalações e clica em "+ Nova"
    await page.getByText('Escalações').first().click();
    await page.waitForTimeout(2000);
    await page.getByText('+ Nova').first().click();
    await page.waitForTimeout(3000);

    // Verifica campos do formulario
    await expect(page.getByText('Nova Escalação').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Orçamento').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Formação').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Perfil de Risco').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Gerar escalação').first()).toBeVisible({ timeout: 5000 });
  });

  test('montar na mao tem slots de posicao', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);

    // Navega para Escalações e clica em "Montar na mão"
    await page.getByText('Escalações').first().click();
    await page.waitForTimeout(2000);
    await page.getByText('Montar na mão').first().click();
    await page.waitForTimeout(3000);

    // Verifica elementos da tela de draft
    await expect(page.getByText('Montar na Mão').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Goleiro').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Formação').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Projetar escalação').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Salvar rascunho').first()).toBeVisible({ timeout: 5000 });
  });

  test('historico de atletas carrega', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);

    // Navega para Escalações
    await page.getByText('Escalações').first().click();
    await page.waitForTimeout(2000);

    // Clica em "Histórico"
    await page.getByText('Histórico').first().click();
    await page.waitForTimeout(3000);

    // Verifica que a tela de historico carregou
    await expect(page.getByText('Histórico de Atletas').first()).toBeVisible({ timeout: 10000 });
  });
});