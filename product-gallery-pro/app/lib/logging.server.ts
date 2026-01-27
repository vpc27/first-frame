type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

function formatLog(level: LogLevel, message: string, meta?: LogMeta) {
  const payload: Record<string, unknown> = {
    level,
    timestamp: new Date().toISOString(),
    message,
  };

  if (meta && Object.keys(meta).length > 0) {
    payload.meta = meta;
  }

  return JSON.stringify(payload);
}

export function logInfo(message: string, meta?: LogMeta) {
  // eslint-disable-next-line no-console
  console.log(formatLog("info", message, meta));
}

export function logWarn(message: string, meta?: LogMeta) {
  // eslint-disable-next-line no-console
  console.warn(formatLog("warn", message, meta));
}

export function logError(
  message: string,
  error?: unknown,
  meta?: LogMeta,
) {
  const errorMeta: LogMeta = {
    ...(meta ?? {}),
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error,
  };

  // eslint-disable-next-line no-console
  console.error(formatLog("error", message, errorMeta));
}

export function logAIRequest(operation: string, meta?: LogMeta) {
  logInfo(`AI:${operation}`, meta);
}

export function logAnalyticsIngest(count: number, meta?: LogMeta) {
  logInfo("analytics_ingest", { count, ...(meta ?? {}) });
}

