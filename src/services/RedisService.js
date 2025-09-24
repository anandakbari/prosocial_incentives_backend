import Redis from 'redis';
import { config } from '../config/index.js';

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = Redis.createClient({
        url: config.redis.url,
        password: config.redis.password,
        retry_strategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          console.log(`Redis connection attempt ${times}, retrying in ${delay}ms`);
          return delay;
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      console.log('Redis disconnected');
    }
  }

  // Queue Management
  async addToQueue(queueKey, participantData) {
  try {
    // 🔒 Check if participant is already matched
    const status = await this.getParticipantStatus(participantData.participantId);
    if (status?.status === 'matched') {
      console.warn(`⚠️ Participant ${participantData.participantId} is already in match ${status.matchId}, blocking queue add`);
      return false; // or throw new Error(...) if you want hard stop
    }

    const queueEntry = {
      ...participantData,
      joinedAt: Date.now(),
      status: 'waiting'
    };
    
    // Add to sorted set with timestamp as score for FIFO ordering
    await this.client.zAdd(queueKey, {
      score: Date.now(),
      value: JSON.stringify(queueEntry)
    });

    // Set TTL for queue entry (cleanup after 10 minutes)
    await this.client.expire(queueKey, 600);
    
    console.log(`✅ Added participant ${participantData.participantId} to queue ${queueKey}`);
    return true;
  } catch (error) {
    console.error('Error adding to queue:', error);
    throw error;
  }
}


  async removeFromQueue(queueKey, participantId) {
    try {
      // Get all queue entries
      const entries = await this.client.zRange(queueKey, 0, -1);
      
      // Find and remove the specific participant
      for (const entry of entries) {
        const data = JSON.parse(entry);
        if (data.participantId === participantId) {
          await this.client.zRem(queueKey, entry);
          console.log(`✅ Removed participant ${participantId} from queue ${queueKey}`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error removing from queue:', error);
      throw error;
    }
  }

  async getQueueEntries(queueKey, excludeParticipantId = null) {
    try {
      const entries = await this.client.zRange(queueKey, 0, -1);
      const parsedEntries = entries.map(entry => JSON.parse(entry));
      
      if (excludeParticipantId) {
        return parsedEntries.filter(entry => entry.participantId !== excludeParticipantId);
      }
      
      return parsedEntries;
    } catch (error) {
      console.error('Error getting queue entries:', error);
      throw error;
    }
  }

  async getQueuePosition(queueKey, participantId) {
    try {
      const entries = await this.client.zRange(queueKey, 0, -1);
      
      for (let i = 0; i < entries.length; i++) {
        const data = JSON.parse(entries[i]);
        if (data.participantId === participantId) {
          return i + 1; // 1-based position
        }
      }
      
      return -1; // Not found
    } catch (error) {
      console.error('Error getting queue position:', error);
      throw error;
    }
  }

  async getQueueSize(queueKey) {
    try {
      return await this.client.zCard(queueKey);
    } catch (error) {
      console.error('Error getting queue size:', error);
      throw error;
    }
  }

  // Match Management
  async createMatch(matchId, matchData) {
    try {
      const matchKey = `match:${matchId}`;
      
      // Convert all fields to strings for Redis storage
      const redisData = {};
      
      // Safely convert all values to strings
      for (const [key, value] of Object.entries(matchData)) {
        if (value === null || value === undefined) {
          redisData[key] = '';
        } else if (typeof value === 'object') {
          redisData[key] = JSON.stringify(value);
        } else {
          redisData[key] = value.toString();
        }
      }
      
      await this.client.hSet(matchKey, {
        ...redisData,
        createdAt: Date.now().toString(),
        status: 'active'
      });
      
      // Set TTL for match data (cleanup after 2 hours)
      await this.client.expire(matchKey, 7200);
      
      console.log(`✅ Created match ${matchId}`);
      return true;
    } catch (error) {
      console.error('Error creating match:', error);
      throw error;
    }
  }

  async getMatch(matchId) {
    try {
      const matchKey = `match:${matchId}`;
      return await this.client.hGetAll(matchKey);
    } catch (error) {
      console.error('Error getting match:', error);
      throw error;
    }
  }

  async updateMatchStatus(matchId, status) {
    try {
      const matchKey = `match:${matchId}`;
      await this.client.hSet(matchKey, 'status', status);
      return true;
    } catch (error) {
      console.error('Error updating match status:', error);
      throw error;
    }
  }

  // Participant Status Management
  async setParticipantStatus(participantId, status, data = {}) {
    try {
      const statusKey = `participant:${participantId}:status`;
      await this.client.hSet(statusKey, {
        status,
        lastUpdated: Date.now(),
        ...data
      });
      
      // Set TTL for participant status (cleanup after 1 hour)
      await this.client.expire(statusKey, 3600);
      
      return true;
    } catch (error) {
      console.error('Error setting participant status:', error);
      throw error;
    }
  }

  async getParticipantStatus(participantId) {
    try {
      const statusKey = `participant:${participantId}:status`;
      return await this.client.hGetAll(statusKey);
    } catch (error) {
      console.error('Error getting participant status:', error);
      throw error;
    }
  }

  // Statistics and Monitoring
  async incrementMatchStats(statType) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const statsKey = `stats:${today}`;
      await this.client.hIncrBy(statsKey, statType, 1);
      
      // Set TTL for stats (cleanup after 7 days)
      await this.client.expire(statsKey, 604800);
      
      return true;
    } catch (error) {
      console.error('Error incrementing match stats:', error);
      throw error;
    }
  }

  async getMatchStats() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const statsKey = `stats:${today}`;
      return await this.client.hGetAll(statsKey);
    } catch (error) {
      console.error('Error getting match stats:', error);
      throw error;
    }
  }

  // Cleanup utilities
  async cleanupExpiredQueues() {
    try {
      const keys = await this.client.keys('queue:*');
      let cleanedCount = 0;
      
      for (const key of keys) {
        const entries = await this.client.zRange(key, 0, -1);
        const now = Date.now();
        
        for (const entry of entries) {
          const data = JSON.parse(entry);
          // Remove entries older than 5 minutes
          if (now - data.joinedAt > 300000) {
            await this.client.zRem(key, entry);
            cleanedCount++;
          }
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} expired queue entries`);
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up expired queues:', error);
      throw error;
    }
  }

  // Distributed locking for race condition prevention
  async acquireLock(lockKey, lockValue, timeoutMs = 5000) {
    try {
      // Use SET with NX (only set if not exists) and PX (expiry in milliseconds)
      const result = await this.client.set(lockKey, lockValue, {
        NX: true,  // Only set if key doesn't exist
        PX: timeoutMs  // Expire after timeoutMs milliseconds
      });
      
      return result === 'OK';
    } catch (error) {
      console.error('Error acquiring lock:', error);
      return false;
    }
  }

  async releaseLock(lockKey, lockValue) {
    try {
      // Use Lua script to atomically check value and delete if it matches
      // This prevents releasing someone else's lock
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await this.client.eval(script, {
        keys: [lockKey],
        arguments: [lockValue]
      });
      
      return result === 1;
    } catch (error) {
      console.error('Error releasing lock:', error);
      return false;
    }
  }
}

export default new RedisService();