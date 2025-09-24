import { v4 as uuidv4 } from 'uuid';
import RedisService from './RedisService.js';
import AIOpponentService from './AIOpponentService.js';
import { config } from '../config/index.js';
import DatabaseService from './DatabaseService.js';
import { getBotName, getPlayerDisplayName } from '../utils/nameUtils.js';

class MatchmakingEngine {
  constructor() {
    this.activeSearches = new Map(); // Track active searches to prevent duplicates
    this.matchTimeouts = new Map(); // Track AI fallback timeouts
    this.onMatchFound = null; // Callback for when matches are found
  }

  /**
   * Set callback for when matches are found
   * @param {Function} callback - Callback function (matchData) => void
   */
  setMatchFoundCallback(callback) {
    this.onMatchFound = callback;
  }

  /**
   * Start searching for a match for a participant
   * @param {Object} participantData - Participant information
   * @returns {Promise<Object>} Match result
   */
  async startMatchmaking(participantData) {
  const { participantId, participantName, roundNumber, skillLevel, treatmentGroup } = participantData;

  console.log(`🔍 Starting matchmaking for participant ${participantId} in round ${roundNumber}`);

  if (this.activeSearches.has(participantId)) {
    console.log(`⚠️ Search already active for participant ${participantId}`);
    return { status: 'already_searching' };
  }

  try {
    this.activeSearches.set(participantId, {
      startTime: Date.now(),
      roundNumber,
      searchAttempts: 0
    });

    // Set participant status in Redis
    await RedisService.setParticipantStatus(participantId, 'searching', {
      roundNumber,
      skillLevel,
      treatmentGroup
    });

    // ✅ FIX: First add participant to the queue
    await this.cleanupParticipantQueue(participantId, roundNumber);
    await this.joinQueue(participantData);

    // ✅ Then try immediate match
    const immediateMatch = await this.findImmediateMatch(participantData);
    if (immediateMatch) {
      this.activeSearches.delete(participantId);

      if (this.onMatchFound) {
        console.log('🔔 Triggering WebSocket callback for immediate human match');
        this.onMatchFound(immediateMatch);
      }

      return immediateMatch;
    }

    // Continue human search
    this.startContinuousSearch(participantData);

    // AI fallback
    this.setAIFallbackTimeout(participantData);

    return {
      status: 'searching',
      queuePosition: await this.getQueuePosition(participantId, roundNumber),
      estimatedWaitTime: config.matchmaking.humanSearchTimeoutMs / 1000
    };

  } catch (error) {
    console.error('❌ Error in matchmaking:', error);
    this.activeSearches.delete(participantId);

    return await this.createAIMatch(participantData);
  }
  }

  /**
   * Cancel an active search
   * @param {string} participantId - Participant ID
   * @param {number} roundNumber - Round number
   */
  async cancelMatchmaking(participantId, roundNumber) {
    console.log(`🛑 Canceling matchmaking for participant ${participantId}`);
    
    // Clear active search
    this.activeSearches.delete(participantId);
    
    // Clear timeout
    if (this.matchTimeouts.has(participantId)) {
      clearTimeout(this.matchTimeouts.get(participantId));
      this.matchTimeouts.delete(participantId);
    }
    
    // Remove from queue
    await this.cleanupParticipantQueue(participantId, roundNumber);
    
    // Update status
    await RedisService.setParticipantStatus(participantId, 'cancelled');
  }

