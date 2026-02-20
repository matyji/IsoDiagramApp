import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import puppeteer from "puppeteer";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../api/.env") });

// Paths
const BASE_ASSETS_PATH = path.resolve(__dirname, "../../api/data/assets/base");
const IMPORTED_ASSETS_PATH = path.resolve(__dirname, "../../api/data/assets/imported");
const STORAGE_PATH = process.env.STORAGE_PATH || path.resolve(__dirname, "../../api/data/diagrams");
const WEB_APP_URL = process.env.WEB_APP_URL || "http://localhost:3000";

const server = new McpServer({
    name: "isodiagram-mcp",
    version: "1.0.0",
});

server.registerTool(
    "list_icons",
    { description: "Get all available icons in the IsoDiagram app (flat list of names)" },
    async () => {
        try {
            const getNamesInDir = async (dirPath: string) => {
                if (!existsSync(dirPath)) return [];
                const files = await fs.readdir(dirPath);
                return files
                    .filter(
                        (file) =>
                            file.endsWith(".svg") ||
                            file.endsWith(".png") ||
                            file.endsWith(".jpg") ||
                            file.endsWith(".jpeg")
                    )
                    .map((file) => file.split(".").slice(0, -1).join("."));
            };

            const baseNames = await getNamesInDir(BASE_ASSETS_PATH);
            const importedNames = await getNamesInDir(IMPORTED_ASSETS_PATH);

            const allNames = Array.from(new Set([...baseNames, ...importedNames]));

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(allNames, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Error: ${error.message}` }],
                isError: true,
            };
        }
    }
);

server.registerTool(
    "get_diagram_json",
    {
        description: "Get the raw JSON data of a specific diagram by its ID",
        inputSchema: z.object({ id: z.string().describe("The ID of the diagram to load") })
    },
    async ({ id }) => {
        try {
            const filePath = path.join(STORAGE_PATH, `${id}.json`);
            const content = await fs.readFile(filePath, "utf-8");

            return {
                content: [{ type: "text", text: content }],
            };
        } catch (error: any) {
            if (error.code === "ENOENT") {
                return { content: [{ type: "text", text: "Diagram JSON not found" }], isError: true };
            }
            return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
        }
    }
);

server.registerTool(
    "open_diagram",
    {
        description: "Get the direct URL to open and edit the diagram in the browser",
        inputSchema: z.object({ id: z.string().describe("The ID of the diagram to open") })
    },
    async ({ id }) => {
        const url = `${WEB_APP_URL}/edit/${id}`;
        return {
            content: [{ type: "text", text: `You can access and edit the diagram here: ${url}` }],
        };
    }
);

server.registerTool(
    "display_diagram",
    {
        description: "Get the direct URL to view the diagram in readonly mode in the browser",
        inputSchema: z.object({ id: z.string().describe("The ID of the diagram to display") })
    },
    async ({ id }) => {
        const url = `${WEB_APP_URL}/display/${id}`;
        return {
            content: [{ type: "text", text: `You can view the diagram in readonly mode here: ${url}` }],
        };
    }
);

server.registerTool(
    "export_diagram",
    {
        description: "Export the diagram to a PNG image locally using Puppeteer",
        // We pass shape directly so we declare it as Zod schema. Note for SDK: it needs to be an object shape schema, wrapped in z.object or shape
        inputSchema: {
            id: z.string().describe("The ID of the diagram to export"),
            scale: z.number().optional().describe("Export scale, default is 2")
        }
    },
    async ({ id, scale = 2 }) => {
        try {
            const filePath = path.join(STORAGE_PATH, `${id}.json`);
            await fs.access(filePath);

            const exportUrl = `${WEB_APP_URL}/display/${id}?export=true`;

            // Launch headless browser to capture screen
            const browser = await puppeteer.launch({
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });

            try {
                const page = await browser.newPage();
                await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: scale });
                await page.goto(exportUrl, { waitUntil: "load", timeout: 60000 });
                await page.waitForSelector('[data-is-ready="true"]', { timeout: 30000 });
                await new Promise((r) => setTimeout(r, 3000));

                const element = await page.$('[data-is-ready="true"]');
                if (!element) throw new Error("Diagram container not found");

                const imageBuffer = await element.screenshot({ type: "png", omitBackground: true });
                await browser.close();

                // Save image locally to disk instead of returning via express download stream
                // That way the AI can tell the user the precise local path of the export
                const imgPath = path.join(STORAGE_PATH, `export-${id}.png`);
                await fs.writeFile(imgPath, imageBuffer);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Diagram exported successfully! The PNG image has been saved to: ${imgPath}`
                        }
                    ],
                };
            } catch (err: any) {
                await browser.close();
                throw err;
            }
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Export failed: ${error.message}` }],
                isError: true,
            };
        }
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("IsoDiagram MCP server running on stdio");
}

main().catch(console.error);
