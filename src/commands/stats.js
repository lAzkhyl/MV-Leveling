import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } from 'discord.js';
import { OWNER_ID } from '../config.js';
import { dirtyXPCache } from '../core/cache.js'; // Impor cache RAM
import fs from 'fs';
import path from 'path';

// --- Helper Keamanan ---
const isAdmin = (interaction) => {
    if (interaction.user.id === OWNER_ID) return true;
    if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    return false;
};

export default {
    // 1. Definisi Perintah
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('[Admin] Menampilkan statistik bot (cache, volume).')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addStringOption(option =>
            option.setName('target')
                .setDescription('Statistik spesifik yang ingin dilihat.')
                .setRequired(false)
                .addChoices(
                    { name: 'Cache (RAM)', value: 'cache' },
                    { name: 'Volume (Disk)', value: 'volume' }
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

        const target = interaction.options.getString('target');
        const embed = new EmbedBuilder().setTitle('📊 Statistik Bot').setColor('#FFFF00'); // Kuning

        try {
            if (target === 'cache') {
                embed.setDescription(`Ada **${dirtyXPCache.size}** update user yang saat ini ada di cache RAM, menunggu untuk di-flush.`);
            } else if (target === 'volume') {
                const dbPath = path.resolve(process.cwd(), 'data', 'leveling.db');
                const dbStats = fs.statSync(dbPath);
                embed.setDescription(`Ukuran file database: **${(dbStats.size / 1024 / 1024).toFixed(2)} MB**.`);
            } else {
                // Tampilan default (gabungan)
                const dbPath = path.resolve(process.cwd(), 'data', 'leveling.db');
                const dbStats = fs.statSync(dbPath);

                embed.addFields(
                    { name: 'Cache (RAM)', value: `**${dirtyXPCache.size}** user menunggu di *cache*.`, inline: true },
                    { name: 'Volume (Disk)', value: `**${(dbStats.size / 1024 / 1024).toFixed(2)} MB** terpakai.`, inline: true },
                    { name: 'Bot Uptime', value: `${Math.floor(process.uptime() / 3600)} jam`, inline: true }
                );
            }
        } catch (e) {
            if (e.code === 'ENOENT') {
                embed.setDescription('Tidak dapat membaca statistik volume. (File DB belum dibuat?)');
            } else {
                console.error('Error executing /stats:', e);
                embed.setDescription('Terjadi error saat mengambil statistik.');
            }
        }
        
        await interaction.editReply({ embeds: [embed] });
    },
};