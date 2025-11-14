import { db } from './index.js';
import { getXpForLevel } from '../core/leveling.js';

// 1. Deklarasikan variabel kueri di sini (bukan const ... = db.prepare())
let getUserRankQuery;
let leaderboardQueries = {};

// Fungsi helper untuk membuat kueri leaderboard
const getLeaderboardQuery = (type) => {
    // Ini aman karena 'type' dikontrol secara internal
    const xpCol = type === 'mv' ? 'mv_xp' : 'friends_xp';
    const levelCol = type === 'mv' ? 'mv_level' : 'friends_level';

    return db.prepare(`
        SELECT
            user_id,
            ${xpCol} AS xp,
            ${levelCol} AS level
        FROM user_levels
        WHERE guild_id = @guildId AND ${xpCol} > 0
        ORDER BY ${xpCol} DESC
        LIMIT 10
    `);
};

// 2. Buat fungsi 'prepare' yang akan dipanggil oleh index.js
export function prepareQueryStatements() {
    getUserRankQuery = db.prepare(`
        WITH RankedUsers AS (
            -- Pertama, kita beri peringkat semua user di server berdasarkan XP
            SELECT 
                user_id,
                mv_xp,
                mv_level,
                friends_xp,
                friends_level,
                -- Fungsi window 'RANK()' memberi kita peringkat
                RANK() OVER (PARTITION BY guild_id ORDER BY mv_xp DESC) as mv_rank,
                RANK() OVER (PARTITION BY guild_id ORDER BY friends_xp DESC) as friends_rank
            FROM user_levels
            WHERE guild_id = @guildId
        )
        -- Sekarang, pilih user spesifik yang kita cari
        SELECT *
        FROM RankedUsers
        WHERE user_id = @userId
    `);
    
    // Siapkan kedua jenis kueri leaderboard
    leaderboardQueries.mv = getLeaderboardQuery('mv');
    leaderboardQueries.friends = getLeaderboardQuery('friends');
}

/**
 * Mengambil data rank untuk satu user di satu server.
 */
export function getUserRank(userId, guildId) {
    try {
        // Ambil data dari DB
        const user = getUserRankQuery.get({ userId, guildId });

        if (!user) {
            // User belum ada di DB
            return {
                userId,
                guildId,
                mv_xp: 0,
                mv_level: 0,
                mv_rank: 'N/A',
                friends_xp: 0,
                friends_level: 0,
                friends_rank: 'N/A',
                mv_xp_next: getXpForLevel(0),
                friends_xp_next: getXpForLevel(0),
            };
        }

        // Hitung XP yang dibutuhkan untuk level berikutnya
        user.mv_xp_next = getXpForLevel(user.mv_level);
        user.friends_xp_next = getXpForLevel(user.friends_level);

        return user;

    } catch (error) {
        console.error('Failed to get user rank:', error);
        return null;
    }
}

/**
 * Mengambil data leaderboard (Top 10).
 */
export function getLeaderboard(guildId, type = 'mv') {
    try {
        const query = (type === 'mv') ? leaderboardQueries.mv : leaderboardQueries.friends;
        const results = query.all({ guildId });
        return results;

    } catch (error) {
        console.error(`Failed to get ${type} leaderboard:`, error);
        return [];
    }
}