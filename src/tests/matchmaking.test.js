import { jest } from '@jest/globals';

// Simple tests for the AI Opponent Service (which doesn't require complex mocking)
describe('AIOpponentService', () => {
  let AIOpponentService;

  beforeAll(async () => {
    // Dynamically import to avoid top-level import issues
    const module = await import('../services/AIOpponentService.js');
    AIOpponentService = module.default;
  });

  describe('selectOpponent', () => {
    test('should select opponent within skill threshold', () => {
      const opponent = AIOpponentService.selectOpponent(7.0, 1.5);

      expect(opponent).toBeDefined();
      expect(opponent.skillLevel).toBeGreaterThanOrEqual(5.5);
      expect(opponent.skillLevel).toBeLessThanOrEqual(8.5);
      expect(opponent.actualSkillLevel).toBeDefined();
      expect(opponent.matchId).toBeDefined();
    });

    test('should select fallback opponent if no suitable matches', () => {
      const opponent = AIOpponentService.selectOpponent(10.0, 0.1);

      expect(opponent).toBeDefined();
      expect(opponent.name).toBeDefined();
      expect(opponent.personality).toBeDefined();
      expect(opponent.responsePattern).toBeDefined();
    });

    test('should return valid personality types', () => {
      const opponent = AIOpponentService.selectOpponent(7.0);
      expect(['competitive', 'collaborative', 'analytical']).toContain(opponent.personality);
    });

    test('should return valid response patterns', () => {
      const opponent = AIOpponentService.selectOpponent(7.0);
      expect(['fast', 'medium', 'slow']).toContain(opponent.responsePattern);
    });
  });

  describe('createAIMatch', () => {
    test('should create complete AI match data', () => {
      const participantId = `test-${Date.now()}`;
      const roundNumber = 2;
      const skillLevel = 6.5;

      const match = AIOpponentService.createAIMatch(participantId, roundNumber, skillLevel);

      expect(match.id).toBeDefined();
      expect(match.participant1_id).toBe(participantId);
      expect(match.round_number).toBe(roundNumber);
      expect(match.match_type).toBe('human_vs_ai');
      expect(match.isAI).toBe(true);
      expect(match.opponent).toBeDefined();
      expect(match.aiSettings).toBeDefined();
      expect(match.aiSettings.responseDelayMs).toBeDefined();
      expect(match.aiSettings.accuracyVariation).toBeDefined();
      expect(match.aiSettings.behaviorPattern).toBeDefined();
    });

    test('should create match with appropriate skill level', () => {
      const match = AIOpponentService.createAIMatch('test-participant', 1, 8.0);
      
      expect(match.opponent.skill_level).toBeGreaterThanOrEqual(1);
      expect(match.opponent.skill_level).toBeLessThanOrEqual(10);
    });
  });

  describe('simulateAIResponse', () => {
    test('should simulate realistic AI response', () => {
      const aiSettings = {
        responseDelayMs: { min: 1000, max: 3000, average: 2000 },
        accuracyVariation: { baseAccuracy: 0.8, variance: 0.1 },
        behaviorPattern: { speedIncreasesWithScore: true, takesRisks: false }
      };

      const response = AIOpponentService.simulateAIResponse(aiSettings, 5, 7);

      expect(response).toBeDefined();
      expect(typeof response.isCorrect).toBe('boolean');
      expect(response.responseTimeMs).toBeGreaterThan(0);
      expect(response.accuracy).toBeGreaterThanOrEqual(0);
      expect(response.accuracy).toBeLessThanOrEqual(1);
      expect(response.questionNumber).toBe(5);
      expect(response.difficulty).toBe(7);
    });

    test('should vary response time based on pattern', () => {
      const fastSettings = {
        responseDelayMs: { min: 800, max: 2000, average: 1200 },
        accuracyVariation: { baseAccuracy: 0.8, variance: 0.1 },
        behaviorPattern: { speedIncreasesWithScore: false }
      };

      const slowSettings = {
        responseDelayMs: { min: 4000, max: 7000, average: 5500 },
        accuracyVariation: { baseAccuracy: 0.8, variance: 0.1 },
        behaviorPattern: { speedIncreasesWithScore: false }
      };

      const fastResponse = AIOpponentService.simulateAIResponse(fastSettings, 5, 7);
      const slowResponse = AIOpponentService.simulateAIResponse(slowSettings, 5, 7);

      expect(fastResponse.responseTimeMs).toBeLessThan(slowResponse.responseTimeMs);
    });
  });

  describe('getAIStats', () => {
    test('should return comprehensive AI statistics', () => {
      const stats = AIOpponentService.getAIStats();

      expect(stats.totalOpponents).toBeGreaterThan(0);
      expect(stats.skillLevelRange).toBeDefined();
      expect(stats.skillLevelRange.min).toBeDefined();
      expect(stats.skillLevelRange.max).toBeDefined();
      expect(stats.skillLevelRange.average).toBeDefined();
      expect(stats.personalityDistribution).toBeDefined();
      expect(stats.responsePatternDistribution).toBeDefined();
    });

    test('should have consistent personality counts', () => {
      const stats = AIOpponentService.getAIStats();
      const totalPersonalities = Object.values(stats.personalityDistribution)
        .reduce((sum, count) => sum + count, 0);
      
      expect(totalPersonalities).toBe(stats.totalOpponents);
    });

    test('should have consistent response pattern counts', () => {
      const stats = AIOpponentService.getAIStats();
      const totalPatterns = Object.values(stats.responsePatternDistribution)
        .reduce((sum, count) => sum + count, 0);
      
      expect(totalPatterns).toBe(stats.totalOpponents);
    });
  });

  describe('getAllOpponents', () => {
    test('should return array of opponents', () => {
      const opponents = AIOpponentService.getAllOpponents();
      
      expect(Array.isArray(opponents)).toBe(true);
      expect(opponents.length).toBeGreaterThan(0);
      
      // Check first opponent structure
      const opponent = opponents[0];
      expect(opponent.id).toBeDefined();
      expect(opponent.name).toBeDefined();
      expect(opponent.skillLevel).toBeDefined();
      expect(opponent.personality).toBeDefined();
      expect(opponent.responsePattern).toBeDefined();
    });
  });

  describe('getOpponentById', () => {
    test('should return specific opponent by ID', () => {
      const allOpponents = AIOpponentService.getAllOpponents();
      const firstOpponent = allOpponents[0];
      
      const foundOpponent = AIOpponentService.getOpponentById(firstOpponent.id);
      
      expect(foundOpponent).toBeDefined();
      expect(foundOpponent.id).toBe(firstOpponent.id);
      expect(foundOpponent.name).toBe(firstOpponent.name);
    });

    test('should return null for non-existent ID', () => {
      const foundOpponent = AIOpponentService.getOpponentById('non-existent-id');
      expect(foundOpponent).toBeNull();
    });
  });
});

