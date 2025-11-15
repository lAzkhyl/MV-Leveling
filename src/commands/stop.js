import { SlashCommandBuilder, PermissionsBitField, MessageFlags } from 'discord.js';
import { OWNER_ID } from '../config.js';
// Impor fungsi flushCacheToDB dari cache.js
import { flushCacheToDB } from '../core/cache.js';

// --- Helper Keamanan ---
const isAdmin = (interaction) => {
    if (interaction.user.id === OWNER_ID) return true;
    if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    return false;
};

export default {
    // 1. Definisi Perintah
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('[Admin] Menghentikan sistem leveling (XP tidak akan dihitung).')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    // 2. Logika Eksekusi
    /**
     * @param {import('discord.js').Interaction} interaction
     */
    async execute(interaction) {
        if (!isAdmin(interaction)) {
            await interaction.reply({ 
                content: 'Hanya Administrator atau Pemilik Bot yang dapat menggunakan perintah ini.', 
                flags: [MessageFlags.Ephemeral] 
            });
            return;
        }

        // 1. Matikan saklar global
        global.isLevelingActive = false;
        
        console.log(`[Admin] Sistem leveling DIMATIKAN oleh ${interaction.user.tag}`);
        await interaction.reply({ 
            content: 'Sistem Leveling DIHENTIKAN. Menjalankan *flush* terakhir untuk menyimpan data...', 
            flags: [MessageFlags.Ephemeral] 
        });

        try {
            // 2. Jalankan flush terakhir untuk membersihkan cache
            await flushCacheToDB(interaction.client);
            
            await interaction.followUp({ 
                content: '🛑 **Sistem Leveling telah DIMATIKAN.** Bot tidak akan menghitung XP. *Cache* telah disimpan dengan aman.', 
                flags: [MessageFlags.Ephemeral] 
            });
        } catch (error) {
            console.error('Error executing /stop flush:', error);
            await interaction.followUp({ 
                content: 'Sistem leveling dimatikan, tetapi terjadi error saat *flush* cache terakhir.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }
    },
};