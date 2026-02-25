import { ScraperConfig } from './types/shared';

export const config: ScraperConfig = {
    baseUrl: 'https://moviesda17.com/', // Example public site
    useDynamic: false,
    selectors: {
        title: 'h1',
        description: '#synopsis .hidden-xs', // Example selector
        year: '.year',
        thumbnail: '#movie-poster img',
        links: '.modal-download a, .magnet-download' // Example
        // Generic selectors usually require site specific adjustment
    }
};
