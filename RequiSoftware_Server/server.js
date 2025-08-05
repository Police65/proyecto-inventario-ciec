const http = require('http');
const fs =require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
const HOSTNAME = '0.0.0.0';
const basePath = path.join(__dirname, 'RequiSoftware');

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'IP no encontrada';
}

const server = http.createServer((req, res) => {
    console.log(`Petición recibida para: ${req.url}`);
    const normalizedUrl = path.normalize(decodeURIComponent(req.url));
    let resourcePath = (normalizedUrl === path.sep) ? '/index.html' : normalizedUrl;
    if (resourcePath.startsWith(path.sep)) {
        resourcePath = resourcePath.substring(1);
    }
    const filePath = path.join(basePath, resourcePath);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            console.log(`Recurso no encontrado, sirviendo index.html como fallback.`);
            fs.readFile(path.join(basePath, 'index.html'), (error, content) => {
                if (error) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('ERROR CRÍTICO: No se pudo leer el archivo index.html.');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(content);
                }
            });
            return;
        }

        const extname = String(path.extname(filePath)).toLowerCase();
        const contentType = mimeTypes[extname] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, HOSTNAME, () => {
    const localIp = getLocalIpAddress();
    console.log('=================================================');
    console.log('    🚀 Servidor de RequiSoftware iniciado 🚀    ');
    console.log('=================================================');
    console.log(`✅ Escuchando en el puerto: ${PORT}`);
    console.log(`✅ Accesible en este equipo: http://localhost:${PORT}`);
    console.log(`✅ Accesible en tu red local: http://${localIp}:${PORT}`);
    console.log('=================================================');
});