import { expect, test, type Locator } from "@playwright/test";

const viewer = "/tests/fixtures/design-system.html";

const expectKeyboardRing = async (control: Locator, offset = "2px") => {
  await expect(control).toHaveCSS("outline-style", "solid");
  await expect(control).toHaveCSS("outline-width", "2px");
  await expect(control).toHaveCSS("outline-offset", offset);
};

test("expanded Settings cards own adjacent borders and keep long text keyboard-scrollable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`${viewer}#/design/components/accordion`);
  const example = page.getByRole("region", {
    name: "Settings disclosures with an expanded card",
  });
  const publishing = example.getByRole("button", { name: "Publishing" });
  const notes = example.locator(".buzz-accordion").filter({
    has: page.getByRole("button", { name: "Working notes" }),
  });
  const card = example.locator(".buzz-accordion-item").filter({
    has: page.getByRole("button", { name: "Publishing" }),
  });
  const cardStyle = (property: string) =>
    card.evaluate(
      (item, name) => getComputedStyle(item, "::before").getPropertyValue(name),
      property,
    );

  await expect(publishing).toHaveAccessibleDescription("Default instructions");
  await expect.poll(() => cardStyle("opacity")).toBe("0");
  await expect(notes).not.toHaveCSS(
    "border-block-start-color",
    "rgba(0, 0, 0, 0)",
  );

  await publishing.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(publishing).toBeFocused();
  await publishing.press("Enter");
  await expect(publishing).toHaveAttribute("aria-expanded", "true");
  await expectKeyboardRing(publishing, "-2px");
  await expect.poll(() => cardStyle("opacity")).toBe("1");
  expect(Number.parseFloat(await cardStyle("inset-inline-start"))).toBeLessThan(
    0,
  );
  await expect(card).toHaveCSS("border-block-start-color", "rgba(0, 0, 0, 0)");
  await expect(notes).toHaveCSS("border-block-start-color", "rgba(0, 0, 0, 0)");

  const body = card.locator(".buzz-accordion-scroll");
  await expect(body).toHaveAttribute("data-overflow-end", "");
  await expect(body).not.toHaveCSS("mask-image", "none");
  await page.keyboard.press("Tab");
  await expect(body).toBeFocused();
  await expectKeyboardRing(body, "-2px");
  await expect(body).toHaveCSS("mask-image", "none");
  await page.keyboard.press("End");
  await expect(body).not.toHaveAttribute("data-overflow-end");
  await page.keyboard.press("Tab");
  await expect(
    card.getByRole("button", { name: "Restore default" }),
  ).toBeFocused();
  await expect(body).toHaveCSS("mask-image", "none");

  await publishing.press("Space");
  await expect(publishing).toHaveAttribute("aria-expanded", "false");
  await expect.poll(() => cardStyle("opacity")).toBe("0");
  await expect(notes).not.toHaveCSS(
    "border-block-start-color",
    "rgba(0, 0, 0, 0)",
  );

  const standard = notes.getByRole("button", { name: "Working notes" });
  await standard.click();
  const standardBody = notes.locator(".buzz-accordion-scroll");
  await expect(standardBody).toHaveCSS("max-block-size", "320px");
  await expect(standardBody).toHaveCSS("mask-image", "none");
});
