import { test, expect } from "./fixture.mjs";
import { openPage } from "./navigation.mjs";

test.use({ productionBroker: true, savedSidebar: true, sidebarIcons: true });

// The fixture groups use custom-emoji icons; serve every one as a plain image.
test.beforeEach(({ page }) =>
  page.route("**/media?*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>',
    }),
  ),
);

// Why the focused element can't be seen, or "" when it can: every ancestor's
// opacity multiplies, and a point at its center has to land on it, which
// catches clipping, zero size and anything covering it.
function unseen(element) {
  if (!element || element === document.body) return "nothing focused";
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return "no size";
  if (getComputedStyle(element).visibility !== "visible") return "hidden";
  let opacity = 1;
  for (let node = element; node; node = node.parentElement)
    opacity *= parseFloat(getComputedStyle(node).opacity);
  if (opacity < 1) return `opacity ${opacity}`;
  const hit = document.elementFromPoint(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  );
  return hit && element.contains(hit) ? "" : "covered or clipped";
}

// Anything focusable has to be visible while it has focus. Tabbing through
// the unified sidebar reaches every control, whichever component draws it and
// however it hides at rest, so a control revealed by a rule that can't match
// fails here.
test("every control Tab reaches in the sidebar is visible while focused", async ({
  page,
  app,
}) => {
  await page.goto(app.origin);
  await openPage(page, "Messages");
  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  await expect(
    sidebar.getByRole("tablist", { name: "Navigation scope" }),
  ).toHaveCount(0);
  await page.mouse.move(0, 0);
  await sidebar
    .getByRole("navigation", { name: "Pages" })
    .getByRole("button")
    .first()
    .focus();
  let quiet = 0;
  const seen = new Set();
  for (let stop = 0; stop < 400; stop += 1) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const element = document.activeElement;
      const aside = element?.closest('aside[aria-label="Sidebar"]');
      if (!aside) return null;
      return {
        key: [...aside.querySelectorAll("*")].indexOf(element),
        label:
          element.getAttribute("aria-label") ||
          element.textContent.trim().slice(0, 40),
        quiet: !!element.closest("[data-navigation-reveal]"),
      };
    });
    // Focus left the sidebar, or wrapped back to where it started.
    if (!focus || seen.has(focus.key)) break;
    seen.add(focus.key);
    if (focus.quiet) quiet += 1;
    await expect
      .poll(() => page.locator(":focus").evaluate(unseen), {
        message: `Focused "${focus.label}" can't be seen`,
      })
      .toBe("");
  }
  // Heading actions that hide at rest were among the stops.
  expect(quiet).toBeGreaterThan(0);
});

test("closing a heading's dialog with the mouse leaves its menu button visible", async ({
  page,
  app,
}) => {
  await page.goto(app.origin);
  await openPage(page, "Messages");
  const more = page.getByRole("button", { name: "More actions for Work" });
  await more.click();
  await page.getByRole("menuitem", { name: "Workspace settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Workspace settings" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await page.mouse.move(0, 0);
  // Focus returns to the menu button, so it has to stay visible.
  await expect(more).toBeFocused();
  await expect.poll(() => more.evaluate(unseen)).toBe("");
});

test.describe("passive channel removal", () => {
  const soloIds = Array.from(
    { length: 16 },
    (_, index) =>
      `c0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  );

  test.use({
    sidebarIcons: false,
    channelIds: ["alpha", "beta", ...soloIds],
    ownSoloChannels: soloIds,
    soloChannels: soloIds,
  });

  // Only a browser can show that recovering keyboard focus scrolls a list
  // after a relay update, even when the user has already scrolled elsewhere.
  test("keeps the visible Solo row when a focused channel is archived above it", async ({
    page,
    app,
  }) => {
    await page.setViewportSize({ width: 1100, height: 430 });
    await page.goto(app.origin);
    await openPage(page, "Messages");
    const sidebar = page.getByRole("navigation", {
      name: "Subscribed channels",
    });
    const workspace = sidebar.locator('[data-sidebar-section="group:work"]');
    const beta = workspace.getByRole("button", { name: "Beta", exact: true });
    const anchor = sidebar.locator(
      `button[data-solo-destination-id="${soloIds[8]}"]`,
    );
    await expect(anchor).toBeVisible();
    await expect.poll(() => app.relay.hasRoute("primary", "beta")).toBe(true);
    await beta.focus();
    await anchor.evaluate((row) => {
      const viewport = row.closest("nav");
      viewport.scrollTop +=
        row.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top -
        10;
    });
    await expect(beta).toBeFocused();
    await expect(beta).not.toBeInViewport();
    await expect(anchor).toBeInViewport({ ratio: 1 });
    const offset = () =>
      anchor.evaluate(
        (row) =>
          row.getBoundingClientRect().top -
          row.closest("nav").getBoundingClientRect().top,
      );
    const before = await offset();

    app.setChannelMetadata("beta", [
      ["name", "Beta"],
      ["t", "stream"],
      ["public"],
      ["archived", "true"],
    ]);
    await expect(
      workspace.locator('button[data-channel-id="beta"]'),
    ).toHaveCount(0);
    await expect(workspace.locator("summary")).toBeFocused();
    await expect(anchor).toBeInViewport({ ratio: 1 });
    expect(await offset()).toBeCloseTo(before, 0);
  });
});
