import { v4 as uuidv4 } from 'uuid';

class AIOpponentService {
  constructor() {
    this.aiOpponents = [
      { 
        id: 'ai_1', 
        name: 'Bot Alex', 
        skillLevel: 7.2, 
        personality: 'competitive', 
        responsePattern: 'fast',
        description: 'Quick-thinking competitive strategist'
      },
      { 
        id: 'ai_2', 
        name: 'Bot Pat', 
        skillLevel: 6.8, 
        personality: 'collaborative', 
        responsePattern: 'medium',
        description: 'Balanced and methodical approach'
      },
      { 
        id: 'ai_3', 
        name: 'Bot Charlie', 
        skillLevel: 7.5, 
        personality: 'analytical', 
        responsePattern: 'slow',
        description: 'Deep analytical thinker'
      },
      { 
        id: 'ai_4', 
        name: 'Bot Riley', 
        skillLevel: 6.5, 
        personality: 'competitive', 
        responsePattern: 'medium',
        description: 'Aggressive competitive player'
      },
      { 
        id: 'ai_5', 
        name: 'Bot Morgan', 
        skillLevel: 7.8, 
        personality: 'analytical', 
        responsePattern: 'fast',
        description: 'Lightning-fast analytical mind'
      },
      { 
        id: 'ai_6', 
        name: 'Bot Casey', 
        skillLevel: 6.0, 
        personality: 'collaborative', 
        responsePattern: 'slow',
        description: 'Thoughtful collaborative partner'
      },
      { 
        id: 'ai_7', 
        name: 'Bot Jordan', 
        skillLevel: 8.0, 
        personality: 'competitive', 
        responsePattern: 'fast',
        description: 'Elite competitive challenger'
      },
      { 
        id: 'ai_8', 
        name: 'Bot Sam', 
        skillLevel: 5.5, 
        personality: 'analytical', 
        responsePattern: 'medium',
        description: 'Careful analytical approach'
      }
    ];
  }

  /**
   * Select the best AI opponent based on participant's skill level
   * @param {number} participantSkillLevel - The participant's skill level (1-10)
   * @param {number} skillThreshold - Maximum skill difference allowed (default: 1.5)
   * @returns {Object} Selected AI opponent
   */
  selectOpponent(participantSkillLevel = 7, skillThreshold = 1.5) {
    console.log(`🤖 Selecting AI opponent for skill level: ${participantSkillLevel}`);
    
    // Find opponents within skill threshold
    const suitableOpponents = this.aiOpponents.filter(ai => 
      Math.abs(ai.skillLevel - participantSkillLevel) <= skillThreshold
    );

    let selectedOpponent;
    
    if (suitableOpponents.length > 0) {
      // Select randomly from suitable opponents
      selectedOpponent = suitableOpponents[Math.floor(Math.random() * suitableOpponents.length)];
      console.log(`✅ Found ${suitableOpponents.length} suitable opponents, selected: ${selectedOpponent.name}`);
    } else {
      // Fallback: select the closest skill level
      selectedOpponent = this.aiOpponents.reduce((closest, current) => {
        const currentDiff = Math.abs(current.skillLevel - participantSkillLevel);
        const closestDiff = Math.abs(closest.skillLevel - participantSkillLevel);
        return currentDiff < closestDiff ? current : closest;
      });
      console.log(`⚠️ No suitable opponents found, using closest skill match: ${selectedOpponent.name}`);
    }

    return {
      ...selectedOpponent,
      // Add some randomization to skill level for variety
      actualSkillLevel: this.randomizeSkillLevel(selectedOpponent.skillLevel),
      matchId: uuidv4()
    };
  }

  /**
   * Get AI opponent by specific ID
   * @param {string} aiId - The AI opponent ID
   * @returns {Object|null} AI opponent or null if not found
   */
  getOpponentById(aiId) {
    return this.aiOpponents.find(ai => ai.id === aiId) || null;
  }

