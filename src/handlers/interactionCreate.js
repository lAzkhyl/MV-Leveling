/**
 * Handler ini berjalan SETIAP KALI ada interaksi.
 * Kita hanya peduli pada 'ChatInputCommand' (slash command).
 * @param {import('discord.js').Interaction} interaction
 */
export default async function onInteractionCreate(interaction) {
    
    // 1. Filter: Hanya proses slash command
    if (!interaction.isChatInputCommand()) return;

    // 2. Ambil file perintah dari 'client.commands' (yang akan kita buat di index.js)
    const command = interaction.client.commands.get(interaction.commandName);

    // 3. Cek Perintah: Jika perintah tidak ditemukan
    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        try {
            await interaction.reply({ 
                content: 'Error: Perintah ini tidak ditemukan.', 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Failed to send "command not found" reply:', error);
        }
        return;
    }

    // 4. Eksekusi Perintah
    try {
        // Jalankan fungsi 'execute' dari file perintah (misal: rank.js, admin.js)
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing /${interaction.commandName}:`, error);
        
        // Kirim balasan error yang aman jika terjadi kegagalan
        const replyOptions = {
            content: 'Terjadi error saat menjalankan perintah ini!',
            ephemeral: true // 'ephemeral: true' berarti pesan hanya terlihat oleh user
        };

        try {
            // Cek apakah bot sudah membalas (misal: 'is thinking...')
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