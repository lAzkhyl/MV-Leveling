import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getLeaderboard } from '../database/queries.js';

export default {
    // 1. Definisi Perintah
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Menampilkan Top 10 leaderboard.')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Tipe leaderboard yang ingin dilihat (default: Keduanya).')
                .setRequired(false)
                .addChoices(
                    { name: 'MV (Most Valuable)', value: 'mv' },
                    { name: 'Friends (Sosial)', value: 'friends' }
                )),

    // 2. Logika Eksekusi
    /**
     * @param {import('discord.js').Interaction} interaction
     */
    async execute(interaction) {
        await interaction.deferReply();

        const type = interaction.options.getString('type');
        const guildId = interaction.guild.id;

        const embed = new EmbedBuilder()
            .setColor('#FFD700') // Gold color
            .setTitle(`🏆 Leaderboard Top 10`)
            .setTimestamp()
            .setFooter({ text: 'MV Leveling System' });

        try {
            // Skenario 1: Tampilkan Leaderboard MV
            if (type === 'mv') {
                const mvData = getLeaderboard(guildId, 'mv');
                const mvDescription = formatLeaderboard(mvData, interaction.client);
                embed.setDescription('**Leaderboard Peringkat MV (Most Valuable)**\n' + mvDescription);
            } 
            // Skenario 2: Tampilkan Leaderboard Friends
            else if (type === 'friends') {
                const friendsData = getLeaderboard(guildId, 'friends');
                const friendsDescription = formatLeaderboard(friendsData, interaction.client);
                embed.setDescription('**Leaderboard Peringkat Friends (Sosial)**\n' + friendsDescription);
            } 
            // Skenario 3: Tampilkan Keduanya (Default)
            else {
                const mvData = getLeaderboard(guildId, 'mv');
                const friendsData = getLeaderboard(guildId, 'friends');
                
                const mvDescription = formatLeaderboard(mvData, interaction.client);
                const friendsDescription = formatLeaderboard(friendsData, interaction.client);

                embed.addFields(
                    { name: '🏆 MV (Most Valuable)', value: mvDescription, inline: true },
                    { name: '🤝 Friends (Sosial)', value: friendsDescription, inline: true }
                );
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error executing leaderboard:', error);
            await interaction.editReply('Terjadi error saat mengambil leaderboard.');
        }
    },
};

/**
 * Fungsi helper untuk memformat data leaderboard menjadi string.
 * @param {Array<object>} data - Data dari getLeaderboard()
 * @param {import('discord.js').Client} client - Discord client
 * @returns {string} String yang sudah diformat
 */
function formatLeaderboard(data, client) {
    if (!data || data.length === 0) {
        return '*(Belum ada data)*';
    }

    const medals = ['🥇', '🥈', '🥉'];

    return data.map((row, index) => {
        const medal = medals[index] || `\`#${index + 1}\``;
        // Coba ambil user dari cache. Jika tidak ada, tampilkan ID.
        const user = client.users.cache.get(row.user_id);
        const userName = user ? user.displayName : `(ID: ${row.user_id})`;
        
        return `${medal} **${userName}**\n    *Level ${row.level}* (*${row.xp} XP*)`;
    }).join('\n\n');
}