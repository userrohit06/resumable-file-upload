import mongoose from "mongoose";
import { randomUUID } from "crypto";

const uploadSchema = new mongoose.Schema(
  {
    uploadID: {
      type: String,
      default: () => randomUUID(),
      unique: true,
      required: true,
    },

    fileName: {
      type: String,
      required: true,
    },

    fileSize: {
      type: Number,
      required: true,
    },

    totalChunks: {
      type: Number,
      required: true,
    },

    uploadedChunks: {
      type: [Number],
      default: [],
    },

    status: {
      type: String,
      enum: [
        "pending",
        "uploading",
        "paused",
        "completed",
        "failed",
        "aborted",
      ],
      default: "pending",
    },
  },
  {
    timestamps: true,
  },
);

export const Upload = mongoose.model("Upload", uploadSchema);
