import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

// Tentukan path ke folder 'data'
const dataDir = path.resolve(process.cwd(), 'data');
// Pastikan folder 'data' ada
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Tentukan path lengkap ke file database SQLite
const dbPath = path.resolve(dataDir, 'leveling.db');

// Inisialisasi koneksi database
const db = new Database(dbPath);

// === SKEMA TABEL (PILAR 1) ===
// Skema ini adalah satu tabel datar yang dioptimalkan untuk performa
// Kita menggunakan Kunci Primer Komposit (user_id, guild_id)
const createTableQuery = `
CREATE TABLE IF NOT EXISTS user_levels (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    
    -- Sistem Progresi 'MV'
    mv_xp BIGINT DEFAULT 0,
    mv_level INT DEFAULT 0,
    
    -- Sistem Progresi 'Friends'
    friends_xp BIGINT DEFAULT 0,
    friends_level INT DEFAULT 0,
    
    -- Kunci primer komposit memastikan 1 entri unik per user per guild
    PRIMARY KEY (user_id, guild_id)
);
`;

// === INDEKS LEADERBOARD (PILAR 1) ===
// Indeks ini KRUSIAL untuk membuat kueri leaderboard (!rank, !leaderboard) menjadi cepat
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
        // Bungkus semua dalam satu transaksi agar lebih cepat
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

// Ekspor koneksi 'db' agar bisa digunakan oleh file lain
// dan fungsi 'initializeDatabase' untuk dipanggil oleh index.js
export { db, initializeDatabase };