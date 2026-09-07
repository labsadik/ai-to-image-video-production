type LogContext = Record<string, string | number | boolean | null | undefined>;

function sanitizeContext(context: LogContext) {
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;
    if (/token|secret|key|authorization|cookie|password|prompt/i.test(key)) continue;
    output[key] = value;
  }
  return output;
}

export function logServerError(event: string, error: unknown, context: LogContext = {}) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({
    level: 'error',
    event,
    message,
    ...sanitizeContext(context),
    timestamp: new Date().toISOString(),
  }));
}

export function logServerWarn(event: string, context: LogContext = {}) {
  console.warn(JSON.stringify({
    level: 'warn',
    event,
    ...sanitizeContext(context),
    timestamp: new Date().toISOString(),
  }));
}
