import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools, setBroadcaster, scraper } from './tools/index';
import cors from 'cors';

const app = express();
app.use(cors());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Broadcast function
const broadcast = (type: string, data: any) => {
    const message = JSON.stringify({ type, data });
    wss.clients.forEach((client) => {
        if (client.readyState === 1) {
            client.send(message);
        }
    });
};

setBroadcaster(broadcast);

wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');

    ws.on('error', (err) => {
        console.error('WebSocket Error:', err.message);
    });

    ws.send(JSON.stringify({ type: 'status', data: 'Connected to Movie MCP Server' }));

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            if (message.type === 'search') {
                broadcast('log', { message: `Searching for ${message.query}` });
                try {
                    const results = await scraper.search(message.query);
                    ws.send(JSON.stringify({ type: 'search_results', data: results }));
                } catch (error: any) {
                    ws.send(JSON.stringify({ type: 'error', data: { message: error.message } }));
                }
            } else if (message.type === 'get_details') {
                broadcast('log', { message: `Fetching details for ${message.url}` });
                try {
                    const details = await scraper.getDetails(message.url);
                    ws.send(JSON.stringify({ type: 'movie_update', data: details }));
                } catch (error: any) {
                    ws.send(JSON.stringify({ type: 'error', data: { message: error.message } }));
                }
            }
        } catch (e) {
            console.error('Invalid WS message', e);
        }
    });
});

const mcpServer = new Server(
    {
        name: "Movie MCP Server",
        version: "1.0.0"
    },
    {
        capabilities: {
            tools: {}
        }
    }
);

registerTools(mcpServer);

async function main() {
    // Start WebSocket/HTTP Server
    const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    server.listen(PORT, '0.0.0.0', () => {
        console.error(`WebSocket server running on port ${PORT}`);
    });

    // Start MCP Server (Stdio)
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error("MCP Server connected to stdio");
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
