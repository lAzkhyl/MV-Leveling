import { Client } from 'discord.js';
import { TOKEN, INTENTS } from './config.js';
import { initializeDatabase } from './database/index.js';

// Impor fungsi 'prepare' BARU
import { prepareCacheStatement } from './core/cache.js';
import { prepareRecoveryStatement } from './core/recovery.js';
import { prepareQueryStatements } from './database/queries.js';

// Impor handler (ini aman, karena mereka hanya 'export default function')
import onReady from './handlers/ready.js';
import onMessageCreate from './handlers/messageCreate.js';
import onVoiceStateUpdate from './handlers/voiceStateUpdate.js';

// Impor 'recover' dan 'shutdown'
import { recoverFromWAL, setupGracefulShutdown } from './core/recovery.js';

/**
 * Fungsi utama untuk memulai bot
 */
async function startBot() {
    console.log('Starting bot...');
    try {
        // --- URUTAN SANGAT PENTING ---

        // 1. Inisialisasi Database (BUAT TABEL)
        initializeDatabase();

        // 2. Daftarkan Fungsi SQL Kustom
        // Ini menjalankan kode registrasi db.function()
        await import('./core/leveling.js'); // Mengajarkan 'calculate_level'

        // 3. Siapkan Kueri (PERSIAPKAN STATEMENT)
        // Sekarang aman, karena tabel 'user_levels' sudah ada
        console.log('Preparing database statements...');
        prepareCacheStatement();
        prepareRecoveryStatement();
        prepareQueryStatements();
        console.log('Statements prepared.');

        // 4. Pulihkan dari WAL (Jalankan kueri recovery)
        console.log('Running WAL recovery check...');
        await recoverFromWAL();
        console.log('Recovery check complete.');
        
        // 5. Inisialisasi Discord Client
        const client = new Client({ intents: INTENTS });

        // 6. Daftarkan Handler
        client.once('clientReady', () => onReady(client));
        client.on('messageCreate', (message) => onMessageCreate(message));
        client.on('voiceStateUpdate', (oldState, newState) => onVoiceStateUpdate(oldState, newState));
        
        // 7. Setup Graceful Shutdown
        setupGracefulShutdown();
        
        // 8. Login
        console.log('Logging in to Discord...');
        await client.login(TOKEN);

    } catch (error) {
        console.error('Fatal error during bot startup:', error);
        process.exit(1);
    }
}

// Jalankan fungsi utama
startBot();