import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
// @ts-ignore - validator.js is a plain JS file without types in the api app
import { validateDiagram } from "../../api/validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../api/.env") });

// Paths
const BASE_ASSETS_PATH = path.resolve(__dirname, "../../api/data/assets/base");
const IMPORTED_ASSETS_PATH = path.resolve(__dirname, "../../api/data/assets/imported");
const STORAGE_PATH = process.env.STORAGE_PATH || path.resolve(__dirname, "../../api/data/diagrams");
const getWebAppUrl = () => process.env.WEB_APP_URL || "http://localhost:3000";

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
        const url = `${getWebAppUrl()}/edit/${id}`;
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
        const url = `${getWebAppUrl()}/display/${id}`;
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
            const exportUrl = `${getWebAppUrl()}/display/${id}?export=true`;

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

// -------------------------------------------------------------
// NEW TOOLS FOR API ENDPOINTS
// -------------------------------------------------------------

server.registerTool(
    "get_storage_status",
    { description: "Check if local storage and git backup are enabled" },
    async () => {
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    enabled: process.env.ENABLE_SERVER_STORAGE === 'true',
                    gitBackup: process.env.ENABLE_GIT_BACKUP === 'true',
                    version: '1.0.0'
                }, null, 2)
            }]
        };
    }
);

server.registerTool(
    "list_diagrams",
    { description: "List all available diagrams in local storage" },
    async () => {
        try {
            if (!existsSync(STORAGE_PATH)) {
                return { content: [{ type: "text", text: "[]" }] };
            }

            const files = await fs.readdir(STORAGE_PATH);
            const diagrams = [];

            for (const file of files) {
                if (file.endsWith('.json') && file !== 'metadata.json') {
                    try {
                        const filePath = path.join(STORAGE_PATH, file);
                        const stats = await fs.stat(filePath);
                        const content = await fs.readFile(filePath, 'utf-8');
                        const data = JSON.parse(content);

                        const name = data.name || data.title || 'Untitled Diagram';

                        diagrams.push({
                            id: file.replace('.json', ''),
                            name: name,
                            lastModified: stats.mtime,
                            size: stats.size
                        });
                    } catch (fileError) {
                        continue;
                    }
                }
            }

            return {
                content: [{ type: "text", text: JSON.stringify(diagrams, null, 2) }]
            };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
        }
    }
);

server.registerTool(
    "create_diagram",
    {
        description: "Create a new diagram from JSON data",
        inputSchema: {
            data: z.record(z.any()).describe("The complete JSON data of the diagram"),
            id: z.string().optional().describe("Optional ID for the new diagram. If omitted, one will be generated.")
        }
    },
    async ({ data, id }) => {
        try {
            const validation = validateDiagram(data);
            if (!validation.success) {
                return { content: [{ type: "text", text: `Model validation failed: ${validation.errors?.join(', ')}` }], isError: true };
            }

            const diagramId = id || `diagram_${Date.now()}`;
            const filePath = path.join(STORAGE_PATH, `${diagramId}.json`);

            if (existsSync(filePath)) {
                return { content: [{ type: "text", text: "Error: Diagram already exists" }], isError: true };
            }

            const finalData = {
                ...data,
                id: diagramId,
                created: new Date().toISOString(),
                lastModified: new Date().toISOString()
            };

            await fs.writeFile(filePath, JSON.stringify(finalData, null, 2));
            return { content: [{ type: "text", text: `Diagram created successfully. ID: ${diagramId}` }, { type: "text", text: `You can access and edit the diagram here: ${getWebAppUrl()}/edit/${id}` }] };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
        }
    }
);

server.registerTool(
    "update_diagram",
    {
        description: "Save or update an existing diagram with new JSON data",
        inputSchema: {
            id: z.string().describe("The ID of the diagram to update"),
            data: z.record(z.any()).describe("The complete new JSON data for the diagram")
        }
    },
    async ({ id, data }) => {
        try {
            const validation = validateDiagram(data);
            if (!validation.success) {
                return { content: [{ type: "text", text: `Model validation failed: ${validation.errors?.join(', ')}` }], isError: true };
            }

            const filePath = path.join(STORAGE_PATH, `${id}.json`);

            const finalData = {
                ...data,
                id: id,
                lastModified: new Date().toISOString()
            };

            await fs.writeFile(filePath, JSON.stringify(finalData, null, 2));
            return { content: [{ type: "text", text: `Diagram ${id} successfully updated.` }, { type: "text", text: `You can access and edit the diagram here: ${getWebAppUrl()}/edit/${id}` }] };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
        }
    }
);

server.registerTool(
    "delete_diagram",
    {
        description: "Delete a diagram by its ID",
        inputSchema: {
            id: z.string().describe("The ID of the diagram to delete")
        }
    },
    async ({ id }) => {
        try {
            const filePath = path.join(STORAGE_PATH, `${id}.json`);
            if (!existsSync(filePath)) {
                return { content: [{ type: "text", text: "Error: Diagram not found" }], isError: true };
            }
            await fs.unlink(filePath);
            return { content: [{ type: "text", text: `Diagram ${id} deleted successfully.` }] };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
        }
    }
);

server.registerTool(
    "upload_icon",
    {
        description: "Upload a new base64 image icon to the server, and returns the URL. Provide only the pure base64 string.",
        inputSchema: {
            name: z.string().describe("The name of the icon (it will sanitize this automatically to form the filename)"),
            base64Data: z.string().describe("The base64 encoded image data (e.g. iVBORw0KGgo...)"),
            extension: z.string().default(".png").describe("The file extension (e.g. .png, .svg)")
        }
    },
    async ({ name, base64Data, extension }) => {
        try {
            // 1. Decode base64 
            // sometimes ai passes "data:image/png;base64,iVBORw..." -> split the header
            let dataToDecode = base64Data;
            if (base64Data.includes("base64,")) {
                dataToDecode = base64Data.split("base64,")[1];
            }
            const buffer = Buffer.from(dataToDecode, 'base64');

            // 2. Sanitize name and build path
            const sanitized = name.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
            let ext = extension.startsWith('.') ? extension : `.${extension}`;
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

            const fileName = sanitized ? `${sanitized}${ext}` : `icon-${uniqueSuffix}${ext}`;
            const filePath = path.join(IMPORTED_ASSETS_PATH, fileName);

            // 3. Save
            await fs.writeFile(filePath, buffer);

            // 4. Resulting URL
            const fileUrl = `/assets/imported/${fileName}`;

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        url: fileUrl,
                        filename: fileName
                    }, null, 2)
                }]
            };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
        }
    }
);

export const mcpServer = server;
