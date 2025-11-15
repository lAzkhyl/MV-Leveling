import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ApplicationCommandOptionType } from 'discord.js';
import { OWNER_ID } from '../config.js';
import { db } from '../database/index.js';
import { getUserRank } from '../database/queries.js';
import { checkAndNotify, getXpFromLevel } from '../core/leveling.js';
import { flushCacheToDB, dirtyXPCache } from '../core/cache.js';
import { WAL_PATH } from '../core/recovery.js';
import fs from 'fs';

// --- Kueri Admin (Disiapkan sekali) ---
// Kita siapkan di sini agar tidak dibuat ulang setiap kali
const adminGiveXpQuery = db.prepare(
    'UPDATE user_levels SET mv_xp = mv_xp + ?, friends_xp = friends_xp + ? WHERE user_id = ? AND guild_id = ?'
);
const adminSetMvLevelQuery = db.prepare(
    'UPDATE user_levels SET mv_xp = ?, mv_level = ? WHERE user_id = ? AND guild_id = ?'
);
const adminSetFriendsLevelQuery = db.prepare(
    'UPDATE user_levels SET friends_xp = ?, friends_level = ? WHERE user_id = ? AND guild_id = ?'
);
const adminResetUserQuery = db.prepare(
    'DELETE FROM user_levels WHERE user_id = ? AND guild_id = ?'
);
const adminResetMvQuery = db.prepare(
    'UPDATE user_levels SET mv_xp = 0, mv_level = 0 WHERE user_id = ? AND guild_id = ?'
);
const adminResetFriendsQuery = db.prepare(
    'UPDATE user_levels SET friends_xp = 0, friends_level = 0 WHERE user_id = ? AND guild_id = ?'
);

// --- Helper Keamanan ---
const isAdmin = (interaction) => {
    // Periksa apakah pengguna adalah OWNER_ID atau memiliki izin Admin di server
    if (interaction.user.id === OWNER_ID) return true;
    if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    return false;
};

