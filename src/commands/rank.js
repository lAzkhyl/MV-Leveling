import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUserRank } from '../database/queries.js';

export default {
    // 1. Definisi Perintah
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Menampilkan rank dan XP kamu (atau user lain).')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User yang ingin kamu lihat rank-nya.')
                .setRequired(false)),

    // 2. Logika Eksekusi
    /**
     * @param {import('discord.js').Interaction} interaction
     */
    async execute(interaction) {
        // Tampilkan pesan "Bot is thinking..."
        await interaction.deferReply();

        // Tentukan user target:
        // - Jika ada @Tag, gunakan user itu.
        // - Jika tidak, gunakan user yang menjalankan perintah.
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;

        // Ambil data rank dari database
        const data = getUserRank(targetUser.id, guildId);

        if (!data) {
            await interaction.editReply('Terjadi error saat mengambil data.');
            return;
        }

        // Buat Embed (tampilan)
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setAuthor({ 
                name: targetUser.displayName, 
                iconURL: targetUser.displayAvatarURL() 
            })
            .setTitle(`Leveling Stats`)
            .setDescription(`Statistik untuk <@${targetUser.id}>`)
            .addFields(
                { 
                    name: `🏆 MV (Most Valuable)`, 
                    value: `**Level:** ${data.mv_level}\n**XP:** ${data.mv_xp} / ${data.mv_xp_next}\n**Rank:** #${data.mv_rank}`,
                    inline: true 
                },
                { 
                    name: `🤝 Friends (Sosial)`, 
                    value: `**Level:** ${data.friends_level}\n**XP:** ${data.friends_xp} / ${data.friends_xp_next}\n**Rank:** #${data.friends_rank}`,
                    inline: true 
                }
            )
            .setTimestamp()
            .setFooter({ text: 'MV Leveling System' });
        
        // Kirim balasan embed
        await interaction.editReply({ embeds: [embed] });
    },
};