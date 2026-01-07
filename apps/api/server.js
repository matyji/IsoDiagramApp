import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');

// Load environment variables from the same directory as server.js
console.log(`Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

console.log(`Value of ENABLE_SERVER_STORAGE: ${process.env.ENABLE_SERVER_STORAGE}`);

// Configuration from environment variables
const STORAGE_ENABLED = process.env.ENABLE_SERVER_STORAGE === 'true';
const STORAGE_PATH = process.env.STORAGE_PATH || '/data/diagrams';
const ENABLE_GIT_BACKUP = process.env.ENABLE_GIT_BACKUP === 'true';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check / Storage status endpoint
app.get('/api/storage/status', (req, res) => {
  res.json({
    enabled: STORAGE_ENABLED,
    gitBackup: ENABLE_GIT_BACKUP,
    version: '1.0.0'
  });
});

// Only enable storage endpoints if storage is enabled
if (STORAGE_ENABLED) {
  // Ensure storage directory exists
  async function ensureStorageDir() {
    try {
      await fs.access(STORAGE_PATH);
      console.log(`Storage directory exists: ${STORAGE_PATH}`);

      // Log current files
      const files = await fs.readdir(STORAGE_PATH);
      console.log(`Current files in storage: ${files.length} files`);
      if (files.length > 0) {
        console.log('Files:', files.join(', '));
      }
    } catch {
      console.log(`Creating storage directory: ${STORAGE_PATH}`);
      await fs.mkdir(STORAGE_PATH, { recursive: true });
      console.log(`Created storage directory: ${STORAGE_PATH}`);
    }
  }

  // Initialize storage
  ensureStorageDir().catch((err) => {
    console.error('Failed to initialize storage:', err);
  });

  // List all diagrams
  app.get('/api/diagrams', async (req, res) => {
    try {
      // First check if storage directory exists
      try {
        await fs.access(STORAGE_PATH);
      } catch (err) {
        console.error(`Storage directory does not exist: ${STORAGE_PATH}`);
        return res.json([]); // Return empty array if directory doesn't exist
      }

      const files = await fs.readdir(STORAGE_PATH);
      console.log(`Found ${files.length} files in ${STORAGE_PATH}:`, files);
      const diagrams = [];

      for (const file of files) {
        if (file.endsWith('.json') && file !== 'metadata.json') {
          try {
            const filePath = path.join(STORAGE_PATH, file);
            const stats = await fs.stat(filePath);
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);

            // Extract name from various possible locations
            const name = data.name || data.title || 'Untitled Diagram';

            console.log(`Successfully read diagram: ${file} (name: ${name})`);

            diagrams.push({
              id: file.replace('.json', ''),
              name: name,
              lastModified: stats.mtime,
              size: stats.size
            });
          } catch (fileError) {
            console.error(`Error reading diagram file ${file}:`, fileError.message);
            // Skip this file and continue with others
            continue;
          }
        }
      }

      console.log(`Returning ${diagrams.length} diagrams`);
      res.json(diagrams);
    } catch (error) {
      console.error('Error listing diagrams:', error);
      res.status(500).json({ error: 'Failed to list diagrams', details: error.message });
    }
  });

  // Get specific diagram
  app.get('/api/diagrams/:id', async (req, res) => {
    const diagramId = req.params.id;
    console.log(`[GET /api/diagrams/${diagramId}] Loading diagram...`);

    try {
      const filePath = path.join(STORAGE_PATH, `${diagramId}.json`);
      console.log(`[GET /api/diagrams/${diagramId}] Reading from: ${filePath}`);

      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      console.log(`[GET /api/diagrams/${diagramId}] Successfully loaded, size: ${content.length} bytes, items: ${data.items?.length || 0}`);
      res.json(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error(`[GET /api/diagrams/${diagramId}] Diagram not found`);
        res.status(404).json({ error: 'Diagram not found' });
      } else {
        console.error(`[GET /api/diagrams/${diagramId}] Error reading diagram:`, error);
        res.status(500).json({ error: 'Failed to read diagram' });
      }
    }
  });

  // Save or update diagram
  app.put('/api/diagrams/:id', async (req, res) => {
    const diagramId = req.params.id;
    console.log(`[PUT /api/diagrams/${diagramId}] Saving diagram...`);

    try {
      const filePath = path.join(STORAGE_PATH, `${diagramId}.json`);
      const data = {
        ...req.body,
        id: diagramId,
        lastModified: new Date().toISOString()
      };

      const iconCount = data.icons?.length || 0;
      const importedIconCount = (data.icons || []).filter(icon => icon.collection === 'imported').length;
      console.log(`[PUT /api/diagrams/${diagramId}] Writing to: ${filePath}`);
      console.log(`[PUT /api/diagrams/${diagramId}]   Items: ${data.items?.length || 0}, Icons: ${iconCount} (${importedIconCount} imported)`);

      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      console.log(`[PUT /api/diagrams/${diagramId}] Successfully saved`);

      // Git backup if enabled
      if (ENABLE_GIT_BACKUP) {
        // TODO: Implement git commit
        console.log('[PUT] Git backup not yet implemented');
      }

      res.json({ success: true, id: diagramId });
    } catch (error) {
      console.error(`[PUT /api/diagrams/${diagramId}] Error saving diagram:`, error);
      res.status(500).json({ error: 'Failed to save diagram' });
    }
  });

  // Delete diagram
  app.delete('/api/diagrams/:id', async (req, res) => {
    try {
      const filePath = path.join(STORAGE_PATH, `${req.params.id}.json`);
      await fs.unlink(filePath);

      res.json({ success: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Diagram not found' });
      } else {
        console.error('Error deleting diagram:', error);
        res.status(500).json({ error: 'Failed to delete diagram' });
      }
    }
  });

  // Create a new diagram
  app.post('/api/diagrams', async (req, res) => {
    try {
      const id = req.body.id || `diagram_${Date.now()}`;
      const filePath = path.join(STORAGE_PATH, `${id}.json`);

      // Check if already exists
      try {
        await fs.access(filePath);
        return res.status(409).json({ error: 'Diagram already exists' });
      } catch {
        // File doesn't exist, proceed
      }

      const data = {
        ...req.body,
        id,
        created: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };

      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      res.status(201).json({ success: true, id });
    } catch (error) {
      console.error('Error creating diagram:', error);
      res.status(500).json({ error: 'Failed to create diagram' });
    }
  });

  /**
   * NEW: Import JSON endpoint
   * Allows loading a JSON payload and saving it as a new diagram
   */
  app.post('/api/import', async (req, res) => {
    try {
      const { name, data } = req.body;

      // Use provided data or the whole body if 'data' property is missing
      const diagramContent = data || req.body;

      if (!diagramContent || (Array.isArray(diagramContent) && diagramContent.length === 0)) {
        return res.status(400).json({ error: 'Invalid or missing diagram data' });
      }

      const id = `import_${Date.now()}`;
      const filePath = path.join(STORAGE_PATH, `${id}.json`);

      // Ensure basic structure
      const finalData = {
        ...diagramContent,
        id,
        name: name || diagramContent.name || 'Imported Diagram',
        lastModified: new Date().toISOString(),
        created: diagramContent.created || new Date().toISOString()
      };

      await fs.writeFile(filePath, JSON.stringify(finalData, null, 2));
      console.log(`[IMPORT] Successfully imported diagram: ${id} (${finalData.name})`);

      res.status(201).json({
        success: true,
        id,
        name: finalData.name,
        message: 'Diagram imported and saved successfully'
      });
    } catch (error) {
      console.error('[IMPORT] Error:', error);
      res.status(500).json({ error: 'Failed to import JSON', details: error.message });
    }
  });

  /**
   * NEW: Export Image endpoint
   * Generates an image from a saved diagram ID
   * NOTE: This is a placeholder structure. Real image generation on server 
   * requires Puppeteer to render the React application.
   */
  app.get('/api/export/:id', async (req, res) => {
    const { id } = req.params;
    const format = req.query.format || 'png'; // png (default) or svg (not yet supported)
    const scale = parseFloat(req.query.scale) || 2;

    try {
      const filePath = path.join(STORAGE_PATH, `${id}.json`);
      await fs.access(filePath);

      console.log(`[EXPORT] Generating ${format} for diagram: ${id} (scale: ${scale})`);

      // Dynamic URL - in dev it's 3001, in prod it might be different
      // Since it's server-side, we use localhost
      const host = process.env.WEB_APP_URL || 'http://localhost:3000';
      const exportUrl = `${host}/display/${id}?export=true`;
      console.log(`[EXPORT] Loading URL: ${exportUrl}`);

      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      try {
        const page = await browser.newPage();

        // Log browser console messages
        page.on('console', msg => console.log('[BROWSER]', msg.text()));

        await page.setViewport({
          width: 1920,
          height: 1080,
          deviceScaleFactor: scale
        });

        console.log('[EXPORT] Navigation starting...');
        const response = await page.goto(exportUrl, {
          waitUntil: 'load',
          timeout: 60000
        });

        if (response) {
          console.log(`[EXPORT] Navigation finished with status: ${response.status()}`);
        } else {
          console.log('[EXPORT] Navigation finished (no response object)');
        }

        // Wait for the diagram to be loaded and rendered
        console.log('[EXPORT] Waiting for [data-is-ready="true"]...');
        await page.waitForSelector('[data-is-ready="true"]', { timeout: 30000 });

        console.log('[EXPORT] Element found, waiting for final layout/icons...');
        await new Promise(r => setTimeout(r, 3000));

        const element = await page.$('[data-is-ready="true"]');

        if (!element) {
          throw new Error('Diagram container not found on page after waiting');
        }

        console.log('[EXPORT] Taking screenshot...');
        const imageBuffer = await element.screenshot({
          type: 'png',
          omitBackground: true
        });

        await browser.close();
        console.log('[EXPORT] Export complete!');

        res.set('Content-Type', 'image/png');
        res.set('Content-Disposition', `attachment; filename="export-${id}.png"`);
        res.send(imageBuffer);

      } catch (err) {
        await browser.close();
        throw err;
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Diagram not found for export' });
      } else {
        console.error('[EXPORT] Error:', error);
        res.status(500).json({ error: 'Export failed', details: error.message });
      }
    }
  });

} else {
  // Storage disabled - return appropriate responses
  app.get('/api/diagrams', (req, res) => {
    res.status(503).json({ error: 'Server storage is disabled' });
  });

  app.get('/api/diagrams/:id', (req, res) => {
    res.status(503).json({ error: 'Server storage is disabled' });
  });

  app.put('/api/diagrams/:id', (req, res) => {
    res.status(503).json({ error: 'Server storage is disabled' });
  });

  app.delete('/api/diagrams/:id', (req, res) => {
    res.status(503).json({ error: 'Server storage is disabled' });
  });

  app.post('/api/diagrams', (req, res) => {
    res.status(503).json({ error: 'Server storage is disabled' });
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`FossFLOW Backend Server running on port ${PORT}`);
  console.log(`Server storage: ${STORAGE_ENABLED ? 'ENABLED' : 'DISABLED'}`);
  if (STORAGE_ENABLED) {
    console.log(`Storage path: ${STORAGE_PATH}`);
    console.log(`Git backup: ${ENABLE_GIT_BACKUP ? 'ENABLED' : 'DISABLED'}`);
  }
});