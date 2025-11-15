import { MessageFlags } from 'discord.js'; // <-- TAMBAHKAN IMPOR INI

/**
 * Handler ini berjalan SETIAP KALI ada interaksi.
 * @param {import('discord.js').Interaction} interaction
 */
export default async function onInteractionCreate(interaction) {
    
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        try {
            // --- PERUBAHAN DI SINI ---
            await interaction.reply({ 
                content: 'Error: Perintah ini tidak ditemukan.', 
                flags: [MessageFlags.Ephemeral] // 'ephemeral: true' diganti
            });
        } catch (error) {
            console.error('Failed to send "command not found" reply:', error);
        }
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing /${interaction.commandName}:`, error);
        
        const replyOptions = {
            content: 'Terjadi error saat menjalankan perintah ini!',
            flags: [MessageFlags.Ephemeral] // 'ephemeral: true' diganti
        };

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(replyOptions);
            } else {
                await interaction.reply(replyOptions);
            }
        } catch (replyError) {
            console.error('Failed to send error reply:', replyError);
        }
    }
}