import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';

// Minimal static server so the assetlink dev loader can fetch the plugins
// straight from this repo during local development. Point assetlink's plugin
// loader / repo.json at e.g. http://localhost:5173/Plants/HarvestingPlants.alink.vue
//
// CORS is enabled so the Asset Link app (served from the farmOS instance, e.g.
// http://localhost:8080/alink) can fetch plugins cross-origin from this dev
// server during development.
const root = process.cwd();
const port = process.env.PORT || 5173;

const contentTypes = {
  '.vue': 'text/plain',
  '.alink.vue': 'text/plain',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
};

createServer(async (req, res) => {
  // Answer CORS preflight requests directly.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }
  try {
    let path = decodeURIComponent(req.url.split('?')[0]);
    if (path === '/') path = '/index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) {
      res.writeHead(403, corsHeaders);
      res.end('Forbidden');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      ...corsHeaders,
      'content-type': contentTypes[extname(file)] || 'application/octet-stream',
    });
    res.end(data);
  } catch {
    res.writeHead(404, corsHeaders);
    res.end('Not found');
  }
}).listen(port, () => {
  console.log(`Dev server running: http://localhost:${port}`);
});
