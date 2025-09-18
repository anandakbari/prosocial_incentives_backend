# API Testing Guide

This guide shows you how to manually test the Prosocial Matchmaking Backend API endpoints.

## Prerequisites

1. **Start the backend server:**
```bash
cd prosocial_backend
./start.sh
# OR
npm run dev
```

2. **Verify server is running:**
```bash
curl http://localhost:3001/health
```

## Basic Health & Info Endpoints

### Health Check
```bash
curl http://localhost:3001/health | jq
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": 1758106500000,
  "version": "1.0.0",
  "services": {
    "redis": true,
    "websocket": true
  }
}
```

### Root Endpoint
```bash
curl http://localhost:3001/ | jq
```

## Matchmaking API Endpoints

### 1. Get System Statistics
```bash
curl http://localhost:3001/api/matchmaking/stats | jq
```

### 2. Get AI Opponents List
```bash
curl http://localhost:3001/api/matchmaking/ai-opponents | jq
```

### 3. Create AI Match (Simulated)
```bash
curl -X POST http://localhost:3001/api/matchmaking/ai-match \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "test-12345",
    "roundNumber": 1,
    "skillLevel": 7.5
  }' | jq
```

### 4. Simulate AI Response
```bash
curl -X POST http://localhost:3001/api/matchmaking/ai-simulate \
  -H "Content-Type: application/json" \
  -d '{
    "aiSettings": {
      "responseDelayMs": {"min": 1000, "max": 3000, "average": 2000},
      "accuracyVariation": {"baseAccuracy": 0.8, "variance": 0.1},
      "behaviorPattern": {"speedIncreasesWithScore": true, "takesRisks": false}
    },
    "questionNumber": 5,
    "difficulty": 7
  }' | jq
```

### 5. Get Queue Status for Round
```bash
curl http://localhost:3001/api/matchmaking/queue/1 | jq
```

### 6. Start Matchmaking (Real Test)
```bash
curl -X POST http://localhost:3001/api/matchmaking/start \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "test-participant-001",
    "roundNumber": 1,
    "skillLevel": 7.0,
    "treatmentGroup": "tournament"
  }' | jq
```

### 7. Cancel Matchmaking
```bash
curl -X POST http://localhost:3001/api/matchmaking/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "test-participant-001",
    "roundNumber": 1
  }' | jq
```

### 8. Check Participant Status
```bash
curl http://localhost:3001/api/matchmaking/participant/test-participant-001/status | jq
```

## Admin API Endpoints

### 1. Admin Dashboard
```bash
curl http://localhost:3001/api/admin/dashboard | jq
```

### 2. Queue Monitoring
```bash
curl http://localhost:3001/api/admin/queues | jq
```

### 3. Connected Clients
```bash
curl http://localhost:3001/api/admin/clients | jq
```

### 4. System Performance
```bash
curl http://localhost:3001/api/admin/performance | jq
```

### 5. AI Opponents Management
```bash
curl http://localhost:3001/api/admin/ai-opponents | jq
```

### 6. Test Specific AI Opponent
```bash
curl -X POST http://localhost:3001/api/admin/ai-opponents/test \
  -H "Content-Type: application/json" \
  -d '{
    "aiId": "ai_1",
    "testScenario": {"difficulty": 8}
  }' | jq
```

### 7. Force System Cleanup
```bash
curl -X POST http://localhost:3001/api/admin/cleanup \
  -H "Content-Type: application/json" \
  -d '{
    "type": "all",
    "olderThanHours": 1
  }' | jq
```

### 8. Generate Analytics Report
```bash
curl -X POST http://localhost:3001/api/admin/analytics/report \
  -H "Content-Type: application/json" \
  -d '{
    "timeRangeHours": 24,
    "includePerformance": true
  }' | jq
```

## WebSocket Testing

### Using wscat (WebSocket testing tool)
```bash
# Install wscat if you don't have it
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:3001/socket.io/?EIO=4&transport=websocket
```

### WebSocket Events to Test

1. **Register Participant:**
```json
42["register", {
  "participantId": "test-ws-001",
  "roundNumber": 1,
  "name": "Test User",
  "treatmentGroup": "tournament"
}]
```

2. **Start Matchmaking:**
```json
42["start_matchmaking", {
  "participantId": "test-ws-001",
  "roundNumber": 1,
  "skillLevel": 7.5,
  "treatmentGroup": "tournament"
}]
```

3. **Get Queue Status:**
```json
42["get_queue_status", {"roundNumber": 1}]
```

4. **Cancel Matchmaking:**
```json
42["cancel_matchmaking", {
  "participantId": "test-ws-001",
  "roundNumber": 1
}]
```

## Testing Scenarios

### Scenario 1: Basic Health Check
```bash
# Test if server is up and running
curl -s http://localhost:3001/health | jq '.status'
# Should return: "healthy"
```

