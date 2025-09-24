# Prosocial Matchmaking Backend

Real-time tournament matchmaking backend for behavioral economics research platform. This backend service provides fast, efficient matchmaking using Redis for queuing and WebSocket for real-time communication.

## Features

- **Real-time Matchmaking**: Sub-second matching with WebSocket updates
- **Redis-based Queuing**: Fast, distributed queue management
- **AI Opponent System**: Intelligent AI opponents with configurable personalities
- **Skill-based Matching**: Matches participants based on skill levels
- **Human Priority**: Prioritizes human opponents over AI
- **Graceful Fallback**: AI opponents when no humans available
- **Live Statistics**: Real-time monitoring and analytics
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive request validation
- **Graceful Shutdown**: Clean shutdown with resource cleanup

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Redis         │
│   (React)       │◄───┤   (Node.js)     │◄───┤   (Queue)       │
│                 │    │                 │    │                 │
│  WebSocket ◄────┼────┤  WebSocket      │    │  - Queues       │
│  REST API ◄─────┼────┤  REST API       │    │  - Matches      │
│                 │    │                 │    │  - Stats        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- Redis server
- Environment variables configured

### Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start Redis** (if not already running):
```bash
# macOS with Homebrew
brew services start redis

# Linux
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:alpine
```

4. **Start the server**:
```bash
# Development
npm run dev

# Production
npm start
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Redis Configuration  
REDIS_URL=redis://localhost:6379

# Supabase Configuration (for database integration)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Matchmaking Configuration
HUMAN_SEARCH_TIMEOUT_MS=180000
AI_FALLBACK_ENABLED=true
MAX_QUEUE_SIZE=1000
SKILL_MATCHING_THRESHOLD=1.5
```

### Key Configuration Options

- `HUMAN_SEARCH_TIMEOUT_MS`: Maximum time to search for human opponents before AI fallback
- `SKILL_MATCHING_THRESHOLD`: Maximum skill level difference for matches (1.5 = ±1.5 skill points)
- `MAX_QUEUE_SIZE`: Maximum participants in queue before rejecting new entries

## API Endpoints

### Matchmaking Operations

```http
# Start matchmaking
POST /api/matchmaking/start
{
  "participantId": "uuid",
  "roundNumber": 1,
  "skillLevel": 7.5,
  "treatmentGroup": "tournament"
}

# Cancel matchmaking
POST /api/matchmaking/cancel
{
  "participantId": "uuid", 
  "roundNumber": 1
}

# Get queue status
GET /api/matchmaking/queue/{roundNumber}

# Get participant queue position
GET /api/matchmaking/position/{participantId}/{roundNumber}
```

### Match Management

```http
# Get match details
GET /api/matchmaking/match/{matchId}

# Update match status
PUT /api/matchmaking/match/{matchId}/status
{
  "status": "completed"
}
```

### Participant Status

```http
# Get participant status
GET /api/matchmaking/participant/{participantId}/status

# Update participant status  
PUT /api/matchmaking/participant/{participantId}/status
{
  "status": "matched",
  "additionalData": {}
}
```

### AI Opponents

```http
# Create AI match directly
POST /api/matchmaking/ai-match
{
  "participantId": "uuid",
  "roundNumber": 1,
  "skillLevel": 7
}

# Get available AI opponents
GET /api/matchmaking/ai-opponents

# Simulate AI response
POST /api/matchmaking/ai-simulate
{
  "aiSettings": {...},
  "questionNumber": 5,
  "difficulty": 8
}
```

### Admin & Monitoring

```http
# Get system statistics
GET /api/matchmaking/stats

# Health check
GET /api/matchmaking/health

# Cleanup expired data
POST /api/matchmaking/cleanup
```

## WebSocket Events

### Client → Server

```javascript
// Register participant
socket.emit('register', {
  participantId: 'uuid',
  roundNumber: 1,
  name: 'Participant Name',
  treatmentGroup: 'tournament'
});

// Start matchmaking
socket.emit('start_matchmaking', {
  participantId: 'uuid',
  roundNumber: 1,
  skillLevel: 7.5,
  treatmentGroup: 'tournament'
});

// Cancel matchmaking
socket.emit('cancel_matchmaking', {
  participantId: 'uuid',
  roundNumber: 1
});

// Get queue status
socket.emit('get_queue_status', {
  roundNumber: 1
});

// Send match update
socket.emit('match_update', {
  matchId: 'uuid',
  participantId: 'uuid',
  updateType: 'score_update',
  updateData: { score: 5 }
});
```