  /**
   * Look for immediate match with existing queue entries
   * @param {Object} participantData - Participant information
   * @returns {Promise<Object|null>} Match data or null
   */
  async findImmediateMatch(participantData) {
    const { participantId, roundNumber, skillLevel } = participantData;
    const queueKey = `queue:round:${roundNumber}`;
    const lockKey = `matchlock:round:${roundNumber}`;
    
    // Use Redis-based distributed lock to prevent race conditions
    const lockValue = `${participantId}-${Date.now()}`;
    const lockTimeout = 5000; // 5 seconds max lock time
    
    try {
      console.log(`🔍 Looking for immediate match for participant ${participantId}`);
      
      // Acquire distributed lock
      const lockAcquired = await RedisService.acquireLock(lockKey, lockValue, lockTimeout);
      if (!lockAcquired) {
        console.log(`⏳ Match lock busy for round ${roundNumber}, participant ${participantId} waiting`);
        return null;
      }
      
      console.log(`🔒 Acquired match lock for round ${roundNumber}, participant ${participantId}`);
      
      try {
        // First, let's see ALL participants in the queue
        const allParticipants = await RedisService.getQueueEntries(queueKey);
        console.log(`👥 ALL participants in queue ${queueKey}:`, allParticipants.map(p => `${p.participantId} (skill: ${p.skillLevel})`));
        
        // Get waiting participants (excluding self)
        const waitingParticipants = await RedisService.getQueueEntries(queueKey, participantId);
        console.log(`⏳ Waiting participants (excluding ${participantId}):`, waitingParticipants.map(p => `${p.participantId} (skill: ${p.skillLevel})`));
        
        if (waitingParticipants.length === 0) {
          console.log('📭 No waiting participants found');
          return null;
        }

        console.log(`👥 Found ${waitingParticipants.length} waiting participants`);

        // Find best skill match
        const bestMatch = this.findBestSkillMatch(skillLevel, waitingParticipants);
        
        if (bestMatch) {
          console.log(`✅ Found skill match: ${bestMatch.participantId} (skill: ${bestMatch.skillLevel})`);
          
          // Create match while still holding the lock
          const match = await this.createHumanMatch(participantData, bestMatch);
          
          console.log(`🔓 Releasing match lock for round ${roundNumber}, participant ${participantId}`);
          await RedisService.releaseLock(lockKey, lockValue);
          
          return match;
        }

        console.log('❌ No suitable skill matches found');
      } finally {
        // Always release the lock, even if an error occurs
        await RedisService.releaseLock(lockKey, lockValue);
        console.log(`🔓 Released match lock for round ${roundNumber}, participant ${participantId}`);
      }
      return null;

    } catch (error) {
      console.error('Error finding immediate match:', error);
      return null;
    }
  }

  /**
   * Find the best skill match from waiting participants
   * @param {number} participantSkillLevel - Current participant's skill level
   * @param {Array} waitingParticipants - Array of waiting participants
   * @returns {Object|null} Best match or null
   */
  findBestSkillMatch(participantSkillLevel, waitingParticipants) {
    if (waitingParticipants.length === 0) return null;

    const threshold = config.matchmaking.skillMatchingThreshold;
    
    // Filter by skill threshold
    const suitableMatches = waitingParticipants.filter(participant => {
      const skillDiff = Math.abs(participant.skillLevel - participantSkillLevel);
      return skillDiff <= threshold;
    });

    if (suitableMatches.length === 0) {
      // If no suitable matches, return the closest skill level
      return waitingParticipants.reduce((closest, current) => {
        const currentDiff = Math.abs(current.skillLevel - participantSkillLevel);
        const closestDiff = Math.abs(closest.skillLevel - participantSkillLevel);
        return currentDiff < closestDiff ? current : closest;
      });
    }

    // Return the first suitable match (FIFO)
    return suitableMatches[0];
  }

  /**
 * Join the matchmaking queue
 * @param {Object} participantData - Participant information
 */
async joinQueue(participantData) {
  const { participantId, participantName, roundNumber, skillLevel, treatmentGroup } = participantData;
  const queueKey = `queue:round:${roundNumber}`;

  try {
    // 🔒 Check if participant already has an active match (Redis quick check first)
    const status = await RedisService.getParticipantStatus(participantId);
    if (status?.status === 'matched') {
      console.warn(`⚠️ Participant ${participantId} already in match ${status.matchId}, skipping queue`);
      return null; // Don’t enqueue
    }

    // Optional DB-level check for safety
    const existingMatch = await DatabaseService.getActiveMatchForParticipant(participantId, roundNumber);
    if (existingMatch) {
      console.warn(`⚠️ Participant ${participantId} already has DB match ${existingMatch.id}, skipping queue`);
      return null;
    }

    // ✅ Safe to enqueue
    const queueEntry = {
      participantId,
      participantName: participantName || getPlayerDisplayName({ id: participantId }),
      roundNumber,
      skillLevel: skillLevel || 7,
      treatmentGroup: treatmentGroup || 'control',
      joinedAt: Date.now(),
      status: 'waiting'
    };

    await RedisService.addToQueue(queueKey, queueEntry);

    // Increment queue stats
    await RedisService.incrementMatchStats('queue_joins');

    console.log(`✅ Participant ${participantId} joined queue for round ${roundNumber}`);
    return queueEntry;

  } catch (error) {
    console.error('Error joining queue:', error);
    throw error;
  }
}

