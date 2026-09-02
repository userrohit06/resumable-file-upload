import {
  deleteChunkDirectory,
  deleteUpload,
  getMissingChunks,
  getUpload,
  getUploads,
  isUploadComplete,
  markChunkUploaded,
  markUploadCompleted,
  mergeChunks,
  pauseUpload,
  resumeUpload,
  saveChunk,
} from "../services/upload.service.js";
import { CHUNK_SIZE } from "../utils/file.utils.js";
import { Upload } from "../models/Upload.js";
import { UPLOAD_STATUS } from "../constants/uploadStatus.js";

export const initUpload = async (req, res) => {
  try {
    const { fileName, fileSize } = req.body;

    if (typeof fileName !== "string" || fileName.trim() === "") {
      return res.status(400).json({ message: "Valid file name is required!" });
    }

    if (typeof fileSize !== "number" || fileSize <= 0) {
      return res.status(400).json({ message: "Valid file size is required!" });
    }

    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

    const upload = await Upload.create({
      fileName: fileName.trim(),
      fileSize,
      totalChunks,
      status: UPLOAD_STATUS.PENDING,
    });

    res.status(201).json({
      uploadID: upload.uploadID,
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      totalChunks: upload.totalChunks,
      uploadedChunks: upload.uploadedChunks,
      status: upload.status,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to initialize upload",
    });
  }
};

export const uploadChunk = async (req, res) => {
  try {
    const { uploadID } = req.params;
    const chunkIndex = Number(req.headers["x-chunk-index"]);

    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      return res.status(400).json({
        message: "Invalid chunk index",
      });
    }

    if (!uploadID) {
      return res.status(400).json({ message: "uploadID is required!" });
    }

    if (!Number.isInteger(Number(chunkIndex)) || Number(chunkIndex) < 0) {
      return res.status(400).json({ message: "Valid chunkIndex is required!" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Chunk file is required!" });
    }

    const result = await saveChunk({
      uploadID,
      chunkIndex: Number(chunkIndex),
      chunk: req.file.buffer,
    });

    await markChunkUploaded(uploadID, chunkIndex);

    return res.status(200).json({
      message: result.alreadyUploaded
        ? "Chunk already uploaded"
        : "Chunk uploaded successfully",
      ...result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({ message: "Failed to upload chunk." });
  }
};

export const getUploadStatus = async (req, res) => {
  try {
    const { uploadID } = req.params;

    if (!uploadID) {
      return res.status(400).json({ message: "uploadID is required!" });
    }

    const upload = await getUpload(uploadID);

    if (!upload) {
      return res.status(404).json({ message: "Upload session not found!" });
    }

    return res.status(200).json({
      uploadID: upload.uploadID,
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      totalChunks: upload.totalChunks,
      uploadedChunks: upload.uploadedChunks,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({ message: "Failed to get upload status" });
  }
};

export const completeUpload = async (req, res) => {
  try {
    const { uploadID } = req.params;

    if (!uploadID) {
      return res.status(400).json({
        message: "uploadID is required",
      });
    }

    const upload = await getUpload(uploadID);

    if (!upload) {
      return res.status(404).json({ message: "Upload session not found!" });
    }

    if (upload.status === UPLOAD_STATUS.COMPLETED) {
      return res.status(409).json({
        message: "Upload already completed",
        uploadID,
      });
    }

    if (!upload) {
      return res.status(404).json({
        message: "Upload session not found",
      });
    }

    const complete = await isUploadComplete(uploadID);

    if (!complete) {
      const missingChunks = await getMissingChunks(uploadID);

      return res.status(400).json({
        message: "Upload is incomplete",
        uploadID,
        totalChunks: upload.totalChunks,
        uploadedChunks: upload.uploadedChunks,
        missingChunks,
      });
    }

    const result = await mergeChunks(uploadID);

    await deleteChunkDirectory(uploadID);

    await markUploadCompleted(uploadID);

    return res.status(200).json({
      message: "File uploaded successfully",
      fileName: result.fileName,
      filePath: result.filePath,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to complete upload",
    });
  }
};

export const cancelUpload = async (req, res) => {
  try {
    const { uploadID } = req.params;

    if (!uploadID) {
      return res.status(400).json({
        message: "uploadID is required.",
      });
    }

    const upload = await getUpload(uploadID);

    if (!upload) {
      return res.status(404).json({
        message: "Upload session not found.",
      });
    }

    // don't allow cancelling an already completed upload
    if (upload.status === UPLOAD_STATUS.COMPLETED) {
      return res.status(409).json({
        message: "Completed upload cannot be cancelled",
        uploadID,
      });
    }

    // remove temporary chunk files
    await deleteChunkDirectory(uploadID);

    // remove upload record from MongoDB
    await deleteUpload(uploadID);

    return res.status(200).json({
      message: "Upload cancelled successfully.",
      uploadID,
    });
  } catch (error) {
    console.error("Cancel upload failed:", error);

    return res.status(500).json({
      message: "Failed to cancel upload.",
    });
  }
};

export const listUploads = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      20,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
    );
    const { status, search } = req.query;

    if (status && !Object.values(UPLOAD_STATUS).includes(status)) {
      return res.status(400).json({ message: "Invalid upload status" });
    }

    const { uploads, totalItems } = await getUploads({
      page,
      limit,
      status,
      search: search?.trim(),
    });

    const totalPages = Math.ceil(totalItems / limit);

    return res.status(200).json({
      uploads,

      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevious: page > 1,
      },
    });
  } catch (error) {
    console.error("Failed to get uploads:", error);

    return res.status(500).json({ message: "Failed to get uploads" });
  }
};

export const pauseUploadCtrl = async (req, res) => {
  try {
    const { uploadID } = req.params;

    if (!uploadID)
      return res.status(400).json({ message: "uploadID is required" });

    const upload = await getUpload(uploadID);

    if (!upload)
      return res.status(404).json({ message: "Upload session not found" });

    if (upload.status === UPLOAD_STATUS.COMPLETED)
      return res.status(409).json({
        message: "Completed upload cannot be paused",
        uploadID,
      });

    const updatedUpload = await pauseUpload(uploadID);

    return res.status(200).json({
      message: "Upload paused successfully",
      uploadID: updatedUpload.uploadID,
      status: updatedUpload.status,
    });
  } catch (error) {
    console.error("Failed to pause upload:", error);

    return res.status(500).json({ message: "Failed to pause upload" });
  }
};

export const resumeUploadCtrl = async (req, res) => {
  try {
    const { uploadID } = req.params;

    if (!uploadID) {
      return res.status(400).json({
        message: "uploadID is required",
      });
    }

    const upload = await resumeUpload(uploadID);

    return res.status(200).json({
      message: "Upload resumed successfully",
      uploadID: upload.uploadID,
      status: upload.status,
      uploadedChunks: upload.uploadedChunks,
      totalChunks: upload.totalChunks,
    });
  } catch (error) {
    console.error("Failed to resume upload:", error);

    return res.status(400).json({
      message: error.message,
    });
  }
};
