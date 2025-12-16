import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

const apiMiddleware = () => ({
    name: 'api-middleware',
    configureServer(server) {
        server.middlewares.use('/api/models', (req, res, next) => {
            const filePath = path.resolve(process.cwd(), 'src/data/local_models.json');

            if (req.method === 'GET') {
                if (fs.existsSync(filePath)) {
                    const data = fs.readFileSync(filePath, 'utf-8');
                    res.setHeader('Content-Type', 'application/json');
                    res.end(data || '[]');
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.end('[]');
                }
            } else if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });
                req.on('end', () => {
                    try {
                        JSON.parse(body);
                        fs.writeFileSync(filePath, body);
                        res.statusCode = 200;
                        res.end('{"success":true}');
                    } catch (e) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: 'Invalid JSON or write error' }));
                    }
                });
            } else {
                next();
            }
        });
    }
});

export default defineConfig({
    plugins: [apiMiddleware()]
});