  /**
   * Start continuous search for human opponents
   * @param {Object} participantData - Participant information
   */
  startContinuousSearch(participantData) {
    const { participantId } = participantData;
    
    const searchInterval = setInterval(async () => {
      if (!this.activeSearches.has(participantId)) {
        clearInterval(searchInterval);
        return;
      }

      const searchData = this.activeSearches.get(participantId);
      searchData.searchAttempts++;
      
      console.log(`🔍 Search attempt #${searchData.searchAttempts} for participant ${participantId}`);
      
      try {
        // Check if we've been matched by another participant
        const status = await RedisService.getParticipantStatus(participantId);
        if (status?.status === 'matched' || status?.status === 'matching') {
          console.log(`✅ Participant ${participantId} was matched by another participant`);
          clearInterval(searchInterval);
          this.activeSearches.delete(participantId);
          return;
        }

        // ADDITIONAL CHECK: Database level check for extra safety
        try {
          const existingMatch = await DatabaseService.getActiveMatchForParticipant(participantId, participantData.roundNumber);
          if (existingMatch) {
            console.log(`✅ Participant ${participantId} has active DB match ${existingMatch.id}, stopping search`);
            clearInterval(searchInterval);
            this.activeSearches.delete(participantId);
            
            // Update Redis status if it's out of sync
            await RedisService.setParticipantStatus(participantId, 'matched', { matchId: existingMatch.id });
            return;
          }
        } catch (dbError) {
          console.error('Error checking database for existing match:', dbError);
          // Continue if database check fails
        }

        // Look for new opponents
        const match = await this.findImmediateMatch(participantData);
        if (match) {
          clearInterval(searchInterval);
          this.activeSearches.delete(participantId);
          
          // Clear AI fallback timeout
          if (this.matchTimeouts.has(participantId)) {
            clearTimeout(this.matchTimeouts.get(participantId));
            this.matchTimeouts.delete(participantId);
          }

          // Notify match found
          if (this.onMatchFound) {
            this.onMatchFound(match);
          }
        }

        // Check if we should fallback to AI due to inactivity
        if (searchData.searchAttempts >= config.matchmaking.minSearchAttempts) {
          const queueActivity = await this.checkQueueActivity(participantData.roundNumber);
          if (!queueActivity) {
            console.log(`🤖 No queue activity after ${searchData.searchAttempts} attempts, falling back to AI`);
            clearInterval(searchInterval);
            
            const aiMatch = await this.createAIMatch(participantData);
            this.activeSearches.delete(participantId);
            
            if (this.onMatchFound) {
              this.onMatchFound(aiMatch);
            }
          }
        }

      } catch (error) {
        console.error('Error in continuous search:', error);
      }
    }, config.matchmaking.searchIntervalMs);
  }

  /**
   * Set AI fallback timeout
   * @param {Object} participantData - Participant information
   */
  setAIFallbackTimeout(participantData) {
    const { participantId } = participantData;
    
    const timeout = setTimeout(async () => {
      if (this.activeSearches.has(participantId)) {
        console.log(`⏰ AI fallback timeout reached for participant ${participantId}`);
        
        const aiMatch = await this.createAIMatch(participantData);
        this.activeSearches.delete(participantId);
        
        if (this.onMatchFound) {
          this.onMatchFound(aiMatch);
        }
      }
    }, config.matchmaking.humanSearchTimeoutMs);

    this.matchTimeouts.set(participantId, timeout);
  }

  /**
   * Check if there's recent activity in the queue
   * @param {number} roundNumber - Round number to check
   * @returns {Promise<boolean>} Whether there's recent activity
   */
  async checkQueueActivity(roundNumber) {
    const queueKey = `queue:round:${roundNumber}`;
    const entries = await RedisService.getQueueEntries(queueKey);
    
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentEntries = entries.filter(entry => entry.joinedAt > fiveMinutesAgo);
    
    return recentEntries.length > 1; // More than just current participant
  }

