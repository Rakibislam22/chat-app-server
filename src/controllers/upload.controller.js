// chat-app-server/src/controllers/upload.controller.js
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");
const r2Client = require("../config/r2");

const VIDEO_MAX = 100 * 1024 * 1024;  // 100 MB
const OTHER_MAX = 50 * 1024 * 1024;   // 50 MB
const MAX_FILES = 5;

/**
 * POST /api/upload/presign
 * Body: [{ filename, contentType, size }]
 * Returns: [{ presignedUrl, publicUrl, key }]
 */
const presign = async (req, res) => {
  try {
    const files = req.body;

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ message: "files array is required" });
    }
    if (files.length > MAX_FILES) {
      return res.status(400).json({ message: `Max ${MAX_FILES} files per upload` });
    }

    // Validate each file
    for (const file of files) {
      const { filename, contentType, size } = file;
      if (!filename || typeof size !== "number") {
        return res.status(400).json({ message: "Each file needs filename and size" });
      }
      const isVideo = (contentType || "").startsWith("video/");
      const limit = isVideo ? VIDEO_MAX : OTHER_MAX;
      if (size > limit) {
        return res.status(400).json({
          message: `${filename} exceeds size limit (${isVideo ? "100MB" : "50MB"})`,
        });
      }
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const results = await Promise.all(
      files.map(async ({ filename, contentType, size }) => {
        // Extract extension from filename (safe — server-generated key)
        const lastDot = filename.lastIndexOf(".");
        const ext = lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : "";
        const key = `uploads/${year}/${month}/${uuidv4()}${ext ? "." + ext : ""}`;

        const effectiveContentType = contentType || "application/octet-stream";

        const command = new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
          ContentType: effectiveContentType,
        });

        const presignedUrl = await getSignedUrl(r2Client, command, {
          expiresIn: 300, // 5 minutes
        });

        const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

        return { presignedUrl, publicUrl, key };
      })
    );

    return res.json(results);
  } catch (err) {
    console.error("presign error:", err.message);
    return res.status(500).json({ message: "Failed to generate upload URL" });
  }
};

module.exports = { presign };
