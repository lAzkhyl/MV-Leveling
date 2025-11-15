import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
// Impor konfigurasi role kita
import { ROLES_MV, ROLES_FRIENDS } from '../config.js';

/**
 * Fungsi helper untuk mengubah objek ROLES_MV menjadi string
 * @param {object} roleConfig - Objek ROLES_MV atau ROLES_FRIENDS
 * @returns {string} String yang sudah diformat
 */
function formatLevelInfo(roleConfig) {
    if (!roleConfig || Object.keys(roleConfig).length === 0) {
        return '*(Tidak ada role reward yang diatur)*';
    }

    // Sortir level dari terendah ke tertinggi
    const sortedLevels = Object.keys(roleConfig).sort((a, b) => parseInt(a) - parseInt(b));

    return sortedLevels.map(level => {
        const roleId = roleConfig[level];
        return `**Level ${level}:** <@&${roleId}>`;
    }).join('\n');
}

export default {
    // 1. Definisi Perintah
    data: new SlashCommandBuilder()
        .setName('levelinfo')
        .setDescription('Menampilkan daftar hadiah role untuk setiap level.')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Tipe role yang ingin dilihat (default: Keduanya).')
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

        const embed = new EmbedBuilder()
            .setColor('#1ABC9C') // Turquoise color
            .setTitle(`🎁 Hadiah Level-Up`)
            .setTimestamp()
            .setFooter({ text: 'MV Leveling System' });

        // Skenario 1: Tampilkan Info MV
        if (type === 'mv') {
            const mvInfo = formatLevelInfo(ROLES_MV);
            embed.setDescription('**Hadiah Role untuk MV (Most Valuable)**\n\n' + mvInfo);
        }
        // Skenario 2: Tampilkan Info Friends
        else if (type === 'friends') {
            const friendsInfo = formatLevelInfo(ROLES_FRIENDS);
            embed.setDescription('**Hadiah Role untuk Friends (Sosial)**\n\n' + friendsInfo);
        }
        // Skenario 3: Tampilkan Keduanya (Default)
        else {
            const mvInfo = formatLevelInfo(ROLES_MV);
            const friendsInfo = formatLevelInfo(ROLES_FRIENDS);

            embed.addFields(
                { name: '🏆 Hadiah MV', value: mvInfo, inline: true },
                { name: '🤝 Hadiah Friends', value: friendsInfo, inline: true }
            );
        }

        await interaction.editReply({ embeds: [embed] });
    },
};