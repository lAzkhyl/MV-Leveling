import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import { OWNER_ID } from '../config.js';
import { db } from '../database/index.js';
import { getUserRank } from '../database/queries.js';
// Impor fungsi notifikasi DAN fungsi kalkulator XP dari Level
import { checkAndNotify, getXpFromLevel } from '../core/leveling.js';

// --- Kueri Admin ---
const adminSetMvLevelQuery = db.prepare(
    'UPDATE user_levels SET mv_xp = ?, mv_level = ? WHERE user_id = ? AND guild_id = ?'
);
const adminSetFriendsLevelQuery = db.prepare(
    'UPDATE user_levels SET friends_xp = ?, friends_level = ? WHERE user_id = ? AND guild_id = ?'
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
        .setName('setlvl')
        .setDescription('[Admin] Mengatur level user secara paksa.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User target.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('type')
                .setDescription('Tipe Level (MV atau Friends).')
                .setRequired(true)
                .addChoices(
                    { name: 'MV (Most Valuable)', value: 'mv' },
                    { name: 'Friends (Sosial)', value: 'friends' }
                ))
        .addIntegerOption(option => 
            option.setName('level')
                .setDescription('Level baru yang dituju.')
                .setRequired(true)),

    // 2. Logika Eksekusi
    /**
     * @param {import('discord.js').Interaction} interaction
     */
    async execute(interaction) {
        // Cek Keamanan
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
        const newLevel = interaction.options.getInteger('level');
        const guildId = interaction.guild.id;

        try {
            // 1. Ambil data lama
            const oldData = getUserRank(targetUser.id, guildId);

            // 2. Hitung XP baru dari level
            const newXp = getXpFromLevel(newLevel);

            // 3. Jalankan update
            if (type === 'mv') {
                adminSetMvLevelQuery.run(newXp, newLevel, targetUser.id, guildId);
            } else {
                adminSetFriendsLevelQuery.run(newXp, newLevel, targetUser.id, guildId);
            }

            // 4. Picu notifikasi (jika naik level)
            const oldLevel = (type === 'mv') ? oldData.mv_level : oldData.friends_level;
            await checkAndNotify(interaction.client, guildId, targetUser.id, type, oldLevel, newLevel);
            
            await interaction.editReply(`Berhasil mengatur **${targetUser.displayName}** ke **Level ${newLevel}** (${type}) dengan **${newXp} XP**.`);

        } catch (error) {
            console.error('Error executing /setlvl:', error);
            await interaction.editReply('Terjadi error saat mengatur level.');
        }
    },
};