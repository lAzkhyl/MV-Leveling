import { SlashCommandBuilder, PermissionsBitField, MessageFlags } from 'discord.js';
import { OWNER_ID } from '../config.js';
import { db } from '../database/index.js';

// --- Kueri Admin ---
const adminResetMvQuery = db.prepare(
    'UPDATE user_levels SET mv_xp = 0, mv_level = 0 WHERE user_id = ? AND guild_id = ?'
);
const adminResetFriendsQuery = db.prepare(
    'UPDATE user_levels SET friends_xp = 0, friends_level = 0 WHERE user_id = ? AND guild_id = ?'
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
        .setName('resetlvl')
        .setDescription('[Admin] Mer-reset Level (dan XP) user untuk 1 sistem.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User yang akan di-reset.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('type')
                .setDescription('Sistem level (MV atau Friends) yang akan di-reset.')
                .setRequired(true)
                .addChoices(
                    { name: 'MV (Most Valuable)', value: 'mv' },
                    { name: 'Friends (Sosial)', value: 'friends' }
                )),

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
        const type = interaction.options.getString('type');
        
        try {
            if (type === 'mv') {
                adminResetMvQuery.run(targetUser.id, interaction.guild.id);
            } else {
                adminResetFriendsQuery.run(targetUser.id, interaction.guild.id);
            }
            
            await interaction.editReply(`Berhasil me-reset data **${type}** untuk **${targetUser.displayName}**.`);
        } catch (error) {
            console.error('Error executing /resetlvl:', error);
            await interaction.editReply('Terjadi error saat me-reset data.');
        }
    },
};