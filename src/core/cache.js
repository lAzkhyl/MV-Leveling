import fs from 'fs';
import path from 'path';
import { db } from '../database/index.js';
import { WAL_PATH } from './recovery.js';
// Impor fungsi notifikasi DAN kalkulasi
import { checkAndNotify, calculateLevel } from './leveling.js'; 
// Impor fungsi query yang sudah kita perbaiki
import { getUserRank } from '../database/queries.js';

export const dirtyXPCache = new Map(); // Diekspor untuk /admin stats
const getKey = (guildId, userId) => `${guildId}-${userId}`;
let upsertQuery; // Kueri "bodoh" kita

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

// PERSIAPKAN KUERI "BODOH" (TANPA RETURNING)
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
    `);
}

/**
 * FUNGSI FLUSH YANG DIRANCANG ULANG TOTAL
 */
export async function flushCacheToDB(client) {
    if (dirtyXPCache.size === 0) return;
    
    const cacheToFlush = new Map(dirtyXPCache);
    dirtyXPCache.clear();
    console.log(`[Cache Flush] Flushing ${cacheToFlush.size} user updates to database...`);

    // Array untuk menyimpan data user yang di-flush
    const flushedUsers = [];

    try {
        // --- Bagian 1: Transaksi Database (Sinkron) ---
        const transaction = db.transaction((entries) => {
            for (const [key, deltas] of entries) {
                const [guildId, userId] = key.split('-');
                // Jalankan kueri "bodoh"
                upsertQuery.run({
                    userId: userId, 
                    guildId: guildId, 
                    mvXpDelta: deltas.mv, 
                    friendsXpDelta: deltas.friends
                });
                // Simpan siapa saja yang di-flush
                flushedUsers.push({ guildId, userId, deltas });
            }
        });

        transaction(cacheToFlush.entries());

        // --- Bagian 2: Hapus WAL (Setelah DB sukses) ---
        fs.truncateSync(WAL_PATH, 0); 
        console.log(`[Cache Flush] Successfully flushed ${cacheToFlush.size} updates. WAL cleared.`);

    } catch (error) {
        // ... (Blok 'catch' untuk 're-merging' data tetap sama)
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

    // --- Bagian 3: Pemberian Role & Notifikasi (Asinkron) ---
    // Sekarang kita panggil notifikasi SETELAH transaksi
    if (flushedUsers.length > 0) {
        console.log(`[Cache Flush] Processing ${flushedUsers.length} level-up events...`);
        
        for (const { guildId, userId, deltas } of flushedUsers) {
            // Ambil data BARU dari DB
            const newData = getUserRank(userId, guildId);
            if (!newData) continue;

            // Hitung data LAMA secara manual
            const oldMvXp = newData.mv_xp - deltas.mv;
            const oldFriendsXp = newData.friends_xp - deltas.friends;
            
            const oldMvLevel = calculateLevel(oldMvXp);
            const oldFriendsLevel = calculateLevel(oldFriendsXp);

            // Panggil notifikasi dengan data yang sudah benar
            await checkAndNotify(client, guildId, userId, 'mv', oldMvLevel, newData.mv_level);
            await checkAndNotify(client, guildId, userId, 'friends', oldFriendsLevel, newData.friends_level);
        }
    }
}