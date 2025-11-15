import { GatewayIntentBits } from 'discord.js';

// Helper function (bisa dihapus jika kamu hard-code semua)
function parseEnvSet(envVar) {
    if (!envVar) {
        return new Set();
    }
    return new Set(envVar.split(',').map(id => id.trim()));
}

// 1. Konfigurasi Bot
export const TOKEN = process.env.DISCORD_TOKEN;
export const CLIENT_ID = process.env.DISCORD_CLIENT_ID; // <-- TAMBAHKAN INI
export const OWNER_ID = process.env.DISCORD_OWNER_ID; // <-- TAMBAHKAN INI

export const INTENTS = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
];
// PREFIX = "$"; // <-- HAPUS BARIS INI

// 2. Konfigurasi Leveling
export const XP_SETTINGS = {
    textXp: {
        mv: 10,
        friends: 5
    },
    voiceXp: {
        full: {
            mv: 10,
            friends: 15
        },
        mutedModifier: 1/3 
    },
    textCooldown: 60 * 1000,
};

// 3. Konfigurasi Role (Tertanam/Hard-coded)
export const ROLES_MV = {
    "10": "1438865836000415835", // @[E] MV
    "25": "1438866998955081784", // @True MV
    "35": "1438867034787282965", // @[E] True MV
    "70": "1438867091582091264", // @Noble MV
    "100": "1438867535650099221", // @[E] Noble MV
    "150": "1438867829649571891"  // @Royal MV (Placeholder ???)
};
export const ROLES_FRIENDS = {
    "10": "1438865644803195001", // @[E] Friend
    "25": "1438865927075528785", // @True Friend
    "35": "1438865974299459635", // @[E] True Friend
    "70": "1438866064267018362", // @Best Friend
    "100": "1438866153056506036", // @[E] Best Friend
    "150": "1438866863864938506"  // @Homies (Placeholder ???)
};

// 4. Channel yang Diabaikan (Tertanam/Hard-coded)
export const IGNORED_TEXT_CHANNELS = new Set([
    "1433143640712024174", // 🤖│bot
    "1433581465999900784"  // 🎵│music
]);
export const IGNORED_VOICE_CHANNELS = new Set([
    "1433572294298439680" // 𝗔𝗙𝗞
]);

// 5. Konfigurasi Notifikasi
export const LEVEL_UP_CHANNEL_ID = "1437546013983510598";