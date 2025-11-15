import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { OWNER_ID } from '../config.js';

// --- Helper Keamanan ---
const isAdmin = (interaction) => {
    if (interaction.user.id === OWNER_ID) return true;
    if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    return false;
};

// Placeholder untuk Global Logger State
// (Ini adalah implementasi sederhana, 'export' agar bisa dibaca file lain jika perlu)
if (typeof global.LOG_LEVEL === 'undefined') {
    global.LOG_LEVEL = 'INFO'; // Set default jika belum ada
}

export default {
    // 1. Definisi Perintah (diambil dari deploy-commands.js)
    data: new SlashCommandBuilder()
        .setName('logdebug')
        .setDescription('Mengaktifkan atau menonaktifkan mode logging DEBUG.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Aktifkan atau matikan.')
                .setRequired(true)
                .addChoices(
                    { name: 'On', value: 'on' },
                    { name: 'Off', value: 'off' }
                )
        ),

    // 2. Logika Eksekusi
    /**
     * @param {import('discord.js').Interaction} interaction
     */
    async execute(interaction) {
        if (!isAdmin(interaction)) {
            await interaction.reply({ content: 'Hanya Administrator atau Pemilik Bot yang dapat menggunakan perintah ini.', ephemeral: true });
            return;
        }

        const status = interaction.options.getString('status');

        if (status === 'on') {
            global.LOG_LEVEL = 'DEBUG';
            await interaction.reply({ content: '🔬 Mode Log Debug sekarang **AKTIF**. Bot akan mencetak log detail.', ephemeral: true });
        } else {
            global.LOG_LEVEL = 'INFO';
            await interaction.reply({ content: '✅ Mode Log Debug sekarang **MATI**. Bot akan kembali ke logging normal.', ephemeral: true });
        }
        
        console.log(`[Admin] LOG_LEVEL diatur ke ${global.LOG_LEVEL} oleh ${interaction.user.tag}`);
    },
};