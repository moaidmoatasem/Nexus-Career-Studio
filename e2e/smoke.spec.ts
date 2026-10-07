import { expect, test } from "@playwright/test";

// One journey through the real app: sign up, add verified evidence, import a role from pasted text,
// then tailor for it. The AI replies come from e2e/fake-ai.mjs; everything else is the real stack.

const JOB_TEXT = `Platform Engineer at Example Robotics. We are looking for an engineer to build and run
reliable services in TypeScript on PostgreSQL. You will work with product teams, own deployments and
improve our testing with Playwright. Remote within the United Kingdom.`;

test("sign up, add evidence, import a role and tailor for it", async ({ page }) => {
  const email = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await test.step("sign up", async () => {
    await page.goto("/auth");
    await page.getByRole("button", { name: "No account? Sign up" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("smoke-test-password");
    await page.getByRole("button", { name: "Sign up", exact: true }).click();
    await expect(page).toHaveURL(/\/radar/, { timeout: 20_000 });
  });

  await test.step("add a verified Career Vault item", async () => {
    await page.goto("/vault");
    await page.getByRole("button", { name: "Add item" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Role or achievement title").fill("Software Engineer");
    await dialog.getByPlaceholder("Organization").fill("Example Labs");
    await dialog.getByPlaceholder("Skills (comma separated)").fill("TypeScript, PostgreSQL");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Software Engineer").first()).toBeVisible();
  });

  await test.step("import a role from pasted text", async () => {
    await page.goto("/radar");
    await page.getByRole("button", { name: "Paste job link" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("paste the job text instead").click();
    await dialog.getByPlaceholder(/Paste the job description here/).fill(JOB_TEXT);
    await dialog.getByRole("button", { name: "Import from text" }).click();
    await expect(page.getByText("Job imported and ready to review")).toBeVisible({
      timeout: 20_000,
    });
  });

  await test.step("tailor for the role", async () => {
    await page.goto("/synthesize");
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Platform Engineer · Example Robotics" }).click();
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(
      page.getByText(
        "Fact-check passed — every number and metric traces to your verified Career Vault.",
      ),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/I would like to join Example Robotics/)).toBeVisible();
  });
});
