// Gender-neutral bot names for tournament matches
const GENDER_NEUTRAL_BOT_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Quinn', 'Sage',
  'River', 'Avery', 'Blake', 'Cameron', 'Drew', 'Emery', 'Finley', 'Gray',
  'Harper', 'Indigo', 'Kai', 'Lane', 'Max', 'Nova', 'Ocean', 'Parker',
  'Reese', 'Skylar', 'Tatum', 'Vale', 'Winter', 'Zion'
];

/**
 * Generate a deterministic bot name based on ID
 * @param {string} participantId - The participant ID to generate a name for
 * @returns {string} Bot name in format "Bot [Name]"
 */
export const getBotName = (participantId) => {
  // Use the last 4 characters of the ID to select a name consistently
  const idSuffix = participantId.slice(-4);
  
  // Convert hex characters to a number to select from the list
  let hash = 0;
  for (let i = 0; i < idSuffix.length; i++) {
    const char = idSuffix.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const index = Math.abs(hash) % GENDER_NEUTRAL_BOT_NAMES.length;
  return `Bot ${GENDER_NEUTRAL_BOT_NAMES[index]}`;
};

/**
 * Get display name for a participant
 * @param {Object} participant - Participant object with id and optional name
 * @param {boolean} isBot - Whether this is a bot participant
 * @returns {string} Display name
 */
export const getPlayerDisplayName = (participant, isBot = false) => {
  if (isBot) {
    return getBotName(participant.id);
  }
  
  // For human participants, use their first name if available
  if (participant.name) {
    // Extract first name from full name (split by space and take first part)
    const firstName = participant.name.split(' ')[0];
    return firstName;
  }
  
  // Fallback to the old format if no name is available
  return `Player ${participant.id.slice(-4)}`;
};