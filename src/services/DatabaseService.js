import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import { retryWithBackoff, generateUUID } from '../utils/helpers.js';

class DatabaseService {
  constructor() {
    this.supabase = null;
    this.isConnected = false;
  }

  /**
   * Initialize Supabase connection
   */
  async connect() {
    try {
      // Check if required config is available
      if (!config.supabase.url || !config.supabase.serviceRoleKey) {
        logger.warn('⚠️  Database credentials not configured, skipping database connection');
        this.isConnected = false;
        return;
      }

      this.supabase = createClient(
        config.supabase.url,
        config.supabase.serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // Test connection
      const { error } = await this.supabase
        .from('participants')
        .select('id')
        .limit(1);

      if (error) {
        throw error;
      }

      this.isConnected = true;
      logger.info('✅ Database connected successfully');
      
    } catch (error) {
      logger.error('❌ Database connection failed:', { error: error.message });
      logger.warn('⚠️  Continuing without database - some features will be disabled');
      this.isConnected = false;
      // Don't throw error, just continue without database
    }
  }

  /**
   * Get participant data including skill level calculation
   * @param {string} participantId - Participant UUID
   * @returns {Promise<Object|null>} Participant data
   */
  async getParticipant(participantId) {
    try {
      const { data, error } = await this.supabase
        .from('participants')
        .select(`
          *,
          participant_demographics(*),
          task_rounds(total_correct, total_questions, created_at)
        `)
        .eq('id', participantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Participant not found
        }
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error getting participant:', { participantId, error: error.message });
      throw error;
    }
  }

  /**
   * Create or update tournament match record
   * @param {Object} matchData - Match data
   * @returns {Promise<Object>} Created match record
   */
  async createTournamentMatch(matchData) {
    try {
      const matchRecord = {
        id: matchData.id,
        participant1_id: matchData.participant1_id,
        participant2_id: matchData.participant2_id,
        round_number: matchData.round_number,
        match_type: matchData.match_type,
        status: matchData.status || 'active',
        created_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('tournament_matches')
        .upsert(matchRecord, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.matchmakingEvent('match_created_in_db', matchData.participant1_id, {
        matchId: matchData.id,
        matchType: matchData.match_type,
        opponent: matchData.participant2_id || 'AI'
      });

      return data;
    } catch (error) {
      logger.error('Error creating tournament match:', { 
        matchId: matchData.id, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Update tournament match status
   * @param {string} matchId - Match UUID
   * @param {string} status - New status
   * @param {Object} additionalData - Additional data to update
   * @returns {Promise<Object>} Updated match record
   */
  async updateTournamentMatch(matchId, status, additionalData = {}) {
    try {
      const updateData = {
        status,
        updated_at: new Date().toISOString(),
        ...additionalData
      };

      const { data, error } = await this.supabase
        .from('tournament_matches')
        .update(updateData)
        .eq('id', matchId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error updating tournament match:', { 
        matchId, 
        status, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get tournament match by ID
   * @param {string} matchId - Match UUID
   * @returns {Promise<Object|null>} Match data
   */
  async getTournamentMatch(matchId) {
    try {
      const { data, error } = await this.supabase
        .from('tournament_matches')
        .select(`
          *,
          participant1:participants!tournament_matches_participant1_id_fkey(id, name),
          participant2:participants!tournament_matches_participant2_id_fkey(id, name)
        `)
        .eq('id', matchId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Match not found
        }
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error getting tournament match:', { matchId, error: error.message });
      throw error;
    }
  }

  /**
   * Record match result
   * @param {Object} resultData - Match result data
   * @returns {Promise<Object>} Created result record
   */
  async recordMatchResult(resultData) {
    try {
      const result = {
        id: generateUUID(),
        match_id: resultData.matchId,
        participant_id: resultData.participantId,
        opponent_id: resultData.opponentId,
        participant_score: resultData.participantScore,
        opponent_score: resultData.opponentScore,
        result: resultData.result, // 'win', 'loss', 'tie'
        round_number: resultData.roundNumber,
        match_duration_ms: resultData.matchDurationMs,
        created_at: new Date().toISOString(),
        ai_opponent: resultData.isAI || false
      };

      const { data, error } = await this.supabase
        .from('tournament_results')
        .insert(result)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.matchmakingEvent('match_result_recorded', resultData.participantId, {
        matchId: resultData.matchId,
        result: resultData.result,
        score: `${resultData.participantScore}-${resultData.opponentScore}`
      });

      return data;
    } catch (error) {
      logger.error('Error recording match result:', { 
        matchId: resultData.matchId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get participant's match history
   * @param {string} participantId - Participant UUID
   * @param {number} limit - Number of matches to retrieve
   * @returns {Promise<Array>} Match history
   */
  async getMatchHistory(participantId, limit = 10) {
    try {
      const { data, error } = await this.supabase
        .from('tournament_results')
        .select(`
          *,
          tournament_matches(*)
        `)
        .eq('participant_id', participantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting match history:', { 
        participantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Record participant activity for analytics
   * @param {Object} activityData - Activity data
   * @returns {Promise<void>}
   */
  async recordActivity(activityData) {
    try {
      const activity = {
        participant_id: activityData.participantId,
        activity_type: activityData.type,
        activity_data: JSON.stringify(activityData.data),
        round_number: activityData.roundNumber,
        timestamp: new Date().toISOString()
      };

      // Insert into live_performance_feed for real-time monitoring
      const { error } = await this.supabase
        .from('live_performance_feed')
        .insert(activity);

      if (error && error.code !== '23505') { // Ignore duplicate entries
        throw error;
      }

    } catch (error) {
      logger.error('Error recording activity:', { 
        participantId: activityData.participantId, 
        type: activityData.type,
        error: error.message 
      });
      // Don't throw - activity recording is non-critical
    }
  }

  /**
   * Get tournament statistics
   * @param {number} roundNumber - Optional round number filter
   * @returns {Promise<Object>} Tournament statistics
   */
  async getTournamentStats(roundNumber = null) {
    try {
      let query = this.supabase
        .from('tournament_results')
        .select('*');

      if (roundNumber) {
        query = query.eq('round_number', roundNumber);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Calculate statistics
      const stats = {
        totalMatches: data.length,
        humanMatches: data.filter(r => !r.ai_opponent).length,
        aiMatches: data.filter(r => r.ai_opponent).length,
        averageMatchDuration: data.reduce((sum, r) => sum + (r.match_duration_ms || 0), 0) / data.length || 0,
        winDistribution: {
          wins: data.filter(r => r.result === 'win').length,
          losses: data.filter(r => r.result === 'loss').length,
          ties: data.filter(r => r.result === 'tie').length
        }
      };

      return stats;
    } catch (error) {
      logger.error('Error getting tournament stats:', { 
        roundNumber, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get real-time leaderboard data
   * @param {number} roundNumber - Round number
   * @param {number} limit - Number of top participants
   * @returns {Promise<Array>} Leaderboard data
   */
  async getLeaderboard(roundNumber, limit = 10) {
    try {
      const { data, error } = await this.supabase
        .rpc('get_tournament_leaderboard', {
          p_round_number: roundNumber,
          p_limit: limit
        });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting leaderboard:', { 
        roundNumber, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Cleanup old match records
   * @param {number} olderThanHours - Remove records older than X hours
   * @returns {Promise<number>} Number of records cleaned up
   */
  async cleanupOldMatches(olderThanHours = 24) {
    try {
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();

      // Only cleanup completed or cancelled matches
      const { data, error } = await this.supabase
        .from('tournament_matches')
        .delete()
        .in('status', ['completed', 'cancelled'])
        .lt('created_at', cutoffTime)
        .select('id');

      if (error) {
        throw error;
      }

      const cleanedCount = data?.length || 0;
      
      if (cleanedCount > 0) {
        logger.info(`🧹 Cleaned up ${cleanedCount} old tournament matches`);
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Error cleaning up old matches:', { error: error.message });
      throw error;
    }
  }

  /**
   * Sync Redis match data to database
   * @param {Object} matchData - Match data from Redis
   * @returns {Promise<Object>} Database record
   */
  async syncMatchToDatabase(matchData) {
    try {
      return await retryWithBackoff(async () => {
        return await this.createTournamentMatch(matchData);
      }, 3, 1000);
    } catch (error) {
      logger.error('Failed to sync match to database after retries:', {
        matchId: matchData.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get participant statistics for skill calculation
   * @param {string} participantId - Participant UUID
   * @returns {Promise<Object>} Participant statistics
   */
  async getParticipantStats(participantId) {
    try {
      const { data, error } = await this.supabase
        .from('task_rounds')
        .select('total_correct, total_questions, created_at')
        .eq('participant_id', participantId)
        .order('created_at', { ascending: false })
        .limit(5); // Get last 5 rounds for skill calculation

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting participant stats:', { 
        participantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Health check for database connection
   * @returns {Promise<boolean>} Connection status
   */
  async healthCheck() {
    try {
      const { error } = await this.supabase
        .from('participants')
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      logger.error('Database health check failed:', { error: error.message });
      return false;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    // Supabase client doesn't need explicit disconnection
    this.isConnected = false;
    logger.info('Database disconnected');
  }
  
  async getActiveMatchForParticipant(participantId, roundNumber) {
    try {
      const { data, error } = await this.supabase
        .from('tournament_matches')
        .select('*')
        .or(`participant1_id.eq.${participantId},participant2_id.eq.${participantId}`)
        .eq('round_number', roundNumber)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // If multiple matches exist (race condition), return the most recent one
      // Log warning about duplicates for debugging
      if (data && data.length > 1) {
        logger.warn('Multiple active matches found for participant:', {
          participantId,
          roundNumber,
          matchCount: data.length,
          matchIds: data.map(m => m.id)
        });
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      logger.error('Error checking active match for participant:', {
        participantId,
        roundNumber,
        error: error.message
      });
      throw error;
    }
  }
}



export default new DatabaseService();