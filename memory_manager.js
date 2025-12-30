const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'users_data');
const GROUPS_DATA_DIR = path.join(__dirname, 'groups_data');

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(GROUPS_DATA_DIR)) {
    fs.mkdirSync(GROUPS_DATA_DIR);
}

/**
 * Loads user memory from JSON file.
 * @param {string|number} userId 
 * @returns {object} User memory object or default structure if new.
 */
function loadUserMemory(userId) {
    const filePath = path.join(DATA_DIR, `${userId}.json`);
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading memory for user ${userId}: `, error);
            // Backup corrupt file
            fs.renameSync(filePath, filePath + '.bak');
        }
    }

    // Default memory structure
    return {
        id: userId,
        username: null,
        language: 'ru', // Default to Russian as requested
        facts: {}, // Key-value pairs of learned facts
        history: [], // Last 10-15 messages
        last_interaction: Date.now()
    };
}

/**
 * Saves user memory to JSON file.
 * @param {string|number} userId 
 * @param {object} data 
 */
function saveUserMemory(userId, data) {
    const filePath = path.join(DATA_DIR, `${userId}.json`);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Error saving memory for user ${userId}: `, error);
    }
}

/**
 * Updates specific fields in user memory.
 * @param {string|number} userId 
 * @param {object} updates Object containing fields to update
 */
function updateMemory(userId, updates) {
    const memory = loadUserMemory(userId);
    const updatedMemory = { ...memory, ...updates };
    saveUserMemory(userId, updatedMemory);
    return updatedMemory;
}

/**
 * Adds a message to the conversation history.
 * Keeps only the last limit messages.
 * @param {string|number} userId 
 * @param {object} message { role: 'user'|'assistant', content: string }
 * @param {number} limit Max history size
 */
function addToHistory(userId, message, limit = 15) {
    const memory = loadUserMemory(userId);
    memory.history.push({
        ...message,
        timestamp: Date.now()
    });


    if (memory.history.length > limit) {
        memory.history = memory.history.slice(-limit);
    }

    saveUserMemory(userId, memory);
}

/**
 * Finds a user's memory by their username.
 * @param {string} username Username without @
 * @returns {object|null} User memory or null if not found
 */
function findUserByUsername(username) {
    const cleanUsername = username.replace('@', '').toLowerCase();
    const files = fs.readdirSync(DATA_DIR);

    for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = path.join(DATA_DIR, file);
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (data.username && data.username.toLowerCase() === cleanUsername) {
                return data;
            }
        } catch (e) {
            console.error(`Error reading ${file} during search: `, e);
        }
    }
    return null;
}

/**
 * Loads group data from JSON file.
 * @param {string|number} chatId 
 * @returns {object} Group data object
 */
function loadGroupData(chatId) {
    const filePath = path.join(GROUPS_DATA_DIR, `${chatId}.json`);
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading group data for ${chatId}: `, error);
        }
    }

    // Default group structure
    return {
        id: chatId,
        title: 'Unknown Group',
        members_count: 0,
        recent_messages: [], // Store last ~50 messages for summary
        added_at: Date.now()
    };
}

/**
 * Saves group data.
 * @param {string|number} chatId 
 * @param {object} data 
 */
function saveGroupData(chatId, data) {
    const filePath = path.join(GROUPS_DATA_DIR, `${chatId}.json`);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Error saving group data for ${chatId}: `, error);
    }
}

/**
 * Returns list of all tracked groups.
 * @returns {Array<object>} List of group data objects
 */
function getAllGroups() {
    const files = fs.readdirSync(GROUPS_DATA_DIR);
    const groups = [];

    for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = path.join(GROUPS_DATA_DIR, file);
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            groups.push(data);
        } catch (e) {
            console.error(`Error reading group file ${file}: `, e);
        }
    }
    return groups;
}

/**
 * Adds a message to group history.
 * @param {string|number} chatId 
 * @param {object} message { sender: string, content: string }
 * @param {number} limit 
 */
function addGroupMessage(chatId, message, limit = 50) {
    const data = loadGroupData(chatId);
    data.recent_messages.push({
        ...message,
        timestamp: Date.now()
    });

    if (data.recent_messages.length > limit) {
        data.recent_messages = data.recent_messages.slice(-limit);
    }
    saveGroupData(chatId, data);
}

module.exports = {
    loadUserMemory,
    saveUserMemory,
    updateMemory,
    addToHistory,
    findUserByUsername,
    loadGroupData,
    saveGroupData,
    getAllGroups,
    addGroupMessage
};
