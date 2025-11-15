import { db } from '../database/index.js';
// Impor yang dibutuhkan untuk notifikasi & role
import { ROLES_MV, ROLES_FRIENDS, LEVEL_UP_CHANNEL_ID } from '../config.js';

// --- FORMULA LEVELING ---
export const XP_TO_LEVEL_MULTIPLIER = 0.1;

export function calculateLevel(xp) {
    if (xp <= 0) return 0;
    return Math.floor(XP_TO_LEVEL_MULTIPLIER * Math.sqrt(xp));
}

export function getXpForLevel(level) {
    if (level <= 0) return 0;
    return Math.ceil(((level + 1) / XP_TO_LEVEL_MULTIPLIER) ** 2);
}

// --- FUNGSI BARU UNTUK MENGHITUNG XP DARI LEVEL ---
// Ini dibutuhkan untuk /setlvl
export function getXpFromLevel(level) {
    if (level <= 0) return 0;
    // (level / 0.1)^2
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

// --- LOGIKA NOTIFIKASI & ROLE (PINDAHAN DARI CACHE.JS) ---
/**
 * Fungsi ini sekarang dipanggil oleh cache.js DAN perintah admin
 * @param {import('discord.js').Client} client
 */
export async function checkAndNotify(client, guildId, userId, type, oldLevel, newLevel) {
    // 1. Pastikan user benar-benar naik level
    if (newLevel <= oldLevel) return; 

    console.log(`[Level Up Check] User ${userId} ${type}: ${oldLevel} -> ${newLevel}`);

    const roleConfig = (type === 'mv') ? ROLES_MV : ROLES_FRIENDS;
    const roleMap = (type === 'mv') ? "MV" : "Friends"; // Nama untuk notifikasi
    let member;
    let guild;

    // 2. Coba ambil data Guild dan Member
    try {
        guild = await client.guilds.fetch(guildId);
        member = await guild.members.fetch(userId);
    } catch (error) {
        // Gagal (member mungkin sudah keluar server)
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