import { v4 as uuidv4 } from 'uuid';

/**
 * Utility functions for the matchmaking backend
 */

/**
 * Generate a UUID v4
 * @returns {string} UUID string
 */
export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return uuidv4();
};

/**
 * Validate UUID format
 * @param {string} uuid - UUID to validate
 * @returns {boolean} Whether UUID is valid
 */
export const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Calculate skill level from participant performance data
 * @param {Array} taskRounds - Array of task round results
 * @returns {number} Calculated skill level (1-10)
 */
export const calculateSkillLevel = (taskRounds = []) => {
  if (!taskRounds || taskRounds.length === 0) {
    return 7; // Default skill level
  }

  // Calculate average score from recent rounds (max 3 rounds)
  const recentRounds = taskRounds.slice(-3);
  const totalCorrect = recentRounds.reduce((sum, round) => sum + (round.total_correct || 0), 0);
  const totalQuestions = recentRounds.reduce((sum, round) => sum + (round.total_questions || 10), 0);
  
  if (totalQuestions === 0) return 7;
  
  const accuracy = totalCorrect / totalQuestions;
  
  // Convert accuracy to skill level (1-10 scale)
  // 0% accuracy = 1, 50% = 5, 100% = 10
  const baseSkill = Math.max(1, Math.min(10, (accuracy * 9) + 1));
  
  // Add slight randomization to prevent exact matches
  const variation = (Math.random() - 0.5) * 0.4; // ±0.2 variation
  
  return Math.max(1, Math.min(10, baseSkill + variation));
};

/**
 * Format time duration in human-readable format
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Format time in MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time
 */
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Sanitize participant name for display
 * @param {string} name - Participant name
 * @returns {string} Sanitized name
 */
export const sanitizeName = (name) => {
  if (!name || typeof name !== 'string') {
    return 'Anonymous';
  }
  
  // Remove HTML tags and limit length
  return name
    .replace(/<[^>]*>/g, '')
    .replace(/[<>'"&]/g, '')
    .trim()
    .substring(0, 50) || 'Anonymous';
};

/**
 * Generate anonymous participant display name
 * @param {string} participantId - Participant UUID
 * @returns {string} Anonymous display name
 */
export const generateAnonymousName = (participantId) => {
  if (!participantId) return 'Player';
  
  // Use last 4 characters of UUID for uniqueness
  const suffix = participantId.slice(-4).toUpperCase();
  return `Player ${suffix}`;
};

/**
 * Calculate wait time estimate based on queue status
 * @param {number} queuePosition - Position in queue
 * @param {number} averageMatchTime - Average time to find matches (seconds)
 * @returns {number} Estimated wait time in seconds
 */
export const calculateWaitTime = (queuePosition, averageMatchTime = 30) => {
  if (queuePosition <= 1) return 0;
  
  // Estimate based on queue position and average match time
  // Account for the fact that multiple matches can happen simultaneously
  const estimatedTime = Math.ceil((queuePosition - 1) / 2) * averageMatchTime;
  
  // Cap at maximum reasonable wait time
  return Math.min(estimatedTime, 300); // Max 5 minutes
};

/**
 * Check if two skill levels are compatible for matching
 * @param {number} skill1 - First participant skill level
 * @param {number} skill2 - Second participant skill level
 * @param {number} threshold - Maximum difference allowed
 * @returns {boolean} Whether skills are compatible
 */
export const areSkillsCompatible = (skill1, skill2, threshold = 1.5) => {
  return Math.abs(skill1 - skill2) <= threshold;
};

/**
 * Generate match quality score based on participant compatibility
 * @param {Object} participant1 - First participant data
 * @param {Object} participant2 - Second participant data
 * @returns {number} Match quality score (0-1)
 */
export const calculateMatchQuality = (participant1, participant2) => {
  let score = 1.0;
  
  // Skill level compatibility (0.5 weight)
  const skillDiff = Math.abs(participant1.skillLevel - participant2.skillLevel);
  const skillScore = Math.max(0, 1 - (skillDiff / 5)); // Normalize to 0-1
  score *= (0.5 + skillScore * 0.5);
  
  // Wait time factor (0.3 weight) - longer wait = accept worse matches
  const waitTime1 = participant1.joinedAt ? Date.now() - participant1.joinedAt : 0;
  const waitTime2 = participant2.joinedAt ? Date.now() - participant2.joinedAt : 0;
  const avgWaitTime = (waitTime1 + waitTime2) / 2;
  const waitScore = Math.min(1, avgWaitTime / 60000); // Normalize by 1 minute
  score *= (0.7 + waitScore * 0.3);
  
  return Math.max(0, Math.min(1, score));
};

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Promise that resolves with function result
 */
export const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Debounce function to limit function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function to limit function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const cloned = {};
    Object.keys(obj).forEach(key => {
      cloned[key] = deepClone(obj[key]);
    });
    return cloned;
  }
};

/**
 * Check if an object is empty
 * @param {Object} obj - Object to check
 * @returns {boolean} Whether object is empty
 */
export const isEmpty = (obj) => {
  return obj === null || obj === undefined || 
         (typeof obj === 'object' && Object.keys(obj).length === 0) ||
         (typeof obj === 'string' && obj.trim().length === 0) ||
         (Array.isArray(obj) && obj.length === 0);
};

/**
 * Convert camelCase to snake_case
 * @param {string} str - String to convert
 * @returns {string} snake_case string
 */
export const camelToSnake = (str) => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

/**
 * Convert snake_case to camelCase
 * @param {string} str - String to convert
 * @returns {string} camelCase string
 */
export const snakeToCamel = (str) => {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
};

/**
 * Generate random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
export const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Generate random float between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random float
 */
export const randomFloat = (min, max) => {
  return Math.random() * (max - min) + min;
};

/**
 * Clamp a number between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Check if code is running in development environment
 * @returns {boolean} Whether in development
 */
export const isDevelopment = () => {
  return process.env.NODE_ENV === 'development';
};

/**
 * Check if code is running in production environment
 * @returns {boolean} Whether in production
 */
export const isProduction = () => {
  return process.env.NODE_ENV === 'production';
};

/**
 * Safe JSON parse that returns null on error
 * @param {string} str - JSON string to parse
 * @returns {any|null} Parsed object or null
 */
export const safeJsonParse = (str) => {
  try {
    return JSON.parse(str);
  } catch (error) {
    return null;
  }
};

/**
 * Safe JSON stringify that returns empty string on error
 * @param {any} obj - Object to stringify
 * @returns {string} JSON string or empty string
 */
export const safeJsonStringify = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    return '';
  }
};