import { voiceStateCache } from '../core/voiceState.js';

/**
 * Handler ini berjalan SETIAP KALI user:
 * - Bergabung ke VC
 * - Meninggalkan VC
 * - Pindah VC
 * - Mute / Unmute (oleh diri sendiri atau server)
 * - Deaf / Undeaf (oleh diri sendiri atau server)
 * @param {import('discord.js').VoiceState} oldState
 * @param {import('discord.js').VoiceState} newState
 */
export default function onVoiceStateUpdate(oldState, newState) {
    try {
        const userId = newState.id;
        
        if (newState.channelId) {
            // User BERADA di channel (bergabung, pindah, atau update status)
            // Kita simpan/update status mereka
            voiceStateCache.set(userId, {
                guildId: newState.guild.id,
                channelId: newState.channelId,
                // Pertahankan 'joinedAt' jika sudah ada (saat mute/deaf)
                // atau setel waktu baru jika baru bergabung
                joinedAt: voiceStateCache.get(userId)?.joinedAt || Date.now(),
                selfMute: newState.selfMute,
                selfDeaf: newState.selfDeaf
            });
        } else {
            // User MENINGGALKAN channel
            // Hapus mereka dari cache
            voiceStateCache.delete(userId);
        }
    } catch (error) {
        console.error('Error in voiceStateUpdate handler:', error);
    }
}