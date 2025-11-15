import { SlashCommandBuilder, PermissionsBitField, MessageFlags } from 'discord.js';
import { OWNER_ID } from '../config.js';
import { db } from '../database/index.js';

// --- Kueri Admin ---
const adminResetUserQuery = db.prepare(
    'DELETE FROM user_levels WHERE user_id = ? AND guild_id = ?'
);

// --- Helper Keamanan ---
const isAdmin = (interaction) => {
    if (interaction.user.id === OWNER_ID) return true;
    if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    return false;
};

export default {
    // 1. Definisi Perintah
    data: new SlashCommandBuilder()
        .setName('reset')
        .setDescription('[Admin] Mer-reset SEMUA data (XP & Level) seorang user.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User yang akan di-reset.')
                .setRequired(true)),

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

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const targetUser = interaction.options.getUser('user');
        
        try {
            adminResetUserQuery.run(targetUser.id, interaction.guild.id);
            await interaction.editReply(`Berhasil me-reset **semua data** leveling untuk **${targetUser.displayName}**.`);
        } catch (error) {
            console.error('Error executing /reset:', error);
            await interaction.editReply('Terjadi error saat me-reset data.');
        }
    },
};