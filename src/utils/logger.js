/**
 * Structured logging utility for ShieldClaw
 * Provides consistent logging across all components
 */

import winston from 'winston';

/**
 * Create a logger instance
 */
export function createLogger(options = {}) {
  const {
    name = 'shieldclaw',
    level = 'info',
    logDir = './logs',
    enableConsole = true,
    enableFile = false,
    enableJson = true
  } = options;
  
  const transports = [];
  
  // Console transport
  if (enableConsole) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
            return `[${timestamp}] [${name}] ${level}: ${message}${metaStr ? '\n' + metaStr : ''}`;
          })
        )
      })
    );
  }
  
  // File transport
  if (enableFile) {
    const { format, transports: fileTransports } = winston;
    
    // Error log file
    fileTransports.push(
      new winston.transports.File({
        filename: `${logDir}/${name}-error.log`,
        level: 'error',
        format: format.combine(
          format.timestamp(),
          format.json()
        )
      })
    );
    
    // Combined log file
    fileTransports.push(
      new winston.transports.File({
        filename: `${logDir}/${name}-combined.log`,
        format: format.combine(
          format.timestamp(),
          format.json()
        )
      })
    );
  }
  
  return winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      enableJson ? winston.format.json() : winston.format.simple()
    ),
    transports
  });
}

/**
 * Create a child logger with context
 */
export function createChildLogger(parentLogger, context) {
  return parentLogger.child(context);
}

/**
 * Log security event with structured format
 */
export function logSecurityEvent(logger, event) {
  const {
    type,
    severity,
    timestamp = Date.now(),
    source,
    target,
    details,
    metadata
  } = event;
  
  const logEntry = {
    type: 'security_event',
    event_type: type,
    severity,
    timestamp,
    source,
    target,
    details,
    metadata
  };
  
  switch (severity) {
    case 'critical':
      logger.critical(type, logEntry);
      break;
    case 'error':
      logger.error(type, logEntry);
      break;
    case 'warning':
      logger.warn(type, logEntry);
      break;
    case 'info':
    default:
      logger.info(type, logEntry);
      break;
  }
}

/**
 * Create audit log entry
 */
export function createAuditLog(action, actor, target, result, metadata = {}) {
  return {
    type: 'audit',
    action,
    actor,
    target,
    result,
    timestamp: Date.now(),
    metadata
  };
}

export default {
  createLogger,
  createChildLogger,
  logSecurityEvent,
  createAuditLog
};
