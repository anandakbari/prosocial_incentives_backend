class Logger {
  constructor() {
    // Use environment variable directly to avoid circular dependency issues
    this.logLevel = this.getLogLevel(process.env.LOG_LEVEL || 'info');
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m'
    };
  }

  getLogLevel(level) {
    const levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    return levels[level] || 2;
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    
    let colorCode = '';
    switch (level) {
      case 'error': colorCode = this.colors.red; break;
      case 'warn': colorCode = this.colors.yellow; break;
      case 'info': colorCode = this.colors.blue; break;
      case 'debug': colorCode = this.colors.dim; break;
    }

    const levelStr = `${colorCode}[${level.toUpperCase()}]${this.colors.reset}`;
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    
    return `${this.colors.dim}${timestamp}${this.colors.reset} ${levelStr} ${this.colors.cyan}[${pid}]${this.colors.reset} ${message}${metaStr}`;
  }

  log(level, message, meta = {}) {
    const levelNum = this.getLogLevel(level);
    if (levelNum <= this.logLevel) {
      const formattedMessage = this.formatMessage(level, message, meta);
      console.log(formattedMessage);
      
      // In production, you might want to send logs to external service
      if (process.env.NODE_ENV === 'production') {
        this.sendToLogService(level, message, meta);
      }
    }
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  // Matchmaking-specific logging methods
  matchmakingEvent(event, participantId, data = {}) {
    this.info(`🎯 Matchmaking: ${event}`, {
      participantId,
      event,
      ...data
    });
  }

  websocketEvent(event, socketId, data = {}) {
    this.debug(`🔌 WebSocket: ${event}`, {
      socketId,
      event,
      ...data
    });
  }

  redisEvent(operation, key, data = {}) {
    this.debug(`📊 Redis: ${operation}`, {
      key,
      operation,
      ...data
    });
  }

  performanceMetric(metric, value, unit = 'ms') {
    this.info(`⚡ Performance: ${metric}`, {
      metric,
      value,
      unit
    });
  }

  securityEvent(event, ip, data = {}) {
    this.warn(`🔒 Security: ${event}`, {
      ip,
      event,
      ...data
    });
  }

  // Send logs to external service in production
  sendToLogService(level, message, meta) {
    // Implementation depends on your logging service
    // Examples: Winston, DataDog, Splunk, etc.
    
    // For now, just structure the log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
      service: 'prosocial-matchmaking',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    // In production, send to your log aggregation service
    // logService.send(logEntry);
  }

  // Request logging middleware
  static requestMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      const logger = new Logger();
      
      // Add logger to request object
      req.logger = logger;
      
      // Log request
      logger.info(`📥 ${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Override res.json to log response
      const originalJson = res.json;
      res.json = function(data) {
        const duration = Date.now() - start;
        
        if (res.statusCode >= 400) {
          logger.error(`📤 ${req.method} ${req.path} - ${res.statusCode}`, {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            error: data.error || data.message
          });
        } else {
          logger.info(`📤 ${req.method} ${req.path} - ${res.statusCode}`, {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration
          });
        }
        
        return originalJson.call(this, data);
      };

      next();
    };
  }
}

export default new Logger();