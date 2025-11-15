import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

// Tentukan path ke folder 'data'
// --- PERBAIKAN DI SINI ---
// Kita akan menunjuk ke root /data, tempat Volume ter-mount
const dataDir = '/data'; 

// Pastikan folder 'data' ada (Railway Volume otomatis membuatnya, tapi ini aman)
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Tentukan path lengkap ke file database SQLite
const dbPath = path.resolve(dataDir, 'leveling.db');

// Inisialisasi koneksi database
const db = new Database(dbPath);

// === SKEMA TABEL (PILAR 1) ===
const createTableQuery = `
CREATE TABLE IF NOT EXISTS user_levels (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    mv_xp BIGINT DEFAULT 0,
    mv_level INT DEFAULT 0,
    friends_xp BIGINT DEFAULT 0,
    friends_level INT DEFAULT 0,
    PRIMARY KEY (user_id, guild_id)
);
`;

// === INDEKS LEADERBOARD (PILAR 1) ===
const createMvIndexQuery = `
CREATE INDEX IF NOT EXISTS idx_mv_leaderboard
ON user_levels (guild_id, mv_xp DESC);
`;

const createFriendsIndexQuery = `
CREATE INDEX IF NOT EXISTS idx_friends_leaderboard
ON user_levels (guild_id, friends_xp DESC);
`;

/**
 * Menjalankan skema database dan membuat tabel/indeks.
 */
function initializeDatabase() {
    try {
        db.transaction(() => {
            db.prepare(createTableQuery).run();
            db.prepare(createMvIndexQuery).run();
            db.prepare(createFriendsIndexQuery).run();
        })();
        console.log('Database initialized successfully (tables & indexes created).');
    } catch (error) {
        console.error('Failed to initialize database:', error);
    }
}

// Ekspor
export { db, initializeDatabase };