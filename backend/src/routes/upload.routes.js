import { Router } from "express";
import {
  cancelUpload,
  completeUpload,
  getUploadStatus,
  initUpload,
  listUploads,
  pauseUploadCtrl,
  resumeUploadCtrl,
  uploadChunk,
} from "../controllers/upload.controller.js";
import upload from "../middleware/upload.middleware.js";

const uploadRoutes = Router();

uploadRoutes.post("/init", initUpload);
uploadRoutes.post("/:uploadID/chunk", upload.single("chunk"), uploadChunk);
uploadRoutes.get("/:uploadID/status", getUploadStatus);
uploadRoutes.post("/:uploadID/complete", completeUpload);
uploadRoutes.delete("/:uploadID/cancel", cancelUpload);
uploadRoutes.get("/", listUploads);
uploadRoutes.post("/:uploadID/pause", pauseUploadCtrl);
uploadRoutes.post("/:uploadID/resume", resumeUploadCtrl);

export default uploadRoutes;
