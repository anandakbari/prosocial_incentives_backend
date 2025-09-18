import RedisService from './RedisService.js';
import DatabaseService from './DatabaseService.js';
import logger from '../utils/logger.js';
import { formatDuration, debounce } from '../utils/helpers.js';

class AnalyticsService {
  constructor() {
    this.metricsBuffer = new Map(); // Buffer for batch processing
    this.flushInterval = null;
    this.isInitialized = false;
  }

  /**
   * Initialize analytics service
   */
  async initialize() {
    if (this.isInitialized) return;

    // Start periodic flush of buffered metrics
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 30000); // Flush every 30 seconds

    this.isInitialized = true;
    logger.info('✅ Analytics service initialized');
  }

  /**
   * Record a real-time metric
   * @param {string} metricName - Name of the metric
   * @param {any} value - Metric value
   * @param {Object} tags - Optional tags for the metric
   */
  async recordMetric(metricName, value, tags = {}) {
    try {
      const timestamp = Date.now();
      const metricKey = `metric:${metricName}:${timestamp}`;
      
      const metricData = {
        name: metricName,
        value,
        tags,
        timestamp
      };

      // Store in Redis with TTL (24 hours)
      await RedisService.client.setEx(metricKey, 86400, JSON.stringify(metricData));
      
      // Add to time series for real-time dashboard
      await this.addToTimeSeries(metricName, value, timestamp);
      
      // Buffer for batch database insertion
      this.bufferMetric(metricData);
      
    } catch (error) {
      logger.error('Error recording metric:', { metricName, error: error.message });
    }
  }

  /**
   * Add metric to time series for real-time charts
   * @param {string} metricName - Metric name
   * @param {number} value - Metric value
   * @param {number} timestamp - Timestamp
   */
  async addToTimeSeries(metricName, value, timestamp) {
    try {
      const timeSeriesKey = `timeseries:${metricName}`;
      
      // Add to sorted set with timestamp as score
      await RedisService.client.zAdd(timeSeriesKey, {
        score: timestamp,
        value: JSON.stringify({ value, timestamp })
      });

      // Keep only last 1000 data points
      await RedisService.client.zRemRangeByRank(timeSeriesKey, 0, -1001);
      
      // Set TTL (2 hours)
      await RedisService.client.expire(timeSeriesKey, 7200);
      
    } catch (error) {
      logger.error('Error adding to time series:', { metricName, error: error.message });
    }
  }

  /**
   * Buffer metric for batch processing
   * @param {Object} metricData - Metric data
   */
  bufferMetric(metricData) {
    const bufferKey = metricData.name;
    
    if (!this.metricsBuffer.has(bufferKey)) {
      this.metricsBuffer.set(bufferKey, []);
    }
    
    this.metricsBuffer.get(bufferKey).push(metricData);
    
    // If buffer gets too large, flush immediately
    if (this.metricsBuffer.get(bufferKey).length >= 100) {
      this.flushMetrics();
    }
  }

  /**
   * Flush buffered metrics to database
   */
  async flushMetrics() {
    if (this.metricsBuffer.size === 0) return;

    try {
      for (const [metricName, metrics] of this.metricsBuffer.entries()) {
        if (metrics.length === 0) continue;

        // Record activity in database for long-term storage
        await DatabaseService.recordActivity({
          participantId: 'system',
          type: 'analytics_metric',
          data: {
            metricName,
            count: metrics.length,
            values: metrics.map(m => m.value),
            timeRange: {
              start: Math.min(...metrics.map(m => m.timestamp)),
              end: Math.max(...metrics.map(m => m.timestamp))
            }
          },
          roundNumber: null
        });
      }

      logger.debug(`📊 Flushed ${this.metricsBuffer.size} metric types to database`);
      this.metricsBuffer.clear();
      
    } catch (error) {
      logger.error('Error flushing metrics:', { error: error.message });
    }
  }

  /**
   * Record matchmaking event
   * @param {string} event - Event type
   * @param {string} participantId - Participant ID
   * @param {Object} data - Event data
   */
  async recordMatchmakingEvent(event, participantId, data = {}) {
    await this.recordMetric('matchmaking_event', 1, {
      event,
      participantId,
      ...data
    });

    // Record specific metrics based on event type
    switch (event) {
      case 'queue_joined':
        await this.recordMetric('queue_joins', 1, { participantId });
        break;
      case 'match_found':
        await this.recordMetric('matches_created', 1, { 
          participantId, 
          matchType: data.matchType 
        });
        break;
      case 'match_completed':
        await this.recordMetric('matches_completed', 1, { 
          participantId, 
          duration: data.duration 
        });
        break;
    }
  }

  /**
   * Record performance metric
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} metadata - Additional metadata
   */
  async recordPerformance(operation, duration, metadata = {}) {
    await this.recordMetric('performance', duration, {
      operation,
      ...metadata
    });

    // Log slow operations
    if (duration > 5000) { // More than 5 seconds
      logger.warn(`🐌 Slow operation detected: ${operation}`, {
        duration: formatDuration(duration),
        metadata
      });
    }
  }

  /**
   * Get real-time dashboard data
   * @returns {Promise<Object>} Dashboard data
   */
  async getDashboardData() {
    try {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      
      const [
        queueMetrics,
        matchMetrics,
        performanceMetrics,
        activeConnections
      ] = await Promise.all([
        this.getTimeSeriesData('queue_joins', oneHourAgo, now),
        this.getTimeSeriesData('matches_created', oneHourAgo, now),
        this.getTimeSeriesData('performance', oneHourAgo, now),
        this.getActiveConnections()
      ]);

      // Calculate hourly rates
      const queueRate = this.calculateHourlyRate(queueMetrics);
      const matchRate = this.calculateHourlyRate(matchMetrics);
      const avgPerformance = this.calculateAverage(performanceMetrics);

      return {
        realTime: {
          activeConnections,
          queueJoinsPerHour: queueRate,
          matchesPerHour: matchRate,
          averageResponseTime: avgPerformance
        },
        timeSeries: {
          queueJoins: queueMetrics,
          matchesCreated: matchMetrics,
          performance: performanceMetrics
        },
        lastUpdated: now
      };
      
    } catch (error) {
      logger.error('Error getting dashboard data:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get time series data for a metric
   * @param {string} metricName - Metric name
   * @param {number} startTime - Start timestamp
   * @param {number} endTime - End timestamp
   * @returns {Promise<Array>} Time series data
   */
  async getTimeSeriesData(metricName, startTime, endTime) {
    try {
      const timeSeriesKey = `timeseries:${metricName}`;
      
      const data = await RedisService.client.zRangeByScore(
        timeSeriesKey,
        startTime,
        endTime
      );

      return data.map(item => JSON.parse(item));
      
    } catch (error) {
      logger.error('Error getting time series data:', { 
        metricName, 
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Get active WebSocket connections count
   * @returns {Promise<number>} Number of active connections
   */
  async getActiveConnections() {
    try {
      // This would be provided by WebSocketService
      // For now, return a placeholder
      return 0;
    } catch (error) {
      logger.error('Error getting active connections:', { error: error.message });
      return 0;
    }
  }

  /**
   * Calculate hourly rate from time series data
   * @param {Array} timeSeries - Time series data
   * @returns {number} Hourly rate
   */
  calculateHourlyRate(timeSeries) {
    if (timeSeries.length === 0) return 0;
    
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentData = timeSeries.filter(item => item.timestamp >= oneHourAgo);
    return recentData.reduce((sum, item) => sum + (item.value || 1), 0);
  }

  /**
   * Calculate average value from time series data
   * @param {Array} timeSeries - Time series data
   * @returns {number} Average value
   */
  calculateAverage(timeSeries) {
    if (timeSeries.length === 0) return 0;
    
    const sum = timeSeries.reduce((sum, item) => sum + item.value, 0);
    return sum / timeSeries.length;
  }

  /**
   * Get queue analytics
   * @param {number} roundNumber - Round number
   * @returns {Promise<Object>} Queue analytics
   */
  async getQueueAnalytics(roundNumber) {
    try {
      const queueKey = `queue:round:${roundNumber}`;
      const entries = await RedisService.getQueueEntries(queueKey);
      
      const now = Date.now();
      const analytics = {
        totalParticipants: entries.length,
        averageWaitTime: 0,
        waitTimeDistribution: {
          under30s: 0,
          under60s: 0,
          under2min: 0,
          over2min: 0
        },
        skillLevelDistribution: {},
        treatmentGroupDistribution: {}
      };

      if (entries.length > 0) {
        // Calculate wait times
        const waitTimes = entries.map(entry => (now - entry.joinedAt) / 1000);
        analytics.averageWaitTime = waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length;
        
        // Wait time distribution
        waitTimes.forEach(waitTime => {
          if (waitTime < 30) analytics.waitTimeDistribution.under30s++;
          else if (waitTime < 60) analytics.waitTimeDistribution.under60s++;
          else if (waitTime < 120) analytics.waitTimeDistribution.under2min++;
          else analytics.waitTimeDistribution.over2min++;
        });

        // Skill level distribution
        entries.forEach(entry => {
          const skillBucket = Math.floor(entry.skillLevel || 7);
          analytics.skillLevelDistribution[skillBucket] = 
            (analytics.skillLevelDistribution[skillBucket] || 0) + 1;
        });

        // Treatment group distribution
        entries.forEach(entry => {
          const group = entry.treatmentGroup || 'unknown';
          analytics.treatmentGroupDistribution[group] = 
            (analytics.treatmentGroupDistribution[group] || 0) + 1;
        });
      }

      return analytics;
      
    } catch (error) {
      logger.error('Error getting queue analytics:', { 
        roundNumber, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get match analytics
   * @param {number} timeRangeHours - Time range in hours
   * @returns {Promise<Object>} Match analytics
   */
  async getMatchAnalytics(timeRangeHours = 24) {
    try {
      const endTime = Date.now();
      const startTime = endTime - (timeRangeHours * 60 * 60 * 1000);
      
      // Get match data from time series
      const matchData = await this.getTimeSeriesData('matches_created', startTime, endTime);
      const completedData = await this.getTimeSeriesData('matches_completed', startTime, endTime);
      
      const analytics = {
        totalMatches: matchData.length,
        completedMatches: completedData.length,
        completionRate: matchData.length > 0 ? (completedData.length / matchData.length) * 100 : 0,
        averageMatchDuration: 0,
        matchTypeDistribution: {
          human_vs_human: 0,
          human_vs_ai: 0
        },
        hourlyDistribution: Array(24).fill(0)
      };

      // Calculate average match duration
      if (completedData.length > 0) {
        const durations = completedData
          .map(match => match.tags?.duration)
          .filter(duration => duration !== undefined);
        
        if (durations.length > 0) {
          analytics.averageMatchDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        }
      }

      // Match type distribution
      matchData.forEach(match => {
        const matchType = match.tags?.matchType;
        if (matchType && analytics.matchTypeDistribution.hasOwnProperty(matchType)) {
          analytics.matchTypeDistribution[matchType]++;
        }
      });

      // Hourly distribution (last 24 hours)
      matchData.forEach(match => {
        const hour = new Date(match.timestamp).getHours();
        analytics.hourlyDistribution[hour]++;
      });

      return analytics;
      
    } catch (error) {
      logger.error('Error getting match analytics:', { 
        timeRangeHours, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get system performance metrics
   * @returns {Promise<Object>} Performance metrics
   */
  async getPerformanceMetrics() {
    try {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      
      const performanceData = await this.getTimeSeriesData('performance', oneHourAgo, now);
      
      if (performanceData.length === 0) {
        return {
          averageResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          operationCounts: {}
        };
      }

      // Sort by response time for percentile calculations
      const sortedTimes = performanceData
        .map(d => d.value)
        .sort((a, b) => a - b);

      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const p99Index = Math.floor(sortedTimes.length * 0.99);

      const metrics = {
        averageResponseTime: this.calculateAverage(performanceData),
        p95ResponseTime: sortedTimes[p95Index] || 0,
        p99ResponseTime: sortedTimes[p99Index] || 0,
        operationCounts: {}
      };

      // Count operations
      performanceData.forEach(d => {
        const operation = d.tags?.operation || 'unknown';
        metrics.operationCounts[operation] = (metrics.operationCounts[operation] || 0) + 1;
      });

      return metrics;
      
    } catch (error) {
      logger.error('Error getting performance metrics:', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate analytics report
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Analytics report
   */
  async generateReport(options = {}) {
    try {
      const {
        timeRangeHours = 24,
        roundNumber = null,
        includePerformance = true
      } = options;

      const report = {
        generatedAt: Date.now(),
        timeRange: timeRangeHours,
        data: {}
      };

      // Get all analytics
      const [
        matchAnalytics,
        performanceMetrics,
        queueAnalytics
      ] = await Promise.all([
        this.getMatchAnalytics(timeRangeHours),
        includePerformance ? this.getPerformanceMetrics() : null,
        roundNumber ? this.getQueueAnalytics(roundNumber) : null
      ]);

      report.data.matches = matchAnalytics;
      
      if (performanceMetrics) {
        report.data.performance = performanceMetrics;
      }
      
      if (queueAnalytics) {
        report.data.queue = queueAnalytics;
      }

      return report;
      
    } catch (error) {
      logger.error('Error generating analytics report:', { error: error.message });
      throw error;
    }
  }

  /**
   * Cleanup old analytics data
   * @param {number} olderThanHours - Remove data older than X hours
   */
  async cleanup(olderThanHours = 48) {
    try {
      const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
      const keys = await RedisService.client.keys('metric:*');
      
      let cleanedCount = 0;
      
      for (const key of keys) {
        const timestamp = parseInt(key.split(':')[2]);
        if (timestamp && timestamp < cutoffTime) {
          await RedisService.client.del(key);
          cleanedCount++;
        }
      }

      // Cleanup time series data
      const timeSeriesKeys = await RedisService.client.keys('timeseries:*');
      for (const key of timeSeriesKeys) {
        await RedisService.client.zRemRangeByScore(key, '-inf', cutoffTime);
      }

      logger.info(`🧹 Cleaned up ${cleanedCount} old analytics records`);
      
    } catch (error) {
      logger.error('Error cleaning up analytics data:', { error: error.message });
    }
  }

  /**
   * Shutdown analytics service
   */
  async shutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    // Flush any remaining metrics
    await this.flushMetrics();
    
    this.isInitialized = false;
    logger.info('Analytics service shut down');
  }
}

export default new AnalyticsService();