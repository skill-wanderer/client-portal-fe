// server.js
/* eslint-disable @typescript-eslint/no-require-imports */
const https = require("https")
const fs = require("fs")
const express = require("express")
const next = require("next")

const dev = true

if (dev && process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
}

const app = next({ dev })
const handle = app.getRequestHandler()

const httpsOptions = {
  key: fs.readFileSync("./certificates/client-portal.test-key.pem"),
  cert: fs.readFileSync("./certificates/client-portal.test.pem"),
}

app.prepare().then(() => {
  const server = express()

  // 🔥 BLOCK LOCALHOST HARD
  server.use((req, res, nextFn) => {
    const host = req.headers.host || ""

    if (host.includes("localhost")) {
      const target = `https://client-portal.test:3000${req.url}`
      return res.redirect(302, target)
    }

    nextFn()
  })

  server.use((req, res) => {
    return handle(req, res)
  })

  https.createServer(httpsOptions, server).listen(3000, () => {
    console.log("🚀 HTTPS Server running at https://client-portal.test:3000")
  })
})