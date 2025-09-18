import rateLimit from 'express-rate-limit';

/**
 * Rate limiting middleware for API endpoints
 */
export const createRateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again later',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/api/matchmaking/health';
    }
  });
};

/**
 * Relaxed rate limiting for matchmaking operations (development)
 */
export const matchmakingRateLimit = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  500 // 500 requests per 5 minutes (much higher for development)
);

/**
 * Relaxed general API rate limiting (development)
 */
export const apiRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  1000 // 1000 requests per 15 minutes (much higher for development)
);

/**
 * Validation middleware for participant ID
 */
export const validateParticipantId = (req, res, next) => {
  const participantId = req.body.participantId || req.params.participantId;
  
  if (!participantId) {
    return res.status(400).json({
      success: false,
      error: 'Participant ID is required'
    });
  }

  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(participantId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid participant ID format'
    });
  }

  next();
};

/**
 * Validation middleware for round number
 */
export const validateRoundNumber = (req, res, next) => {
  const roundNumber = req.body.roundNumber || req.params.roundNumber;
  
  if (roundNumber === undefined || roundNumber === null) {
    return res.status(400).json({
      success: false,
      error: 'Round number is required'
    });
  }

  const round = parseInt(roundNumber);
  if (isNaN(round) || round < 1 || round > 10) {
    return res.status(400).json({
      success: false,
      error: 'Round number must be between 1 and 10'
    });
  }

  // Normalize to integer
  if (req.body.roundNumber !== undefined) {
    req.body.roundNumber = round;
  }
  if (req.params.roundNumber !== undefined) {
    req.params.roundNumber = round;
  }

  next();
};

/**
 * Validation middleware for skill level
 */
export const validateSkillLevel = (req, res, next) => {
  const { skillLevel } = req.body;
  
  if (skillLevel !== undefined && skillLevel !== null) {
    const skill = parseFloat(skillLevel);
    if (isNaN(skill) || skill < 1 || skill > 10) {
      return res.status(400).json({
        success: false,
        error: 'Skill level must be between 1 and 10'
      });
    }
    req.body.skillLevel = skill;
  }

  next();
};

/**
 * Validation middleware for treatment group
 */
export const validateTreatmentGroup = (req, res, next) => {
  const { treatmentGroup } = req.body;
  
  if (treatmentGroup !== undefined) {
    const validGroups = [
      'Group 1: Control',
      'Group 2: Goal Setting Only',
      'Group 3: Goal Setting + AI Assistant',
      'Group 4: Goal Setting + AI Assistant + Competition',
      'Group 5: Goal Setting + AI Assistant + Blind Competition',
      // Keep the old short codes for backward compatibility
      'control', 
      'goal_setting', 
      'goal_ai', 
      'tournament'
    ];
    
    if (!validGroups.includes(treatmentGroup)) {
      return res.status(400).json({
        success: false,
        error: `Invalid treatment group. Must be one of: ${validGroups.slice(0, 5).join(', ')}`
      });
    }
  }

  next();
};

/**
 * Validation middleware for match ID
 */
export const validateMatchId = (req, res, next) => {
  const { matchId } = req.params;
  
  if (!matchId) {
    return res.status(400).json({
      success: false,
      error: 'Match ID is required'
    });
  }

  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(matchId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid match ID format'
    });
  }

  next();
};

/**
 * Request logging middleware
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  console.log(`📝 ${req.method} ${req.path} - ${req.ip} - ${new Date().toISOString()}`);
  
  // Log request body for non-GET requests (excluding sensitive data)
  if (req.method !== 'GET' && req.body) {
    const sanitizedBody = { ...req.body };
    // Remove any potential sensitive fields
    delete sanitizedBody.password;
    delete sanitizedBody.token;
    console.log(`📦 Request body:`, sanitizedBody);
  }

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - start;
    console.log(`📤 ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    
    // Log error responses
    if (res.statusCode >= 400) {
      console.log(`❌ Error response:`, data);
    }
    
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error('🚨 Unhandled error:', err);

  // Default error response
  let status = 500;
  let message = 'Internal server error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = err.message;
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = 'Unauthorized';
  } else if (err.code === 'ECONNREFUSED') {
    status = 503;
    message = 'Service temporarily unavailable';
  }

  res.status(status).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    timestamp: Date.now()
  });
};

/**
 * CORS configuration
 */
export const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const defaultOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'https://prosocial-incentives.onrender.com',
      'https://prosocial-incentives-backend.onrender.com',
      'https://prosocial.netlify.app'
    ];
    
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()) || defaultOrigins;
    
    console.log(`🔍 CORS check - Origin: ${origin}, Allowed: ${allowedOrigins.join(', ')}`);
    
    // For now, allow all origins to debug the issue
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*') || origin.includes('prosocial') || origin.includes('netlify')) {
      console.log(`✅ CORS allowed for origin: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked for origin: ${origin}`);
      // Still allow but log the rejection for debugging
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining']
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove server header
  res.removeHeader('X-Powered-By');
  
  next();
};

/**
 * Request sanitization middleware
 */
export const sanitizeInput = (req, res, next) => {
  // Basic input sanitization
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove potential XSS patterns
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
};