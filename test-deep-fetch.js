const axios = require('axios');
const cheerio = require('cheerio');

async function testDeepLink() {
    const url = 'https://moviesda17.com//inji-iduppazhagi-2015-tamil-movie/';
    console.log("Fetching: " + url);
    try {
        const { data: page1Data } = await axios.get(url, { timeout: 10000 });
        const $1 = cheerio.load(page1Data);

        const categoryLinks = [];
        console.log("--- All Links on Page 1 ---");
        $1('a').each((_, el) => {
            const href = $1(el).attr('href');
            const text = $1(el).text().toLowerCase().trim();
            if (href && !href.includes('tamil-movies') && href.includes('movie')) {
                console.log(`Link: [${text}] => ${href}`);
                if (text.match(/[0-9]+x[0-9]+/) || text.includes('hd') || text.includes('p)')) {
                    categoryLinks.push(href);
                }
            }
        });

        console.log("\nCategories found:", categoryLinks);
    } catch (e) {
        console.error(e.message);
    }
}

testDeepLink();
