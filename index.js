const { Telegraf } = require('telegraf');
require('dotenv').config();
const { loadUserMemory, saveUserMemory, updateMemory, addToHistory, findUserByUsername } = require('./memory_manager');
const { generateResponse } = require('./bot_logic');

if (!process.env.BOT_TOKEN) {
    console.error('Error: BOT_TOKEN is missing in .env');
    process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// Middleware to log incoming messages
bot.use(async (ctx, next) => {
    // Basic permissions check or logging can go here
    await next();
});

bot.start((ctx) => {
    ctx.reply('Привет! Я твой новый цифровой друг. Будем знакомы?');
    // Ensure memory is initialized
    loadUserMemory(ctx.from.id);
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const userText = ctx.message.text;
    const chatType = ctx.chat.type;

    // In groups, reply only if mentioned or replied to
    if (chatType === 'group' || chatType === 'supergroup') {
        const botUsername = ctx.botInfo.username;
        const isMentioned = userText.includes(`@${botUsername}`);
        const isReply = ctx.message.reply_to_message && ctx.message.reply_to_message.from.id === ctx.botInfo.id;

        if (!isMentioned && !isReply) {
            return; // Ignore
        }
    }

    // Load memory
    const memory = loadUserMemory(userId);

    // Update username if changed or new
    if (ctx.from.username && memory.username !== ctx.from.username) {
        memory.username = ctx.from.username;
        // Immediate save to ensure it's indexable
        saveUserMemory(userId, memory);
    }

    // Check for "Who is @username" query
    let targetMemory = null;
    const whoIsRegex = /(?:кто так\w*|who is|расскажи о)\s+@(\w+)/i;
    const whoIsMatch = userText.match(whoIsRegex);

    if (whoIsMatch) {
        const targetUsername = whoIsMatch[1];
        // Don't search for self
        if (targetUsername.toLowerCase() !== (ctx.from.username || '').toLowerCase()) {
            targetMemory = findUserByUsername(targetUsername);
            if (!targetMemory) {
                // Optional: Tell AI that user was not found, or just let AI hallucinate/say "I don't know".
                // Let's pass a special empty object or just null, but maybe let AI know.
                // For now, we leave targetMemory null, and AI will probably say "I don't know".
            }
        }
    }

    // Send placeholder typing action
    ctx.sendChatAction('typing');

    // Get response from AI
    const rawResponse = await generateResponse(userText, memory, targetMemory);

    // Parse [UPDATE] tags
    let cleanResponse = rawResponse;
    const updateRegex = /\[UPDATE:\s*({.*?})\]/g;
    let match;

    while ((match = updateRegex.exec(rawResponse)) !== null) {
        try {
            const updates = JSON.parse(match[1]);
            // Update facts
            memory.facts = { ...memory.facts, ...updates };
            // Remove tag from response
            cleanResponse = cleanResponse.replace(match[0], '').trim();
            console.log(`Updated memory for user ${userId}:`, updates);
        } catch (e) {
            console.error('Failed to parse memory update:', e);
        }
    }

    // Parse [REMIND] tags
    const remindRegex = /\[REMIND:\s*({.*?})\]/g;
    while ((match = remindRegex.exec(rawResponse)) !== null) {
        try {
            const remindData = JSON.parse(match[1]);
            const minutes = remindData.minutes || 1;
            const text = remindData.text || "Напоминание!";

            // Remove tag from response
            cleanResponse = cleanResponse.replace(match[0], '').trim();

            // Schedule reminder
            setTimeout(() => {
                ctx.reply(`⏰ Напоминание: ${text}`);
            }, minutes * 60 * 1000);

            console.log(`Scheduled reminder for user ${userId} in ${minutes} minutes`);
        } catch (e) {
            console.error('Failed to parse reminder:', e);
        }
    }

    // Update history
    addToHistory(userId, { role: 'user', content: userText });
    addToHistory(userId, { role: 'assistant', content: cleanResponse });

    // Save final state
    saveUserMemory(userId, memory);

    // Send response
    if (cleanResponse) {
        ctx.reply(cleanResponse);
    }
});

bot.launch().then(() => {
    console.log('Digital Friend Bot started!');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
