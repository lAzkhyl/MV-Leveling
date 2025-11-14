// Impor fungsi-fungsi inti yang akan kita jalankan
import { processXPQueue } from '../core/queue.js';
import { grantVoiceXP } from '../core/voiceState.js';
import { flushCacheToDB } from '../core/cache.js';

// Interval loop (dalam milidetik)
const QUEUE_PROCESS_INTERVAL = 1000; // Proses antrian setiap 1 detik
const VOICE_XP_INTERVAL = 60 * 1000; // Beri XP suara setiap 1 menit
const CACHE_FLUSH_INTERVAL = 60 * 1000; // Flush cache ke DB setiap 1 menit

/**
 * Handler ini berjalan TEPAT SATU KALI saat bot berhasil login & siap.
 * @param {import('discord.js').Client} client 
 */
export default function onReady(client) {
    console.log(`Bot is online! Logged in as ${client.user.tag}`);
    
    // --- MULAI SEMUA LOOP INTI (PILAR 2, 3, 4) ---
    // Sekarang bot sudah siap, kita bisa mulai memproses data.

    // 1. Mulai "Worker" Antrian XP (Pilar 3)
    // Memproses batch XP dari 'xpJobQueue'
    setInterval(processXPQueue, QUEUE_PROCESS_INTERVAL);
    console.log(`XP Queue worker started (Interval: ${QUEUE_PROCESS_INTERVAL}ms).`);

    // 2. Mulai Loop Pemberian XP Suara (Pilar 4)
    // Memindai 'voiceStateCache' dan memberi XP
    setInterval(() => grantVoiceXP(client), VOICE_XP_INTERVAL);
    console.log(`Voice XP loop started (Interval: ${VOICE_XP_INTERVAL}ms).`);

    // 3. Mulai Loop "Flush" Cache (Pilar 2)
    // Menyimpan 'dirtyXPCache' ke database SQLite
    setInterval(() => flushCacheToDB(client), CACHE_FLUSH_INTERVAL);
    console.log(`Cache flush loop started (Interval: ${CACHE_FLUSH_INTERVAL}ms).`);
}