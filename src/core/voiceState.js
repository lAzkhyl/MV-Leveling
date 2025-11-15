import { 
    XP_SETTINGS, 
    IGNORED_VOICE_CHANNELS,
    MV_BASE_ROLE_ID,
    FRIENDS_BASE_ROLE_ID
} from '../config.js';
import { xpJobQueue } from './queue.js';

export const voiceStateCache = new Map();

/**
 * Fungsi ini sekarang mengecek role base user
 * sebelum memberikan XP Voice.
 * @param {import('discord.js').Client} client
 */
export async function grantVoiceXP(client) { // <-- Fungsi diubah menjadi async
    if (!global.isLevelingActive) return;
    
    // Iterasi cache state LOKAL kita
    for (const [userId, state] of voiceStateCache.entries()) {
        try {
            // --- 1. Ambil Objek Guild & Channel ---
            const guild = client.guilds.cache.get(state.guildId);
            if (!guild) {
                voiceStateCache.delete(userId); 
                continue;
            }
            const channel = guild.channels.cache.get(state.channelId);
            if (!channel) {
                voiceStateCache.delete(userId);
                continue;
            }

            // --- 2. Ambil Objek Member (BARU!) ---
            // Kita perlu 'member' untuk mengecek role
            let member;
            try {
                member = await guild.members.fetch(userId);
            } catch (e) {
                // User mungkin sudah keluar server
                voiceStateCache.delete(userId);
                continue;
            }

            // --- 3. Terapkan Logika Anti-Abuse (Sama seperti sebelumnya) ---
            if (state.selfDeaf) continue; // 0 XP
            if (state.channelId === guild.afkChannelId) continue; // 0 XP
            if (IGNORED_VOICE_CHANNELS.has(state.channelId)) continue; // 0 XP
            if (channel.members.size < 2) continue; // 0 XP

            // --- 4. Tentukan XP & Role (Logika Baru) ---
            const { full, mutedModifier } = XP_SETTINGS.voiceXp;
            let xpSystem = null;
            let baseAmount = 0;

            // Cek role user
            if (member.roles.cache.has(MV_BASE_ROLE_ID)) {
                xpSystem = 'mv';
                baseAmount = full.mv;
            } else if (member.roles.cache.has(FRIENDS_BASE_ROLE_ID)) {
                xpSystem = 'friends';
                baseAmount = full.friends;
            }

            // Jika user tidak punya role base, hentikan
            if (!xpSystem) continue;

            // Terapkan modifier Mute
            const finalAmount = state.selfMute 
                ? Math.floor(baseAmount * mutedModifier) 
                : baseAmount;

            // --- 5. Masukkan ke Antrian (Pilar 3) ---
            if (finalAmount > 0) {
                xpJobQueue.push({
                    type: 'voice',
                    guildId: state.guildId,
                    userId: userId,
                    amount: finalAmount,
                    xpSystem: xpSystem // 'mv' or 'friends'
                });
            }

        } catch (error) {
            console.error(`Failed to process voice XP for user ${userId}:`, error);
        }
    }
}