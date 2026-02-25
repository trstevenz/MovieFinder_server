import { ScraperConfig } from '../types/shared';
import { MovieScraper } from './base';
import { StaticScraper } from './static';
import { DynamicScraper } from './dynamic';

export function createScraper(config: ScraperConfig): MovieScraper {
    if (config.useDynamic) {
        console.log("Using Dynamic Scraper (Playwright)");
        return new DynamicScraper(config);
    }
    console.log("Using Static Scraper (Axios+Cheerio)");
    return new StaticScraper(config);
}
