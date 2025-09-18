import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT) || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
    baseUrl: process.env.BACKEND_BASE_URL || `http://localhost:${parseInt(process.env.PORT) || 3001}`
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || undefined,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3
  },
  
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  },
  
  matchmaking: {
    humanSearchTimeoutMs: parseInt(process.env.HUMAN_SEARCH_TIMEOUT_MS) || 45000,
    aiFallbackEnabled: process.env.AI_FALLBACK_ENABLED !== 'false',
    maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE) || 1000,
    skillMatchingThreshold: parseFloat(process.env.SKILL_MATCHING_THRESHOLD) || 1.5,
    searchIntervalMs: 3000,
    minSearchAttempts: 10
  },
  
  websocket: {
    heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL) || 30000,
    connectionTimeout: parseInt(process.env.WS_CONNECTION_TIMEOUT) || 60000,
    pingTimeout: 20000,
    pingInterval: 25000
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

// Validate required configuration (lenient for development)
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn(`⚠️  Missing environment variables: ${missingEnvVars.join(', ')}`);
  console.warn('⚠️  Database features will be disabled until these are configured');
  console.warn('📝 Please copy .env.example to .env and fill in the required values');
  
  // Only exit in production, warn in development
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

export default config;