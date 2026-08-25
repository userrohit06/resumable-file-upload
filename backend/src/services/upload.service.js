import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import { getChunkDirectory } from "../utils/file.utils.js";
import { Upload } from "../models/Upload.js";

export const createUpload = async ({ fileName, fileSize, totalChunks }) => {
  const uploadID = crypto.randomUUID();

  const upload = await Upload.create({
    uploadID,
    fileName,
    fileSize,
    totalChunks,
    uploadedChunks: [],
    status: "pending",
  });

  return upload;
};

export const saveChunk = async ({ uploadID, chunkIndex, chunk }) => {
  const upload = await Upload.findOne({ uploadID });

  if (!upload) {
    throw new Error("Upload session not found");
  }

  if (chunkIndex < 0 || chunkIndex >= upload.totalChunks) {
    throw new Error("Invalid chunk index");
  }

  const chunkDirectory = getChunkDirectory(uploadID);

  await fs.mkdir(chunkDirectory, {
    recursive: true,
  });

  const chunkPath = path.join(chunkDirectory, String(chunkIndex));

  const chunkExists = await fs
    .access(chunkPath)
    .then(() => true)
    .catch(() => false);

  // Idempotency:
  // If the same chunk is sent again,
  // don't overwrite or corrupt it.
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

export const markChunkUploaded = async (uploadID, chunkIndex) => {
  const upload = await Upload.findOneAndUpdate(
    {
      uploadID,
    },
    {
      $addToSet: {
        uploadedChunks: chunkIndex,
      },

      $set: {
        status: "uploading",
      },
    },
    {
      new: true,
    },
  );

  if (!upload) {
    throw new Error("Upload session not found");
  }

  return upload;
};

export const getUpload = async (uploadID) => {
  const upload = await Upload.findOne({
    uploadID,
  });

  return upload;
};

export const isUploadComplete = async (uploadID) => {
  const upload = await Upload.findOne({
    uploadID,
  });

  if (!upload) {
    throw new Error("Upload session not found");
  }

  return upload.uploadedChunks.length === upload.totalChunks;
};

export const getMissingChunks = async (uploadID) => {
  const upload = await Upload.findOne({
    uploadID,
  });

  if (!upload) {
    throw new Error("Upload session not found");
  }

  const missingChunks = [];

  for (let chunkIndex = 0; chunkIndex < upload.totalChunks; chunkIndex++) {
    if (!upload.uploadedChunks.includes(chunkIndex)) {
      missingChunks.push(chunkIndex);
    }
  }

  return missingChunks;
};

export const mergeChunks = async (uploadID) => {
  const upload = await Upload.findOne({
    uploadID,
  });

  if (!upload) {
    throw new Error("Upload session not found");
  }

  const chunkDirectory = getChunkDirectory(uploadID);
  const uploadDirectory = path.join(process.cwd(), "storage", "uploads");

  await fs.mkdir(uploadDirectory, {
    recursive: true,
  });

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

export const deleteChunkDirectory = async (uploadID) => {
  const chunkDirectory = getChunkDirectory(uploadID);

  await fs.rm(chunkDirectory, {
    recursive: true,
    force: true,
  });
};

export const markUploadCompleted = async (uploadID) => {
  const upload = await Upload.findOneAndUpdate(
    {
      uploadID,
    },
    {
      $set: {
        status: "completed",
      },
    },
    {
      new: true,
    },
  );

  if (!upload) {
    throw new Error("Upload session not found");
  }

  return upload;
};
