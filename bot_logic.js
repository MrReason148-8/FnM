const OpenAI = require('openai');
require('dotenv').config();

const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com'
});

/**
 * Generates a system prompt based on user memory.
 * @param {object} memory User memory object
 * @param {object|null} targetMemory Memory of another user (for questions like "Who is @user")
 * @returns {string} System prompt
 */
function generateSystemPrompt(memory, targetMemory = null) {
    let facts = Object.entries(memory.facts)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join('\n');

    if (!facts) facts = "Ничего пока не известно.";

    let targetInfo = "";
    if (targetMemory) {
        let targetFacts = Object.entries(targetMemory.facts)
            .map(([key, value]) => `- ${key}: ${value}`)
            .join('\n');
        if (!targetFacts) targetFacts = "Фактов нет.";
        targetInfo = `
Ты отвечаешь на вопрос о пользователе @${targetMemory.username}.
Вот что ты знаешь о нем:
${targetFacts}
`;
    }

    return `Ты — Digital Friend, близкий друг пользователя.
Твоя задача: поддерживать диалог, быть эмпатичным, веселым и, если уместно, немного саркастичным.
Твой язык: Русский.

О собеседнике ты знаешь следующее:
${facts}
${targetInfo}

Правила:
1. Не будь роботом. Отвечай коротко, живо.
2. Используй память. Если пользователь что-то рассказывал, упоминай это.
3. [ВАЖНО] Если ты узнал новый факт (имя, хобби, планы), добавь в конец: [UPDATE: {"ключ": "значение"}].
4. [ВАЖНО] Если пользователь просит напомнить о чем-то, добавь в конец: [REMIND: {"minutes": X, "text": "напоминание"}].
   Пример: "Окей, напомню." [REMIND: {"minutes": 10, "text": "Выключи чайник!"}]
5. Не используй теги, если нет повода.
`;
}

/**
 * Generates a response from DeepSeek.
 * @param {string} userMessage User's message
 * @param {object} memory User memory object
 * @param {object|null} targetMemory Optional memory of another user
 * @returns {Promise<string>} Bot's response
 */
async function generateResponse(userMessage, memory, targetMemory = null) {
    const systemPrompt = generateSystemPrompt(memory, targetMemory);

    // Create messages array
    // Note: We don't include target user's history here to respect privacy, only facts.
    // We do include current user's history.
    const messages = [
        { role: 'system', content: systemPrompt },
        ...memory.history.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: userMessage }
    ];

    try {
        const completion = await client.chat.completions.create({
            messages: messages,
            model: 'deepseek-chat',
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('DeepSeek API Error:', error);
        return "Что-то мне нехорошо (ошибка API).";
    }
}

module.exports = { generateResponse };
