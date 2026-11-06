import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';

// Minimal static server so the assetlink dev loader can fetch the plugins
// straight from this repo during local development. Point assetlink's plugin
// loader / repo.json at e.g. http://localhost:5173/Plants/HarvestingPlants.alink.vue
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

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(req.url.split('?')[0]);
    if (path === '/') path = '/index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': contentTypes[extname(file)] || 'application/octet-stream',
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(port, () => {
  console.log(`Dev server running: http://localhost:${port}`);
});
