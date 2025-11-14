import { EmbedBuilder } from 'discord.js';
import {
    PREFIX,
    XP_SETTINGS,
    IGNORED_TEXT_CHANNELS
} from '../config.js';
import { xpJobQueue } from '../core/queue.js';
import { getUserRank } from '../database/queries.js';

const cooldowns = new Map();

/**
 * Handler untuk Pesan Teks dan Perintah Prefix
 * @param {import('discord.js').Message} message
 */
export default async function onMessageCreate(message) {
    try {
        if (message.author.bot || !message.guild) {
            return;
        }

        // 1. Logika Perintah
        if (message.content.startsWith(PREFIX)) {
            const args = message.content.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            if (command === 'level') {
                await handleLevelCommand(message);
            }
            // (Perintah lain bisa ditambahkan di sini)
            
            return; // Hentikan agar tidak memberi XP untuk perintah
        }

        // 2. Logika Pemberian XP
        
        // Cek channel yang diabaikan
        if (IGNORED_TEXT_CHANNELS.has(message.channel.id)) {
            return;
        }

        // Cek Cooldown
        const now = Date.now();
        const lastMessageTime = cooldowns.get(message.author.id);
        
        if (lastMessageTime) {
            const timePassed = now - lastMessageTime;
            if (timePassed < XP_SETTINGS.textCooldown) {
                return; // Masih cooldown
            }
        }
        cooldowns.set(message.author.id, now);

        // Lolos: Masukkan ke antrian XP
        xpJobQueue.push({
            type: 'text',
            guildId: message.guild.id,
            userId: message.author.id,
            messageContent: message.content
        });

    } catch (error) {
        console.error('Error in messageCreate handler:', error);
    }
}

/**
 * Logika khusus untuk perintah $level
 * @param {import('discord.js').Message} message
 */
async function handleLevelCommand(message) {
    // Ambil data user dari DB (Pilar 1)
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const data = getUserRank(userId, guildId);

    if (!data) {
        return message.reply('Terjadi error saat mengambil data.');
    }

    // Buat Embed
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setAuthor({ 
            name: message.author.displayName, 
            iconURL: message.author.displayAvatarURL() 
        })
        .setTitle(`Leveling Stats`)
        .addFields(
            { 
                name: `🏆 MV (Most Valuable)`, 
                value: `**Level:** ${data.mv_level}\n**XP:** ${data.mv_xp} / ${data.mv_xp_next}\n**Rank:** #${data.mv_rank}`,
                inline: true 
            },
            { 
                name: `🤝 Friends (Sosial)`, 
                value: `**Level:** ${data.friends_level}\n**XP:** ${data.friends_xp} / ${data.friends_xp_next}\n**Rank:** #${data.friends_rank}`,
                inline: true 
            }
        )
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}