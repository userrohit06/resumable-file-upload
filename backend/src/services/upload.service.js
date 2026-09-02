import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import { getChunkDirectory } from "../utils/file.utils.js";
import { Upload } from "../models/Upload.js";
import { UPLOAD_STATUS } from "../constants/uploadStatus.js";

export const createUpload = async ({ fileName, fileSize, totalChunks }) => {
  const uploadID = crypto.randomUUID();

  const upload = await Upload.create({
    uploadID,
    fileName,
    fileSize,
    totalChunks,
    uploadedChunks: [],
    status: UPLOAD_STATUS.PENDING,
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
        status: UPLOAD_STATUS.UPLOADING,
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
        status: UPLOAD_STATUS.COMPLETED,
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

export const deleteUpload = async (uploadID) => {
  const result = await Upload.findOneAndDelete({ uploadID });
  return result;
};

export const getUploads = async ({ page, limit, status, search }) => {
  const skip = (page - 1) * limit;

  const filter = {};

  // filter by status
  if (status) filter.status = status;

  // search by filename
  if (search) {
    filter.fileName = {
      $regex: search,
      $options: "i",
    };
  }

  const [uploads, totalItems] = await Promise.all([
    Upload.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Upload.countDocuments(filter),
  ]);

  return {
    uploads,
    totalItems,
  };
};

export const pauseUpload = async (uploadID) => {
  const upload = await Upload.findOneAndUpdate(
    { uploadID },
    {
      $set: {
        status: UPLOAD_STATUS.PAUSED,
      },
    },
    { new: true },
  );

  if (!upload) throw new Error("Upload session not found");

  return upload;
};

export const resumeUpload = async (uploadID) => {
  const upload = await Upload.findOneAndUpdate(
    { uploadID, status: UPLOAD_STATUS.PENDING },
    {
      $set: {
        status: UPLOAD_STATUS.UPLOADING,
      },
    },
    { new: true },
  );

  if (!upload) throw new Error("Paused upload session not found");

  return upload;
};