// Test helper functions
describe('Helper Functions', () => {
  let helpers;

  beforeAll(async () => {
    const module = await import('../utils/helpers.js');
    helpers = module;
  });

  describe('generateUUID', () => {
    test('should generate valid UUID', () => {
      const uuid = helpers.generateUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      expect(uuid).toBeDefined();
      expect(typeof uuid).toBe('string');
      expect(uuidRegex.test(uuid)).toBe(true);
    });

    test('should generate unique UUIDs', () => {
      const uuid1 = helpers.generateUUID();
      const uuid2 = helpers.generateUUID();
      
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('isValidUUID', () => {
    test('should validate correct UUIDs', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      expect(helpers.isValidUUID(validUUID)).toBe(true);
    });

    test('should reject invalid UUIDs', () => {
      expect(helpers.isValidUUID('invalid-uuid')).toBe(false);
      expect(helpers.isValidUUID('123')).toBe(false);
      expect(helpers.isValidUUID('')).toBe(false);
    });
  });

  describe('calculateSkillLevel', () => {
    test('should return default skill level for empty data', () => {
      expect(helpers.calculateSkillLevel([])).toBe(7);
      expect(helpers.calculateSkillLevel()).toBe(7);
    });

    test('should calculate skill level from task rounds', () => {
      const taskRounds = [
        { total_correct: 8, total_questions: 10 },
        { total_correct: 7, total_questions: 10 },
        { total_correct: 9, total_questions: 10 }
      ];
      
      const skillLevel = helpers.calculateSkillLevel(taskRounds);
      expect(skillLevel).toBeGreaterThanOrEqual(1);
      expect(skillLevel).toBeLessThanOrEqual(10);
    });
  });

  describe('formatTime', () => {
    test('should format seconds correctly', () => {
      expect(helpers.formatTime(30)).toBe('0:30');
      expect(helpers.formatTime(90)).toBe('1:30');
      expect(helpers.formatTime(125)).toBe('2:05');
    });
  });

  describe('areSkillsCompatible', () => {
    test('should determine skill compatibility', () => {
      expect(helpers.areSkillsCompatible(7.0, 7.5, 1.0)).toBe(true);
      expect(helpers.areSkillsCompatible(7.0, 9.0, 1.0)).toBe(false);
      expect(helpers.areSkillsCompatible(6.0, 7.0, 1.5)).toBe(true);
    });
  });

  describe('clamp', () => {
    test('should clamp values within range', () => {
      expect(helpers.clamp(5, 1, 10)).toBe(5);
      expect(helpers.clamp(-5, 1, 10)).toBe(1);
      expect(helpers.clamp(15, 1, 10)).toBe(10);
    });
  });
});

// Configuration tests
describe('Configuration', () => {
  let config;

  beforeAll(async () => {
    const module = await import('../config/index.js');
    config = module.config;
  });

  test('should have required configuration properties', () => {
    expect(config.server).toBeDefined();
    expect(config.redis).toBeDefined();
    expect(config.matchmaking).toBeDefined();
    expect(config.websocket).toBeDefined();
  });

  test('should have valid server configuration', () => {
    expect(config.server.port).toBeGreaterThan(0);
    expect(config.server.nodeEnv).toBeDefined();
    expect(Array.isArray(config.server.corsOrigins)).toBe(true);
  });

  test('should have valid matchmaking configuration', () => {
    expect(config.matchmaking.humanSearchTimeoutMs).toBeGreaterThan(0);
    expect(config.matchmaking.skillMatchingThreshold).toBeGreaterThan(0);
    expect(typeof config.matchmaking.aiFallbackEnabled).toBe('boolean');
  });
});