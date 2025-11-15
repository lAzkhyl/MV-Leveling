import { Client, Collection } from 'discord.js'; // <-- Impor 'Collection'
import fs from 'fs'; // <-- Impor 'fs' (File System)
import path from 'path'; // <-- Impor 'path'
import { fileURLToPath } from 'url'; // <-- Impor 'url'

import { TOKEN, INTENTS } from './config.js';
import { initializeDatabase } from './database/index.js';

// Impor fungsi 'prepare'
import { prepareCacheStatement } from './core/cache.js';
import { prepareRecoveryStatement } from './core/recovery.js';
import { prepareQueryStatements } from './database/queries.js';

// Impor handler
import onReady from './handlers/ready.js';
import onMessageCreate from './handlers/messageCreate.js'; // Ini tetap untuk XP
import onVoiceStateUpdate from './handlers/voiceStateUpdate.js';
import onInteractionCreate from './handlers/interactionCreate.js'; // <-- HANDLER BARU

// Impor 'recover' dan 'shutdown'
import { recoverFromWAL, setupGracefulShutdown } from './core/recovery.js';

global.isLevelingActive = true;

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
        await import('./core/leveling.js'); // Mengajarkan 'calculate_level'

        // 3. Siapkan Kueri (PERSIAPKAN STATEMENT)
        console.log('Preparing database statements...');
        prepareCacheStatement();
        prepareRecoveryStatement();
        prepareQueryStatements();
        console.log('Statements prepared.');

        // 4. Pulihkan dari WAL
        console.log('Running WAL recovery check...');
        await recoverFromWAL();
        console.log('Recovery check complete.');
        
        // 5. Inisialisasi Discord Client
        const client = new Client({ intents: INTENTS });

        // --- 6. MEMUAT SLASH COMMANDS (BARU!) ---
        client.commands = new Collection();
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        
        const commandsPath = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            // Gunakan import dinamis karena kita pakai ES Modules
            const command = (await import(filePath)).default; 

            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`Loaded command: /${command.data.name}`);
            } else {
                console.warn(`[WARNING] Command di ${filePath} tidak valid (kurang 'data' or 'execute').`);
            }
        }
        
        // --- 7. Daftarkan Handler ---
        client.once('clientReady', () => onReady(client));
        client.on('messageCreate', (message) => onMessageCreate(message));
        client.on('voiceStateUpdate', (oldState, newState) => onVoiceStateUpdate(oldState, newState));
        client.on('interactionCreate', (interaction) => onInteractionCreate(interaction)); // <-- HANDLER BARU
        
        // 8. Setup Graceful Shutdown
        setupGracefulShutdown();
        
        // 9. Login
        console.log('Logging in to Discord...');
        await client.login(TOKEN);

    } catch (error) {
        console.error('Fatal error during bot startup:', error);
        process.exit(1);
    }
}



// Jalankan fungsi utama
startBot();