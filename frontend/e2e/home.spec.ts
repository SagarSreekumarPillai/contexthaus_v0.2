import { expect, test } from "@playwright/test";

async function mockSession(page: import("@playwright/test").Page, role = "verwalter") {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: {
        id: "u1",
        email: "e2e@test.local",
        full_name: "E2E User",
        role,
        organization_id: "org1",
        organization_name: "Test Org",
      },
    });
  });
}

/** PropertyView calls vendor APIs on mount; unmocked requests hit the real backend and can 401 → logout. */
async function mockVendorApis(page: import("@playwright/test").Page) {
  await page.route("**/api/vendors/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fulfill({ status: 200, json: {} });
      return;
    }
    await route.fulfill({ json: [] });
  });
}

test.describe("Home UX", () => {
  test("shows role onboarding modal and saves selection", async ({ page }) => {
    await mockSession(page, "verwalter");
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ch_access_token", "e2e-token");
    });
    await page.route("**/api/properties/", async (route) => {
      await route.fulfill({ json: [] });
    });

    await page.goto("/workspace");
    await expect(page.getByTestId("role-onboarding-modal")).toBeVisible();
    await page.getByTestId("role-option-owner").click();
    await expect(page.getByTestId("role-onboarding-modal")).not.toBeVisible();
    const roleEvents = await page.evaluate(() =>
      ((window as unknown as { __chEvents?: Array<{ event: string }> }).__chEvents || [])
        .filter((item) => item.event === "role_selected")
        .length
    );
    expect(roleEvents).toBeGreaterThan(0);
  });

  test("ships analytics events to configured endpoint", async ({ page }) => {
    await mockSession(page, "verwalter");
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ch_access_token", "e2e-token");
      (window as unknown as { __CH_ANALYTICS_ENDPOINT_OVERRIDE?: string }).__CH_ANALYTICS_ENDPOINT_OVERRIDE = "/__analytics_test";
    });
    await page.route("**/api/properties/", async (route) => {
      await route.fulfill({ json: [] });
    });
    await page.route("**/__analytics_test", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });

    const analyticsRequest = page.waitForRequest("**/__analytics_test");

    await page.goto("/workspace");
    await page.getByTestId("role-option-owner").click();

    const request = await analyticsRequest;
    const payload = request.postDataJSON() as { event?: string };
    expect(payload.event).toBe("role_selected");
  });

  test("shows onboarding checklist and property selection flow", async ({ page }) => {
    await mockSession(page, "verwalter");
    await mockVendorApis(page);
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ch_access_token", "e2e-token");
      window.localStorage.setItem("ch.user-role.v1", "owner");
    });

    await page.route("**/api/properties/", async (route) => {
      await route.fulfill({
        json: [
          {
            id: "prop-e2e",
            name: "E2E Property",
            address: "42 Test Street",
            context_md: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });
    });

    await page.goto("/workspace");

    await expect(page.getByText("ContextHaus")).toBeVisible();
    await expect(page.getByText("Onboarding checklist")).toBeVisible();
    await expect(page.getByText("Select your primary property")).toBeVisible();
    await expect(page.getByTestId("onboarding-progress")).toContainText("1/3");
    await expect(page.getByText("E2E Property")).toBeVisible();
    await page.getByTestId("property-list-item").first().click();
    await expect(page.getByTestId("onboarding-progress")).toContainText("2/3");
  });

  test("can hide and resume onboarding panel", async ({ page }) => {
    await mockSession(page, "verwalter");
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ch_access_token", "e2e-token");
      window.localStorage.setItem("ch.user-role.v1", "owner");
    });
    await page.route("**/api/properties/", async (route) => {
      await route.fulfill({ json: [] });
    });

    await page.goto("/workspace");
    await page.getByTestId("hide-onboarding").click();
    await expect(page.getByText("Onboarding paused")).toBeVisible();
    await page.getByTestId("resume-onboarding").click();
    await expect(page.getByText("Onboarding checklist")).toBeVisible();
    const events = await page.evaluate(() =>
      ((window as unknown as { __chEvents?: Array<{ event: string }> }).__chEvents || []).map((item) => item.event)
    );
    expect(events).toContain("onboarding_hidden");
    expect(events).toContain("onboarding_resumed");
  });

  test("shows property empty state guidance", async ({ page }) => {
    await mockSession(page, "verwalter");
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ch_access_token", "e2e-token");
      window.localStorage.setItem("ch.user-role.v1", "owner");
    });

    await page.route("**/api/properties/", async (route) => {
      await route.fulfill({ json: [] });
    });
    await page.goto("/workspace");
    await expect(page.getByText("SELECT A PROPERTY", { exact: true })).toBeVisible();
    await expect(page.getByText("or create one to get started")).toBeVisible();
  });

  test("opens command palette with keyboard and selects property", async ({ page }) => {
    await mockSession(page, "verwalter");
    await mockVendorApis(page);
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ch_access_token", "e2e-token");
      window.localStorage.setItem("ch.user-role.v1", "owner");
    });
    await page.route("**/api/properties/", async (route) => {
      await route.fulfill({
        json: [
          {
            id: "prop-a",
            name: "Alpha Tower",
            address: "1 Main Street",
            context_md: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "prop-b",
            name: "Bravo Gardens",
            address: "2 High Street",
            context_md: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });
    });

    await page.goto("/workspace");
    await page.keyboard.press("Meta+k");
    if (!(await page.getByTestId("command-palette").isVisible())) {
      await page.getByTestId("open-command-palette").click();
    }
    await expect(page.getByTestId("command-palette")).toBeVisible();
    await page.getByTestId("command-palette-input").fill("Bravo");
    await page.getByTestId("command-property-item").first().click();
    await expect(page.getByTestId("selected-property-title")).toContainText("Bravo Gardens");
  });

  test("shows retry action when property loading fails", async ({ page }) => {
    await mockSession(page, "verwalter");
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ch_access_token", "e2e-token");
      window.localStorage.setItem("ch.user-role.v1", "owner");
    });
    let requestCount = 0;
    await page.route("**/api/properties/", async (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({ status: 500, json: { detail: "boom" } });
        return;
      }
      await route.fulfill({ json: [] });
    });

    await page.goto("/workspace");
    await expect(page.getByText("Could not load properties. Check your connection and retry.")).toBeVisible();
    await page.getByTestId("retry-load-properties").click();
    await expect(page.getByText("Could not load properties. Check your connection and retry.")).not.toBeVisible();
    const events = await page.evaluate(() =>
      ((window as unknown as { __chEvents?: Array<{ event: string }> }).__chEvents || []).map((item) => item.event)
    );
    expect(events).toContain("properties_retry_clicked");
  });

  test("shows ingest retry and succeeds on retry", async ({ page }) => {
    await mockSession(page, "verwalter");
    await mockVendorApis(page);
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ch_access_token", "e2e-token");
      window.localStorage.setItem("ch.user-role.v1", "owner");
    });

    await page.route("**/api/properties/prop-ingest", async (route) => {
      await route.fulfill({
        json: {
          id: "prop-ingest",
          name: "Ingest Test Property",
          address: "99 Retry Lane",
          context_md: "## Summary\n- Updated",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    });

    await page.route("**/api/properties/", async (route) => {
      await route.fulfill({
        json: [
          {
            id: "prop-ingest",
            name: "Ingest Test Property",
            address: "99 Retry Lane",
            context_md: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });
    });

    let ingestAttempt = 0;
    await page.route("**/api/ingest/prop-ingest/source", async (route) => {
      ingestAttempt += 1;
      if (ingestAttempt === 1) {
        await route.fulfill({ status: 500, json: { detail: "first attempt failed" } });
        return;
      }
      await route.fulfill({
        json: {
          status: "ingested",
          filename: "sample.txt",
          changes: [{ section: "Summary", type: "updated" }],
          context_md: "## Summary\n- Updated",
        },
      });
    });

    await page.goto("/workspace");
    await page.getByTestId("property-list-item").first().click();

    await page.getByTestId("ingest-file-input").setInputFiles({
      name: "sample.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("test content"),
    });
    await expect(page.getByTestId("ingest-error-message")).toBeVisible();

    await page.getByTestId("retry-ingest-button").click();
    await expect(page.getByTestId("ingest-error-message")).not.toBeVisible();
    await expect(page.getByText("✓ INGESTED — sample.txt")).toBeVisible();
    await expect(page.getByTestId("onboarding-progress")).toContainText("3/3");
    const events = await page.evaluate(() =>
      ((window as unknown as { __chEvents?: Array<{ event: string }> }).__chEvents || []).map((item) => item.event)
    );
    expect(events).toContain("ingest_failed");
    expect(events).toContain("ingest_retry_clicked");
    expect(events).toContain("ingest_succeeded");
  });
});
