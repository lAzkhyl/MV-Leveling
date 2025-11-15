import { SlashCommandBuilder, PermissionsBitField, MessageFlags } from 'discord.js';
import { OWNER_ID } from '../config.js';
// Impor fungsi flushCacheToDB dari cache.js
import { flushCacheToDB } from '../core/cache.js';

// --- Helper Keamanan ---
const isAdmin = (interaction) => {
    if (interaction.user.id === OWNER_ID) return true;
    if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    return false;
};

export default {
    // 1. Definisi Perintah
    data: new SlashCommandBuilder()
        .setName('flush')
        .setDescription('[Admin] Memaksa bot untuk menyimpan cache XP ke database SEKARANG.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

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

        await interaction.reply({ content: 'Memulai paksa cache flush...', flags: [MessageFlags.Ephemeral] });
        
        try {
            // Jalankan fungsi flushCacheToDB secara manual
            // Kita teruskan 'interaction.client' yang dibutuhkan oleh fungsi notifikasi
            await flushCacheToDB(interaction.client); 
            
            await interaction.followUp({ content: '✅ Cache flush berhasil dijalankan!', flags: [MessageFlags.Ephemeral] });
        } catch (error) {
            console.error('Error executing /flush:', error);
            await interaction.followUp({ content: 'Terjadi error saat menjalankan flush.', flags: [MessageFlags.Ephemeral] });
        }
    },
};