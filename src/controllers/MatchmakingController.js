import MatchmakingEngine from '../services/MatchmakingEngine.js';
import RedisService from '../services/RedisService.js';
import AIOpponentService from '../services/AIOpponentService.js';
import DatabaseService from '../services/DatabaseService.js';

class MatchmakingController {
  /**
   * Start matchmaking for a participant
   * POST /api/matchmaking/start
   */
  async startMatchmaking(req, res) {
    try {
      const { participantId, roundNumber, skillLevel, treatmentGroup, participantName } = req.body;

      // Validate required fields
      if (!participantId || !roundNumber) {
        return res.status(400).json({
          success: false,
          error: 'Participant ID and round number are required'
        });
      }

      console.log(`🎯 API: Starting matchmaking for ${participantId} in round ${roundNumber}`);

      const result = await MatchmakingEngine.startMatchmaking({
        participantId,
        participantName,
        roundNumber,
        skillLevel: skillLevel || 7,
        treatmentGroup: treatmentGroup || 'control'
      });

      res.json({
        success: true,
        data: result,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error in startMatchmaking API:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Cancel matchmaking for a participant
   * POST /api/matchmaking/cancel
   */
  async cancelMatchmaking(req, res) {
    try {
      const { participantId, roundNumber } = req.body;

      if (!participantId || !roundNumber) {
        return res.status(400).json({
          success: false,
          error: 'Participant ID and round number are required'
        });
      }

      console.log(`🛑 API: Canceling matchmaking for ${participantId}`);

      await MatchmakingEngine.cancelMatchmaking(participantId, roundNumber);

      res.json({
        success: true,
        message: 'Matchmaking cancelled successfully',
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error in cancelMatchmaking API:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get queue status for a round
   * GET /api/matchmaking/queue/:roundNumber
   */
  async getQueueStatus(req, res) {
    try {
      const { roundNumber } = req.params;

      if (!roundNumber || isNaN(roundNumber)) {
        return res.status(400).json({
          success: false,
          error: 'Valid round number is required'
        });
      }

      const queueStatus = await MatchmakingEngine.getQueueStatus(parseInt(roundNumber));

      res.json({
        success: true,
        data: {
          roundNumber: parseInt(roundNumber),
          ...queueStatus
        },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error in getQueueStatus API:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get participant's queue position
   * GET /api/matchmaking/position/:participantId/:roundNumber
   */
  async getQueuePosition(req, res) {
    try {
      const { participantId, roundNumber } = req.params;

      if (!participantId || !roundNumber || isNaN(roundNumber)) {
        return res.status(400).json({
          success: false,
          error: 'Valid participant ID and round number are required'
        });
      }

      const position = await MatchmakingEngine.getQueuePosition(participantId, parseInt(roundNumber));

      res.json({
        success: true,
        data: {
          participantId,
          roundNumber: parseInt(roundNumber),
          position,
          inQueue: position !== -1
        },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error in getQueuePosition API:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get skill level for a participant
   * GET /api/matchmaking/skill/:participantId
   */
  async getSkillLevel(req, res) {
    try {
      const { participantId } = req.params;

      if (!participantId) {
        return res.status(400).json({
          success: false,
          error: 'Participant ID is required'
        });
      }

      const previousRounds = await DatabaseService.getParticipantStats(participantId);

      if (!previousRounds || previousRounds.length === 0) {
        return res.json({ success: true, data: { skillLevel: 7 }, timestamp: Date.now() });
      }

      const avgScore = previousRounds.reduce((sum, round) => sum + round.total_correct, 0) / previousRounds.length;
      const skillLevel = Math.round(avgScore);

      res.json({ success: true, data: { skillLevel }, timestamp: Date.now() });

    } catch (error) {
      console.error('Error in getSkillLevel API:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get match information
   * GET /api/matchmaking/match/:matchId
   */
  async getMatch(req, res) {
    try {
      const { matchId } = req.params;

      if (!matchId) {
        return res.status(400).json({
          success: false,
          error: 'Match ID is required'
        });
      }

      const match = await RedisService.getMatch(matchId);

      if (!match || Object.keys(match).length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Match not found'
        });
      }

      res.json({
        success: true,
        data: match,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error in getMatch API:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Update match status
   * PUT /api/matchmaking/match/:matchId/status
   */
  async updateMatchStatus(req, res) {
    try {
      const { matchId } = req.params;
      const { status } = req.body;

      if (!matchId || !status) {
        return res.status(400).json({
          success: false,
          error: 'Match ID and status are required'
        });
      }

      const validStatuses = ['active', 'completed', 'cancelled', 'paused'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      await RedisService.updateMatchStatus(matchId, status);

      res.json({
        success: true,
        message: 'Match status updated successfully',
        data: { matchId, status },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error in updateMatchStatus API:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get participant status
   * GET /api/matchmaking/participant/:participantId/status
   */
  async getParticipantStatus(req, res) {
    try {
      const { participantId } = req.params;

      if (!participantId) {
        return res.status(400).json({
          success: false,
          error: 'Participant ID is required'
        });
      }

      const status = await RedisService.getParticipantStatus(participantId);

      res.json({
        success: true,
        data: {
          participantId,
          ...status
        },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error in getParticipantStatus API:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Update participant status
   * PUT /api/matchmaking/participant/:participantId/status
   */
  async updateParticipantStatus(req, res) {
    try {
      const { participantId } = req.params;
      const { status, ...additionalData } = req.body;

      if (!participantId || !status) {
        return res.status(400).json({
          success: false,
          error: 'Participant ID and status are required'
        });
      }

      await RedisService.setParticipantStatus(participantId, status, additionalData);

      res.json({
        success: true,
        message: 'Participant status updated successfully',
        data: { participantId, status },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error in updateParticipantStatus API:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Create AI match directly
   * POST /api/matchmaking/ai-match
   */
  async createAIMatch(req, res) {
    try {
      const { participantId, roundNumber, skillLevel, participantName } = req.body;

      if (!participantId || !roundNumber) {
        return res.status(400).json({
          success: false,
          error: 'Participant ID and round number are required'
        });
      }

      console.log(`🤖 API: Creating AI match for ${participantId}`);

      const aiMatch = await MatchmakingEngine.createAIMatch({
        participantId,
        participantName,
        roundNumber,
        skillLevel: skillLevel || 7
      });

      res.json({
        success: true,
        data: aiMatch,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error in createAIMatch API:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get AI opponents list
   * GET /api/matchmaking/ai-opponents
   */
  async getAIOpponents(req, res) {
    try {
      const opponents = AIOpponentService.getAllOpponents();
      const stats = AIOpponentService.getAIStats();

      res.json({
        success: true,
        data: {
          opponents,
          stats
        },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error in getAIOpponents API:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Simulate AI response for testing
   * POST /api/matchmaking/ai-simulate
   */
  async simulateAIResponse(req, res) {
    try {
      const { aiSettings, questionNumber, difficulty, opponentCorrect } = req.body;

      if (!aiSettings || questionNumber === undefined || difficulty === undefined) {
        return res.status(400).json({
          success: false,
          error: 'AI settings, question number, and difficulty are required'
        });
      }

      const simulation = AIOpponentService.simulateAIResponse(
        aiSettings,
        questionNumber,
        difficulty,
        opponentCorrect
      );

      res.json({
        success: true,
        data: simulation,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error in simulateAIResponse API:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get matchmaking statistics
   * GET /api/matchmaking/stats
   */
  async getStats(req, res) {
    try {
      const stats = await MatchmakingEngine.getMatchmakingStats();

      res.json({
        success: true,
        data: stats,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error in getStats API:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Health check endpoint
   * GET /api/matchmaking/health
   */
  async healthCheck(req, res) {
    try {
      const redisConnected = RedisService.isConnected;
      const stats = await MatchmakingEngine.getMatchmakingStats();

      res.json({
        success: true,
        data: {
          status: 'healthy',
          services: {
            redis: redisConnected ? 'connected' : 'disconnected',
            matchmaking: 'active',
            websocket: 'active'
          },
          stats: {
            activeSearches: stats.activeSearches,
            todayMatches: stats.today.totalMatches
          }
        },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error in healthCheck API:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Cleanup expired data
   * POST /api/matchmaking/cleanup
   */
  async cleanup(req, res) {
    try {
      console.log('🧹 API: Starting cleanup process');

      await MatchmakingEngine.cleanup();
      const cleanedQueues = await RedisService.cleanupExpiredQueues();

      res.json({
        success: true,
        data: {
          message: 'Cleanup completed successfully',
          cleanedQueueEntries: cleanedQueues
        },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error in cleanup API:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}

export default new MatchmakingController();