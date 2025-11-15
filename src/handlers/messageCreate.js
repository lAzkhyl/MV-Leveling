import {
    XP_SETTINGS,
    IGNORED_TEXT_CHANNELS
} from '../config.js';
import { xpJobQueue } from '../core/queue.js';

// Cooldown global untuk user (Pilar 4)
const cooldowns = new Map();

export default async function onMessageCreate(message) {
    try {
        // --- PENGECEKAN SAKLAR (BARU!) ---
        if (!global.isLevelingActive) return;
        // --- AKHIR PENGECEKAN SAKLAR ---

        if (message.author.bot || !message.guild) {
            return;
        }
        
        // 2. Cek channel yang diabaikan
        if (IGNORED_TEXT_CHANNELS.has(message.channel.id)) {
            return;
        }

        // 3. Cek Cooldown
        const now = Date.now();
        const lastMessageTime = cooldowns.get(message.author.id);
        
        if (lastMessageTime) {
            const timePassed = now - lastMessageTime;
            if (timePassed < XP_SETTINGS.textCooldown) {
                return; // Masih cooldown
            }
        }
        cooldowns.set(message.author.id, now);

        // 4. Lolos: Masukkan ke antrian XP
        xpJobQueue.push({
            type: 'text',
            guildId: message.guild.id,
            userId: message.author.id,
            messageContent: message.content
        });

    } catch (error) {
        console.error('Error in messageCreate handler:', error);
    }
}
// --- SEMUA LOGIKA handleLevelCommand() SUDAH DIHAPUS ---