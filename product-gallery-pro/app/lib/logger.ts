type LogLevel = "info" | "warn" | "error" | "debug";

const isDebug = process.env.NODE_ENV === "development";

function log(level: LogLevel, message: string, data?: unknown): void {
  if (level === "debug" && !isDebug) return;

  const timestamp = new Date().toISOString();
  const prefix = `[PGP][${level.toUpperCase()}][${timestamp}]`;

  switch (level) {
    case "error":
      console.error(prefix, message, data ?? "");
      break;
    case "warn":
      console.warn(prefix, message, data ?? "");
      break;
    case "debug":
      console.debug(prefix, message, data ?? "");
      break;
    default:
      console.log(prefix, message, data ?? "");
  }
}

export function logInfo(message: string, data?: unknown): void {
  log("info", message, data);
}

export function logWarn(message: string, data?: unknown): void {
  log("warn", message, data);
}

export function logError(message: string, data?: unknown): void {
  log("error", message, data);
}

export function logDebug(message: string, data?: unknown): void {
  log("debug", message, data);
}
