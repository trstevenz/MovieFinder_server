import { Movie, SearchResult } from '../types/shared';

export interface MovieScraper {
    search(query: string): Promise<SearchResult[]>;
    getDetails(url: string): Promise<Movie>;
}
