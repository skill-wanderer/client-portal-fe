// server.js
/* eslint-disable @typescript-eslint/no-require-imports */
const https = require("https")
const fs = require("fs")
const express = require("express")
const next = require("next")
const {
  attachCorrelationId,
  getOrCreateCorrelationId,
  logError,
  logInfo,
  logWarn,
} = require("./lib/observability/runtime.js")

const dev = process.env.NODE_ENV !== "production"

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  throw new Error(
    "Insecure TLS bypass detected. Remove NODE_TLS_REJECT_UNAUTHORIZED=0 before starting the HTTPS server."
  )
}

const app = next({ dev })
const handle = app.getRequestHandler()

const httpsOptions = {
  key: fs.readFileSync("./certs/key.pem"),
  cert: fs.readFileSync("./certs/cert.pem"),
}

function logEntryResponse(correlationId, method, path, status, duration) {
  const payload = {
    message: "entry_request_complete",
    correlationId,
    method,
    path,
    status,
    duration,
  }

  if (status >= 500) {
    logError(payload)
    return
  }

  if (status >= 400) {
    logWarn(payload)
    return
  }

  logInfo(payload)
}

app.prepare().then(() => {
  const server = express()

  server.use((req, res, nextFn) => {
    const correlationId = getOrCreateCorrelationId(req)
    const startedAt = Date.now()
    const path = req.originalUrl || req.url

    attachCorrelationId(res, correlationId)
    logInfo({
      message: "entry_request_start",
      correlationId,
      method: req.method,
      path,
    })

    res.on("finish", () => {
      logEntryResponse(
        correlationId,
        req.method,
        path,
        res.statusCode,
        Date.now() - startedAt
      )
    })

    nextFn()
  })

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
    logInfo({
      message: "https_server_started",
      path: "https://client-portal.test:3000",
    })
  })
})