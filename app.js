const http = require('http');

const PORT = 3000;
const HOST = '0.0.0.0';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      message: 'Hello from Node.js in Docker!',
      path: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
    })
  );
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});
