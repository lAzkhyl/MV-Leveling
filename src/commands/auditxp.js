import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } from 'discord.js';
import { OWNER_ID } from '../config.js';
import { WAL_PATH } from '../core/recovery.js'; // Impor path WAL
import fs from 'fs';
import readline from 'readline';

// --- Helper Keamanan ---
const isAdmin = (interaction) => {
    if (interaction.user.id === OWNER_ID) return true;
    if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    return false;
};

export default {
    // 1. Definisi Perintah
    data: new SlashCommandBuilder()
        .setName('auditxp')
        .setDescription('[Admin] Menampilkan 50 transaksi XP terakhir dari WAL.')
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

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            // Kita akan membaca file WAL baris per baris
            const fileStream = fs.createReadStream(WAL_PATH);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            const lines = [];
            for await (const line of rl) {
                if (line.trim() !== '') {
                    lines.push(line);
                }
            }

            // Ambil 50 baris terakhir dan balik urutannya (terbaru dulu)
            const last50Lines = lines.slice(-50).reverse();

            if (last50Lines.length === 0) {
                await interaction.editReply('Log audit (WAL) saat ini kosong. (Menunggu *flush* berikutnya).');
                return;
            }

            const description = last50Lines.map(line => {
                try {
                    const entry = JSON.parse(line);
                    const time = new Date(entry.ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    return `\`[${time}]\` **${entry.amount} XP** (${entry.type}) → <@${entry.userId}>`;
                } catch {
                    return '*(Garis log rusak)*';
                }
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle('監査 XP Audit Log (50 Terakhir)')
                .setDescription(description)
                .setColor('#FFA500') // Oranye
                .setFooter({ text: 'Log ini dibersihkan setiap kali cache flush berhasil.'});
                
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            if (error.code === 'ENOENT') {
                await interaction.editReply('Log audit (WAL) belum dibuat.');
            } else {
                console.error('Failed to read WAL for /auditxp:', error);
                await interaction.editReply('Gagal membaca file log audit.');
            }
        }
    },
};