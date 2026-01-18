import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '.env');
console.log(`[BOOT] Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, 'data', 'diagrams');
const DOWNLOAD_ASSETS_PATH = process.env.DOWNLOAD_ASSETS_PATH || path.join(__dirname, 'data', 'assets', 'imported');
const BASE_ASSETS_PATH = path.join(__dirname, 'data', 'assets', 'base');
const IMPORTED_ASSETS_PATH = DOWNLOAD_ASSETS_PATH;

function ensureDirSync(dir) {
  if (!existsSync(dir)) {
    console.log(`[BOOT] Creating directory: ${dir}`);
    mkdirSync(dir, { recursive: true });
  }
}

try {
  ensureDirSync(DOWNLOAD_ASSETS_PATH);
  ensureDirSync(BASE_ASSETS_PATH);
  ensureDirSync(IMPORTED_ASSETS_PATH);
  ensureDirSync(STORAGE_PATH);
} catch (err) {
  console.error('[BOOT] Directory creation failed:', err);
}

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;
const STORAGE_ENABLED = process.env.ENABLE_SERVER_STORAGE === 'true';
const ENABLE_GIT_BACKUP = process.env.ENABLE_GIT_BACKUP === 'true';

console.log(`[BOOT] PORT: ${PORT}`);
console.log(`[BOOT] STORAGE_ENABLED: ${STORAGE_ENABLED}`);
console.log(`[BOOT] STORAGE_PATH: ${STORAGE_PATH}`);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Simple request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

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
      console.log(`Found ${files.length} files in ${STORAGE_PATH}`);
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

  // Open specific diagram in the editor
  app.get('/api/diagrams/:id/open', (req, res) => {
    const { id } = req.params;
    console.log(`[GET /api/diagrams/${id}/open] Redirecting to editor...`);
    res.redirect(`/edit/${id}`);
  });

  // Open specific diagram in readonly mode
  app.get('/api/diagrams/:id/display', (req, res) => {
    const { id } = req.params;
    console.log(`[GET /api/diagrams/${id}/display] Redirecting to readonly view...`);
    res.redirect(`/display/${id}`);
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
   * Import JSON endpoint
   */
  app.post('/api/import', async (req, res) => {
    try {
      const { name, data } = req.body;
      const diagramContent = data || req.body;

      if (!diagramContent || (Array.isArray(diagramContent) && diagramContent.length === 0)) {
        return res.status(400).json({ error: 'Invalid or missing diagram data' });
      }

      const id = `import_${Date.now()}`;
      const filePath = path.join(STORAGE_PATH, `${id}.json`);

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
   * Export Image endpoint
   */
  app.get('/api/export/:id', async (req, res) => {
    const { id } = req.params;
    const format = req.query.format || 'png';
    const scale = parseFloat(req.query.scale) || 2;

    try {
      const filePath = path.join(STORAGE_PATH, `${id}.json`);
      await fs.access(filePath);

      const host = process.env.WEB_APP_URL || 'http://localhost:3000';
      const exportUrl = `${host}/display/${id}?export=true`;

      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: scale });
        await page.goto(exportUrl, { waitUntil: 'load', timeout: 60000 });
        await page.waitForSelector('[data-is-ready="true"]', { timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));

        const element = await page.$('[data-is-ready="true"]');
        if (!element) throw new Error('Diagram container not found');

        const imageBuffer = await element.screenshot({ type: 'png', omitBackground: true });
        await browser.close();

        res.set('Content-Type', 'image/png');
        res.set('Content-Disposition', `attachment; filename="export-${id}.png"`);
        res.send(imageBuffer);
      } catch (err) {
        await browser.close();
        throw err;
      }
    } catch (error) {
      console.error('[EXPORT] Error:', error);
      res.status(500).json({ error: 'Export failed', details: error.message });
    }
  });

}

// --- GLOBALLY AVAILABLE ROUTES (Regardless of Storage) ---

// Serve uploaded and base assets
console.log(`[BOOT] Serving /assets/imported from: ${IMPORTED_ASSETS_PATH}`);
console.log(`[BOOT] Serving /assets/base from: ${BASE_ASSETS_PATH}`);

app.use('/assets/imported', express.static(IMPORTED_ASSETS_PATH));
app.use('/assets/download', express.static(IMPORTED_ASSETS_PATH)); // Alias for backward compatibility
app.use('/assets/base', express.static(BASE_ASSETS_PATH));

/**
 * Upload Asset endpoint
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DOWNLOAD_ASSETS_PATH);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'icon-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `/assets/imported/${req.file.filename}`;
  console.log(`[UPLOAD] Saved ${req.file.originalname} to ${fileUrl}`);

  res.json({
    success: true,
    url: fileUrl,
    filename: req.file.filename
  });
});

// --- END GLOBALLY AVAILABLE ROUTES ---

// Serve static files from the built web app with custom cache headers
const webAppPath = path.join(__dirname, '../web/build');
app.use(express.static(webAppPath, {
  setHeaders: (res, path) => {
    if (path.endsWith('index.html') || path.endsWith('service-worker.js')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }
}));

// Express error handler
app.use((err, req, res, next) => {
  console.error('EXPRESS ERROR:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Catch-all route for SPA
app.get('*', (req, res, next) => {
  // If the request is for an API endpoint that wasn't matched, skip to next (404)
  if (req.url.startsWith('/api')) {
    return next();
  }
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  res.sendFile(path.join(webAppPath, 'index.html'));
});

// Process error handlers
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});

// Start server
app.listen(PORT, () => {
  console.log(`FossFLOW Backend Server running on port ${PORT}`);
  console.log(`Server storage: ${STORAGE_ENABLED ? 'ENABLED' : 'DISABLED'}`);
  if (STORAGE_ENABLED) {
    console.log(`Storage path: ${STORAGE_PATH}`);
    console.log(`Git backup: ${ENABLE_GIT_BACKUP ? 'ENABLED' : 'DISABLED'}`);
  }
});