import { SlashCommandBuilder, PermissionsBitField, MessageFlags } from 'discord.js';
import { OWNER_ID } from '../config.js';

// --- Helper Keamanan ---
const isAdmin = (interaction) => {
    if (interaction.user.id === OWNER_ID) return true;
    if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    return false;
};

export default {
    // 1. Definisi Perintah
    data: new SlashCommandBuilder()
        .setName('start')
        .setDescription('[Admin] Mengaktifkan kembali sistem leveling (XP akan mulai dihitung).')
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

        // Setel saklar global ke true
        global.isLevelingActive = true;
        
        console.log(`[Admin] Sistem leveling DIAKTIFKAN oleh ${interaction.user.tag}`);
        await interaction.reply({ 
            content: '✅ **Sistem Leveling telah DIAKTIFKAN.** Bot akan mulai menghitung XP.',
            flags: [MessageFlags.Ephemeral] 
        });
    },
};