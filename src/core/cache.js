import fs from 'fs';
import path from 'path';
import { db } from '../database/index.js';
import { WAL_PATH } from './recovery.js';
import { ROLES_MV, ROLES_FRIENDS } from '../config.js';

// === CACHE GLOBAL (PILAR 2) ===
const dirtyXPCache = new Map();
const getKey = (guildId, userId) => `${guildId}-${userId}`;

/**
 * Pintu masuk utama untuk menambahkan XP ke cache.
 * Dipanggil oleh processXPQueue (Pilar 3).
 */
export function addDirtyXP(guildId, userId, type, amount) {
    if (amount === 0) return;

    const key = getKey(guildId, userId);

    // 1. Perbarui Cache di Memori
    const entry = dirtyXPCache.get(key) || { mv: 0, friends: 0 };
    if (type === 'mv') {
        entry.mv += amount;
    } else {
        entry.friends += amount;
    }
    dirtyXPCache.set(key, entry);

    // 2. Tulis ke "Lite" WAL
    const logEntry = {
        ts: Date.now(),
        guildId,
        userId,
        type,
        amount
    };

    try {
        fs.appendFileSync(WAL_PATH, JSON.stringify(logEntry) + '\n');
    } catch (error) {
        console.error('CRITICAL: Failed to write to WAL!', error);
    }
}

// === FUNGSI FLUSH CACHE (PILAR 2) ===

// 1. Deklarasikan variabel kueri di sini (bukan const ... = db.prepare())
let upsertQuery;

// 2. Buat fungsi 'prepare' yang akan dipanggil oleh index.js
export function prepareCacheStatement() {
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
            user_id, guild_id, mv_level AS new_mv_level, friends_level AS new_friends_level, 
            (SELECT mv_level FROM user_levels WHERE user_id = @userId AND guild_id = @guildId) AS old_mv_level,
            (SELECT friends_level FROM user_levels WHERE user_id = @userId AND guild_id = @guildId) AS old_friends_level;
    `);
}

/**
 * Fungsi ini dipanggil oleh setInterval di ready.js.
 */
export function flushCacheToDB(client) {
    if (dirtyXPCache.size === 0) {
        return;
    }
    const cacheToFlush = new Map(dirtyXPCache);
    dirtyXPCache.clear();

    console.log(`[Cache Flush] Flushing ${cacheToFlush.size} user updates to database...`);
    try {
        const transaction = db.transaction((entries) => {
            for (const [key, deltas] of entries) {
                const [guildId, userId] = key.split('-');
                
                // Jalankan kueri UPSERT cerdas
                const result = upsertQuery.get({
                    userId: userId, 
                    guildId: guildId, 
                    mvXpDelta: deltas.mv, 
                    friendsXpDelta: deltas.friends
                });

                // --- LOGIKA LEVEL UP ---
                if (result) {
                    checkAndAssignRoles(client, result.guildId, result.userId, 'mv', result.old_mv_level, result.new_mv_level);
                    checkAndAssignRoles(client, result.guildId, result.userId, 'friends', result.old_friends_level, result.new_friends_level);
                }
            }
        });

        transaction(cacheToFlush.entries());

        // 3. Setelah DB berhasil di-flush, hapus file WAL
        fs.truncateSync(WAL_PATH, 0); 
        console.log(`[Cache Flush] Successfully flushed ${cacheToFlush.size} updates. WAL cleared.`);

    } catch (error) {
        // Jika flush GAGAL, gabungkan kembali data ke cache utama
        console.error('CRITICAL: Failed to flush cache to DB!', error);
        console.log('[Cache Flush] Re-merging failed data back into cache...');
        for (const [key, deltas] of cacheToFlush.entries()) {
            const existing = dirtyXPCache.get(key) || { mv: 0, friends: 0 };
            existing.mv += deltas.mv;
            existing.friends += deltas.friends;
            dirtyXPCache.set(key, existing);
        }
    }
}

/**
 * Fungsi untuk menangani pemberian role saat level up
 */
async function checkAndAssignRoles(client, guildId, userId, type, oldLevel, newLevel) {
    if (newLevel <= oldLevel) return; 

    const roleConfig = (type === 'mv') ? ROLES_MV : ROLES_FRIENDS;
    if (!roleConfig || Object.keys(roleConfig).length === 0) return;

    console.log(`[Level Up Check] User ${userId} ${type}: ${oldLevel} -> ${newLevel}`);
    try {
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);

        for (const levelThreshold in roleConfig) {
            if (newLevel >= levelThreshold && oldLevel < levelThreshold) {
                const roleId = roleConfig[levelThreshold];
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.add(role);
                    console.log(`[Level Up] Assigned role ${role.name} to ${member.user.tag} for reaching ${type} level ${levelThreshold}.`);
                } else {
                    console.warn(`[Level Up] Role ID ${roleId} not found in guild ${guild.name}.`);
                }
            }
        }
    } catch (error) {
        console.error(`Failed to assign level-up role to ${userId} in ${guildId}:`, error.message);
    }
}