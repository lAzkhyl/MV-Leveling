import { addDirtyXP } from './cache.js'; 

export const xpJobQueue = [];

/**
 * Fungsi ini sekarang lebih sederhana.
 * Hanya mengagregasi job yang sudah spesifik.
 */
export function processXPQueue() {
    if (!global.isLevelingActive) return;
    if (xpJobQueue.length === 0) return;

    // 1. Ambil SEMUA pekerjaan saat ini
    const jobsToProcess = xpJobQueue.splice(0, xpJobQueue.length);

    // 2. Agregasi "Micro-batch"
    const aggregatedJobs = new Map();
    const key = (guildId, userId) => `${guildId}-${userId}`;

    for (const job of jobsToProcess) {
        const jobKey = key(job.guildId, job.userId);
        
        if (!aggregatedJobs.has(jobKey)) {
            aggregatedJobs.set(jobKey, { mv: 0, friends: 0 });
        }

        const agg = aggregatedJobs.get(jobKey);

        // --- Logika Anti-Spam (Hanya untuk Teks) ---
        if (job.type === 'text') {
            if (job.messageContent.length < 5) {
                continue; 
            }
        }

        // --- Logika Agregasi (Disederhanakan) ---
        if (job.xpSystem === 'mv') {
            agg.mv += job.amount;
        } else if (job.xpSystem === 'friends') {
            agg.friends += job.amount;
        }
    }

    // 3. Terapkan batch AGREGAT ini ke Cache (Pilar 2)
    for (const [jobKey, gains] of aggregatedJobs.entries()) {
        const [guildId, userId] = jobKey.split('-');

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