### Scenario 2: AI Matchmaking Flow
```bash
# 1. Check available AI opponents
curl -s http://localhost:3001/api/matchmaking/ai-opponents | jq '.data.opponents | length'

# 2. Create an AI match
PARTICIPANT_ID="test-$(date +%s)"
curl -X POST http://localhost:3001/api/matchmaking/ai-match \
  -H "Content-Type: application/json" \
  -d "{
    \"participantId\": \"$PARTICIPANT_ID\",
    \"roundNumber\": 1,
    \"skillLevel\": 7.5
  }" | jq '.data.opponent.name'
```

### Scenario 3: Queue Management
```bash
# 1. Start matchmaking for participant
PARTICIPANT_ID="test-queue-$(date +%s)"
curl -X POST http://localhost:3001/api/matchmaking/start \
  -H "Content-Type: application/json" \
  -d "{
    \"participantId\": \"$PARTICIPANT_ID\",
    \"roundNumber\": 1,
    \"skillLevel\": 7.0,
    \"treatmentGroup\": \"tournament\"
  }" | jq '.data.status'

# 2. Check queue status
curl -s http://localhost:3001/api/matchmaking/queue/1 | jq '.data.totalWaiting'

# 3. Check participant position
curl -s "http://localhost:3001/api/matchmaking/position/$PARTICIPANT_ID/1" | jq '.data.position'

# 4. Cancel matchmaking
curl -X POST http://localhost:3001/api/matchmaking/cancel \
  -H "Content-Type: application/json" \
  -d "{
    \"participantId\": \"$PARTICIPANT_ID\",
    \"roundNumber\": 1
  }" | jq '.success'
```

### Scenario 4: Admin Monitoring
```bash
# Get comprehensive system overview
curl -s http://localhost:3001/api/admin/dashboard | jq '{
  connectedClients: .data.realTime.connectedClients,
  activeSearches: .data.realTime.activeSearches,
  todayMatches: .data.matchmaking.today.totalMatches,
  systemHealth: .data.system.redis
}'
```

### Scenario 5: Performance Testing
```bash
# Test response times
echo "Testing response times..."
for i in {1..5}; do
  echo "Request $i:"
  time curl -s http://localhost:3001/health > /dev/null
done
```

## Error Testing

### Invalid Requests
```bash
# Missing required fields
curl -X POST http://localhost:3001/api/matchmaking/start \
  -H "Content-Type: application/json" \
  -d '{}' | jq

# Invalid participant ID format
curl -X POST http://localhost:3001/api/matchmaking/start \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "invalid-id",
    "roundNumber": 1
  }' | jq

# Invalid round number
curl -X POST http://localhost:3001/api/matchmaking/start \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "123e4567-e89b-12d3-a456-426614174000",
    "roundNumber": 999
  }' | jq
```

## Load Testing (Optional)

### Using Apache Bench (ab)
```bash
# Test health endpoint with 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:3001/health

# Test AI opponents endpoint
ab -n 50 -c 5 http://localhost:3001/api/matchmaking/ai-opponents
```

### Using curl with parallel requests
```bash
# Create multiple AI matches simultaneously
for i in {1..5}; do
  curl -X POST http://localhost:3001/api/matchmaking/ai-match \
    -H "Content-Type: application/json" \
    -d "{
      \"participantId\": \"load-test-$i\",
      \"roundNumber\": 1,
      \"skillLevel\": $((RANDOM % 5 + 5))
    }" &
done
wait
echo "All requests completed"
```

## Monitoring During Tests

### Watch Logs
```bash
# In another terminal, watch the server logs
tail -f logs/combined.log  # if using PM2
# OR watch console output if running with npm run dev
```

### Monitor Redis
```bash
# Connect to Redis and monitor commands
redis-cli monitor
```

### Check System Resources
```bash
# Monitor CPU and memory usage
top -p $(pgrep -f "node.*server.js")
```

## Expected Responses

All successful API responses follow this format:
```json
{
  "success": true,
  "data": { /* response data */ },
  "timestamp": 1758106500000
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed error description",
  "timestamp": 1758106500000
}
```

## Tips for Testing

1. **Use jq for JSON formatting**: Install with `brew install jq` (macOS) or `apt install jq` (Linux)

2. **Save common participant IDs**: 
   ```bash
   export TEST_PARTICIPANT="123e4567-e89b-12d3-a456-426614174000"
   ```

3. **Test in sequence**: Some endpoints depend on previous actions (like canceling requires starting first)

4. **Monitor server logs**: Keep an eye on the console output to see real-time processing

5. **Use different skill levels**: Test with various skill levels (1-10) to see AI opponent selection

6. **Test error cases**: Intentionally send invalid data to test error handling

7. **WebSocket testing**: Use browser developer tools or wscat for WebSocket testing

8. **Performance monitoring**: Watch response times and server resources during testing