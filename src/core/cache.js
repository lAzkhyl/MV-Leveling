import fs from 'fs';
import path from 'path';
import { db } from '../database/index.js';
import { WAL_PATH } from './recovery.js';
import { ROLES_MV, ROLES_FRIENDS } from '../config.js';

// === CACHE GLOBAL (PILAR 2) ===
// Ini adalah "bendungan" kita.
// Map<key, { mv: delta, friends: delta }>
// 'key' adalah string: `${guildId}-${userId}`
const dirtyXPCache = new Map();

// Kunci untuk 'key' di Map
const getKey = (guildId, userId) => `${guildId}-${userId}`;

/**
 * Pintu masuk utama untuk menambahkan XP ke cache.
 * Dipanggil oleh processXPQueue (Pilar 3).
 * @param {string} guildId
 * @param {string} userId
 * @param {'mv' | 'friends'} type
 * @param {number} amount
 */
export function addDirtyXP(guildId, userId, type, amount) {
    if (amount === 0) return;

    const key = getKey(guildId, userId);

    // 1. Perbarui Cache di Memori (Sangat Cepat)
    const entry = dirtyXPCache.get(key) || { mv: 0, friends: 0 };
    if (type === 'mv') {
        entry.mv += amount;
    } else {
        entry.friends += amount;
    }
    dirtyXPCache.set(key, entry);

    // 2. Tulis ke "Lite" WAL (Jaring Pengaman Pilar 2)
    const logEntry = {
        ts: Date.now(),
        guildId,
        userId,
        type,
        amount
    };

    try {
        // Kita gunakan 'appendFileSync'. Ini "blocking", tapi 'append'
        // sangat cepat sehingga dampaknya minimal.
        fs.appendFileSync(WAL_PATH, JSON.stringify(logEntry) + '\n');
    } catch (error) {
        console.error('CRITICAL: Failed to write to WAL!', error);
    }
}

// === FUNGSI FLUSH CACHE (PILAR 2) ===

// Siapkan kueri UPSERT (Update/Insert) yang cerdas
const upsertQuery = db.prepare(`
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
        
        -- Hitung level baru secara otomatis di dalam DB!
        mv_level = calculate_level(user_levels.mv_xp + @mvXpDelta),
        friends_level = calculate_level(user_levels.friends_xp + @friendsXpDelta)
    
    -- Mengembalikan data LAMA dan BARU agar kita bisa cek level-up
    RETURNING 
        user_id, guild_id, mv_level AS new_mv_level, friends_level AS new_friends_level, 
        (SELECT mv_level FROM user_levels WHERE user_id = @userId AND guild_id = @guildId) AS old_mv_level,
        (SELECT friends_level FROM user_levels WHERE user_id = @userId AND guild_id = @guildId) AS old_friends_level;
`);

/**
 * Fungsi ini dipanggil oleh setInterval di ready.js.
 * Tugasnya adalah mengambil data dari cache dan menyimpannya ke DB SQLite.
 * @param {import('discord.js').Client} client
 */
export function flushCacheToDB(client) {
    // Jika tidak ada yang perlu di-flush, kembali
    if (dirtyXPCache.size === 0) {
        return;
    }

    // 1. Salin cache saat ini secara atomik dan bersihkan yang asli
    const cacheToFlush = new Map(dirtyXPCache);
    dirtyXPCache.clear();

    console.log(`[Cache Flush] Flushing ${cacheToFlush.size} user updates to database...`);

    // 2. Ubah Map menjadi array dan jalankan sebagai satu transaksi DB
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

                // --- LOGIKA LEVEL UP (BARU!) ---
                if (result) {
                    // Cek Level Up untuk 'MV'
                    checkAndAssignRoles(
                        client, 
                        result.guildId, 
                        result.userId, 
                        'mv', 
                        result.old_mv_level, 
                        result.new_mv_level
                    );
                    // Cek Level Up untuk 'Friends'
                    checkAndAssignRoles(
                        client, 
                        result.guildId, 
                        result.userId, 
                        'friends', 
                        result.old_friends_level, 
                        result.new_friends_level
                    );
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
 * @param {import('discord.js').Client} client
 */
async function checkAndAssignRoles(client, guildId, userId, type, oldLevel, newLevel) {
    // Pastikan user benar-benar naik level
    if (newLevel <= oldLevel) return; 

    const roleConfig = (type === 'mv') ? ROLES_MV : ROLES_FRIENDS;
    if (!roleConfig || Object.keys(roleConfig).length === 0) return; // Tidak ada role di config

    console.log(`[Level Up Check] User ${userId} ${type}: ${oldLevel} -> ${newLevel}`);

    try {
        // Ambil guild dan member dari cache/fetch
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);

        for (const levelThreshold in roleConfig) {
            // Jika user melewati threshold level ini
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
        // Tangani error jika member keluar server atau bot tidak punya izin
        console.error(`Failed to assign level-up role to ${userId} in ${guildId}:`, error.message);
    }
}