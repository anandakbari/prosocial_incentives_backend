import { Server } from 'socket.io';
import { config } from '../config/index.js';
import MatchmakingEngine from './MatchmakingEngine.js';
import RedisService from './RedisService.js';

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map(); // participantId -> socket info
    this.heartbeatInterval = null;
  }

  /**
   * Initialize WebSocket server
   * @param {Object} server - HTTP server instance
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: config.server.corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: config.websocket.pingTimeout,
      pingInterval: config.websocket.pingInterval,
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    this.startHeartbeat();
    
    console.log('✅ WebSocket server initialized');
  }

  /**
   * Set up WebSocket event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Handle participant registration
      socket.on('register', (data) => {
        this.handleParticipantRegistration(socket, data);
      });

      // Handle matchmaking requests
      socket.on('start_matchmaking', (data) => {
        this.handleStartMatchmaking(socket, data);
      });

      // Handle matchmaking cancellation
      socket.on('cancel_matchmaking', (data) => {
        this.handleCancelMatchmaking(socket, data);
      });

      // Handle queue status requests
      socket.on('get_queue_status', (data) => {
        this.handleGetQueueStatus(socket, data);
      });

      // Handle match updates (for real-time match progress)
      socket.on('match_update', (data) => {
        this.handleMatchUpdate(socket, data);
      });

      // Handle admin requests
      socket.on('admin_stats', () => {
        this.handleAdminStats(socket);
      });

      // Handle participant status updates
      socket.on('update_status', (data) => {
        this.handleStatusUpdate(socket, data);
      });

      // Handle heartbeat/ping
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket, reason);
      });

      // Handle connection errors
      socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });
    });

    // Set up matchmaking callback
    MatchmakingEngine.setMatchFoundCallback((matchData) => {
      this.notifyMatchFound(matchData);
    });
  }

  /**
   * Handle participant registration
   * @param {Object} socket - Socket instance
   * @param {Object} data - Registration data
   */
  async handleParticipantRegistration(socket, data) {
    try {
      const { participantId, roundNumber, name, treatmentGroup } = data;
      
      if (!participantId) {
        socket.emit('error', { message: 'Participant ID required' });
        return;
      }

      // Store client connection info
      this.connectedClients.set(participantId, {
        socketId: socket.id,
        socket: socket,
        participantId,
        roundNumber,
        name,
        treatmentGroup,
        connectedAt: Date.now(),
        lastSeen: Date.now()
      });

      // Join participant-specific room
      socket.join(`participant:${participantId}`);
      
      // Join round-specific room for broadcasts
      if (roundNumber) {
        socket.join(`round:${roundNumber}`);
      }

      console.log(`✅ Participant registered: ${participantId} (${name})`);
      console.log(`📝 Registration data received:`, { participantId, roundNumber, name, treatmentGroup });
      
      socket.emit('registration_success', {
        participantId,
        connectedAt: Date.now(),
        serverStatus: 'connected'
      });

      // Send current queue status if in a round
      if (roundNumber) {
        const queueStatus = await MatchmakingEngine.getQueueStatus(roundNumber);
        socket.emit('queue_status_update', queueStatus);
      }

    } catch (error) {
      console.error('Error in participant registration:', error);
      socket.emit('error', { message: 'Registration failed' });
    }
  }

  /**
   * Handle start matchmaking request
   * @param {Object} socket - Socket instance
   * @param {Object} data - Matchmaking data
   */
  async handleStartMatchmaking(socket, data) {
    try {
      const { participantId, roundNumber, skillLevel, treatmentGroup, participantName } = data;
      
      if (!participantId || !roundNumber) {
        socket.emit('error', { message: 'Participant ID and round number required' });
        return;
      }

      console.log(`🎯 Starting matchmaking for ${participantId} in round ${roundNumber}`);

      // Emit matchmaking started
      socket.emit('matchmaking_started', {
        participantId,
        roundNumber,
        startTime: Date.now(),
        status: 'searching'
      });

      // Get participant name from connected clients or use provided name
      const clientInfo = this.connectedClients.get(participantId);
      const finalParticipantName = participantName || clientInfo?.name;

      // Start matchmaking process
      const result = await MatchmakingEngine.startMatchmaking({
        participantId,
        participantName: finalParticipantName,
        roundNumber,
        skillLevel: skillLevel || 7,
        treatmentGroup: treatmentGroup || 'control'
      });

      // Send initial result
      socket.emit('matchmaking_status', result);

      // If immediately matched, send match data
      if (result.status === 'matched') {
        socket.emit('match_found', result);
      }

    } catch (error) {
      console.error('Error starting matchmaking:', error);
      socket.emit('matchmaking_error', { 
        message: 'Failed to start matchmaking',
        error: error.message 
      });
    }
  }

  /**
   * Handle cancel matchmaking request
   * @param {Object} socket - Socket instance
   * @param {Object} data - Cancellation data
   */
  async handleCancelMatchmaking(socket, data) {
    try {
      const { participantId, roundNumber } = data;
      
      console.log(`🛑 Canceling matchmaking for ${participantId}`);

      await MatchmakingEngine.cancelMatchmaking(participantId, roundNumber);
      
      socket.emit('matchmaking_cancelled', {
        participantId,
        roundNumber,
        cancelledAt: Date.now()
      });

    } catch (error) {
      console.error('Error canceling matchmaking:', error);
      socket.emit('error', { message: 'Failed to cancel matchmaking' });
    }
  }

  /**
   * Handle queue status request
   * @param {Object} socket - Socket instance
   * @param {Object} data - Request data
   */
  async handleGetQueueStatus(socket, data) {
    try {
      const { roundNumber } = data;
      
      const queueStatus = await MatchmakingEngine.getQueueStatus(roundNumber);
      
      socket.emit('queue_status_update', {
        roundNumber,
        ...queueStatus,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error getting queue status:', error);
      socket.emit('error', { message: 'Failed to get queue status' });
    }
  }

  /**
   * Handle match update (for real-time match progress)
   * @param {Object} socket - Socket instance
   * @param {Object} data - Match update data
   */
  async handleMatchUpdate(socket, data) {
    try {
      const { matchId, participantId, updateType, updateData } = data;
      
      // Validate match exists
      const match = await RedisService.getMatch(matchId);
      if (!match || Object.keys(match).length === 0) {
        socket.emit('error', { message: 'Match not found' });
        return;
      }

      // Broadcast update to both participants in the match
      const participant1Id = match.participant1_id;
      const participant2Id = match.participant2_id;

      if (participant2Id) { // Human vs Human
        this.sendToParticipant(participant1Id, 'match_update', {
          matchId,
          updateType,
          updateData,
          timestamp: Date.now()
        });
        
        this.sendToParticipant(participant2Id, 'match_update', {
          matchId,
          updateType,
          updateData,
          timestamp: Date.now()
        });
      } else { // Human vs AI
        this.sendToParticipant(participant1Id, 'match_update', {
          matchId,
          updateType,
          updateData,
          timestamp: Date.now()
        });
      }

      console.log(`📊 Match update broadcasted for match ${matchId}: ${updateType}`);

    } catch (error) {
      console.error('Error handling match update:', error);
      socket.emit('error', { message: 'Failed to process match update' });
    }
  }

  /**
   * Handle admin statistics request
   * @param {Object} socket - Socket instance
   */
  async handleAdminStats(socket) {
    try {
      const stats = await MatchmakingEngine.getMatchmakingStats();
      const connectedCount = this.connectedClients.size;
      
      socket.emit('admin_stats', {
        ...stats,
        connections: {
          total: connectedCount,
          clients: Array.from(this.connectedClients.values()).map(client => ({
            participantId: client.participantId,
            roundNumber: client.roundNumber,
            connectedAt: client.connectedAt,
            lastSeen: client.lastSeen
          }))
        },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error getting admin stats:', error);
      socket.emit('error', { message: 'Failed to get admin stats' });
    }
  }

  /**
   * Handle participant status update
   * @param {Object} socket - Socket instance
   * @param {Object} data - Status data
   */
  async handleStatusUpdate(socket, data) {
    try {
      const { participantId, status, additionalData } = data;
      
      // Update last seen time
      const clientInfo = this.connectedClients.get(participantId);
      if (clientInfo) {
        clientInfo.lastSeen = Date.now();
        clientInfo.status = status;
      }

      // Update status in Redis
      await RedisService.setParticipantStatus(participantId, status, additionalData);
      
      socket.emit('status_updated', {
        participantId,
        status,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error updating status:', error);
      socket.emit('error', { message: 'Failed to update status' });
    }
  }

  /**
   * Handle client disconnection
   * @param {Object} socket - Socket instance
   * @param {string} reason - Disconnection reason
   */
  async handleDisconnection(socket, reason) {
    console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);

    // Find and remove client from connected clients
    let disconnectedParticipant = null;
    for (const [participantId, clientInfo] of this.connectedClients.entries()) {
      if (clientInfo.socketId === socket.id) {
        disconnectedParticipant = participantId;
        this.connectedClients.delete(participantId);
        break;
      }
    }

    if (disconnectedParticipant) {
      console.log(`❌ Participant ${disconnectedParticipant} disconnected`);
      
      // Update participant status
      await RedisService.setParticipantStatus(disconnectedParticipant, 'disconnected', {
        disconnectedAt: Date.now(),
        reason
      });

      // Cancel any active matchmaking
      try {
        await MatchmakingEngine.cancelMatchmaking(disconnectedParticipant, 0); // Use 0 as fallback round
      } catch (error) {
        console.warn('Error canceling matchmaking on disconnect:', error);
      }
    }
  }

  /**
   * Notify participants when a match is found
   * @param {Object} matchData - Match data
   */
  notifyMatchFound(matchData) {
    try {
      // Ensure isAI is a boolean for proper JavaScript evaluation
      const processedMatchData = { ...matchData };
      if (typeof processedMatchData.isAI === 'string') {
        processedMatchData.isAI = processedMatchData.isAI === 'true';
      }
      
      const { participant1_id, participant2_id, isAI } = processedMatchData;

      console.log(`🎉 Notifying match found: ${participant1_id} vs ${participant2_id || 'AI'}`);
      console.log(`🔍 Match isAI value: ${isAI} (type: ${typeof isAI})`);

      if (isAI) {
        // For AI matches, send same data to participant1 (only they exist)
        this.sendToParticipant(participant1_id, 'match_found', {
          ...processedMatchData,
          myRole: 'participant1',
          timestamp: Date.now()
        });
      } else {
        // For human vs human matches, we need to create different opponent data for each participant
        
        // Get participant names from match data (preferred) or connected clients (fallback)
        const participant1Name = processedMatchData.participant1_name || 
                                this.connectedClients.get(participant1_id)?.name || 
                                `Player ${participant1_id.slice(-4)}`;
        const participant2Name = processedMatchData.participant2_name || 
                                this.connectedClients.get(participant2_id)?.name || 
                                `Player ${participant2_id.slice(-4)}`;

        // Parse the current opponent data (which is participant2's info)
        let originalOpponent = {};
        try {
          originalOpponent = typeof processedMatchData.opponent === 'string' 
            ? JSON.parse(processedMatchData.opponent) 
            : processedMatchData.opponent;
        } catch (e) {
          console.warn('Failed to parse opponent data, using fallback');
        }

        // Create participant1's match data (opponent is participant2)
        const participant1MatchData = {
          ...processedMatchData,
          opponent: JSON.stringify({
            name: participant2Name,
            participant_id: participant2_id,
            skill_level: originalOpponent.skill_level
          }),
          myRole: 'participant1',
          timestamp: Date.now()
        };

        // Create participant2's match data (opponent is participant1)
        const participant2MatchData = {
          ...processedMatchData,
          opponent: JSON.stringify({
            name: participant1Name,
            participant_id: participant1_id,
            skill_level: 7 // Default skill level, could be retrieved if needed
          }),
          myRole: 'participant2',
          timestamp: Date.now()
        };

        // Send customized data to each participant
        this.sendToParticipant(participant1_id, 'match_found', participant1MatchData);
        this.sendToParticipant(participant2_id, 'match_found', participant2MatchData);
      }

    } catch (error) {
      console.error('Error notifying match found:', error);
    }
  }

  /**
   * Send message to specific participant
   * @param {string} participantId - Participant ID
   * @param {string} event - Event name
   * @param {Object} data - Data to send
   */
  sendToParticipant(participantId, event, data) {
    const clientInfo = this.connectedClients.get(participantId);
    if (clientInfo && clientInfo.socket) {
      clientInfo.socket.emit(event, data);
      clientInfo.lastSeen = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Broadcast to all participants in a round
   * @param {number} roundNumber - Round number
   * @param {string} event - Event name
   * @param {Object} data - Data to broadcast
   */
  broadcastToRound(roundNumber, event, data) {
    this.io.to(`round:${roundNumber}`).emit(event, data);
  }

  /**
   * Broadcast to all connected clients
   * @param {string} event - Event name
   * @param {Object} data - Data to broadcast
   */
  broadcastToAll(event, data) {
    this.io.emit(event, data);
  }

  /**
   * Start heartbeat to check client connections
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      const now = Date.now();
      const timeout = config.websocket.connectionTimeout;
      
      // Check for stale connections
      for (const [participantId, clientInfo] of this.connectedClients.entries()) {
        if (now - clientInfo.lastSeen > timeout) {
          console.log(`💔 Connection timeout for participant ${participantId}`);
          
          // Remove stale connection
          this.connectedClients.delete(participantId);
          
          // Update status
          await RedisService.setParticipantStatus(participantId, 'timeout', {
            timeoutAt: now,
            lastSeen: clientInfo.lastSeen
          });
        }
      }

      // Send heartbeat to all connected clients
      this.broadcastToAll('heartbeat', { 
        timestamp: now,
        connectedClients: this.connectedClients.size 
      });

    }, config.websocket.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get connected clients count
   * @returns {number} Number of connected clients
   */
  getConnectedCount() {
    return this.connectedClients.size;
  }

  /**
   * Get connected clients info
   * @returns {Array} Array of connected client info
   */
  getConnectedClients() {
    return Array.from(this.connectedClients.values());
  }

  /**
   * Force disconnect a participant
   * @param {string} participantId - Participant ID
   */
  disconnectParticipant(participantId) {
    const clientInfo = this.connectedClients.get(participantId);
    if (clientInfo && clientInfo.socket) {
      clientInfo.socket.disconnect(true);
      this.connectedClients.delete(participantId);
      console.log(`🔌 Force disconnected participant ${participantId}`);
      return true;
    }
    return false;
  }

  /**
   * Cleanup WebSocket service
   */
  async cleanup() {
    this.stopHeartbeat();
    
    if (this.io) {
      // Disconnect all clients
      this.io.disconnectSockets(true);
      
      // Clear connected clients
      this.connectedClients.clear();
      
      console.log('🧹 WebSocket service cleaned up');
    }
  }
}

export default new WebSocketService();