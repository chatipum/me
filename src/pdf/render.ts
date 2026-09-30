import puppeteer, { type Browser } from 'puppeteer-core';

async function launchBrowser(): Promise<Browser> {
  const localChrome = process.env.CHROME_EXECUTABLE_PATH;
  if (localChrome) {
    return puppeteer.launch({ executablePath: localChrome, headless: true });
  }
  const chromium = (await import('@sparticuz/chromium')).default;
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: 'shell',
  });
}

export async function renderPdf(url: string): Promise<Uint8Array> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });
    if (!response?.ok()) throw new Error(`Print page responded ${response?.status()}`);
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}
