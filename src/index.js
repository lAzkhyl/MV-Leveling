import { Client } from 'discord.js';
import { TOKEN, INTENTS } from './config.js';
import { initializeDatabase } from './database/index.js';
import { recoverFromWAL, setupGracefulShutdown } from './core/recovery.js';

// Impor handler
import onReady from './handlers/ready.js';
import onMessageCreate from './handlers/messageCreate.js';
import onVoiceStateUpdate from './handlers/voiceStateUpdate.js';

/**
 * Fungsi utama untuk memulai bot
 */
async function startBot() {
    console.log('Starting bot...');

    try {
        // --- PILAR 2 (RECOVERY): Pulihkan dari WAL ---
        console.log('Running WAL recovery check...');
        await recoverFromWAL();
        console.log('Recovery check complete.');

        // --- PILAR 1 & 5: Inisialisasi Database ---
        initializeDatabase();
        
        // --- KRUSIAL: Impor leveling.js ---
        // Ini menjalankan kode registrasi db.function()
        // agar 'calculate_level' dikenal oleh SQLite.
        await import('./core/leveling.js'); 

        // --- INISIALISASI DISCORD CLIENT ---
        const client = new Client({ intents: INTENTS });

        // --- DAFTARKAN HANDLER (PILAR 3 & 4) ---
        client.once('ready', () => onReady(client));
        client.on('messageCreate', (message) => onMessageCreate(message));
        client.on('voiceStateUpdate', (oldState, newState) => onVoiceStateUpdate(oldState, newState));
        
        // --- PILAR 2 (MITIGASI): Setup Graceful Shutdown ---
        setupGracefulShutdown();
        
        // --- LOGIN KE DISCORD ---
        console.log('Logging in to Discord...');
        await client.login(TOKEN);

    } catch (error) {
        console.error('Fatal error during bot startup:', error);
        process.exit(1);
    }
}

// Jalankan fungsi utama
startBot();