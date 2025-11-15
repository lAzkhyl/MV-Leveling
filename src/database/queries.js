import { db } from './index.js';
import { getXpForLevel } from '../core/leveling.js';

// 1. Deklarasikan variabel, JANGAN siapkan di sini.
let getUserDataQuery;
let getUserRankQuery;
let leaderboardQueries = {};

// Fungsi helper untuk membuat kueri leaderboard (Ini aman, karena tidak langsung dijalankan)
const getLeaderboardQuery = (type) => {
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

// 2. Siapkan SEMUA kueri di dalam fungsi ini
// Fungsi ini akan dipanggil oleh index.js SETELAH tabel dibuat.
export function prepareQueryStatements() {
    
    // PINDAHKAN DARI ATAS KE SINI:
    getUserDataQuery = db.prepare(`
        SELECT * FROM user_levels
        WHERE user_id = @userId AND guild_id = @guildId
    `);

    // PINDAHKAN DARI ATAS KE SINI:
    getUserRankQuery = db.prepare(`
        SELECT 
            (SELECT COUNT(*) FROM user_levels t2 WHERE t2.guild_id = t1.guild_id AND t2.mv_xp > t1.mv_xp) + 1 AS mv_rank,
            (SELECT COUNT(*) FROM user_levels t2 WHERE t2.guild_id = t1.guild_id AND t2.friends_xp > t1.friends_xp) + 1 AS friends_rank
        FROM user_levels t1
        WHERE t1.user_id = @userId AND t1.guild_id = @guildId
    `);
    
    // Kueri leaderboard (ini sudah benar)
    leaderboardQueries.mv = getLeaderboardQuery('mv');
    leaderboardQueries.friends = getLeaderboardQuery('friends');
}

/**
 * 3. Sisa file (getUserRank dan getLeaderboard)
 * Tidak perlu diubah sama sekali.
 */
export function getUserRank(userId, guildId) {
    try {
        // 1. Ambil data XP/Level
        let user = getUserDataQuery.get({ userId, guildId });

        // 2. Jika user tidak ada, kembalikan data default
        if (!user) {
            return {
                userId, guildId,
                mv_xp: 0, mv_level: 0, mv_rank: 'N/A',
                friends_xp: 0, friends_level: 0, friends_rank: 'N/A',
                mv_xp_next: getXpForLevel(0),
                friends_xp_next: getXpForLevel(0),
            };
        }

        // 3. Jika user ada, ambil data Rank mereka
        const ranks = getUserRankQuery.get({ userId, guildId });

        // 4. Gabungkan data
        user.mv_rank = ranks.mv_rank;
        user.friends_rank = ranks.friends_rank;
        
        // 5. Hitung XP untuk level berikutnya
        user.mv_xp_next = getXpForLevel(user.mv_level);
        user.friends_xp_next = getXpForLevel(user.friends_level);

        return user;

    } catch (error) {
        console.error('Failed to get user rank:', error);
        return null;
    }
}

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