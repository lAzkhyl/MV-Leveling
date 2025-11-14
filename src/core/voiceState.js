import { XP_SETTINGS, IGNORED_VOICE_CHANNELS } from '../config.js';
import { xpJobQueue } from './queue.js'; // Impor antrian

// === CACHE STATUS SUARA GLOBAL (PILAR 4) ===
// Ini adalah "state" kita. Map<userId, UserVoiceState>
// Diisi oleh handler voiceStateUpdate.js [cite: 166]
export const voiceStateCache = new Map();

/**
 * Fungsi ini dipanggil oleh setInterval di ready.js.
 * Tugasnya adalah mengiterasi state cache LOKAL kita
 * dan memberikan XP jika valid.
 * @param {import('discord.js').Client} client
 */
export function grantVoiceXP(client) {
    // Iterasi cache state LOKAL kita. Ini SANGAT CEPAT[cite: 187].
    for (const [userId, state] of voiceStateCache.entries()) {
        try {
            // --- 1. Ambil Objek (Cepat, dari cache Discord.js) ---
            const guild = client.guilds.cache.get(state.guildId);
            if (!guild) {
                voiceStateCache.delete(userId); // Bersihkan (bot keluar dari guild?)
                continue;
            }
            const channel = guild.channels.cache.get(state.channelId);
            if (!channel) {
                voiceStateCache.delete(userId); // Bersihkan (channel dihapus?)
                continue;
            }

            // --- 2. Terapkan Logika Anti-Abuse (Pilar 4) ---
            
            const { full, mutedModifier, type } = XP_SETTINGS.voiceXp;
            let xpAmount = 0;

            // Aturan 1: Cek Deaf (0 XP)
            if (state.selfDeaf) {
                xpAmount = 0;
            // Aturan 2: Cek Mute (1/3 XP) - Sesuai permintaanmu
            } else if (state.selfMute) {
                xpAmount = Math.floor(full * mutedModifier);
            // Aturan 3: Aktif (XP Penuh)
            } else {
                xpAmount = full;
            }

            // Aturan 4: Cek Channel AFK Server (0 XP) [cite: 192]
            if (state.channelId === guild.afkChannelId) {
                xpAmount = 0;
            }

            // Aturan 5: Cek Channel AFK Kustom (0 XP) - Dari config
            if (IGNORED_VOICE_CHANNELS.has(state.channelId)) {
                xpAmount = 0;
            }

            // Aturan 6: Cek Sendirian (0 XP) [cite: 194]
            // (Hanya beri XP jika ada > 1 orang)
            if (channel.members.size < 2) {
                xpAmount = 0;
            }
            
            // --- 3. Masukkan ke Antrian (Pilar 3) ---
            // Jika setelah semua cek masih ada XP, masukkan ke antrian [cite: 195]
            if (xpAmount > 0) {
                xpJobQueue.push({
                    type: 'voice',
                    guildId: state.guildId,
                    userId: userId,
                    amount: xpAmount,
                    xpSystem: type // Misal: 'friends'
                });
            }

        } catch (error) {
            console.error(`Failed to process voice XP for user ${userId}:`, error);
        }
    }
}