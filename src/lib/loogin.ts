type LogMethod = (...args: unknown[]) => void;

export interface LooginLogger {
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  debug: LogMethod;
  child(scope: string): LooginLogger;
}

function buildLogger(namespace: string): LooginLogger {
  const prefix = namespace ? `[${namespace}]` : '';

  const format = (level: string, args: unknown[]) => {
    if (!prefix) {
      return [`[${level}]`, ...args];
    }
    return [`[${level}]${prefix}`, ...args];
  };

  const logger: LooginLogger = {
    info: (...args) => console.log(...format('info', args)),
    warn: (...args) => console.warn(...format('warn', args)),
    error: (...args) => console.error(...format('error', args)),
    debug: (...args) => console.debug(...format('debug', args)),
    child: (scope: string) => buildLogger(namespace ? `${namespace}:${scope}` : scope),
  };

  return logger;
}

export const loogin = {
  scope(scope: string): LooginLogger {
    return buildLogger(scope);
  },
};


