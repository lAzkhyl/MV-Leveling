import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    // 1. Definisi Perintah
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Menampilkan daftar semua perintah bot yang tersedia.'),

    // 2. Logika Eksekusi
    /**
     * @param {import('discord.js').Interaction} interaction
     */
    async execute(interaction) {
        await interaction.deferReply();

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('Bantuan Perintah MV Leveling')
            .setDescription('Berikut adalah daftar perintah yang bisa kamu gunakan:')
            .addFields(
                { 
                    name: 'Perintah Publik', 
                    value: 
`**/rank [@Tag]**
Menampilkan kartu rank kamu atau user lain.

**/leaderboard [MV / Friend]**
Menampilkan Top 10 server (bisa difilter).

**/progress [@Tag]**
Menampilkan progres XP kamu menuju level berikutnya.

**/levelinfo [MV / Friend]**
Menampilkan daftar semua hadiah role berdasarkan level.

**/expboost**
Melihat status XP boost kamu (jika ada).

**/help**
Menampilkan pesan bantuan ini.`
                },
                {
                    name: 'Perintah Admin',
                    value: 'Perintah admin (seperti `/givexp`, `/setlvl`, `/reset`, `/adminflush`, dll.) hanya bisa dilihat dan digunakan oleh Administrator.'
                }
            )
            .setTimestamp()
            .setFooter({ text: 'MV Leveling System' });
        
        await interaction.editReply({ embeds: [embed] });
    },
};