  /**
   * Create a human vs human match
   * @param {Object} participant1Data - First participant data
   * @param {Object} participant2Data - Second participant data
   * @returns {Promise<Object>} Match data
   */
  async createHumanMatch(participant1Data, participant2Data) {
    const matchId = uuidv4();
    const { roundNumber } = participant1Data;
    
    try {
      console.log(`🤝 Creating human match: ${participant1Data.participantId} vs ${participant2Data.participantId}`);
      
      // Prevent self-matches (double-check)
      if (participant1Data.participantId === participant2Data.participantId) {
        console.error('❌ CRITICAL: Attempted self-match detected!');
        throw new Error('Self-match attempted');
      }

      // Get participant name from database if not provided
      let participant2Name = participant2Data.participantName;
      if (!participant2Name) {
        try {
          const participant2Info = await DatabaseService.getParticipant(participant2Data.participantId);
          participant2Name = getPlayerDisplayName(participant2Info || { id: participant2Data.participantId });
          console.log(`📝 Retrieved participant name from DB: ${participant2Name}`);
        } catch (dbError) {
          console.warn('⚠️ Failed to get participant name from DB, using fallback');
          participant2Name = getPlayerDisplayName({ id: participant2Data.participantId });
        }
      }

      const matchData = {
        id: matchId,
        participant1_id: participant1Data.participantId,
        participant2_id: participant2Data.participantId,
        round_number: roundNumber,
        match_type: 'live',
        status: 'active',
        created_at: new Date().toISOString(),
        isAI: false,
        opponent: JSON.stringify({ // Stringify the nested object
          name: participant2Name,
          participant_id: participant2Data.participantId,
          skill_level: participant2Data.skillLevel
        })
      };

      // Store match in Redis
      await RedisService.createMatch(matchId, matchData);

      // Also save to persistent database
      try {
        await DatabaseService.createTournamentMatch(matchData);
        console.log(`💾 Human match ${matchId} saved to database`);
      } catch (dbError) {
        console.error(`❌ Error saving human match ${matchId} to database:`, dbError);
        // Non-critical, Redis is the primary store for active matches
      }

      // Update both participants' status
      await Promise.all([
        RedisService.setParticipantStatus(participant1Data.participantId, 'matched', { matchId }),
        RedisService.setParticipantStatus(participant2Data.participantId, 'matched', { matchId })
      ]);

      // Remove both participants from queue
      const queueKey = `queue:round:${roundNumber}`;
      await Promise.all([
        RedisService.removeFromQueue(queueKey, participant1Data.participantId),
        RedisService.removeFromQueue(queueKey, participant2Data.participantId)
      ]);

      // Increment stats
      await RedisService.incrementMatchStats('human_matches');

      console.log(`✅ Human match created successfully: ${matchId}`);
      return matchData;

    } catch (error) {
      console.error('❌ Error creating human match:', error);
      throw error;
    }
  }

  /**
   * Create an AI match
   * @param {Object} participantData - Participant information
   * @returns {Promise<Object>} AI match data
   */
  async createAIMatch(participantData) {
    const { participantId, roundNumber, skillLevel } = participantData;
    
    try {
      console.log(`🤖 Creating AI match for participant ${participantId}`);
      
      // Clean up queue and timeouts
      await this.cleanupParticipantQueue(participantId, roundNumber);
      if (this.matchTimeouts.has(participantId)) {
        clearTimeout(this.matchTimeouts.get(participantId));
        this.matchTimeouts.delete(participantId);
      }

      // Create AI match using AIOpponentService
      const aiMatchData = AIOpponentService.createAIMatch(participantId, roundNumber, skillLevel);

      // Store match in Redis
      await RedisService.createMatch(aiMatchData.id, aiMatchData);

      // Also save to persistent database
      try {
        await DatabaseService.createTournamentMatch(aiMatchData);
        console.log(`💾 AI match ${aiMatchData.id} saved to database`);
      } catch (dbError) {
        console.error(`❌ Error saving AI match ${aiMatchData.id} to database:`, dbError);
        // Non-critical, Redis is the primary store for active matches
      }

      // Update participant status
      await RedisService.setParticipantStatus(participantId, 'matched', { 
        matchId: aiMatchData.id,
        opponentType: 'ai'
      });

      // Increment stats
      await RedisService.incrementMatchStats('ai_matches');

      console.log(`✅ AI match created successfully: ${aiMatchData.id}`);
      return aiMatchData;

    } catch (error) {
      console.error('❌ Error creating AI match:', error);
      
      // Fallback AI match
      const fallbackOpponentId = `AI-FALLBACK-${participantId.slice(-4)}`;
      const fallbackMatch = {
        id: uuidv4(),
        participant1_id: participantId,
        participant2_id: null,
        round_number: roundNumber,
        match_type: 'live',
        status: 'active',
        created_at: new Date().toISOString(),
        isAI: true,
        opponent: JSON.stringify({ // Stringify the nested object
                id: 'ai_fallback',
                name: getBotName(fallbackOpponentId),
                participant_id: fallbackOpponentId,
                skill_level: 7,
                personality: 'competitive',
                responsePattern: 'medium'
            })
      };

      return fallbackMatch;
    }
  }

