import axios from 'axios';
import * as cheerio from 'cheerio';
import { Movie, SearchResult, ScraperConfig } from '../types/shared';
import { MovieScraper } from './base';
import { fuzzyTitleMatchScore } from './utils';

export class StaticScraper implements MovieScraper {
    constructor(private config: ScraperConfig) { }

    async search(query: string): Promise<SearchResult[]> {
        const cleanQuery = query.toLowerCase().trim();
        if (!cleanQuery) return [];

        const firstLetter = cleanQuery.charAt(0);
        const isNumeric = /[0-9]/.test(firstLetter);
        const searchPath = isNumeric ? '0-9' : firstLetter;
        const scoredResults: { result: SearchResult, score: number }[] = [];
        const seenUrls = new Set<string>();
        const maxPages = 15;
        const maxTolerance = Math.max(3, Math.floor(cleanQuery.length / 3));

        try {
            for (let page = 1; page <= maxPages; page++) {
                const pageUrl = page === 1
                    ? `${this.config.baseUrl}tamil-movies/${searchPath}/`
                    : `${this.config.baseUrl}tamil-movies/${searchPath}/?page=${page}`;

                try {
                    const { data } = await axios.get(pageUrl, { timeout: 8000 });
                    const $ = cheerio.load(data);
                    let foundMovieLink = false;

                    $('a').each((_, el) => {
                        const title = $(el).text().trim();
                        const url = $(el).attr('href') || '';

                        if (url.includes('-movie/') || url.includes('-movie')) {
                            foundMovieLink = true;
                            if (!seenUrls.has(url)) {
                                seenUrls.add(url);

                                const score = fuzzyTitleMatchScore(cleanQuery, title);
                                if (score <= maxTolerance) {
                                    scoredResults.push({
                                        result: {
                                            title: title,
                                            url: url.startsWith('http') ? url : new URL(url, this.config.baseUrl).href,
                                            thumbnail: 'https://via.placeholder.com/60x80?text=Movie'
                                        },
                                        score
                                    });
                                }
                            }
                        }
                    });

                    if (!foundMovieLink) break;
                } catch (e) {
                    break; // stop pagination on 404 or connection error
                }
            }

            scoredResults.sort((a, b) => a.score - b.score);
            return scoredResults.slice(0, 30).map(r => r.result);
        } catch (e: any) {
            console.error("Internal crawl failed", e.message);
            throw new Error(`Failed to crawl directory on ${this.config.baseUrl}.`);
        }
    }

    async getDetails(url: string): Promise<Movie> {
        try {
            const { data: page1Data } = await axios.get(url, { timeout: 10000 });
            const $1 = cheerio.load(page1Data);

            const title = $1('h1').first().text().trim() || 'Unknown Title';
            const yearMatch = title.match(/\((\d{4})\)/);
            const year = yearMatch ? yearMatch[1] : undefined;

            const thumbnailUrls: string[] = [];
            $1('.movie-poster img, .cover img, center img').each((_, el) => {
                const src = $1(el).attr('src');
                if (src && src.startsWith('http')) thumbnailUrls.push(src);
            });

            const finalDownloadLinks: { label: string, url: string }[] = [];

            // 1. Movie Page -> Contains a link to the Resolution Page
            const categoryLinks: { title: string, href: string }[] = [];
            $1('a').each((_, el) => {
                const href = $1(el).attr('href');
                const text = $1(el).text().toLowerCase();
                const rawText = $1(el).text().trim();
                if (href && (text.includes('x') || text.includes('hd') || text.includes('p)'))) {
                    if (!href.includes('tamil-movies')) {
                        const fullPath = href.startsWith('http') ? href : new URL(href, this.config.baseUrl).href;
                        categoryLinks.push({ title: rawText, href: fullPath });
                    }
                }
            });

            for (const cat of categoryLinks) {
                try {
                    const { data: page2Data } = await axios.get(cat.href, { timeout: 10000 });
                    const $2 = cheerio.load(page2Data);

                    const filePageLinks = $2('a').map((_, el) => {
                        const href = $2(el).attr('href');
                        return href && href.includes('/download/') ? (href.startsWith('http') ? href : new URL(href, this.config.baseUrl).href) : null;
                    }).get().filter(h => h);

                    if (filePageLinks.length > 0) {
                        const fileUrl = filePageLinks[filePageLinks.length - 1];
                        const { data: page3Data } = await axios.get(fileUrl, { timeout: 10000 });
                        const $3 = cheerio.load(page3Data);
                        const extRedirect1 = $3('a').map((_, el) => $3(el).attr('href')).get().find(href => href && href.includes('.xyz/download/file/'));

                        if (extRedirect1) {
                            const { data: page4Data } = await axios.get(extRedirect1, { timeout: 10000 });
                            const $4 = cheerio.load(page4Data);
                            const extRedirect2 = $4('a').map((_, el) => $4(el).attr('href')).get().find(href => href && href.includes('.xyz/download/page/'));

                            if (extRedirect2) {
                                const { data: page5Data } = await axios.get(extRedirect2, { timeout: 10000 });
                                const $5 = cheerio.load(page5Data);

                                const serverPages: string[] = [];
                                $5('a').each((_, el) => {
                                    const text = $5(el).text().toLowerCase();
                                    const href = $5(el).attr('href');
                                    if (href && text.includes('server')) {
                                        serverPages.push(href);
                                    }
                                });

                                // Finally follow the server page to get the MP4
                                for (const sp of serverPages) {
                                    try {
                                        const { data: spData } = await axios.get(sp, { timeout: 10000 });
                                        const $sp = cheerio.load(spData);
                                        $sp('a').each((_, el) => {
                                            const finalHref = $sp(el).attr('href');
                                            if (finalHref && finalHref.endsWith('.mp4')) {
                                                finalDownloadLinks.push({ label: `[${cat.title}] Direct MP4`, url: finalHref });
                                            }
                                        });
                                    } catch (e) { }
                                }
                            }
                        }
                    }
                } catch (e) { }
            }

            return {
                title,
                year,
                description: "Direct movie download links auto-extracted past all redirects.",
                thumbnailUrls,
                availableLinks: finalDownloadLinks.length > 0 ? finalDownloadLinks : [{ label: 'View on Site', url }]
            };
        } catch (e: any) {
            console.error("Get details failed", e.message);
            throw new Error(`Failed to load details: Website is unreachable or timed out.`);
        }
    }
}
