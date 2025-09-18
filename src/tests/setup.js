// Jest test setup file

// Global test helpers
global.generateMockParticipant = () => ({
  participantId: `test-${Math.random().toString(36).substr(2, 9)}`,
  roundNumber: Math.floor(Math.random() * 5) + 1,
  skillLevel: Math.random() * 9 + 1,
  treatmentGroup: ['control', 'goal_setting', 'goal_ai', 'tournament'][Math.floor(Math.random() * 4)]
});

global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));