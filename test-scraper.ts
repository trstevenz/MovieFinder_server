import { StaticScraper } from './src/scrapers/static';
import { config } from './src/config';

async function runTest() {
    console.log("=== Testing Moviesda Scraper ===");
    const scraper = new StaticScraper(config);

    const query = "inji idupazhagi"; // Intentional typo
    console.log(`\n1. Searching for: "${query}"...`);

    try {
        const results = await scraper.search(query);
        console.log(`✅ Found ${results.length} result(s):`);
        console.log(JSON.stringify(results, null, 2));

        if (results.length > 0) {
            console.log(`\n2. Fetching details for the first result: ${results[0].title}...`);
            const details = await scraper.getDetails(results[0].url);
            console.log(`✅ Details fetched successfully:`);
            console.log("Title: " + details.title);
            console.log("Download Links Extracted:");
            console.log(JSON.stringify(details.availableLinks, null, 2));
        } else {
            console.log("❌ No results found to fetch details for.");
        }
    } catch (e: any) {
        console.error("❌ Test failed:", e.message);
    }
}

runTest();