export default {
    // 1. Definisi Perintah (dengan Sub-Command)
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Perintah administrasi untuk bot leveling.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator) // Hanya Admin
        
        .addSubcommand(sub => sub
            .setName('givexp')
            .setDescription('Memberi (atau mengurangi) XP ke user.')
            .addUserOption(opt => opt.setName('user').setDescription('User target.').setRequired(true))
            .addStringOption(opt => opt.setName('type').setDescription('Tipe XP (mv/friends).').setRequired(true).addChoices({ name: 'MV', value: 'mv' }, { name: 'Friends', value: 'friends' }))
            .addIntegerOption(opt => opt.setName('amount').setDescription('Jumlah XP (negatif untuk mengurangi).').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('setlvl')
            .setDescription('Mengatur level user secara paksa (XP akan disesuaikan).')
            .addUserOption(opt => opt.setName('user').setDescription('User target.').setRequired(true))
            .addStringOption(opt => opt.setName('type').setDescription('Tipe XP (mv/friends).').setRequired(true).addChoices({ name: 'MV', value: 'mv' }, { name: 'Friends', value: 'friends' }))
            .addIntegerOption(opt => opt.setName('level').setDescription('Level baru yang dituju.').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('reset')
            .setDescription('Mer-reset SEMUA data (XP & Level) seorang user.')
            .addUserOption(opt => opt.setName('user').setDescription('User yang akan di-reset.').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('resetlvl')
            .setDescription('Mer-reset Level (dan XP) user untuk 1 sistem.')
            .addUserOption(opt => opt.setName('user').setDescription('User yang akan di-reset.').setRequired(true))
            .addStringOption(opt => opt.setName('type').setDescription('Sistem level (mv/friends) yang akan di-reset.').setRequired(true).addChoices({ name: 'MV', value: 'mv' }, { name: 'Friends', value: 'friends' }))
        )
        .addSubcommand(sub => sub
            .setName('flush')
            .setDescription('Memaksa bot untuk menyimpan cache XP ke database SEKARANG.')
        )
        .addSubcommand(sub => sub
            .setName('stats')
            .setDescription('Menampilkan statistik bot (cache, volume).')
            .addStringOption(opt => opt.setName('target').setDescription('Statistik spesifik.').setRequired(false).addChoices({ name: 'Cache (RAM)', value: 'cache' }, { name: 'Volume (Disk)', value: 'volume' }))
        )
        .addSubcommand(sub => sub
            .setName('logdebug')
            .setDescription('Mengaktifkan atau menonaktifkan mode logging DEBUG (placeholder).')
            .addStringOption(opt => opt.setName('status').setDescription('Aktifkan atau matikan.').setRequired(true).addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }))
        )
        .addSubcommand(sub => sub
            .setName('auditxp')
            .setDescription('Menampilkan 50 transaksi XP terakhir dari WAL.')
        ),

    // 2. Logika Eksekusi
    /**
     * @param {import('discord.js').Interaction} interaction
     */
    async execute(interaction) {
        // --- Pemeriksaan Keamanan Universal ---
        if (!isAdmin(interaction)) {
            await interaction.reply({ content: 'Hanya Administrator atau Pemilik Bot yang dapat menggunakan perintah ini.', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true }); // Balasan admin bersifat pribadi

        try {
            // --- Router untuk Sub-Command ---
            switch (subcommand) {
                case 'givexp':
                    await handleGiveXp(interaction);
                    break;
                case 'setlvl':
                    await handleSetLvl(interaction);
                    break;
                case 'reset':
                    await handleReset(interaction);
                    break;
                case 'resetlvl':
                    await handleResetLvl(interaction);
                    break;
                case 'flush':
                    await handleFlush(interaction);
                    break;
                case 'stats':
                    await handleStats(interaction);
                    break;
                case 'logdebug':
                    await handleLogDebug(interaction);
                    break;
                case 'auditxp':
                    await handleAuditXp(interaction);
                    break;
                case 'start':
                    global.isLevelingActive = true;
                    await interaction.editReply('✅ **Sistem Leveling telah DIAKTIFKAN.** Bot akan mulai menghitung XP.');
                    break;
                case 'stop':
                    global.isLevelingActive = false;
                    await interaction.editReply('Sistem Leveling DIHENTIKAN. Menjalankan *flush* terakhir untuk menyimpan data...');
                    flushCacheToDB(interaction.client);
                    await interaction.followUp({ content: '🛑 **Sistem Leveling telah DIMATIKAN.** Bot tidak akan menghitung XP. *Cache* telah disimpan.', ephemeral: true });
                    break;
            }
        } catch (error) {
            console.error(`Error executing /admin ${subcommand}:`, error);
            await interaction.editReply('Terjadi error internal saat menjalankan perintah admin.');
        }
    },
};

// --- Logika untuk setiap Sub-Command ---

async function handleGiveXp(interaction) {
    const targetUser = interaction.options.getUser('user');
    const type = interaction.options.getString('type');
    const amount = interaction.options.getInteger('amount');
    const guildId = interaction.guild.id;

    // 1. Ambil data lama (untuk notifikasi)
    const oldData = getUserRank(targetUser.id, guildId);
    
    // 2. Jalankan update
    const mvAmount = (type === 'mv') ? amount : 0;
    const friendsAmount = (type === 'friends') ? amount : 0;
    adminGiveXpQuery.run(mvAmount, friendsAmount, targetUser.id, guildId);

    // 3. Ambil data baru
    const newData = getUserRank(targetUser.id, guildId);

    // 4. Picu notifikasi (jika naik level)
    await checkAndNotify(interaction.client, guildId, targetUser.id, 'mv', oldData.mv_level, newData.mv_level);
    await checkAndNotify(interaction.client, guildId, targetUser.id, 'friends', oldData.friends_level, newData.friends_level);

    await interaction.editReply(`Berhasil memberikan **${amount} XP** (${type}) kepada **${targetUser.displayName}**. Level baru mereka: ${newData[type + '_level']}.`);
}

async function handleSetLvl(interaction) {
    const targetUser = interaction.options.getUser('user');
    const type = interaction.options.getString('type');
    const newLevel = interaction.options.getInteger('level');
    const guildId = interaction.guild.id;

    // 1. Ambil data lama
    const oldData = getUserRank(targetUser.id, guildId);

    // 2. Hitung XP baru dari level
    const newXp = getXpFromLevel(newLevel);

    // 3. Jalankan update
    if (type === 'mv') {
        adminSetMvLevelQuery.run(newXp, newLevel, targetUser.id, guildId);
    } else {
        adminSetFriendsLevelQuery.run(newXp, newLevel, targetUser.id, guildId);
    }

    // 4. Picu notifikasi (jika naik level)
    const oldLevel = (type === 'mv') ? oldData.mv_level : oldData.friends_level;
    await checkAndNotify(interaction.client, guildId, targetUser.id, type, oldLevel, newLevel);
    
    await interaction.editReply(`Berhasil mengatur **${targetUser.displayName}** ke **Level ${newLevel}** (${type}) dengan **${newXp} XP**.`);
}

async function handleReset(interaction) {
    const targetUser = interaction.options.getUser('user');
    adminResetUserQuery.run(targetUser.id, interaction.guild.id);
    await interaction.editReply(`Berhasil me-reset **semua data** leveling untuk **${targetUser.displayName}**.`);
}

async function handleResetLvl(interaction) {
    const targetUser = interaction.options.getUser('user');
    const type = interaction.options.getString('type');
    
    if (type === 'mv') {
        adminResetMvQuery.run(targetUser.id, interaction.guild.id);
    } else {
        adminResetFriendsQuery.run(targetUser.id, interaction.guild.id);
    }
    
    await interaction.editReply(`Berhasil me-reset data **${type}** untuk **${targetUser.displayName}**.`);
}

async function handleFlush(interaction) {
    await interaction.editReply('Memulai paksa cache flush...');
    flushCacheToDB(interaction.client); // Jalankan flush
    await interaction.followUp({ content: 'Cache flush berhasil dijalankan!', ephemeral: true });
}

async function handleStats(interaction) {
    const target = interaction.options.getString('target');
    const embed = new EmbedBuilder().setTitle('📊 Statistik Bot').setColor('#FFFF00');

    if (target === 'cache') {
        embed.setDescription(`Ada **${dirtyXPCache.size}** update user yang saat ini ada di cache RAM, menunggu untuk di-flush.`);
    } else if (target === 'volume') {
        // Ini hanya akan menampilkan ukuran file DB, bukan sisa volume
        try {
            const dbStats = fs.statSync(path.resolve(process.cwd(), 'data', 'leveling.db'));
            embed.setDescription(`Ukuran file database: **${(dbStats.size / 1024 / 1024).toFixed(2)} MB**.`);
        } catch (e) {
            embed.setDescription('Tidak dapat membaca statistik volume. (File DB belum dibuat?)');
        }
    } else {
        embed.setDescription(`Total item di cache: **${dirtyXPCache.size}**`);
    }
    await interaction.editReply({ embeds: [embed] });
}

async function handleLogDebug(interaction) {
    const status = interaction.options.getString('status');
    // TODO: Implementasikan logika global state logger di sini
    // global.LOG_LEVEL = (status === 'on') ? 'DEBUG' : 'INFO';
    await interaction.editReply(`Mode Log Debug sekarang **${status.toUpperCase()}**. (Fitur ini masih placeholder, logika logger belum diimplementasi).`);
}

async function handleAuditXp(interaction) {
    try {
        const walData = fs.readFileSync(WAL_PATH, 'utf8');
        const lines = walData.split('\n').filter(Boolean); // Baca semua baris, hapus yang kosong
        const last50Lines = lines.slice(-50).reverse(); // Ambil 50 terakhir, balik urutannya

        if (last50Lines.length === 0) {
            await interaction.editReply('Log audit (WAL) saat ini kosong.');
            return;
        }

        const description = last50Lines.map(line => {
            try {
                const entry = JSON.parse(line);
                return `\`[${new Date(entry.ts).toLocaleTimeString()}]\` **${entry.amount} XP** (${entry.type}) → <@${entry.userId}>`;
            } catch {
                return '*(Garis log rusak)*';
            }
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('監査 XP Audit Log (50 Terakhir)')
            .setDescription(description)
            .setColor('#FFA500');
            
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        if (error.code === 'ENOENT') {
            await interaction.editReply('Log audit (WAL) belum dibuat.');
        } else {
            console.error('Failed to read WAL:', error);
            await interaction.editReply('Gagal membaca file log audit.');
        }
    }
}