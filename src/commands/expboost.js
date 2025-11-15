import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    // 1. Definisi Perintah
    data: new SlashCommandBuilder()
        .setName('expboost')
        .setDescription('Melihat status XP boost (server atau pribadi).')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User yang ingin kamu lihat status boost-nya.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('target')
                .setDescription('Lihat boost server.')
                .setRequired(false)
                .addChoices(
                    { name: 'Server', value: 'server' }
                )),

    // 2. Logika Eksekusi
    /**
     * @param {import('discord.js').Interaction} interaction
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // LOGIKA INI HANYA PLACEHOLDER
        // Nanti kamu bisa menambahkan logika sebenarnya di sini
        
        const embed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setTitle('Fitur XP Boost')
            .setDescription('Fitur ini sedang dalam pengembangan dan belum diaktifkan.')
            .setTimestamp()
            .setFooter({ text: 'MV Leveling System' });
        
        await interaction.editReply({ embeds: [embed] });
    },
};