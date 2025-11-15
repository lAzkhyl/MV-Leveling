import { db } from '../database/index.js';
import { ROLES_MV, ROLES_FRIENDS, LEVEL_UP_CHANNEL_ID } from '../config.js';

// --- FORMULA LEVELING ---
export const XP_TO_LEVEL_MULTIPLIER = 0.1;

export function calculateLevel(xp) {
    if (xp <= 0) return 0;
    return Math.floor(XP_TO_LEVEL_MULTIPLIER * Math.sqrt(xp));
}

/**
 * Menghitung XP yang dibutuhkan untuk level BERIKUTNYA.
 * @param {number} level Level SAAT INI
 * @returns {number} Total XP yang dibutuhkan untuk level (level + 1)
 */
export function getXpForLevel(level) {
    // --- PERBAIKAN BUG DIMULAI ---
    // if (level <= 0) return 0; // <-- INI BUG-NYA
    if (level < 0) return 0; // Level negatif tidak valid
    // --- PERBAIKAN BUG SELESAI ---

    const nextLevel = level + 1;
    // (nextLevel / 0.1)^2
    return Math.ceil((nextLevel / XP_TO_LEVEL_MULTIPLIER) ** 2);
}

// Fungsi untuk /setlvl
export function getXpFromLevel(level) {
    if (level <= 0) return 0;
    return Math.ceil((level / XP_TO_LEVEL_MULTIPLIER) ** 2);
}

// --- REGISTRASI FUNGSI DB (PILAR 5) ---
try {
    db.function('calculate_level', {
        deterministic: true,
        varargs: false,
    }, (xp) => {
        if (xp <= 0) return 0;
        xp = Number(xp || 0);
        return Math.floor(XP_TO_LEVEL_MULTIPLIER * Math.sqrt(xp));
    });
    console.log('Registered custom SQL function "calculate_level".');
} catch (error) {
    console.error("Failed to register custom SQL function:", error);
}

// --- LOGIKA NOTIFIKASI & ROLE ---
export async function checkAndNotify(client, guildId, userId, type, oldLevel, newLevel) {
    if (newLevel <= oldLevel) return; 
    console.log(`[Level Up Check] User ${userId} ${type}: ${oldLevel} -> ${newLevel}`);

    const roleConfig = (type === 'mv') ? ROLES_MV : ROLES_FRIENDS;
    const roleMap = (type === 'mv') ? "MV" : "Friends";
    let member;
    let guild;

    try {
        guild = await client.guilds.fetch(guildId);
        member = await guild.members.fetch(userId);
    } catch (error) {
        console.error(`[Level Up] Gagal fetch member ${userId} di ${guildId}.`, error.message);
        return;
    }

    // 3. Logika Pemberian Role
    if (roleConfig && Object.keys(roleConfig).length > 0) {
        for (const levelThreshold in roleConfig) {
            if (newLevel >= levelThreshold && oldLevel < levelThreshold) {
                const roleId = roleConfig[levelThreshold];
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    try {
                        await member.roles.add(role);
                        console.log(`[Level Up] Assigned role ${role.name} to ${member.user.tag}.`);
                    } catch (roleError) {
                        console.warn(`[Level Up] Gagal memberi role ${role.name} ke ${member.user.tag}. (Missing Permissions?)`);
                    }
                } else {
                    console.warn(`[Level Up] Role ID ${roleId} tidak ditemukan di guild ${guild.name}.`);
                }
            }
        }
    }

    // 4. LOGIKA NOTIFIKASI NAIK LEVEL
    if (LEVEL_UP_CHANNEL_ID) {
        try {
            const channel = await guild.channels.fetch(LEVEL_UP_CHANNEL_ID);
            if (channel && channel.isTextBased()) {
                await channel.send(`🎉 **Selamat, ${member.displayName}!** Kamu telah mencapai **Level ${newLevel}** di sistem **${roleMap}**!`);
            }
        } catch (channelError) {
            console.warn(`[Notification] Gagal mengirim pesan level-up ke channel ID ${LEVEL_UP_CHANNEL_ID}.`, channelError.message);
        }
    }
}