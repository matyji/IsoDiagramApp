import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
import { validateDiagram } from "./validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

// Paths
const BASE_ASSETS_PATH = path.resolve(__dirname, "data/assets/base");
const IMPORTED_ASSETS_PATH = path.resolve(__dirname, "data/assets/imported");
const STORAGE_PATH = process.env.STORAGE_PATH || path.resolve(__dirname, "data/diagrams");
const getWebAppUrl = () => process.env.WEB_APP_URL || "http://localhost:3000";

export function createMcpServer() {
    const server = new McpServer({
        name: "isodiagram-mcp",
        version: "1.0.0",
    });

    server.tool(
        "list_icons",
        "Get all available icons in the IsoDiagram app (flat list of names)",
        async () => {
            try {
                const getNamesInDir = async (dirPath) => {
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
            } catch (error) {
                return {
                    content: [{ type: "text", text: `Error: ${error.message}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "get_diagram_json",
        "Get the raw JSON data of a specific diagram by its ID",
        { id: z.string().describe("The ID of the diagram to load") },
        async ({ id }) => {
            try {
                const filePath = path.join(STORAGE_PATH, `${id}.json`);
                const content = await fs.readFile(filePath, "utf-8");

                return {
                    content: [{ type: "text", text: content }],
                };
            } catch (error) {
                if (error.code === "ENOENT") {
                    return { content: [{ type: "text", text: "Diagram JSON not found" }], isError: true };
                }
                return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
            }
        }
    );

    server.tool(
        "open_diagram",
        "Get the direct URL to open and edit the diagram in the browser",
        { id: z.string().describe("The ID of the diagram to open") },
        async ({ id }) => {
            const url = `${getWebAppUrl()}/edit/${id}`;
            return {
                content: [{ type: "text", text: `You can access and edit the diagram here: ${url}` }],
            };
        }
    );

    server.tool(
        "display_diagram",
        "Get the direct URL to view the diagram in readonly mode in the browser",
        { id: z.string().describe("The ID of the diagram to display") },
        async ({ id }) => {
            const url = `${getWebAppUrl()}/display/${id}`;
            return {
                content: [{ type: "text", text: `You can view the diagram in readonly mode here: ${url}` }],
            };
        }
    );

    server.tool(
        "export_diagram",
        "Export the diagram to a PNG image locally using Puppeteer",
        {
            id: z.string().describe("The ID of the diagram to export"),
            scale: z.number().optional().describe("Export scale, default is 2")
        },
        async ({ id, scale = 2 }) => {
            try {
                const filePath = path.join(STORAGE_PATH, `${id}.json`);
                await fs.access(filePath);
                const exportUrl = `${getWebAppUrl()}/display/${id}?export=true`;

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

                    const base64Data = await element.screenshot({ type: "png", omitBackground: true, encoding: "base64" });
                    await browser.close();

                    return {
                        content: [
                            {
                                type: "text",
                                text: "Diagram exported successfully. The image is provided below."
                            },
                            {
                                type: "image",
                                data: base64Data,
                                mimeType: "image/png"
                            }
                        ],
                    };
                } catch (err) {
                    await browser.close();
                    throw err;
                }
            } catch (error) {
                return {
                    content: [{ type: "text", text: `Export failed: ${error.message}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "get_storage_status",
        "Check if local storage and git backup are enabled",
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

    server.tool(
        "list_diagrams",
        "List all available diagrams in local storage",
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
            } catch (error) {
                return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
            }
        }
    );

    server.tool(
        "create_diagram",
        "Create a new diagram from JSON data",
        {
            data: z.record(z.any()).describe("The complete JSON data of the diagram"),
            id: z.string().optional().describe("Optional ID for the new diagram. If omitted, one will be generated.")
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
                return { content: [{ type: "text", text: `Diagram created successfully. ID: ${diagramId}` }, { type: "text", text: `You can access and edit the diagram here: ${getWebAppUrl()}/edit/${diagramId}` }] };
            } catch (error) {
                return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
            }
        }
    );

    server.tool(
        "update_diagram",
        "Save or update an existing diagram with new JSON data",
        {
            id: z.string().describe("The ID of the diagram to update"),
            data: z.record(z.any()).describe("The complete new JSON data for the diagram")
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
            } catch (error) {
                return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
            }
        }
    );

    server.tool(
        "delete_diagram",
        "Delete a diagram by its ID",
        {
            id: z.string().describe("The ID of the diagram to delete")
        },
        async ({ id }) => {
            try {
                const filePath = path.join(STORAGE_PATH, `${id}.json`);
                if (!existsSync(filePath)) {
                    return { content: [{ type: "text", text: "Error: Diagram not found" }], isError: true };
                }
                await fs.unlink(filePath);
                return { content: [{ type: "text", text: `Diagram ${id} deleted successfully.` }] };
            } catch (error) {
                return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
            }
        }
    );

    server.tool(
        "upload_icon",
        "Upload a new base64 image icon to the server, and returns the URL. Provide only the pure base64 string.",
        {
            name: z.string().describe("The name of the icon (it will sanitize this automatically to form the filename)"),
            base64Data: z.string().describe("The base64 encoded image data (e.g. iVBORw0KGgo...)"),
            extension: z.string().default(".png").describe("The file extension (e.g. .png, .svg)")
        },
        async ({ name, base64Data, extension }) => {
            try {
                let dataToDecode = base64Data;
                if (base64Data.includes("base64,")) {
                    dataToDecode = base64Data.split("base64,")[1];
                }
                const buffer = Buffer.from(dataToDecode, 'base64');
                const sanitized = name.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
                let ext = extension.startsWith('.') ? extension : `.${extension}`;
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

                const fileName = sanitized ? `${sanitized}${ext}` : `icon-${uniqueSuffix}${ext}`;
                const filePath = path.join(IMPORTED_ASSETS_PATH, fileName);

                await fs.writeFile(filePath, buffer);
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
            } catch (error) {
                return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
            }
        }
    );

    return server;
}
