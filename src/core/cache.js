import fs from 'fs';
import path from 'path';
import { db } from '../database/index.js';
import { WAL_PATH } from './recovery.js';
import { checkAndNotify } from './leveling.js'; 

export const dirtyXPCache = new Map(); // Diekspor untuk /admin stats
const getKey = (guildId, userId) => `${guildId}-${userId}`;
let upsertQuery;

export function addDirtyXP(guildId, userId, type, amount) {
    if (amount === 0) return;
    const key = getKey(guildId, userId);
    const entry = dirtyXPCache.get(key) || { mv: 0, friends: 0 };
    if (type === 'mv') {
        entry.mv += amount;
    } else {
        entry.friends += amount;
    }
    dirtyXPCache.set(key, entry);

    const logEntry = { ts: Date.now(), guildId, userId, type, amount };
    try {
        fs.appendFileSync(WAL_PATH, JSON.stringify(logEntry) + '\n');
    } catch (error) {
        console.error('CRITICAL: Failed to write to WAL!', error);
    }
}

export function prepareCacheStatement() {
    // --- PERBAIKAN BUG DIMULAI (RETURNING) ---
    upsertQuery = db.prepare(`
        INSERT INTO user_levels (
            user_id, guild_id, 
            mv_xp, mv_level, 
            friends_xp, friends_level
        )
        VALUES (
            @userId, @guildId, 
            @mvXpDelta, calculate_level(@mvXpDelta), 
            @friendsXpDelta, calculate_level(@friendsXpDelta)
        )
        ON CONFLICT (user_id, guild_id) DO UPDATE SET
            mv_xp = user_levels.mv_xp + @mvXpDelta,
            friends_xp = user_levels.friends_xp + @friendsXpDelta,
            mv_level = calculate_level(user_levels.mv_xp + @mvXpDelta),
            friends_level = calculate_level(user_levels.friends_xp + @friendsXpDelta)
        RETURNING 
            user_id, guild_id, 
            mv_level AS new_mv_level, 
            friends_level AS new_friends_level,
            -- Trik SQLite: Ambil nilai LAMA *sebelum* klausa UPDATE dijalankan
            (SELECT mv_level FROM user_levels WHERE user_id = @userId AND guild_id = @guildId) AS old_mv_level,
            (SELECT friends_level FROM user_levels WHERE user_id = @userId AND guild_id = @guildId) AS old_friends_level;
    `);
    // --- PERBAIKAN BUG SELESAI ---
}

export async function flushCacheToDB(client) {
    if (dirtyXPCache.size === 0) return;
    
    const cacheToFlush = new Map(dirtyXPCache);
    dirtyXPCache.clear();
    console.log(`[Cache Flush] Flushing ${cacheToFlush.size} user updates to database...`);

    let levelUpEvents = []; 

    try {
        const transaction = db.transaction((entries) => {
            let events = [];
            for (const [key, deltas] of entries) {
                const [guildId, userId] = key.split('-');
                const result = upsertQuery.get({
                    userId: userId, 
                    guildId: guildId, 
                    mvXpDelta: deltas.mv, 
                    friendsXpDelta: deltas.friends
                });
                
                if (result) {
                    events.push(result);
                }
            }
            return events; 
        });

        levelUpEvents = transaction(cacheToFlush.entries());

        fs.truncateSync(WAL_PATH, 0); 
        console.log(`[Cache Flush] Successfully flushed ${cacheToFlush.size} updates. WAL cleared.`);

    } catch (error) {
        console.error('CRITICAL: Failed to flush cache to DB!', error);
        console.log('[Cache Flush] Re-merging failed data back into cache...');
        for (const [key, deltas] of cacheToFlush.entries()) {
            const existing = dirtyXPCache.get(key) || { mv: 0, friends: 0 };
            existing.mv += deltas.mv;
            existing.friends += deltas.friends;
            dirtyXPCache.set(key, existing);
        }
        return; 
    }

    if (levelUpEvents.length > 0) {
        console.log(`[Cache Flush] Processing ${levelUpEvents.length} level-up events...`);
        for (const event of levelUpEvents) {
            await checkAndNotify(client, event.guildId, event.userId, 'mv', event.old_mv_level, event.new_mv_level);
            await checkAndNotify(client, event.guildId, event.userId, 'friends', event.old_friends_level, event.new_friends_level);
        }
    }
}