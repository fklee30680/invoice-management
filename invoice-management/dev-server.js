/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("node:http");
const next = require("next");

const port = Number(process.env.PORT || process.argv.at(-1)) || 3000;
const app = next({ dev: true, dir: process.cwd(), turbopack: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  http
    .createServer((request, response) => handle(request, response))
    .listen(port, () => {
      console.log(`Invoice Management ready at http://localhost:${port}`);
    });
});
