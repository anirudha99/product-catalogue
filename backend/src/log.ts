export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
type Fields = Record<string, unknown>;

export interface Logger {
  debug(message: string, fields?: Fields): void;
  info(message: string, fields?: Fields): void;
  warn(message: string, fields?: Fields): void;
  error(message: string, fields?: Fields): void;
}

const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

/**
 * One JSON object per line on stdout. Callers must never pass customer details
 * (name, email, phone, message): log IDs and references only.
 */
export function createLogger(
  level: LogLevel,
  write: (line: string) => void = (line) => process.stdout.write(line + "\n"),
): Logger {
  const log =
    (at: Exclude<LogLevel, "silent">) =>
    (message: string, fields: Fields = {}) => {
      if (order[at] < order[level]) return;
      write(JSON.stringify({ time: new Date().toISOString(), level: at, message, ...fields }));
    };
  return { debug: log("debug"), info: log("info"), warn: log("warn"), error: log("error") };
}

export const silentLogger: Logger = createLogger("silent");
