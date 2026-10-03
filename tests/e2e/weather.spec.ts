import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import raw from '../fixtures/tulsa.json' with { type: 'json' };

const NOW = new Date('2026-10-03T02:35:00Z');
const TRANSPARENT_TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
  'base64',
);
const manifest = {
  host: 'https://tilecache.rainviewer.com',
  radar: {
    past: [0, 1, 2].map((i) => ({
      time: NOW.getTime() / 1000 - 1200 + i * 600,
      path: `/v2/radar/test${i}`,
    })),
  },
};
function nav(page: Page, info: TestInfo) {
  return page.getByRole('navigation', {
    name: info.project.name === 'mobile' ? 'Mobile forecast views' : 'Forecast views',
    exact: true,
  });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: raw }));
  await page.route('https://api.weather.gov/**', (route) =>
    route.fulfill({ json: { features: [] } }),
  );
  await page.route('https://api.rainviewer.com/**', (route) => route.fulfill({ json: manifest }));
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: TRANSPARENT_TILE }),
  );
  await page.route('https://tilecache.rainviewer.com/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: TRANSPARENT_TILE }),
  );
  await page.route('https://geocoding-api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: 2643743,
            name: 'London',
            admin1: 'England',
            country: 'United Kingdom',
            country_code: 'GB',
            latitude: 51.5085,
            longitude: -0.1257,
          },
        ],
      },
    }),
  );
});

test('shows actual-shaped forecasts, converts units, and persists preferences', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.current-temperature')).toContainText('67°');
  await expect(page.locator('.hour-column')).toHaveCount(24);
  await expect(page.locator('.day-row')).toHaveCount(5);
  await page.getByRole('button', { name: '°C', exact: true }).click();
  await expect(page.locator('.current-temperature')).toContainText('20°');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.reload();
  await expect(page.locator('.current-temperature')).toContainText('20°');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});

test('navigates to hourly, daily and radar views with functional controls', async ({
  page,
}, info) => {
  await page.goto('/');
  await expect(page.locator('.current-temperature')).toBeVisible();
  await nav(page, info).getByRole('button', { name: 'Hourly', exact: true }).click();
  await expect(page.locator('.hourly-table-row')).toHaveCount(24);
  await page.getByRole('button', { name: 'Next 24 hours', exact: true }).click();
  await expect(page.getByText('24–48 hours ahead')).toBeVisible();
  await page.getByRole('button', { name: 'Precipitation', exact: true }).click();
  await expect(page.locator('.temperature-chart')).toHaveClass(/rain/);
  await nav(page, info).getByRole('button', { name: '10 days', exact: true }).click();
  await expect(page.locator('.day-row')).toHaveCount(10);
  await page.locator('.day-row').first().click();
  await expect(page.locator('.day-detail')).toBeVisible();
  await nav(page, info).getByRole('button', { name: 'Radar', exact: true }).click();
  await expect(page.locator('.map-time')).not.toContainText('Loading');
  await page.getByRole('slider', { name: 'Radar history' }).fill('0');
  await expect(page.getByRole('slider')).toHaveValue('0');
  await page.getByRole('button', { name: 'Play radar animation' }).click();
  await expect(page.getByRole('button', { name: 'Pause radar animation' })).toBeVisible();
  await expect.poll(() => page.getByRole('slider').inputValue()).not.toBe('0');
  await page.getByRole('button', { name: 'Latest', exact: true }).click();
  await expect(page.getByRole('slider')).toHaveValue('2');
});

test('searches cities, preserves keyboard access, and remembers a saved place', async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  const input = page.getByRole('combobox');
  await expect(input).toBeFocused();
  await input.fill('London');
  await expect(page.getByRole('option')).toHaveCount(1);
  await input.press('Enter');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('London');
  await expect(page.getByText('In-app weather alerts cover U.S. locations.')).toBeVisible();
  await page.getByRole('button', { name: 'Save location', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('London');
  await expect(page.getByRole('button', { name: 'Unsave location' })).toBeVisible();
  await page.keyboard.press('/');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('never shows the old city forecast while a newly selected city is loading', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.current-temperature')).toBeVisible();
  await page.route('https://api.open-meteo.com/**', () => new Promise(() => {}));
  await page.keyboard.press('/');
  await page.getByRole('combobox').fill('London');
  await page.getByRole('option', { name: /London/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('London');
  await expect(page.locator('.current-temperature')).not.toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading weather forecast' })).toBeVisible();
});

test('shows a real error instead of demo weather when the forecast is unavailable', async ({
  page,
}) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByText('A brief break in the forecast.')).toBeVisible();
  await expect(page.locator('.current-temperature')).toHaveCount(0);
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: raw }));
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('.current-temperature')).toBeVisible();
});

test('labels a cached forecast and never confuses failed alert checks with all clear', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.current-temperature')).toBeVisible();
  await page.route('https://api.open-meteo.com/**', (route) => route.abort());
  await page.route('https://api.weather.gov/**', (route) => route.abort());
  await page.reload();
  await expect(page.locator('.forecast-notice')).toContainText('Showing a saved or older forecast');
  await expect(page.locator('.current-temperature')).toBeVisible();
  await expect(page.getByText('Weather alerts are unavailable right now.')).toBeVisible();
  await expect(page.getByText(/No active NWS alerts/)).toHaveCount(0);
});

test('makes severe weather alerts prominent and expandable', async ({ page }) => {
  await page.route('https://api.weather.gov/**', (route) =>
    route.fulfill({
      json: {
        features: [
          {
            properties: {
              id: 'test-alert',
              event: 'Severe Thunderstorm Warning',
              headline: 'A test severe thunderstorm warning',
              severity: 'Severe',
              description: 'Test fixture: strong wind is possible.',
              instruction: 'Test fixture: move indoors.',
              senderName: 'NWS Tulsa',
              expires: '2026-10-03T04:00:00Z',
            },
          },
        ],
      },
    }),
  );
  await page.goto('/');
  await expect(page.locator('.alert-banner')).toContainText('Severe Thunderstorm Warning');
  await page.locator('.alert-banner').click();
  await expect(page.locator('.alert-details')).toContainText('Test fixture: move indoors.');
  await expect(page.locator('.alert-details a')).toHaveAttribute('href', /forecast.weather.gov/);
});

test('handles radar outage and geolocation denial without breaking forecasts', async ({
  page,
  context,
}, info) => {
  await context.clearPermissions();
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, error) =>
      error?.({
        code: 1,
        message: 'Denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
  });
  await page.route('https://api.rainviewer.com/**', (route) => route.abort());
  await page.goto('/');
  await page.keyboard.press('/');
  await page.getByRole('button', { name: 'Use my current location' }).click();
  await expect(
    page.getByText('Location permission was denied. You can still search for any city.'),
  ).toBeVisible();
  await nav(page, info).getByRole('button', { name: 'Radar', exact: true }).click();
  await expect(page.locator('.map-error')).toContainText('Radar is temporarily unavailable.');
  await expect(page.getByRole('button', { name: 'Play radar animation' })).toBeDisabled();
});

test('fits narrow screens and passes core accessibility checks', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('.current-temperature')).toBeVisible();
  await expect(page.locator('.map-time')).not.toContainText('Loading');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const violations = (
    await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  ).violations;
  expect(
    violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  const darkViolations = (
    await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  ).violations;
  expect(darkViolations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  if (info.project.name === 'mobile') {
    await page.setViewportSize({ width: 320, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
