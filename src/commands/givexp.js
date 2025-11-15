import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import { OWNER_ID } from '../config.js';
import { db } from '../database/index.js';
import { getUserRank } from '../database/queries.js';
import { checkAndNotify } from '../core/leveling.js';

// --- Kueri Admin ---
// Kita siapkan kueri ini di sini, spesifik untuk perintah ini
const adminGiveXpQuery = db.prepare(
    'UPDATE user_levels SET mv_xp = mv_xp + ?, friends_xp = friends_xp + ? WHERE user_id = ? AND guild_id = ?'
);

// --- Helper Keamanan ---
const isAdmin = (interaction) => {
    if (interaction.user.id === OWNER_ID) return true;
    if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    return false;
};

export default {
    // 1. Definisi Perintah (diambil dari deploy-commands.js)
    data: new SlashCommandBuilder()
        .setName('givexp')
        .setDescription('[Admin] Memberi (atau mengurangi) XP ke user.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User target.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('type')
                .setDescription('Tipe XP (MV atau Friends).')
                .setRequired(true)
                .addChoices(
                    { name: 'MV (Most Valuable)', value: 'mv' },
                    { name: 'Friends (Sosial)', value: 'friends' }
                ))
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Jumlah XP (bisa negatif untuk mengurangi).')
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
                flags: [MessageFlags.Ephemeral] // Perbaikan 'ephemeral'
            });
            return;
        }

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }); // Balasan admin bersifat pribadi

        const targetUser = interaction.options.getUser('user');
        const type = interaction.options.getString('type');
        const amount = interaction.options.getInteger('amount');
        const guildId = interaction.guild.id;

        try {
            // 1. Ambil data lama (untuk notifikasi)
            const oldData = getUserRank(targetUser.id, guildId);
            
            // 2. Jalankan update
            const mvAmount = (type === 'mv') ? amount : 0;
            const friendsAmount = (type === 'friends') ? amount : 0;
            adminGiveXpQuery.run(mvAmount, friendsAmount, targetUser.id, guildId);

            // 3. Ambil data baru
            const newData = getUserRank(targetUser.id, guildId);

            // 4. Picu notifikasi (jika naik level)
            await checkAndNotify(interaction.client, guildId, targetUser.id, 'mv', oldData.mv_level, newData.mv_level);
            await checkAndNotify(interaction.client, guildId, targetUser.id, 'friends', oldData.friends_level, newData.friends_level);

            await interaction.editReply(`Berhasil memberikan **${amount} XP** (${type}) kepada **${targetUser.displayName}**. Level baru mereka: ${newData[type + '_level']}.`);
        
        } catch (error) {
            console.error('Error executing /givexp:', error);
            await interaction.editReply('Terjadi error saat memberikan XP.');
        }
    },
};