import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.PW_BASE_URL || "http://localhost:5173";
const LOGIN_USER = process.env.PW_USER || "admin@admin.com";
const LOGIN_PASSWORD = process.env.PW_PASSWORD || "admin123";
const TUNNEL_PASSWORD = process.env.PW_TUNNEL_PASSWORD || "";
const HEADLESS = process.env.PW_HEADLESS !== "false";

const ROUTES = [
  "/",
  "/employees",
  "/companies",
  "/calendar",
  "/timesheet",
  "/assets",
  "/inbox",
  "/audit",
  "/reports",
  "/anomalies",
  "/import",
  "/users",
  "/settings",
  "/profile",
  "/vacations",
  "/expenses",
  "/reconciliation",
];

const OUTPUT_DIR = path.resolve("output/playwright");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  loginUser: LOGIN_USER,
  login: { success: false, error: null },
  routeChecks: [],
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  apiErrors: [],
};

const saveReport = () => {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "smoke-report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );
};

const run = async () => {
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();
  let currentRoute = "/login";

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      report.consoleErrors.push({
        route: currentRoute,
        url: page.url(),
        message: msg.text(),
      });
    }
  });

  page.on("pageerror", (error) => {
    report.pageErrors.push({
      route: currentRoute,
      url: page.url(),
      message: String(error?.message || error),
    });
  });

  page.on("requestfailed", (request) => {
    report.failedRequests.push({
      route: currentRoute,
      method: request.method(),
      url: request.url(),
      failure: request.failure()?.errorText || "unknown",
    });
  });

  page.on("response", async (response) => {
    if (!response.url().includes("/api/")) return;
    if (response.status() < 400) return;
    if (response.url().includes("/auth/me") && response.status() === 401) return;
    let body = "";
    try {
      body = (await response.text()).slice(0, 300);
    } catch {}
    report.apiErrors.push({
      route: currentRoute,
      status: response.status(),
      url: response.url(),
      body,
    });
  });

  try {
    await page.goto(`${BASE_URL}/login`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // LocalTunnel may show a password gate before the app.
    const title = await page.title().catch(() => "");
    if (/Tunnel website ahead/i.test(title)) {
      if (!TUNNEL_PASSWORD) {
        throw new Error(
          "Tunnel gate detected. Set PW_TUNNEL_PASSWORD to continue."
        );
      }

      await page.locator("input").first().fill(TUNNEL_PASSWORD);
      await page
        .getByRole("button", { name: /Click to Submit|Submit/i })
        .first()
        .click();
      await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: path.join(OUTPUT_DIR, "01-login.png"),
      fullPage: true,
    });

    await page.getByPlaceholder("admin@empresa.com o 12345678Z").fill(LOGIN_USER);
    await page.locator('input[type="password"]').first().fill(LOGIN_PASSWORD);
    await page.getByRole("button", { name: /Entrar al Sistema/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15000,
    });

    report.login.success = true;
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "02-after-login.png"),
      fullPage: true,
    });

    for (const route of ROUTES) {
      currentRoute = route;
      const result = {
        route,
        status: null,
        navOk: false,
        urlAfter: null,
        title: null,
        visibleError: null,
      };

      try {
        const response = await page.goto(`${BASE_URL}${route}`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        result.status = response?.status() ?? null;
        result.navOk = true;
      } catch (error) {
        result.navOk = false;
        result.visibleError = String(error?.message || error);
      }

      await page.waitForTimeout(2000);
      result.urlAfter = page.url();
      result.title = await page.title().catch(() => null);

      const errorCandidate = page
        .locator(
          'text=/Error|Acceso denegado|No autorizado|No vinculado|No hay|Failed/i'
        )
        .first();
      if (await errorCandidate.isVisible().catch(() => false)) {
        result.visibleError =
          (await errorCandidate.textContent().catch(() => null)) || result.visibleError;
      }

      const screenshotName =
        "route-" + route.replace(/[^a-z0-9]/gi, "_").replace(/^_+$/, "root") + ".png";
      await page
        .screenshot({
          path: path.join(OUTPUT_DIR, screenshotName),
          fullPage: true,
        })
        .catch(() => {});

      report.routeChecks.push(result);
    }
  } catch (error) {
    report.login.error = String(error?.message || error);
  } finally {
    saveReport();
    await context.close();
    await browser.close();
  }
};

run()
  .then(() => {
    const summary = {
      loginSuccess: report.login.success,
      checkedRoutes: report.routeChecks.length,
      apiErrors: report.apiErrors.length,
      consoleErrors: report.consoleErrors.length,
      pageErrors: report.pageErrors.length,
      failedRequests: report.failedRequests.length,
      reportPath: "output/playwright/smoke-report.json",
    };
    console.log(JSON.stringify(summary, null, 2));
  })
  .catch((error) => {
    saveReport();
    console.error(error);
    process.exit(1);
  });
