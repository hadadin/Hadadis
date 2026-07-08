import {
  createScraper,
  CompanyTypes,
  SCRAPERS,
  type ScraperCredentials,
  type ScraperScrapingResult,
} from "israeli-bank-scrapers";

export { CompanyTypes, SCRAPERS };

/**
 * Thin wrapper around israeli-bank-scrapers. Runs a real headless-Chrome
 * login against the bank/credit-card company's own site — this is why
 * bank sync runs as an offline script (scripts/bank-sync.ts), never as a
 * Vercel API route (serverless functions don't reliably fit a full
 * Puppeteer + Chrome session within their time/size limits).
 */
export async function scrapeCompany(
  companyId: CompanyTypes,
  credentials: ScraperCredentials,
  startDate: Date
): Promise<ScraperScrapingResult> {
  const scraper = createScraper({
    companyId,
    startDate,
    combineInstallments: false,
    showBrowser: false,
  });
  return scraper.scrape(credentials);
}

/** ILS amounts from the scraper are floats (e.g. 45.9) — convert to agorot. */
export function toAgorot(amount: number): number {
  return Math.round(amount * 100);
}
