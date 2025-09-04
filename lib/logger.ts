import pino from "pino";

// Configure logger based on environment
const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";

// Create logger with appropriate level and format
export const logger = pino({
  level: isDevelopment ? "debug" : "info",
  // In production, use JSON format for log aggregation
  ...(isProduction && {
    formatters: {
      level: (label) => {
        return { level: label };
      },
      log: (obj) => {
        // Add timestamp and environment info
        return {
          ...obj,
          timestamp: new Date().toISOString(),
          env: process.env.NODE_ENV,
          service: "ai-chat",
        };
      },
    },
  }),
  // In development, use pretty printing
  ...(!isProduction && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
});

// Create child loggers for different modules
export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};

// Specific loggers for different parts of the app
export const authLogger = createModuleLogger("auth");
export const apiLogger = createModuleLogger("api");
export const compareLogger = createModuleLogger("compare");
export const streamLogger = createModuleLogger("stream");
export const dbLogger = createModuleLogger("database");
export const uiLogger = createModuleLogger("ui");

// Helper functions for common logging patterns
export const logRequest = (
  logger: pino.Logger,
  method: string,
  url: string,
  userId?: string
) => {
  logger.info({ method, url, userId }, "Request received");
};

export const logError = (logger: pino.Logger, error: any, context?: any) => {
  logger.error(
    { error: error.message, stack: error.stack, ...context },
    "Error occurred"
  );
};

export const logPerformance = (
  logger: pino.Logger,
  operation: string,
  duration: number,
  context?: any
) => {
  logger.info({ operation, duration, ...context }, "Performance measurement");
};

// Export default logger for backward compatibility
export default logger;
