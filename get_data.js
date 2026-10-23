import { APIKEY } from "./env.js";
import fs from "node:fs/promises";
import path from "node:path";

const videoId = "CM53UkHLQKc";
const maxResults = "100";
const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=${maxResults}&order=time&textFormat=plainText&key=${APIKEY}`;

const OUTPUT_FILE = "./data/chunk_";

// Membaca file CSV
async function readFile(filePath) {
    try {
        return await fs.readFile(filePath, "utf8");
    } catch (error) {
        console.error(`Gagal membaca file: ${filePath}`);
        throw error;
    }
}

// Menulis file CSV
async function writeFile(filePath, content) {
    try {
        await fs.writeFile(filePath, content, "utf8");
        console.log(`File berhasil disimpan: ${filePath}`);
    } catch (error) {
        console.error(`Gagal menulis file: ${filePath}`);
        throw error;
    }
}

// Mengubah teks menjadi format CSV yang valid
function escapeCSV(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
}


// Membersihkan komentar YouTube
function cleanseComment(comment) {
    return (
        comment
            // Decode HTML entities umum
            // Hapus emoji dan simbol Unicode terkait
            .replace(/[\p{Extended_Pictographic}\p{Emoji_Component}]/gu, "")

            // Hapus karakter mojibake yang umum
            .replace(/[âðÃï�]/g, "")
            .replace(/&amp;/gi, "&")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
            .replace(/&quot;/gi, '"')
            .replace(/&#39;|&apos;/gi, "'")
            .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
            .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))

            // Hapus URL
            .replace(/https?:\/\/\S+|www\.\S+/gi, "")

            // Hapus tag HTML
            .replace(/<[^>]*>/g, " ")

            // Hapus mention @username
            .replace(/(^|\s)@[\w.-]+/g, "$1")

            // Hapus variation selector dan zero-width characters
            .replace(/[\uFE0E\uFE0F\u200B-\u200D\u2060\uFEFF]/g, "")

            // Rapikan whitespace setiap baris
            .replace(/[ \t]+/g, " ")

            // Rapikan spasi di sekitar newline
            .replace(/ *\n */g, "\n")

            // Gabungkan baris menjadi satu baris
            .replace(/\s+/g, " ")

            // Rapikan spasi dan baris baru
            .replace(/\s+/g, " ")
            .trim()
    );
}

function arrayToCSV(data) {
    if (!data.length) return "";

    const headers = Object.keys(data[0]);

    const escapeCSV = (value) => {
        const text = String(value ?? "");
        return `"${text.replace(/"/g, '""')}"`;
    };

    const rows = data.map((item) =>
        headers.map((key) => escapeCSV(item[key])).join(",")
    );

    return [
        headers.map(escapeCSV).join(","),
        ...rows,
    ].join("\n");
}

// Proses utama
async function main() {
    try {
        const res = await fetch(url)
        const data = await res.json()
            
        const rows = data.items.map((item) => {
            const comment = item.snippet.topLevelComment.snippet.textOriginal
            return {
                authorDisplayName: item.snippet.topLevelComment.snippet.authorDisplayName,
                // komentar_raw: comment,
                textDisplay: cleanseComment(comment),
                likeCount: item.snippet.topLevelComment.snippet.likeCount,
                publishedAt: item.snippet.topLevelComment.snippet.publishedAt,
            }
        });

        if (rows.length === 0) {
            return;
        }

        const csv = arrayToCSV(rows);

        await writeFile(OUTPUT_FILE, csv);
        console.log("DONEE", OUTPUT_FILE)
    } catch (error) {
        console.error("Terjadi kesalahan:", error.message);
        process.exitCode = 1;
    }
}

main();
