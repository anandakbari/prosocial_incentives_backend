import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config/index.js';
import RedisService from './services/RedisService.js';
import WebSocketService from './services/WebSocketService.js';
import MatchmakingEngine from './services/MatchmakingEngine.js';
import DatabaseService from './services/DatabaseService.js';
import AnalyticsService from './services/AnalyticsService.js';
import MatchmakingController from './controllers/MatchmakingController.js';
import AdminController from './controllers/AdminController.js';
import logger from './utils/logger.js';
import {
  corsOptions,
  requestLogger,
  errorHandler,
  securityHeaders,
  sanitizeInput,
  apiRateLimit,
  matchmakingRateLimit,
  validateParticipantId,
  validateRoundNumber,
  validateSkillLevel,
  validateTreatmentGroup,
  validateMatchId
} from './middleware/validation.js';

class MatchmakingServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.isShuttingDown = false;
    this.cleanupInterval = null;
  }

  /**
   * Initialize the server
   */
  async initialize() {
    try {
      logger.info('🚀 Initializing Prosocial Matchmaking Backend...');

      // Connect to Redis
      await RedisService.connect();

      // Connect to Database
      await DatabaseService.connect();

      // Initialize Analytics
      await AnalyticsService.initialize();

      // Create HTTP server
      this.server = createServer(this.app);

      // Setup middleware
      logger.info('Setting up middleware...');
      this.setupMiddleware();
      logger.info('✅ Middleware setup completed');

      // Setup routes
      logger.info('Setting up routes...');
      this.setupRoutes();
      logger.info('✅ Routes setup completed');

      // Setup WebSocket
      logger.info('Setting up WebSocket...');
      WebSocketService.initialize(this.server);
      logger.info('✅ WebSocket setup completed');

      // Setup cleanup interval
      this.setupCleanupInterval();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('✅ Server initialization completed');

    } catch (error) {
      logger.error('❌ Failed to initialize server:', { 
        error: error.message, 
        stack: error.stack 
      });
      console.error('❌ Server initialization error:', error);
      process.exit(1);
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Allow WebSocket connections
      crossOriginEmbedderPolicy: false
    }));
    
    // CORS
    this.app.use(cors(corsOptions));
    
    // Compression
    this.app.use(compression());
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Security headers
    this.app.use(securityHeaders);
    
    // Input sanitization
    this.app.use(sanitizeInput);
    
    // Request logging (simplified for now)
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });
    
    // Rate limiting
    this.app.use('/api/', apiRateLimit);
    this.app.use('/api/matchmaking/', matchmakingRateLimit);

    console.log('✅ Middleware setup completed');
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: Date.now(),
        version: '1.0.0',
        services: {
          redis: RedisService.isConnected,
          websocket: true
        }
      });
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Prosocial Matchmaking Backend',
        version: '1.0.0',
        description: 'Real-time tournament matchmaking for behavioral economics research',
        endpoints: {
          health: '/health',
          api: '/api/matchmaking',
          websocket: '/socket.io'
        },
        timestamp: Date.now()
      });
    });

    // API routes with validation
    const apiRouter = express.Router();

    // Matchmaking endpoints
    apiRouter.post('/start', 
      validateParticipantId, 
      validateRoundNumber, 
      validateSkillLevel, 
      validateTreatmentGroup, 
      MatchmakingController.startMatchmaking.bind(MatchmakingController)
    );

    apiRouter.post('/cancel', 
      validateParticipantId, 
      validateRoundNumber, 
      MatchmakingController.cancelMatchmaking.bind(MatchmakingController)
    );

    apiRouter.get('/queue/:roundNumber', 
      validateRoundNumber, 
      MatchmakingController.getQueueStatus.bind(MatchmakingController)
    );

    apiRouter.get('/position/:participantId/:roundNumber', 
      validateParticipantId, 
      validateRoundNumber, 
      MatchmakingController.getQueuePosition.bind(MatchmakingController)
    );

    apiRouter.get('/skill/:participantId', 
      validateParticipantId, 
      MatchmakingController.getSkillLevel.bind(MatchmakingController)
    );

    // Match endpoints
    apiRouter.get('/match/:matchId', 
      validateMatchId, 
      MatchmakingController.getMatch.bind(MatchmakingController)
    );

    apiRouter.put('/match/:matchId/status', 
      validateMatchId, 
      MatchmakingController.updateMatchStatus.bind(MatchmakingController)
    );

    // Participant endpoints
    apiRouter.get('/participant/:participantId/status', 
      validateParticipantId, 
      MatchmakingController.getParticipantStatus.bind(MatchmakingController)
    );

    apiRouter.put('/participant/:participantId/status', 
      validateParticipantId, 
      MatchmakingController.updateParticipantStatus.bind(MatchmakingController)
    );

    // AI endpoints
    apiRouter.post('/ai-match', 
      validateParticipantId, 
      validateRoundNumber, 
      validateSkillLevel, 
      MatchmakingController.createAIMatch.bind(MatchmakingController)
    );

    apiRouter.get('/ai-opponents', 
      MatchmakingController.getAIOpponents.bind(MatchmakingController)
    );

    apiRouter.post('/ai-simulate', 
      MatchmakingController.simulateAIResponse.bind(MatchmakingController)
    );

    // Stats and admin endpoints
    apiRouter.get('/stats', 
      MatchmakingController.getStats.bind(MatchmakingController)
    );

    apiRouter.get('/health', 
      MatchmakingController.healthCheck.bind(MatchmakingController)
    );

    apiRouter.post('/cleanup', 
      MatchmakingController.cleanup.bind(MatchmakingController)
    );

    // Admin routes (separate router for admin endpoints)
    const adminRouter = express.Router();

    adminRouter.get('/dashboard', AdminController.getDashboard.bind(AdminController));
    adminRouter.post('/analytics/report', AdminController.getAnalyticsReport.bind(AdminController));
    adminRouter.get('/queues', AdminController.getQueueMonitoring.bind(AdminController));
    adminRouter.get('/clients', AdminController.getConnectedClients.bind(AdminController));
    adminRouter.post('/clients/disconnect', AdminController.disconnectClient.bind(AdminController));
    adminRouter.get('/ai-opponents', AdminController.getAIOpponents.bind(AdminController));
    adminRouter.post('/ai-opponents/test', AdminController.testAIOpponent.bind(AdminController));
    adminRouter.get('/performance', AdminController.getPerformanceMetrics.bind(AdminController));
    adminRouter.post('/cleanup', AdminController.forceCleanup.bind(AdminController));
    adminRouter.get('/logs', AdminController.getSystemLogs.bind(AdminController));
    adminRouter.put('/config', AdminController.updateConfig.bind(AdminController));

    // Mount API routes
    this.app.use('/api/matchmaking', apiRouter);
    this.app.use('/api/admin', adminRouter);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
        timestamp: Date.now()
      });
    });

    // Error handler (must be last)
    this.app.use(errorHandler);

    logger.info('✅ Routes setup completed');
  }

  /**
   * Setup periodic cleanup
   */
  setupCleanupInterval() {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      try {
        logger.debug('🧹 Running periodic cleanup...');
        await MatchmakingEngine.cleanup();
        await RedisService.cleanupExpiredQueues();
        await AnalyticsService.cleanup();
      } catch (error) {
        logger.error('Error in periodic cleanup:', error);
      }
    }, 5 * 60 * 1000);

    logger.info('✅ Cleanup interval setup completed');
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.warn(`\n🛑 Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop accepting new connections
        this.server.close(() => {
          logger.info('✅ HTTP server closed');
        });

        // Cleanup intervals
        if (this.cleanupInterval) {
          clearInterval(this.cleanupInterval);
        }

        // Cleanup services
        await WebSocketService.cleanup();
        await MatchmakingEngine.cleanup();
        await AnalyticsService.shutdown();
        await DatabaseService.disconnect();
        await RedisService.disconnect();

        logger.info('✅ Graceful shutdown completed');
        process.exit(0);

      } catch (error) {
        logger.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('🚨 Uncaught Exception:', { error: error.message, stack: error.stack });
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('🚨 Unhandled Rejection:', { reason, promise });
      gracefulShutdown('UNHANDLED_REJECTION');
    });

    logger.info('✅ Graceful shutdown handlers setup completed');
  }

  /**
   * Start the server
   */
  async start() {
    try {
      await this.initialize();

      this.server.listen(config.server.port, () => {
        logger.info(`\n🎯 Prosocial Matchmaking Backend`);
        logger.info(`📍 Server running on port ${config.server.port}`);
        logger.info(`🌐 Environment: ${config.server.nodeEnv}`);
        logger.info(`📡 WebSocket: ws://localhost:${config.server.port}/socket.io`);
        logger.info(`🔗 Matchmaking API: http://localhost:${config.server.port}/api/matchmaking`);
        logger.info(`🔧 Admin API: http://localhost:${config.server.port}/api/admin`);
        logger.info(`❤️  Health: http://localhost:${config.server.port}/health`);
        logger.info(`\n✅ Ready to handle matchmaking requests!`);
      });

    } catch (error) {
      logger.error('❌ Failed to start server:', { error: error.message, stack: error.stack });
      process.exit(1);
    }
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MatchmakingServer();
  server.start();
}

export default MatchmakingServer;
