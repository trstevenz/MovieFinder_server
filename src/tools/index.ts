import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createScraper } from "../scrapers/index";
import { config } from "../config";

// Global WS broadcaster
export let broadcast: (type: string, payload: any) => void = () => { };

export function setBroadcaster(fn: typeof broadcast) {
    broadcast = fn;
}

export const scraper = createScraper(config);

export function registerTools(server: Server) {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "fetch_movie_details",
                    description: "Fetch details about a movie from a URL",
                    inputSchema: {
                        type: "object",
                        properties: {
                            url: { type: "string", description: "The URL of the movie page" }
                        },
                        required: ["url"]
                    }
                },
                {
                    name: "search_movies",
                    description: "Search for movies by query string",
                    inputSchema: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "Search query" }
                        },
                        required: ["query"]
                    }
                }
            ]
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        if (name === "fetch_movie_details") {
            const url = (args as any).url;
            broadcast("log", { message: `Fetching details for ${url}` });
            try {
                const details = await scraper.getDetails(url);
                broadcast("movie_update", details);
                return {
                    content: [{ type: "text", text: JSON.stringify(details, null, 2) }]
                };
            } catch (error: any) {
                broadcast("error", { message: error.message });
                return {
                    content: [{ type: "text", text: `Error: ${error.message}` }],
                    isError: true
                };
            }
        }

        if (name === "search_movies") {
            const query = (args as any).query;
            broadcast("log", { message: `Searching for ${query}` });
            try {
                const results = await scraper.search(query);
                broadcast("search_results", results);
                return {
                    content: [{ type: "text", text: JSON.stringify(results, null, 2) }]
                };
            } catch (error: any) {
                broadcast("error", { message: error.message });
                return {
                    content: [{ type: "text", text: `Error: ${error.message}` }],
                    isError: true
                };
            }
        }

        throw new Error(`Tool ${name} not found`);
    });
}