  /**
   * Get all available AI opponents
   * @returns {Array} Array of all AI opponents
   */
  getAllOpponents() {
    return [...this.aiOpponents];
  }

  /**
   * Get opponents filtered by personality type
   * @param {string} personality - 'competitive', 'collaborative', or 'analytical'
   * @returns {Array} Filtered AI opponents
   */
  getOpponentsByPersonality(personality) {
    return this.aiOpponents.filter(ai => ai.personality === personality);
  }

  /**
   * Get opponents filtered by response pattern
   * @param {string} responsePattern - 'fast', 'medium', or 'slow'
   * @returns {Array} Filtered AI opponents
   */
  getOpponentsByResponsePattern(responsePattern) {
    return this.aiOpponents.filter(ai => ai.responsePattern === responsePattern);
  }

  /**
   * Create a match object with AI opponent
   * @param {string} participantId - The human participant's ID
   * @param {number} roundNumber - The round number
   * @param {number} participantSkillLevel - The participant's skill level
   * @returns {Object} Complete match object
   */
  createAIMatch(participantId, roundNumber, participantSkillLevel = 7) {
    const aiOpponent = this.selectOpponent(participantSkillLevel);
    const matchId = uuidv4();

    const matchData = {
      id: matchId,
      participant1_id: participantId,
      participant2_id: null, // AI doesn't have a participant ID
      round_number: roundNumber,
      match_type: 'human_vs_ai',
      status: 'active',
      created_at: new Date().toISOString(),
      isAI: true,
      opponent: JSON.stringify({
        id: aiOpponent.id,
        name: aiOpponent.name,
        participant_id: aiOpponent.id,
        skill_level: aiOpponent.actualSkillLevel,
        personality: aiOpponent.personality,
        responsePattern: aiOpponent.responsePattern,
        description: aiOpponent.description
      }),
      aiSettings: JSON.stringify({
        responseDelayMs: this.getResponseDelay(aiOpponent.responsePattern),
        accuracyVariation: this.getAccuracyVariation(aiOpponent.personality),
        behaviorPattern: this.getBehaviorPattern(aiOpponent.personality)
      })
    };

    console.log(`✅ Created AI match: ${participantId} vs ${aiOpponent.name} (${aiOpponent.skillLevel})`);
    return matchData;
  }

  /**
   * Simulate AI response times based on response pattern
   * @param {string} responsePattern - 'fast', 'medium', or 'slow'
   * @returns {Object} Response timing configuration
   */
  getResponseDelay(responsePattern) {
    const delays = {
      fast: { min: 800, max: 2000, average: 1200 },
      medium: { min: 2000, max: 4000, average: 3000 },
      slow: { min: 4000, max: 7000, average: 5500 }
    };
    
    return delays[responsePattern] || delays.medium;
  }

  /**
   * Get accuracy variation based on personality
   * @param {string} personality - AI personality type
   * @returns {Object} Accuracy configuration
   */
  getAccuracyVariation(personality) {
    const variations = {
      competitive: { 
        baseAccuracy: 0.85, 
        variance: 0.1, 
        improvesOverTime: true,
        rushesEasy: true 
      },
      collaborative: { 
        baseAccuracy: 0.80, 
        variance: 0.08, 
        improvesOverTime: false,
        consistent: true 
      },
      analytical: { 
        baseAccuracy: 0.88, 
        variance: 0.05, 
        improvesOverTime: true,
        slowStart: true 
      }
    };
    
    return variations[personality] || variations.collaborative;
  }

  /**
   * Get behavioral patterns for AI simulation
   * @param {string} personality - AI personality type
   * @returns {Object} Behavior configuration
   */
  getBehaviorPattern(personality) {
    const patterns = {
      competitive: {
        speedIncreasesWithScore: true,
        takesRisks: true,
        adaptToOpponent: true,
        celebration: 'aggressive'
      },
      collaborative: {
        speedIncreasesWithScore: false,
        takesRisks: false,
        adaptToOpponent: false,
        celebration: 'modest'
      },
      analytical: {
        speedIncreasesWithScore: false,
        takesRisks: false,
        adaptToOpponent: true,
        celebration: 'analytical'
      }
    };
    
    return patterns[personality] || patterns.collaborative;
  }

