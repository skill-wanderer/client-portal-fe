const CORRELATION_ID_HEADER = "x-correlation-id";

function createCorrelationId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `generated-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getHeaderValue(request, name) {
  if (!request || typeof request !== "object") {
    return null;
  }

  if (request.headers && typeof request.headers.get === "function") {
    return request.headers.get(name);
  }

  if (request.headers && typeof request.headers === "object") {
    const value = request.headers[name] ?? request.headers[name.toLowerCase()];

    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return typeof value === "string" ? value : null;
  }

  if (typeof request.get === "function") {
    const value = request.get(name);
    return typeof value === "string" ? value : null;
  }

  return null;
}

function getOrCreateCorrelationId(request) {
  const existingValue = getHeaderValue(request, CORRELATION_ID_HEADER);
  const correlationId =
    typeof existingValue === "string" && existingValue.trim().length > 0
      ? existingValue.trim()
      : createCorrelationId();

  if (request && typeof request === "object") {
    try {
      request.correlationId = correlationId;
    } catch {}

    if (request.headers && typeof request.headers.set === "function") {
      try {
        request.headers.set(CORRELATION_ID_HEADER, correlationId);
      } catch {}
    } else if (request.headers && typeof request.headers === "object") {
      request.headers[CORRELATION_ID_HEADER] = correlationId;
    }
  }

  return correlationId;
}

function attachCorrelationId(response, correlationId) {
  if (!response || !correlationId) {
    return response;
  }

  if (response.headers && typeof response.headers.set === "function") {
    response.headers.set(CORRELATION_ID_HEADER, correlationId);
    return response;
  }

  if (typeof response.setHeader === "function") {
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
  }

  return response;
}

function serializeError(error) {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  if (typeof error === "string") {
    return { name: "Error", message: error, stack: null };
  }

  try {
    return JSON.parse(JSON.stringify(error));
  } catch {
    return { name: "Error", message: String(error), stack: null };
  }
}

function createLogRecord(level, fields) {
  return {
    level,
    message: fields.message,
    timestamp: fields.timestamp ?? new Date().toISOString(),
    correlationId: fields.correlationId ?? null,
    path: fields.path ?? null,
    method: fields.method ?? null,
    status: fields.status ?? null,
    duration: fields.duration ?? null,
    error: serializeError(fields.error),
  };
}

function emit(record) {
  const serializedRecord = JSON.stringify(record);

  if (record.level === "error") {
    console.error(serializedRecord);
    return;
  }

  if (record.level === "warn") {
    console.warn(serializedRecord);
    return;
  }

  console.info(serializedRecord);
}

function logInfo(fields) {
  emit(createLogRecord("info", fields));
}

function logWarn(fields) {
  emit(createLogRecord("warn", fields));
}

function logError(fields) {
  emit(createLogRecord("error", fields));
}

module.exports = {
  CORRELATION_ID_HEADER,
  attachCorrelationId,
  getOrCreateCorrelationId,
  logError,
  logInfo,
  logWarn,
};