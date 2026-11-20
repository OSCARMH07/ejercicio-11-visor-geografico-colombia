import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';

const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/css/style.css', ['css/style.css', 'text/css']],
  ['/js/app.js', ['js/app.js', 'text/javascript']]
]);

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (request.method !== 'GET') {
      response.writeHead(405).end();
      return;
    }

    if (url.pathname === '/geoserver/wms' || url.pathname === '/geoserver/wfs') {
      const service = url.pathname.endsWith('wms') ? 'wms' : 'wfs';
      const operation = [...url.searchParams].find(([name]) => name.toLowerCase() === 'request')?.[1];
      if (operation?.toLowerCase() !== (service === 'wms' ? 'getmap' : 'getfeature')) {
        response.writeHead(400).end('Operación no disponible.');
        return;
      }
      const source = new URL(`http://localhost:8080/geoserver/taller/${service}`);
      source.search = url.search;
      const upstream = await fetch(source, { signal: AbortSignal.timeout(60000) });
      response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream' });
      const body = Readable.fromWeb(upstream.body);
      body.on('error', () => response.destroy());
      response.on('close', () => body.destroy());
      body.pipe(response);
      return;
    }

    const file = files.get(url.pathname);
    if (!file) {
      response.writeHead(404).end();
      return;
    }
    const [path, contentType] = file;
    const content = await readFile(new URL(`./webapp/${path}`, import.meta.url));
    response.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` }).end(content);
  } catch {
    response.writeHead(502).end('No se pudo obtener el recurso.');
  }
}).listen(8000, '127.0.0.1', () => console.log('Visor local: http://127.0.0.1:8000/'));
