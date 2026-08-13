import {
  createUpload,
  deleteChunkDirectory,
  getMissingChunks,
  getUpload,
  markChunkUploaded,
  markUploadCompleted,
  saveChunk,
} from "../services/upload.service.js";
import { CHUNK_SIZE } from "../utils/file.utils.js";

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

    const upload = createUpload({
      fileName: fileName.trim(),
      fileSize,
      totalChunks,
    });

    res.status(201).json(upload);
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
    const { chunkIndex } = req.body;

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

    markChunkUploaded(uploadID, chunkIndex);

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

    const upload = getUpload(uploadID);

    if (!upload) {
      return res.status(400).json({ message: "Upload session not found!" });
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

    const upload = getUpload(uploadID);

    if (upload.status === "completed") {
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

    const complete = isUploadComplete(uploadID);

    if (!complete) {
      const missingChunks = getMissingChunks(uploadID);

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

    markUploadCompleted(uploadID);

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
