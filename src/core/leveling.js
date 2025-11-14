import { db } from '../database/index.js';

// --- FORMULA LEVELING ---
// Ini adalah formula standar: Level = 0.1 * sqrt(XP)
// Kamu bisa mengubah '0.1' untuk membuatnya lebih cepat/lambat
export const XP_TO_LEVEL_MULTIPLIER = 0.1;

/**
 * Menghitung level dari total XP.
 * @param {number} xp Total XP
 * @returns {number} Level saat ini
 */
export function calculateLevel(xp) {
    if (xp <= 0) return 0;
    return Math.floor(XP_TO_LEVEL_MULTIPLIER * Math.sqrt(xp));
}

/**
 * Menghitung XP yang dibutuhkan untuk level berikutnya.
 * @param {number} level Level saat ini
 * @returns {number} Total XP yang dibutuhkan
 */
export function getXpForLevel(level) {
    if (level <= 0) return 0;
    // (level / 0.1)^2
    // Kita bulatkan ke atas agar user perlu XP pas atau lebih
    return Math.ceil(((level + 1) / XP_TO_LEVEL_MULTIPLIER) ** 2);
}


// --- REGISTRASI FUNGSI DB (PILAR 5) ---
// Ini "mengajarkan" SQLite formula leveling kita.
// Ini memungkinkan kueri database menghitung level "on-the-fly".
try {
    db.function('calculate_level', {
        deterministic: true, // Hasilnya selalu sama untuk input yang sama
        varargs: false, // Hanya menerima 1 argumen (xp)
    }, (xp) => {
        if (xp <= 0) return 0;
        // Pastikan input adalah Angka
        xp = Number(xp || 0);
        return Math.floor(XP_TO_LEVEL_MULTIPLIER * Math.sqrt(xp));
    });
    console.log('Registered custom SQL function "calculate_level".');
} catch (error) {
    console.error("Failed to register custom SQL function:", error);
}