### Server → Client

```javascript
// Registration success
socket.on('registration_success', (data) => {
  console.log('Registered:', data);
});

// Matchmaking started
socket.on('matchmaking_started', (data) => {
  console.log('Search started:', data);
});

// Match found
socket.on('match_found', (matchData) => {
  console.log('Match found:', matchData);
});

// Queue status update
socket.on('queue_status_update', (status) => {
  console.log('Queue status:', status);
});

// Match updates
socket.on('match_update', (update) => {
  console.log('Match update:', update);
});

// Heartbeat
socket.on('heartbeat', (data) => {
  console.log('Server heartbeat:', data);
});
```

## AI Opponent System

The AI system provides realistic opponents with different personalities and skill levels:

### AI Personalities

- **Competitive**: Fast, aggressive, improves under pressure
- **Collaborative**: Steady, consistent performance  
- **Analytical**: Slow start, strong finish, very accurate

### Response Patterns

- **Fast**: 800-2000ms response time
- **Medium**: 2000-4000ms response time
- **Slow**: 4000-7000ms response time

### Skill Levels

AI opponents range from 5.5 to 8.0 skill level, with dynamic adjustment based on:
- Question difficulty
- Game progression
- Opponent performance
- Personality traits

## Integration with Frontend

To integrate with your React frontend:

### 1. Install Socket.IO Client

```bash
npm install socket.io-client
```

### 2. Connect to Backend

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling']
});

// Register participant
socket.emit('register', {
  participantId: currentParticipant.id,
  roundNumber: roundNumber,
  name: currentParticipant.name,
  treatmentGroup: currentParticipant.treatment_group
});

// Listen for match found
socket.on('match_found', (matchData) => {
  onMatchFound(matchData);
});
```

### 3. Replace Database Polling

Replace the existing `TournamentMatchingEngine.tsx` database polling with WebSocket events:

```javascript
// Instead of database queries, use WebSocket
const startMatchmaking = () => {
  socket.emit('start_matchmaking', {
    participantId: currentParticipant.id,
    roundNumber: roundNumber,
    skillLevel: calculateSkillLevel(),
    treatmentGroup: currentParticipant.treatment_group
  });
};
```

## Monitoring & Health

### Health Check

```bash
curl http://localhost:3001/health
```

### Real-time Statistics

```bash
curl http://localhost:3001/api/matchmaking/stats
```

### Redis Monitoring

```bash
# Connect to Redis CLI
redis-cli

# Monitor live commands
MONITOR

# Check queue sizes
ZCARD queue:round:1

# View match data
HGETALL match:uuid
```

## Development

### Running in Development

```bash
npm run dev
```

This uses `nodemon` for auto-restart on file changes.

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Production Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure Redis connection
3. Set appropriate CORS origins
4. Configure rate limiting
5. Setup process manager (PM2, Docker, etc.)

### PM2 Deployment

```bash
npm install -g pm2
pm2 start src/server.js --name "matchmaking-backend"
pm2 save
pm2 startup
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ src/
EXPOSE 3001
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Ensure Redis is running: `redis-cli ping`
   - Check REDIS_URL in .env

2. **WebSocket Connection Issues**
   - Verify CORS origins in .env
   - Check firewall settings

3. **High Memory Usage**
   - Monitor Redis memory: `redis-cli info memory`
   - Run cleanup: `POST /api/matchmaking/cleanup`

### Debug Logging

Set `LOG_LEVEL=debug` in .env for verbose logging.

### Performance Monitoring

Monitor key metrics:
- Redis memory usage
- WebSocket connections
- Match completion rates
- Queue wait times

## Contributing

1. Follow existing code style
2. Add tests for new features
3. Update documentation
4. Ensure all health checks pass

## License

MIT License - See LICENSE file for details.