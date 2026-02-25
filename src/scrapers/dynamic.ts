import { chromium, Browser, Page } from 'playwright';
import { Movie, SearchResult, ScraperConfig } from '../types/shared';
import { MovieScraper } from './base';
import { fuzzyTitleMatchScore } from './utils';

export class DynamicScraper implements MovieScraper {
    private browser: Browser | null = null;

    constructor(private config: ScraperConfig) { }

    private async getPage(): Promise<{ browser: Browser; page: Page }> {
        if (!this.browser) {
            this.browser = await chromium.launch({ headless: true });
        }
        const page = await this.browser.newPage();
        return { browser: this.browser, page };
    }

    async search(query: string): Promise<SearchResult[]> {
        const { page } = await this.getPage();
        try {
            const cleanQuery = query.toLowerCase().trim();
            if (!cleanQuery) return [];

            const firstLetter = cleanQuery.charAt(0);
            const isNumeric = /[0-9]/.test(firstLetter);
            const searchPath = isNumeric ? '0-9' : firstLetter;

            const scoredResults: { result: SearchResult, score: number }[] = [];
            const seenUrls = new Set<string>();
            const maxPages = 15;
            const maxTolerance = Math.max(3, Math.floor(cleanQuery.length / 3));

            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
                const pageUrl = pageNum === 1
                    ? `${this.config.baseUrl}tamil-movies/${searchPath}/`
                    : `${this.config.baseUrl}tamil-movies/${searchPath}/?page=${pageNum}`;

                const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null);
                if (!response || !response.ok()) break;

                const pageResults = await page.evaluate(() => {
                    const links = document.querySelectorAll('a');
                    const extracted: { title: string, url: string }[] = [];

                    links.forEach(link => {
                        const href = link.getAttribute('href') || '';
                        const title = link.textContent?.trim() || '';

                        if (href.includes('-movie/') || href.includes('-movie')) {
                            extracted.push({ title, url: href });
                        }
                    });
                    return extracted;
                });

                let pageHasMovies = false;
                for (const res of pageResults) {
                    pageHasMovies = true;
                    if (!seenUrls.has(res.url)) {
                        seenUrls.add(res.url);

                        const score = fuzzyTitleMatchScore(cleanQuery, res.title);
                        if (score <= maxTolerance) {
                            scoredResults.push({
                                result: {
                                    title: res.title,
                                    url: res.url.startsWith('http') ? res.url : this.config.baseUrl + res.url,
                                    thumbnail: 'https://via.placeholder.com/60x80?text=Movie'
                                },
                                score
                            });
                        }
                    }
                }

                if (!pageHasMovies) break;
            }

            scoredResults.sort((a, b) => a.score - b.score);
            return scoredResults.slice(0, 30).map(r => r.result);
        } catch (e: any) {
            console.error("Dynamic crawl failed", e.message);
            throw new Error(`Failed to crawl directory on ${this.config.baseUrl}.`);
        } finally {
            await page.close();
        }
    }

    async getDetails(url: string): Promise<Movie> {
        const { page } = await this.getPage();
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });

            // 1. Movie Page extraction
            const details = await page.evaluate(() => {
                const title = document.querySelector('h1')?.textContent?.trim() || 'Unknown Title';
                const yearMatch = title.match(/\((\d{4})\)/);
                const year = yearMatch ? yearMatch[1] : undefined;
                const thumbnails = Array.from(document.querySelectorAll('.movie-poster img, .cover img, center img'))
                    .map(img => img.getAttribute('src'))
                    .filter(src => src && src.startsWith('http')) as string[];
                return { title, year, thumbnails };
            });

            // Find best resolution link
            const catUrl = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a'));
                const cats = links.map(a => a.getAttribute('href') || '')
                    .filter(href => href && href.startsWith('http') && !href.includes('tamil-movies') &&
                        (href.includes('x') || href.includes('hd') || href.includes('p)')));
                return cats.length > 0 ? cats[cats.length - 1] : null;
            });

            const finalDownloadLinks: { label: string, url: string }[] = [];

            if (catUrl) {
                // 2. Resolution Page
                await page.goto(catUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
                const fileUrl = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a'));
                    return links.map(a => a.getAttribute('href') || '').find(href => href.includes('/download/'));
                });

                if (fileUrl) {
                    // 3. File Index Page
                    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
                    const extRedirect1 = await page.evaluate(() => {
                        return Array.from(document.querySelectorAll('a'))
                            .map(a => a.getAttribute('href') || '').find(href => href.includes('.xyz/download/file/'));
                    });

                    if (extRedirect1) {
                        // 4. Ad Redirect 1
                        await page.goto(extRedirect1, { waitUntil: 'domcontentloaded' }).catch(() => null);
                        const extRedirect2 = await page.evaluate(() => {
                            return Array.from(document.querySelectorAll('a'))
                                .map(a => a.getAttribute('href') || '').find(href => href.includes('.xyz/download/page/'));
                        });

                        if (extRedirect2) {
                            // 5. Ad Redirect 2 -> Get Server Pages
                            await page.goto(extRedirect2, { waitUntil: 'domcontentloaded' }).catch(() => null);
                            const serverPages = await page.evaluate(() => {
                                const pages: string[] = [];
                                Array.from(document.querySelectorAll('a')).forEach(a => {
                                    const href = a.getAttribute('href') || '';
                                    if (href && a.textContent?.toLowerCase().includes('server')) {
                                        pages.push(href);
                                    }
                                });
                                return pages;
                            });

                            // 6. Follow Server Pages to MP4
                            for (const sp of serverPages) {
                                await page.goto(sp, { waitUntil: 'domcontentloaded' }).catch(() => null);
                                const mp4Link = await page.evaluate(() => {
                                    return Array.from(document.querySelectorAll('a'))
                                        .map(a => a.getAttribute('href') || '')
                                        .find(href => href.endsWith('.mp4'));
                                });

                                if (mp4Link) {
                                    finalDownloadLinks.push({ label: `Direct MP4`, url: mp4Link });
                                }
                            }
                        }
                    }
                }
            }

            return {
                title: details.title,
                year: details.year,
                description: "Direct movie download links auto-extracted past all redirects.",
                thumbnailUrls: details.thumbnails,
                availableLinks: finalDownloadLinks.length > 0 ? finalDownloadLinks : [{ label: 'View on Site', url }]
            };
        } catch (e: any) {
            console.error("Dynamic details failed", e.message);
            throw new Error("Failed to load details: Website unreachable.");
        } finally {
            await page.close();
        }
    }

    async close() {
        if (this.browser) await this.browser.close();
    }
}
