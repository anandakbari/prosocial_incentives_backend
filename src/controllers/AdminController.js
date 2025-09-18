import MatchmakingEngine from '../services/MatchmakingEngine.js';
import RedisService from '../services/RedisService.js';
import DatabaseService from '../services/DatabaseService.js';
import AnalyticsService from '../services/AnalyticsService.js';
import WebSocketService from '../services/WebSocketService.js';
import AIOpponentService from '../services/AIOpponentService.js';
import logger from '../utils/logger.js';
import { formatDuration } from '../utils/helpers.js';

class AdminController {
  /**
   * Get comprehensive system dashboard data
   * GET /api/admin/dashboard
   */
  async getDashboard(req, res) {
    try {
      logger.info('📊 Admin dashboard requested');

      const [
        dashboardData,
        matchmakingStats,
        queueStatus,
        systemHealth
      ] = await Promise.all([
        AnalyticsService.getDashboardData(),
        MatchmakingEngine.getMatchmakingStats(),
        this.getAllQueueStatus(),
        this.getSystemHealth()
      ]);

      const dashboard = {
        realTime: {
          ...dashboardData.realTime,
          activeSearches: matchmakingStats.activeSearches,
          connectedClients: WebSocketService.getConnectedCount()
        },
        analytics: dashboardData,
        matchmaking: matchmakingStats,
        queues: queueStatus,
        system: systemHealth,
        lastUpdated: Date.now()
      };

      res.json({
        success: true,
        data: dashboard,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error getting admin dashboard:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard data',
        message: error.message
      });
    }
  }

  /**
   * Get real-time analytics report
   * POST /api/admin/analytics/report
   */
  async getAnalyticsReport(req, res) {
    try {
      const { timeRangeHours, roundNumber, includePerformance } = req.body;

      const report = await AnalyticsService.generateReport({
        timeRangeHours: timeRangeHours || 24,
        roundNumber,
        includePerformance: includePerformance !== false
      });

      res.json({
        success: true,
        data: report,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error generating analytics report:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to generate analytics report',
        message: error.message
      });
    }
  }

  /**
   * Get live queue monitoring data
   * GET /api/admin/queues
   */
  async getQueueMonitoring(req, res) {
    try {
      const queueStatus = await this.getAllQueueStatus();
      
      // Get detailed analytics for each active queue
      const detailedQueues = await Promise.all(
        Object.keys(queueStatus).map(async (roundNumber) => {
          const analytics = await AnalyticsService.getQueueAnalytics(parseInt(roundNumber));
          return {
            roundNumber: parseInt(roundNumber),
            ...queueStatus[roundNumber],
            analytics
          };
        })
      );

      res.json({
        success: true,
        data: {
          queues: detailedQueues,
          summary: {
            totalQueues: detailedQueues.length,
            totalParticipants: detailedQueues.reduce((sum, q) => sum + q.totalWaiting, 0),
            averageWaitTime: this.calculateOverallAverageWait(detailedQueues)
          }
        },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error getting queue monitoring data:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get queue monitoring data',
        message: error.message
      });
    }
  }

  /**
   * Get connected clients information
   * GET /api/admin/clients
   */
  async getConnectedClients(req, res) {
    try {
      const clients = WebSocketService.getConnectedClients();
      
      const clientsWithStatus = await Promise.all(
        clients.map(async (client) => {
          try {
            const status = await RedisService.getParticipantStatus(client.participantId);
            return {
              ...client,
              status: status.status || 'unknown',
              lastStatusUpdate: status.lastUpdated || null
            };
          } catch (error) {
            return {
              ...client,
              status: 'error',
              lastStatusUpdate: null
            };
          }
        })
      );

      // Group by status
      const statusGroups = clientsWithStatus.reduce((groups, client) => {
        const status = client.status;
        if (!groups[status]) groups[status] = [];
        groups[status].push(client);
        return groups;
      }, {});

      res.json({
        success: true,
        data: {
          total: clientsWithStatus.length,
          clients: clientsWithStatus,
          statusGroups,
          connectionSummary: {
            connected: clientsWithStatus.length,
            searching: (statusGroups.searching || []).length,
            matched: (statusGroups.matched || []).length,
            disconnected: (statusGroups.disconnected || []).length
          }
        },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error getting connected clients:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get connected clients data',
        message: error.message
      });
    }
  }

