import { db } from '../database/index.js';
import { 
    ROLES_MV, 
    ROLES_FRIENDS, 
    LEVEL_UP_CHANNEL_ID,
    MV_BASE_ROLE_ID,       // <-- Impor baru
    FRIENDS_BASE_ROLE_ID   // <-- Impor baru
} from '../config.js';

// --- FORMULA LEVELING (Tetap Sama) ---
export const XP_TO_LEVEL_MULTIPLIER = 0.1;

export function calculateLevel(xp) {
    if (xp <= 0) return 0;
    return Math.floor(XP_TO_LEVEL_MULTIPLIER * Math.sqrt(xp));
}

export function getXpForLevel(level) {
    if (level < 0) return 0;
    const nextLevel = level + 1;
    return Math.ceil((nextLevel / XP_TO_LEVEL_MULTIPLIER) ** 2);
}

export function getXpFromLevel(level) {
    if (level <= 0) return 0;
    return Math.ceil((level / XP_TO_LEVEL_MULTIPLIER) ** 2);
}

// --- REGISTRASI FUNGSI DB (Tetap Sama) ---
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

// --- LOGIKA NOTIFIKASI & ROLE (DI-UPGRADE) ---
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

    // --- LOGIKA ROLE REPLACEMENT (BARU!) ---
    if (roleConfig && Object.keys(roleConfig).length > 0) {
        let newRoleToAdd = null;
        let rolesToRemove = [];

        for (const levelThreshold in roleConfig) {
            const roleId = roleConfig[levelThreshold];
            
            // Apakah ini role yang baru saja dicapai?
            if (newLevel >= levelThreshold && oldLevel < levelThreshold) {
                newRoleToAdd = roleId;
            } 
            // Apakah ini role lama yang harus dihapus?
            else if (newLevel >= levelThreshold) {
                // Kumpulkan semua role yang levelnya di bawah level baru
                rolesToRemove.push(roleId);
            }
        }

        try {
            // 1. Tambahkan role baru (jika ada)
            if (newRoleToAdd) {
                // Pastikan role baru tidak ada di daftar hapus (jika ada bug)
                rolesToRemove = rolesToRemove.filter(id => id !== newRoleToAdd);
                
                const role = guild.roles.cache.get(newRoleToAdd);
                if (role) {
                    await member.roles.add(role);
                    console.log(`[Level Up] Menambahkan role ${role.name} ke ${member.user.tag}.`);
                } else {
                     console.warn(`[Level Up] Role ID ${newRoleToAdd} tidak ditemukan.`);
                }
            }

            // 2. Hapus semua role lama (jika ada)
            if (rolesToRemove.length > 0) {
                // Saring lagi untuk memastikan kita TIDAK menghapus role base
                const rolesToActuallyRemove = rolesToRemove.filter(id => 
                    id !== MV_BASE_ROLE_ID && id !== FRIENDS_BASE_ROLE_ID
                );

                if (rolesToActuallyRemove.length > 0) {
                    await member.roles.remove(rolesToActuallyRemove);
                    console.log(`[Level Up] Menghapus ${rolesToActuallyRemove.length} role lama dari ${member.user.tag}.`);
                }
            }

        } catch (roleError) {
            console.warn(`[Level Up] Gagal mengubah role untuk ${member.user.tag}. (Missing Permissions?)`);
        }
    }
    // --- AKHIR LOGIKA ROLE REPLACEMENT ---

    // 4. LOGIKA NOTIFIKASI NAIK LEVEL (Tetap Sama)
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