  /**
   * Add slight randomization to skill level for variety
   * @param {number} baseSkillLevel - Base skill level
   * @returns {number} Randomized skill level
   */
  randomizeSkillLevel(baseSkillLevel) {
    // Add ±0.3 random variation
    const variation = (Math.random() - 0.5) * 0.6;
    return Math.max(1, Math.min(10, baseSkillLevel + variation));
  }

  /**
   * Simulate AI performance for a question
   * @param {Object} aiSettings - AI configuration
   * @param {number} questionNumber - Current question number (1-10)
   * @param {number} difficulty - Question difficulty (1-10)
   * @param {boolean} opponentCorrect - Whether human opponent got it right
   * @returns {Object} AI response simulation
   */
  simulateAIResponse(aiSettings, questionNumber, difficulty, opponentCorrect = null) {
    const { responseDelayMs, accuracyVariation, behaviorPattern } = aiSettings;
    
    // Calculate base accuracy adjusted for difficulty
    let accuracy = accuracyVariation.baseAccuracy - (difficulty - 5) * 0.02;
    
    // Apply personality-based adjustments
    if (behaviorPattern.adaptToOpponent && opponentCorrect !== null) {
      // Competitive AI tries harder when opponent is doing well
      if (behaviorPattern.speedIncreasesWithScore && opponentCorrect) {
        accuracy += 0.05; // Small boost when competing
      }
    }
    
    if (accuracyVariation.slowStart && questionNumber <= 3) {
      accuracy -= 0.1; // Slower start for analytical types
    }
    
    if (accuracyVariation.improvesOverTime && questionNumber > 5) {
      accuracy += 0.05; // Improvement over time
    }
    
    // Add random variance
    accuracy += (Math.random() - 0.5) * accuracyVariation.variance;
    accuracy = Math.max(0, Math.min(1, accuracy)); // Clamp between 0 and 1
    
    // Determine if AI gets question correct
    const isCorrect = Math.random() < accuracy;
    
    // Calculate response time
    let responseTime = responseDelayMs.min + Math.random() * (responseDelayMs.max - responseDelayMs.min);
    
    // Adjust response time based on personality
    if (behaviorPattern.speedIncreasesWithScore && questionNumber > 5) {
      responseTime *= 0.8; // Faster as game progresses
    }
    
    if (accuracyVariation.rushesEasy && difficulty < 5) {
      responseTime *= 0.7; // Faster on easy questions
    }
    
    return {
      isCorrect,
      responseTimeMs: Math.round(responseTime),
      accuracy: Math.round(accuracy * 100) / 100,
      questionNumber,
      difficulty
    };
  }

  /**
   * Get AI opponent statistics for admin monitoring
   * @returns {Object} AI usage statistics
   */
  getAIStats() {
    return {
      totalOpponents: this.aiOpponents.length,
      skillLevelRange: {
        min: Math.min(...this.aiOpponents.map(ai => ai.skillLevel)),
        max: Math.max(...this.aiOpponents.map(ai => ai.skillLevel)),
        average: this.aiOpponents.reduce((sum, ai) => sum + ai.skillLevel, 0) / this.aiOpponents.length
      },
      personalityDistribution: {
        competitive: this.aiOpponents.filter(ai => ai.personality === 'competitive').length,
        collaborative: this.aiOpponents.filter(ai => ai.personality === 'collaborative').length,
        analytical: this.aiOpponents.filter(ai => ai.personality === 'analytical').length
      },
      responsePatternDistribution: {
        fast: this.aiOpponents.filter(ai => ai.responsePattern === 'fast').length,
        medium: this.aiOpponents.filter(ai => ai.responsePattern === 'medium').length,
        slow: this.aiOpponents.filter(ai => ai.responsePattern === 'slow').length
      }
    };
  }
}

export default new AIOpponentService();