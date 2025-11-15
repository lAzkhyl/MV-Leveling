import { REST, Routes, ApplicationCommandOptionType, PermissionsBitField } from 'discord.js';
import { TOKEN, CLIENT_ID } from './src/config.js'; // Impor dari config
import dotenv from 'dotenv';

// Muat variabel .env jika ada (untuk development lokal)
dotenv.config();

// Pastikan TOKEN dan CLIENT_ID ada
if (!TOKEN || !CLIENT_ID) {
    console.error('Error: DISCORD_TOKEN dan DISCORD_CLIENT_ID harus ada di environment variables!');
    process.exit(1);
}

// --- Definisi Opsi Pilihan (untuk menghindari duplikasi) ---
const typeChoices = [
    { name: 'MV (Most Valuable)', value: 'mv' },
    { name: 'Friends (Sosial)', value: 'friends' },
];

// --- Definisi Semua Perintah ---
const commands = [
    // --- Perintah Publik ---
    {
        name: 'help',
        description: 'Menampilkan daftar semua perintah bot.',
    },
    {
        name: 'rank',
        description: 'Menampilkan rank dan XP kamu (atau user lain).',
        options: [
            {
                name: 'user',
                description: 'User yang ingin kamu lihat rank-nya.',
                type: ApplicationCommandOptionType.User,
                required: false,
            },
        ],
    },
    {
        name: 'leaderboard',
        description: 'Menampilkan Top 10 leaderboard.',
        options: [
            {
                name: 'type',
                description: 'Tipe leaderboard yang ingin dilihat (default: Keduanya).',
                type: ApplicationCommandOptionType.String,
                required: false,
                choices: typeChoices,
            },
        ],
    },
    {
        name: 'progress',
        description: 'Menampilkan progres XP kamu (atau user lain) menuju level berikutnya.',
        options: [
            {
                name: 'user',
                description: 'User yang ingin kamu lihat progres-nya.',
                type: ApplicationCommandOptionType.User,
                required: false,
            },
        ],
    },
    {
        name: 'levelinfo',
        description: 'Menampilkan daftar hadiah role untuk setiap level.',
        options: [
            {
                name: 'type',
                description: 'Tipe role yang ingin dilihat (default: Keduanya).',
                type: ApplicationCommandOptionType.String,
                required: false,
                choices: typeChoices,
            },
        ],
    },
    {
        name: 'expboost',
        description: 'Melihat status XP boost.',
        options: [
            {
                name: 'user',
                description: 'User yang ingin kamu lihat status boost-nya.',
                type: ApplicationCommandOptionType.User,
                required: false,
            }
            // (Sub-command server bisa ditambahkan nanti)
        ],
    },

    // --- Perintah Admin (Tersembunyi) ---
    // 'default_member_permissions' akan menyembunyikan perintah ini
    // dari user biasa di Discord.
    {
        name: 'givexp',
        description: 'Memberi (atau mengurangi) XP ke user.',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
        options: [
            { name: 'user', description: 'User yang akan diubah XP-nya.', type: ApplicationCommandOptionType.User, required: true },
            { name: 'type', description: 'Tipe XP (MV atau Friends).', type: ApplicationCommandOptionType.String, required: true, choices: typeChoices },
            { name: 'amount', description: 'Jumlah XP (bisa negatif untuk mengurangi).', type: ApplicationCommandOptionType.Integer, required: true },
        ],
    },
    {
        name: 'setlvl',
        description: 'Mengatur level user secara paksa.',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
        options: [
            { name: 'user', description: 'User yang akan diubah level-nya.', type: ApplicationCommandOptionType.User, required: true },
            { name: 'type', description: 'Tipe Level (MV atau Friends).', type: ApplicationCommandOptionType.String, required: true, choices: typeChoices },
            { name: 'level', description: 'Level baru yang dituju.', type: ApplicationCommandOptionType.Integer, required: true },
        ],
    },
    {
        name: 'reset',
        description: 'Mer-reset SEMUA data (XP & Level) seorang user.',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
        options: [
            { name: 'user', description: 'User yang akan di-reset.', type: ApplicationCommandOptionType.User, required: true },
        ],
    },
    {
        name: 'resetlvl',
        description: 'Mer-reset Level (dan XP) user untuk 1 sistem.',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
        options: [
            { name: 'user', description: 'User yang akan di-reset.', type: ApplicationCommandOptionType.User, required: true },
            { name: 'type', description: 'Sistem level (MV atau Friends) yang akan di-reset.', type: ApplicationCommandOptionType.String, required: true, choices: typeChoices },
        ],
    },
    // (resetexp tidak perlu, karena resetlvl sudah mencakup itu)
    {
        name: 'adminflush',
        description: 'Memaksa bot untuk menyimpan cache XP ke database SEKARANG.',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    },
    {
        name: 'stats',
        description: 'Menampilkan statistik bot (cache, volume).',
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
        description: 'Mengaktifkan atau menonaktifkan mode logging DEBUG.',
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
        description: 'Menampilkan 50 transaksi XP terakhir dari WAL.',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    },
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