  /**
   * Get queue position for a participant
   * @param {string} participantId - Participant ID
   * @param {number} roundNumber - Round number
   * @returns {Promise<number>} Queue position (1-based) or -1 if not found
   */
  async getQueuePosition(participantId, roundNumber) {
    const queueKey = `queue:round:${roundNumber}`;
    return await RedisService.getQueuePosition(queueKey, participantId);
  }

  /**
   * Get queue status for a round
   * @param {number} roundNumber - Round number
   * @returns {Promise<Object>} Queue status information
   */
  async getQueueStatus(roundNumber) {
    const queueKey = `queue:round:${roundNumber}`;
    const queueSize = await RedisService.getQueueSize(queueKey);
    const entries = await RedisService.getQueueEntries(queueKey);
    
    return {
      totalWaiting: queueSize,
      averageWaitTime: this.calculateAverageWaitTime(entries),
      recentMatches: await this.getRecentMatchCount(),
      estimatedWaitTime: config.matchmaking.humanSearchTimeoutMs / 1000
    };
  }

  /**
   * Calculate average wait time from queue entries
   * @param {Array} entries - Queue entries
   * @returns {number} Average wait time in seconds
   */
  calculateAverageWaitTime(entries) {
    if (entries.length === 0) return 0;
    
    const now = Date.now();
    const totalWaitTime = entries.reduce((sum, entry) => {
      return sum + (now - entry.joinedAt);
    }, 0);
    
    return Math.round(totalWaitTime / entries.length / 1000); // Convert to seconds
  }

  /**
   * Get recent match count for statistics
   * @returns {Promise<number>} Number of recent matches
   */
  async getRecentMatchCount() {
    const stats = await RedisService.getMatchStats();
    const humanMatches = parseInt(stats.human_matches) || 0;
    const aiMatches = parseInt(stats.ai_matches) || 0;
    return humanMatches + aiMatches;
  }

  /**
   * Clean up participant from all queues
   * @param {string} participantId - Participant ID
   * @param {number} roundNumber - Round number
   */
  async cleanupParticipantQueue(participantId, roundNumber) {
    try {
      const queueKey = `queue:round:${roundNumber}`;
      await RedisService.removeFromQueue(queueKey, participantId);
      console.log(`🧹 Cleaned up participant ${participantId} from queue`);
    } catch (error) {
      console.warn('Warning during queue cleanup:', error);
    }
  }

  /**
   * Get matchmaking statistics
   * @returns {Promise<Object>} Matchmaking statistics
   */
  async getMatchmakingStats() {
    const stats = await RedisService.getMatchStats();
    const aiStats = AIOpponentService.getAIStats();
    
    return {
      today: {
        humanMatches: parseInt(stats.human_matches) || 0,
        aiMatches: parseInt(stats.ai_matches) || 0,
        queueJoins: parseInt(stats.queue_joins) || 0,
        totalMatches: (parseInt(stats.human_matches) || 0) + (parseInt(stats.ai_matches) || 0)
      },
      activeSearches: this.activeSearches.size,
      aiOpponents: aiStats,
      system: {
        humanSearchTimeoutMs: config.matchmaking.humanSearchTimeoutMs,
        searchIntervalMs: config.matchmaking.searchIntervalMs,
        skillMatchingThreshold: config.matchmaking.skillMatchingThreshold
      }
    };
  }

  /**
   * Cleanup expired searches and timeouts
   */
  async cleanup() {
    // Clean up expired searches (older than 10 minutes)
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    
    for (const [participantId, searchData] of this.activeSearches.entries()) {
      if (searchData.startTime < tenMinutesAgo) {
        console.log(`🧹 Cleaning up expired search for participant ${participantId}`);
        this.activeSearches.delete(participantId);
        
        if (this.matchTimeouts.has(participantId)) {
          clearTimeout(this.matchTimeouts.get(participantId));
          this.matchTimeouts.delete(participantId);
        }
      }
    }

    // Clean up expired queue entries in Redis
    await RedisService.cleanupExpiredQueues();
  }
}

export default new MatchmakingEngine();