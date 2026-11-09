import { expect } from "@playwright/test";

export async function expectRoutesFit(page, routes, width, height = 844) {
  await page.setViewportSize({ width, height });
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
      route + " at " + width,
    ).toBe(true);
  }
}
