import { XP_SETTINGS, IGNORED_VOICE_CHANNELS } from '../config.js';
import { xpJobQueue } from './queue.js'; // Impor antrian

// === CACHE STATUS SUARA GLOBAL (PILAR 4) ===
export const voiceStateCache = new Map();

/**
 * Fungsi ini dipanggil oleh setInterval di ready.js.
 * @param {import('discord.js').Client} client
 */
export function grantVoiceXP(client) {
    // Iterasi cache state LOKAL kita
    for (const [userId, state] of voiceStateCache.entries()) {
        try {
            // --- 1. Ambil Objek (Cepat, dari cache Discord.js) ---
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

            // --- 2. Terapkan Logika Anti-Abuse (Pilar 4) ---
            
            // Ambil pengaturan XP baru
            const { full, mutedModifier } = XP_SETTINGS.voiceXp;
            
            // Objek untuk menyimpan XP yang akan diberikan
            let xpGains = {
                mv: 0,
                friends: 0
            };

            // Aturan 1: Cek Deaf (0 XP)
            if (state.selfDeaf) {
                xpGains.mv = 0;
                xpGains.friends = 0;
            // Aturan 2: Cek Mute (1/3 XP untuk keduanya)
            } else if (state.selfMute) {
                xpGains.mv = Math.floor(full.mv * mutedModifier);
                xpGains.friends = Math.floor(full.friends * mutedModifier);
            // Aturan 3: Aktif (XP Penuh untuk keduanya)
            } else {
                xpGains.mv = full.mv;
                xpGains.friends = full.friends;
            }

            // Aturan 4: Cek Channel AFK Server (0 XP)
            if (state.channelId === guild.afkChannelId) {
                xpGains.mv = 0;
                xpGains.friends = 0;
            }

            // Aturan 5: Cek Channel AFK Kustom (0 XP)
            if (IGNORED_VOICE_CHANNELS.has(state.channelId)) {
                xpGains.mv = 0;
                xpGains.friends = 0;
            }

            // Aturan 6: Cek Sendirian (0 XP)
            if (channel.members.size < 2) {
                xpGains.mv = 0;
                xpGains.friends = 0;
            }
            
            // --- 3. Masukkan ke Antrian (Pilar 3) ---
            
            // Kirim XP MV jika ada
            if (xpGains.mv > 0) {
                xpJobQueue.push({
                    type: 'voice',
                    guildId: state.guildId,
                    userId: userId,
                    amount: xpGains.mv,
                    xpSystem: 'mv' // Tipe sistem MV
                });
            }
            
            // Kirim XP Friends jika ada
            if (xpGains.friends > 0) {
                xpJobQueue.push({
                    type: 'voice',
                    guildId: state.guildId,
                    userId: userId,
                    amount: xpGains.friends,
                    xpSystem: 'friends' // Tipe sistem Friends
                });
            }

        } catch (error) {
            console.error(`Failed to process voice XP for user ${userId}:`, error);
        }
    }
}