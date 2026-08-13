import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import { getChunkDirectory } from "../utils/file.utils.js";

const uploads = new Map();

export const createUpload = ({ fileName, fileSize, totalChunks }) => {
  const uploadID = crypto.randomUUID();

  const upload = {
    uploadID,
    fileName,
    fileSize,
    totalChunks,
    uploadedChunks: [],
    status: "uploading",
  };

  uploads.set(uploadID, upload);

  return upload;
};

export const saveChunk = async ({ uploadID, chunkIndex, chunk }) => {
  const upload = uploads.get(uploadID);

  if (!upload) {
    throw new Error("Upload session not found");
  }

  if (chunkIndex < 0 || chunkIndex >= upload.totalChunks) {
    throw new Error("Invalid chunk index");
  }

  const chunkDirectory = getChunkDirectory(uploadID);

  await fs.mkdir(chunkDirectory, { recursive: true });

  const chunkPath = path.join(chunkDirectory, String(chunkIndex));

  const chunkExists = await fs
    .access(chunkPath)
    .then(() => true)
    .catch(() => false);

  if (chunkExists) {
    return {
      chunkIndex,
      size: 0,
      alreadyUploaded: true,
    };
  }

  await fs.writeFile(chunkPath, chunk);

  return {
    chunkIndex,
    size: chunk.length,
    alreadyUploaded: false,
  };
};

export const markChunkUploaded = (uploadID, chunkIndex) => {
  const upload = uploads.get(uploadID);

  if (!upload.uploadedChunks.includes(chunkIndex)) {
    upload.uploadedChunks.push(chunkIndex);
  }

  return upload;
};

export const getUpload = (uploadID) => {
  return uploads.get(uploadID);
};

export const isUploadComplete = (uploadID) => {
  const upload = uploads.get(uploadID);

  if (!upload) {
    throw new Error("Upload session not found!");
  }

  return upload.uploadedChunks.length === upload.totalChunks;
};

export const mergeChunks = async (uploadID) => {
  const upload = uploads.get(uploadID);

  if (!upload) {
    throw new Error("Upload session not found");
  }

  const chunkDirectory = getChunkDirectory(uploadID);

  const uploadDirectory = path.join(process.cwd(), "storage", "uploads");

  await fs.mkdir(uploadDirectory, { recursive: true });

  const finalFilePath = path.join(uploadDirectory, upload.fileName);

  const finalFileHandle = await fs.open(finalFilePath, "w");

  try {
    for (let chunkIndex = 0; chunkIndex < upload.totalChunks; chunkIndex++) {
      const chunkPath = path.join(chunkDirectory, String(chunkIndex));

      const chunk = await fs.readFile(chunkPath);

      await finalFileHandle.write(chunk);
    }
  } finally {
    await finalFileHandle.close();
  }

  return {
    fileName: upload.fileName,
    filePath: finalFilePath,
  };
};

export const getMissingChunks = (uploadID) => {
  const upload = uploads.get(uploadID);

  if (!upload) {
    throw new Error("Upload session not found!");
  }

  const missingChunks = [];

  for (let chunkIndex = 0; chunkIndex < upload.totalChunks; chunkIndex++) {
    if (!upload.uploadedChunks.includes(chunkIndex)) {
      missingChunks.push(chunkIndex);
    }
  }

  return missingChunks;
};

export const deleteChunkDirectory = async (uploadID) => {
  const chunkDirectory = getChunkDirectory(uploadID);

  await fs.rm(chunkDirectory, {
    recursive: true,
    force: true,
  });
};

export const markUploadCompleted = (uploadID) => {
  const upload = uploads.get(uploadID);

  if (!upload) {
    throw new Error("Upload session not found");
  }

  upload.status = "completed";

  return upload;
};
