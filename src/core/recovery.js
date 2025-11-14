import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { db } from '../database/index.js';
import { flushCacheToDB } from './cache.js';
import './leveling.js'; // <-- PENTING: Impor ini untuk mendaftarkan 'calculate_level'

// Tentukan path ke folder 'data'
const dataDir = path.resolve(process.cwd(), 'data');
// Tentukan path lengkap ke file WAL
export const WAL_PATH = path.resolve(dataDir, 'xp_journal.wal');

// Siapkan kueri UPSERT "CERDAS" (versi yang sudah di-upgrade)
// Ini akan memastikan level juga dihitung ulang saat pemulihan
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
        mv_level = calculate_level(user_levels.mv_xp + @mvXpDelta),
        friends_level = calculate_level(user_levels.friends_xp + @friendsXpDelta)
`);

/**
 * PILAR 2 (RECOVERY): Memulihkan data dari WAL saat startup.
 */
export async function recoverFromWAL() {
    // Pastikan file WAL ada
    if (!fs.existsSync(WAL_PATH) || fs.statSync(WAL_PATH).size === 0) {
        console.log('[Recovery] WAL is empty or not found. No recovery needed.');
        // Pastikan file kosong ada untuk 'append'
        fs.closeSync(fs.openSync(WAL_PATH, 'a'));
        return;
    }

    console.warn('[Recovery] WAL file found! Replaying data from last crash...');
    
    // Map sementara untuk merekonstruksi cache dari WAL
    const recoveryCache = new Map();
    const getKey = (guildId, userId) => `${guildId}-${userId}`;

    const fileStream = fs.createReadStream(WAL_PATH);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let lineCount = 0;
    try {
        // Baca file WAL baris per baris
        for await (const line of rl) {
            if (line.trim() === '') continue;
            
            const logEntry = JSON.parse(line);
            const key = getKey(logEntry.guildId, logEntry.userId);

            const entry = recoveryCache.get(key) || { mv: 0, friends: 0 };
            if (logEntry.type === 'mv') {
                entry.mv += logEntry.amount;
            } else {
                entry.friends += logEntry.amount;
            }
            recoveryCache.set(key, entry);
            lineCount++;
        }

        console.log(`[Recovery] Replayed ${lineCount} log entries, aggregated into ${recoveryCache.size} user updates.`);

        if (recoveryCache.size === 0) {
            fs.truncateSync(WAL_PATH, 0); // Bersihkan file
            return;
        }

        // --- FLUSH DATA PEMULIHAN ---
        console.log('[Recovery] Flushing recovered data directly to database...');
        
        const transaction = db.transaction((entries) => {
            for (const [key, deltas] of entries) {
                const [guildId, userId] = key.split('-');
                // Jalankan kueri dengan parameter bernama
                upsertQuery.run({
                    userId: userId,
                    guildId: guildId,
                    mvXpDelta: deltas.mv,
                    friendsXpDelta: deltas.friends
                });
            }
        });

        transaction(recoveryCache.entries());

        // Setelah DB berhasil, baru kita hapus WAL
        fs.truncateSync(WAL_PATH, 0);
        console.log('[Recovery] Database synchronized from WAL successfully. WAL cleared.');

    } catch (error) {
        console.error('CRITICAL: Failed to recover from WAL!', error);
        console.error('[Recovery] WAL file will NOT be deleted for inspection.');
    }
}

/**
 * PILAR 2 (MITIGASI): Menyiapkan "Graceful Shutdown".
 */
export function setupGracefulShutdown() {
    process.on('SIGTERM', () => {
        console.warn('SIGTERM received! Performing graceful shutdown...');
        
        // Panggil flush terakhir kali secara sinkron
        console.log('Flushing cache to database one last time...');
        flushCacheToDB(); 
        
        console.log('Flush complete. Shutting down.');
        
        // Keluar dengan bersih
        process.exit(0);
    });
}