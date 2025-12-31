// Storage service - abstracts screenshot uploads to Supabase Storage

import { supabaseAdmin } from "../lib/supabase.js";
import fs from "fs/promises";
import path from "path";

const BUCKET = "scrape-storage";

/**
 * Upload a screenshot to Supabase Storage
 * @param {string} localPath - Local file path
 * @param {string} userId - Owner user ID
 * @param {string} jobId - Parent job ID
 * @param {string} resultId - Result ID (for unique naming)
 * @returns {Promise<string>} Storage path (not URL)
 */
export async function uploadScreenshot(localPath, userId, jobId, resultId) {
    const buffer = await fs.readFile(localPath);
    const storagePath = `screenshots/${userId}/${jobId}/${resultId}.png`;

    const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
            contentType: "image/png",
            upsert: true,
        });

    if (error) {
        console.error("Screenshot upload failed:", error);
        throw error;
    }

    return storagePath;
}

/**
 * Upload a thumbnail to Supabase Storage
 * @param {string} localPath - Local file path
 * @param {string} userId - Owner user ID
 * @param {string} jobId - Parent job ID
 * @param {string} resultId - Result ID (for unique naming)
 * @returns {Promise<string>} Storage path (not URL)
 */
export async function uploadThumbnail(localPath, userId, jobId, resultId) {
    const buffer = await fs.readFile(localPath);
    const storagePath = `screenshots/${userId}/${jobId}/${resultId}_thumb.jpg`;

    const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
            contentType: "image/jpeg",
            upsert: true,
        });

    if (error) {
        console.error("Thumbnail upload failed:", error);
        throw error;
    }

    return storagePath;
}

/**
 * Upload any file to Supabase Storage
 * @param {Buffer|string} content - File content (buffer or path)
 * @param {string} storagePath - Full storage path
 * @param {string} contentType - MIME type
 */
export async function uploadFile(content, storagePath, contentType = "application/octet-stream") {
    const buffer = typeof content === "string" ? await fs.readFile(content) : content;

    const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType, upsert: true });

    if (error) throw error;
    return storagePath;
}

/**
 * Get a signed URL for a storage object
 * @param {string} storagePath - Object path
 * @param {number} expiresIn - Seconds until expiry
 */
export async function getSignedUrl(storagePath, expiresIn = 3600) {
    const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, expiresIn);

    if (error) throw error;
    return data.signedUrl;
}

/**
 * Delete a file from storage
 */
export async function deleteFile(storagePath) {
    const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .remove([storagePath]);

    if (error) throw error;
}

/**
 * List files in a folder
 */
export async function listFiles(folderPath) {
    const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .list(folderPath);

    if (error) throw error;
    return data;
}