  /**
   * Force disconnect a participant
   * POST /api/admin/clients/disconnect
   */
  async disconnectClient(req, res) {
    try {
      const { participantId, reason } = req.body;

      if (!participantId) {
        return res.status(400).json({
          success: false,
          error: 'Participant ID is required'
        });
      }

      const disconnected = WebSocketService.disconnectParticipant(participantId);
      
      if (disconnected) {
        // Cancel any active matchmaking
        await MatchmakingEngine.cancelMatchmaking(participantId, 0);
        
        // Update status
        await RedisService.setParticipantStatus(participantId, 'admin_disconnected', {
          reason: reason || 'Admin action',
          disconnectedBy: 'admin',
          timestamp: Date.now()
        });

        logger.warn(`🔨 Admin disconnected participant: ${participantId}`, {
          reason,
          timestamp: Date.now()
        });

        res.json({
          success: true,
          message: 'Participant disconnected successfully',
          data: { participantId, reason }
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Participant not found or not connected'
        });
      }

    } catch (error) {
      logger.error('Error disconnecting client:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to disconnect client',
        message: error.message
      });
    }
  }

  /**
   * Get AI opponent statistics and management
   * GET /api/admin/ai-opponents
   */
  async getAIOpponents(req, res) {
    try {
      const aiStats = AIOpponentService.getAIStats();
      const opponents = AIOpponentService.getAllOpponents();
      
      // Get AI usage statistics from Redis
      const aiUsageStats = await this.getAIUsageStats();

      res.json({
        success: true,
        data: {
          opponents,
          statistics: aiStats,
          usage: aiUsageStats,
          lastUpdated: Date.now()
        }
      });

    } catch (error) {
      logger.error('Error getting AI opponents data:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get AI opponents data',
        message: error.message
      });
    }
  }

  /**
   * Test AI opponent simulation
   * POST /api/admin/ai-opponents/test
   */
  async testAIOpponent(req, res) {
    try {
      const { aiId, testScenario } = req.body;

      if (!aiId) {
        return res.status(400).json({
          success: false,
          error: 'AI opponent ID is required'
        });
      }

      const opponent = AIOpponentService.getOpponentById(aiId);
      if (!opponent) {
        return res.status(404).json({
          success: false,
          error: 'AI opponent not found'
        });
      }

      // Create test match
      const testMatch = AIOpponentService.createAIMatch('test-participant', 1, 7);
      
      // Simulate responses for different scenarios
      const testResults = [];
      for (let i = 1; i <= 10; i++) {
        const simulation = AIOpponentService.simulateAIResponse(
          testMatch.aiSettings,
          i,
          testScenario?.difficulty || 5,
          Math.random() > 0.5 // Random opponent performance
        );
        testResults.push(simulation);
      }

      res.json({
        success: true,
        data: {
          opponent,
          testMatch: testMatch.aiSettings,
          simulation: testResults,
          summary: {
            averageAccuracy: testResults.reduce((sum, r) => sum + r.accuracy, 0) / testResults.length,
            averageResponseTime: testResults.reduce((sum, r) => sum + r.responseTimeMs, 0) / testResults.length,
            correctAnswers: testResults.filter(r => r.isCorrect).length
          }
        }
      });

    } catch (error) {
      logger.error('Error testing AI opponent:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to test AI opponent',
        message: error.message
      });
    }
  }

  /**
   * Get system performance metrics
   * GET /api/admin/performance
   */
  async getPerformanceMetrics(req, res) {
    try {
      const [
        performanceMetrics,
        redisInfo,
        memoryUsage
      ] = await Promise.all([
        AnalyticsService.getPerformanceMetrics(),
        this.getRedisInfo(),
        this.getMemoryUsage()
      ]);

      res.json({
        success: true,
        data: {
          application: performanceMetrics,
          redis: redisInfo,
          memory: memoryUsage,
          uptime: process.uptime(),
          timestamp: Date.now()
        }
      });

    } catch (error) {
      logger.error('Error getting performance metrics:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get performance metrics',
        message: error.message
      });
    }
  }

  /**
   * Force cleanup of expired data
   * POST /api/admin/cleanup
   */
  async forceCleanup(req, res) {
    try {
      const { type, olderThanHours } = req.body;
      const hours = olderThanHours || 24;
      
      let results = {};

      switch (type) {
        case 'all':
          results = await this.performFullCleanup(hours);
          break;
        case 'redis':
          results.redisCleanup = await RedisService.cleanupExpiredQueues();
          break;
        case 'database':
          results.databaseCleanup = await DatabaseService.cleanupOldMatches(hours);
          break;
        case 'analytics':
          await AnalyticsService.cleanup(hours);
          results.analyticsCleanup = 'completed';
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid cleanup type. Use: all, redis, database, or analytics'
          });
      }

      logger.info(`🧹 Admin forced cleanup: ${type}`, results);

      res.json({
        success: true,
        data: {
          type,
          olderThanHours: hours,
          results
        },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error performing cleanup:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to perform cleanup',
        message: error.message
      });
    }
  }

  /**
   * Get system logs (last N entries)
   * GET /api/admin/logs
   */
  async getSystemLogs(req, res) {
    try {
      const { limit = 100, level } = req.query;
      
      // In a production system, you'd read from log files or log service
      // For now, return a placeholder
      const logs = {
        message: 'Log retrieval not implemented',
        note: 'In production, this would return filtered log entries',
        parameters: { limit, level }
      };

      res.json({
        success: true,
        data: logs,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error getting system logs:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get system logs',
        message: error.message
      });
    }
  }

  /**
   * Update system configuration
   * PUT /api/admin/config
   */
  async updateConfig(req, res) {
    try {
      const { configType, updates } = req.body;

      if (!configType || !updates) {
        return res.status(400).json({
          success: false,
          error: 'Config type and updates are required'
        });
      }

      // This would update runtime configuration
      // For now, just log the attempt
      logger.info(`🔧 Admin config update requested: ${configType}`, updates);

      res.json({
        success: true,
        message: 'Configuration update logged (not implemented)',
        data: { configType, updates },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error updating config:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to update configuration',
        message: error.message
      });
    }
  }

  // Helper methods

  /**
   * Get status for all active queues
   */
  async getAllQueueStatus() {
    try {
      const keys = await RedisService.client.keys('queue:round:*');
      const queueStatus = {};

      for (const key of keys) {
        const roundNumber = key.split(':')[2];
        const queueSize = await RedisService.getQueueSize(key);
        
        if (queueSize > 0) {
          queueStatus[roundNumber] = await MatchmakingEngine.getQueueStatus(parseInt(roundNumber));
        }
      }

      return queueStatus;
    } catch (error) {
      logger.error('Error getting all queue status:', { error: error.message });
      return {};
    }
  }

  /**
   * Calculate overall average wait time across all queues
   */
  calculateOverallAverageWait(queues) {
    if (queues.length === 0) return 0;
    
    const totalParticipants = queues.reduce((sum, q) => sum + q.totalWaiting, 0);
    if (totalParticipants === 0) return 0;
    
    const weightedWaitTime = queues.reduce((sum, q) => {
      return sum + (q.averageWaitTime * q.totalWaiting);
    }, 0);
    
    return Math.round(weightedWaitTime / totalParticipants);
  }

  /**
   * Get system health information
   */
  async getSystemHealth() {
    try {
      const [
        redisConnected,
        databaseConnected
      ] = await Promise.all([
        RedisService.isConnected,
        DatabaseService.healthCheck()
      ]);

      return {
        redis: redisConnected ? 'healthy' : 'unhealthy',
        database: databaseConnected ? 'healthy' : 'unhealthy',
        websocket: 'healthy', // WebSocket is always healthy if server is running
        uptime: formatDuration(process.uptime() * 1000),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      };
    } catch (error) {
      logger.error('Error getting system health:', { error: error.message });
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Get AI usage statistics
   */
  async getAIUsageStats() {
    try {
      const stats = await RedisService.getMatchStats();
      return {
        todayAIMatches: parseInt(stats.ai_matches) || 0,
        todayHumanMatches: parseInt(stats.human_matches) || 0,
        aiFallbackRate: this.calculateAIFallbackRate(stats)
      };
    } catch (error) {
      logger.error('Error getting AI usage stats:', { error: error.message });
      return { todayAIMatches: 0, todayHumanMatches: 0, aiFallbackRate: 0 };
    }
  }

  /**
   * Calculate AI fallback rate
   */
  calculateAIFallbackRate(stats) {
    const aiMatches = parseInt(stats.ai_matches) || 0;
    const humanMatches = parseInt(stats.human_matches) || 0;
    const totalMatches = aiMatches + humanMatches;
    
    return totalMatches > 0 ? Math.round((aiMatches / totalMatches) * 100) : 0;
  }

  /**
   * Get Redis information
   */
  async getRedisInfo() {
    try {
      // This would use Redis INFO command in production
      return {
        connected: RedisService.isConnected,
        memory: 'N/A - Redis INFO not implemented',
        keyCount: 'N/A - Redis DBSIZE not implemented'
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024)
    };
  }

  /**
   * Perform full system cleanup
   */
  async performFullCleanup(hours) {
    const [
      redisCleanup,
      databaseCleanup
    ] = await Promise.all([
      RedisService.cleanupExpiredQueues(),
      DatabaseService.cleanupOldMatches(hours)
    ]);

    await AnalyticsService.cleanup(hours);

    return {
      redisCleanup,
      databaseCleanup,
      analyticsCleanup: 'completed'
    };
  }
}

export default new AdminController();