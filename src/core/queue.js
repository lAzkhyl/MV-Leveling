import { XP_SETTINGS } from '../config.js';
import { addDirtyXP } from './cache.js'; // Kita akan buat file ini di langkah berikutnya

// === ANTRIAN GLOBAL (PILAR 3) ===
// Ini adalah antrian "in-memory" kita.
// Ini adalah array sederhana yang menampung "job" XP.
export const xpJobQueue = [];

// === WORKER PEMROSES ANTRIAN (PILAR 3) ===

/**
 * Fungsi ini dipanggil oleh setInterval di ready.js.
 * Tugasnya adalah mengambil semua job dari antrian,
 * mengagregasinya, dan menerapkannya ke cache (Pilar 2).
 */
export function processXPQueue() {
    // Jika antrian kosong, jangan lakukan apa-apa
    if (xpJobQueue.length === 0) return;

    // 1. Ambil SEMUA pekerjaan saat ini dalam satu operasi atomik
    //    dan bersihkan antrian aslinya.
    const jobsToProcess = xpJobQueue.splice(0, xpJobQueue.length);

    // 2. Agregasi "Micro-batch"
    //    (Mencegah 1 user spam 100x dan memanggil addDirtyXP 100x)
    //    Map<key, { mv: total_mv, friends: total_friends }>
    const aggregatedJobs = new Map();
    const key = (guildId, userId) => `${guildId}-${userId}`;

    for (const job of jobsToProcess) {
        const jobKey = key(job.guildId, job.userId);
        
        // Inisialisasi jika user ini belum ada di batch
        if (!aggregatedJobs.has(jobKey)) {
            aggregatedJobs.set(jobKey, { mv: 0, friends: 0 });
        }

        const agg = aggregatedJobs.get(jobKey);

        if (job.type === 'text') {
            // --- Anti-Spam Lanjutan (Pilar 4) ---
            // Cek panjang pesan minimum
            if (job.messageContent.length < 5) { // Abaikan pesan "ok", "lol"
                continue; 
            }
            // (Tambahkan logika anti-spam lain di sini jika perlu)
            
            agg.mv += XP_SETTINGS.textXp.mv;
            agg.friends += XP_SETTINGS.textXp.friends;
            
        } else if (job.type === 'voice') {
            // Logika XP Suara dari grantVoiceXP (Pilar 4)
            if (job.xpSystem === 'friends') {
                agg.friends += job.amount;
            } else if (job.xpSystem === 'mv') {
                agg.mv += job.amount;
            }
        }
    }

    // 3. Terapkan batch AGREGAT ini ke Cache "Write-Behind" (Pilar 2)
    for (const [jobKey, gains] of aggregatedJobs.entries()) {
        const [guildId, userId] = jobKey.split('-');

        // Panggil fungsi dari Pilar 2
        // Kita akan membuat addDirtyXP di langkah selanjutnya
        if (gains.mv > 0) {
            addDirtyXP(guildId, userId, 'mv', gains.mv);
        }
        if (gains.friends > 0) {
            addDirtyXP(guildId, userId, 'friends', gains.friends);
        }
    }

    if (aggregatedJobs.size > 0) {
        console.log(`[Queue Worker] Processed ${jobsToProcess.length} jobs, aggregated into ${aggregatedJobs.size} cache updates.`);
    }
}