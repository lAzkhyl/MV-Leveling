import { REST, Routes, ApplicationCommandOptionType, PermissionsBitField } from 'discord.js';
import { TOKEN, CLIENT_ID } from './src/config.js';
import dotenv from 'dotenv';

dotenv.config();

if (!TOKEN || !CLIENT_ID) {
    console.error('Error: DISCORD_TOKEN dan DISCORD_CLIENT_ID harus ada di environment variables!');
    process.exit(1);
}

// --- Definisi Opsi Pilihan ---
const typeChoices = [
    { name: 'MV (Most Valuable)', value: 'mv' },
    { name: 'Friends (Sosial)', value: 'friends' },
];

// --- Definisi Semua Perintah ---
const commands = [
    // === Perintah Publik ===
    {
        name: 'help',
        description: 'Menampilkan daftar semua perintah bot.',
    },
    {
        name: 'rank',
        description: 'Menampilkan rank dan XP kamu (atau user lain).',
        options: [
            { name: 'user', description: 'User yang ingin kamu lihat rank-nya.', type: ApplicationCommandOptionType.User, required: false },
        ],
    },
    {
        name: 'leaderboard',
        description: 'Menampilkan Top 10 leaderboard.',
        options: [
            { name: 'type', description: 'Tipe leaderboard (default: Keduanya).', type: ApplicationCommandOptionType.String, required: false, choices: typeChoices },
        ],
    },
    {
        name: 'progress',
        description: 'Menampilkan progres XP kamu (atau user lain).',
        options: [
            { name: 'user', description: 'User yang ingin kamu lihat progres-nya.', type: ApplicationCommandOptionType.User, required: false },
        ],
    },
    {
        name: 'levelinfo',
        description: 'Menampilkan daftar hadiah role untuk setiap level.',
        options: [
            { name: 'type', description: 'Tipe role (default: Keduanya).', type: ApplicationCommandOptionType.String, required: false, choices: typeChoices },
        ],
    },
    {
        name: 'expboost',
        description: 'Melihat status XP boost.',
        options: [
            { name: 'user', description: 'User yang ingin kamu lihat status boost-nya.', type: ApplicationCommandOptionType.User, required: false }
        ],
    },

    // === Perintah Admin (Tersembunyi) ===
    // 'default_member_permissions' akan menyembunyikan ini dari user biasa
    {
        name: 'givexp',
        description: '[Admin] Memberi (atau mengurangi) XP ke user.',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
        options: [
            { name: 'user', description: 'User target.', type: ApplicationCommandOptionType.User, required: true },
            { name: 'type', description: 'Tipe XP (MV atau Friends).', type: ApplicationCommandOptionType.String, required: true, choices: typeChoices },
            { name: 'amount', description: 'Jumlah XP (bisa negatif).', type: ApplicationCommandOptionType.Integer, required: true },
        ],
    },
    {
        name: 'setlvl',
        description: '[Admin] Mengatur level user secara paksa.',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
        options: [
            { name: 'user', description: 'User target.', type: ApplicationCommandOptionType.User, required: true },
            { name: 'type', description: 'Tipe Level (MV atau Friends).', type: ApplicationCommandOptionType.String, required: true, choices: typeChoices },
            { name: 'level', description: 'Level baru yang dituju.', type: ApplicationCommandOptionType.Integer, required: true },
        ],
    },
    {
        name: 'reset',
        description: '[Admin] Mer-reset SEMUA data (XP & Level) seorang user.',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
        options: [
            { name: 'user', description: 'User yang akan di-reset.', type: ApplicationCommandOptionType.User, required: true },
        ],
    },
    {
        name: 'resetlvl',
        description: '[Admin] Mer-reset Level (dan XP) user untuk 1 sistem.',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
        options: [
            { name: 'user', description: 'User yang akan di-reset.', type: ApplicationCommandOptionType.User, required: true },
            { name: 'type', description: 'Sistem level (MV atau Friends) yang akan di-reset.', type: ApplicationCommandOptionType.String, required: true, choices: typeChoices },
        ],
    },
    {
        name: 'flush', // <-- Nama diubah dari 'adminflush'
        description: '[Admin] Memaksa bot untuk menyimpan cache XP ke database SEKARANG.',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    },
    {
        name: 'stats',
        description: '[Admin] Menampilkan statistik bot (cache, volume).',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
        options: [
            {
                name: 'target',
                description: 'Statistik spesifik yang ingin dilihat.',
                type: ApplicationCommandOptionType.String,
                required: false,
                choices: [
                    { name: 'Cache (RAM)', value: 'cache' },
                    { name: 'Volume (Disk)', value: 'volume' },
                ],
            },
        ],
    },
    {
        name: 'logdebug',
        description: '[Admin] Mengaktifkan atau menonaktifkan mode logging DEBUG.',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
        options: [
            {
                name: 'status',
                description: 'Aktifkan atau matikan.',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: 'On', value: 'on' },
                    { name: 'Off', value: 'off' },
                ],
            },
        ],
    },
    {
        name: 'auditxp',
        description: '[Admin] Menampilkan 50 transaksi XP terakhir dari WAL.',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    },
    {
        name: 'start', // <-- Perintah BARU
        description: '[Admin] Mengaktifkan kembali sistem leveling (XP akan mulai dihitung).',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    },
    {
        name: 'stop', // <-- Perintah BARU
        description: '[Admin] Menghentikan sistem leveling (XP tidak akan dihitung).',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    }
];

// --- Logika Pendaftaran ---
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log(`Mulai mendaftarkan ${commands.length} application (/) commands.`);
        
        // Daftarkan perintah ke Discord
        const data = await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );

        console.log(`Berhasil mendaftarkan ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();