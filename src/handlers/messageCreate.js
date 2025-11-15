import {
    XP_SETTINGS,
    IGNORED_TEXT_CHANNELS,
    MV_BASE_ROLE_ID,
    FRIENDS_BASE_ROLE_ID
} from '../config.js';
import { xpJobQueue } from '../core/queue.js';

const cooldowns = new Map();

/**
 * Handler ini sekarang mendeteksi role base user
 * dan HANYA memberi XP untuk track yang sesuai.
 * @param {import('discord.js').Message} message
 */
export default async function onMessageCreate(message) {
    try {
        if (message.author.bot || !message.guild) {
            return;
        }

        // --- 1. Cek Channel & Cooldown (Tetap sama) ---
        if (IGNORED_TEXT_CHANNELS.has(message.channel.id)) {
            return;
        }
        
        const now = Date.now();
        const lastMessageTime = cooldowns.get(message.author.id);
        
        if (lastMessageTime) {
            const timePassed = now - lastMessageTime;
            if (timePassed < XP_SETTINGS.textCooldown) {
                return; // Masih cooldown
            }
        }
        cooldowns.set(message.author.id, now);

        // --- 2. Deteksi Role & Kirim Job (Logika Baru) ---
        const memberRoles = message.member.roles.cache;
        let xpSystem = null;
        let xpAmount = 0;

        // Cek apakah user ada di jalur MV
        if (memberRoles.has(MV_BASE_ROLE_ID)) {
            xpSystem = 'mv';
            xpAmount = XP_SETTINGS.textXp.mv;
        } 
        // Cek apakah user ada di jalur Friends
        else if (memberRoles.has(FRIENDS_BASE_ROLE_ID)) {
            xpSystem = 'friends';
            xpAmount = XP_SETTINGS.textXp.friends;
        }

        // 3. Masukkan ke Antrian (Jika user punya salah satu role)
        if (xpSystem && xpAmount > 0) {
            xpJobQueue.push({
                type: 'text',
                guildId: message.guild.id,
                userId: message.author.id,
                messageContent: message.content,
                xpSystem: xpSystem, // 'mv' or 'friends'
                amount: xpAmount     // 10 or 5
            });
        }
        // Jika user tidak punya kedua role base, mereka tidak dapat XP Teks

    } catch (error) {
        console.error('Error in messageCreate handler:', error);
    }
}
// --- Logika $level sudah dihapus ---