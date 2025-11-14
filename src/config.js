import { GatewayIntentBits } from 'discord.js';

function parseEnvSet(envVar) {
    if (!envVar) {
        return new Set();
    }
    return new Set(envVar.split(',').map(id => id.trim()));
}

// 1. Konfigurasi Bot
export const TOKEN = process.env.DISCORD_TOKEN;
export const INTENTS = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
];
export const PREFIX = "$"; // <-- Perintah Prefix Ditambahkan

// 2. Konfigurasi Leveling
export const XP_SETTINGS = {
    textXp: {
        mv: 10,
        friends: 5
    },
    voiceXp: {
        full: 15,
        mutedModifier: 1/3,
        type: 'friends'
    },
    textCooldown: 60 * 1000,
};

// 3. Konfigurasi Role (dari Env)
export const ROLES_MV = JSON.parse(process.env.ROLES_MV_JSON || '{}');
export const ROLES_FRIENDS = JSON.parse(process.env.ROLES_FRIENDS_JSON || '{}');

// 4. Channel yang Diabaikan (dari Env)
export const IGNORED_TEXT_CHANNELS = parseEnvSet(process.env.IGNORED_TEXT_CHANNELS);
export const IGNORED_VOICE_CHANNELS = parseEnvSet(process.env.IGNORED_VOICE_CHANNELS);