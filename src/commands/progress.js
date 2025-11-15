import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUserRank } from '../database/queries.js';

// Fungsi helper untuk membuat progress bar teks
function createProgressBar(current, total, barLength = 10) {
    if (total === 0) return `[${' '.repeat(barLength)}] 0%`;
    const percent = current / total;
    const progress = Math.round(barLength * percent);
    const empty = barLength - progress;
    
    const bar = `[${'#'.repeat(progress)}${'.'.repeat(empty)}]`;
    return `${bar} ${Math.floor(percent * 100)}%`;
}

export default {
    // 1. Definisi Perintah
    data: new SlashCommandBuilder()
        .setName('progress')
        .setDescription('Menampilkan progres XP kamu (atau user lain) menuju level berikutnya.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User yang ingin kamu lihat progres-nya.')
                .setRequired(false)),

    // 2. Logika Eksekusi
    /**
     * @param {import('discord.js').Interaction} interaction
     */
    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;

        // Ambil data rank dari database (ini sudah berisi semua yang kita butuh)
        const data = getUserRank(targetUser.id, guildId);

        if (!data) {
            await interaction.editReply('Terjadi error saat mengambil data.');
            return;
        }

        // Hitung XP yang dibutuhkan untuk level saat ini
        const mvXpStart = data.mv_level === 0 ? 0 : data.mv_xp_next / ((data.mv_level + 1) / data.mv_level)**2; // Estimasi XP awal level
        const friendsXpStart = data.friends_level === 0 ? 0 : data.friends_xp_next / ((data.friends_level + 1) / data.friends_level)**2; // Estimasi XP awal level
        
        // Hitung progres level ini
        const mvProgress = data.mv_xp - mvXpStart;
        const mvNeeded = data.mv_xp_next - mvXpStart;
        
        const friendsProgress = data.friends_xp - friendsXpStart;
        const friendsNeeded = data.friends_xp_next - friendsXpStart;

        const embed = new EmbedBuilder()
            .setColor('#3498DB') // Blue color
            .setAuthor({ 
                name: targetUser.displayName, 
                iconURL: targetUser.displayAvatarURL() 
            })
            .setTitle(`Progres Leveling`)
            .setDescription(`Progres menuju level berikutnya untuk <@${targetUser.id}>`)
            .addFields(
                { 
                    name: `🏆 Progres MV (Level ${data.mv_level} → ${data.mv_level + 1})`, 
                    value: `**${mvProgress} / ${mvNeeded} XP**\n${createProgressBar(mvProgress, mvNeeded)}`,
                    inline: false 
                },
                { 
                    name: `🤝 Progres Friends (Level ${data.friends_level} → ${data.friends_level + 1})`, 
                    value: `**${friendsProgress} / ${friendsNeeded} XP**\n${createProgressBar(friendsProgress, friendsNeeded)}`,
                    inline: false 
                }
            )
            .setTimestamp()
            .setFooter({ text: 'MV Leveling System' });
        
        await interaction.editReply({ embeds: [embed] });
    },
};