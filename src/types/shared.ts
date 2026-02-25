import { z } from 'zod';

export const MovieSchema = z.object({
    title: z.string(),
    year: z.string().optional(),
    description: z.string().optional(),
    thumbnailUrls: z.array(z.string()),
    availableLinks: z.array(z.object({
        label: z.string(),
        url: z.string()
    }))
});

export type Movie = z.infer<typeof MovieSchema>;

export const SearchResultSchema = z.object({
    title: z.string(),
    thumbnail: z.string().optional(),
    url: z.string()
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

export interface ScraperConfig {
    baseUrl: string;
    useDynamic: boolean;
    selectors: {
        title: string;
        description?: string;
        year?: string;
        thumbnail: string;
        links: string;
        searchResult?: string;
    }
}
