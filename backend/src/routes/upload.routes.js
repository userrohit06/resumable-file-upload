import { Router } from "express";
import {
  completeUpload,
  getUploadStatus,
  initUpload,
  uploadChunk,
} from "../controllers/upload.controller.js";
import upload from "../middleware/upload.middleware.js";

const uploadRoutes = Router();

uploadRoutes.post("/init", initUpload);
uploadRoutes.post("/:uploadID/chunk", upload.single("chunk"), uploadChunk);
uploadRoutes.post("/:uploadID/status", getUploadStatus);
uploadRoutes.post("/:uploadID/complete", completeUpload);

export default uploadRoutes;
