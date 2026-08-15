import { useState } from "react";

import {
  completeUpload,
  getUploadStatus,
  initializeUpload,
  uploadChunk,
} from "../services/upload.api";

import { createChunks } from "../utils/upload.utils";
import { retry } from "../utils/retry.utils";
import {
  findStoredUpload,
  removeStoredUpload,
  saveStoredUpload,
} from "../utils/upload.storage";

const speedTrackers = {};

export const useFileUpload = () => {
  const [uploads, setUploads] = useState({});

  const startUpload = async (file, existingUploadID) => {
    const storedUpload = findStoredUpload({
      fileName: file.name,
      fileSize: file.size,
    });

    const resumeUploadID = existingUploadID ?? storedUpload?.uploadID ?? null;

    try {
      // 1. Get existing upload or initialize a new one
      let upload;
      let uploadedChunks = [];

      if (resumeUploadID) {
        try {
          const status = await getUploadStatus(resumeUploadID);

          // Upload already completed
          if (status.status === "completed") {
            console.log("Upload already completed:", status);

            removeStoredUpload(status.uploadID);

            return;
          }

          // Upload still exists → resume
          upload = {
            uploadID: status.uploadID,
            totalChunks: status.totalChunks,
          };

          uploadedChunks = status.uploadedChunks ?? [];

          console.log("Resuming upload:", status);
        } catch (error) {
          console.log("Stored upload no longer exists. Starting a new upload.");

          // Remove stale localStorage entry
          removeStoredUpload(resumeUploadID);

          // Create a completely new upload
          upload = await initializeUpload({
            fileName: file.name,
            fileSize: file.size,
          });

          saveStoredUpload({
            uploadID: upload.uploadID,
            fileName: file.name,
            fileSize: file.size,
            totalChunks: upload.totalChunks,
          });

          uploadedChunks = [];
        }
      } else {
        // Start a completely new upload
        upload = await initializeUpload({
          fileName: file.name,
          fileSize: file.size,
        });

        saveStoredUpload({
          uploadID: upload.uploadID,
          fileName: file.name,
          fileSize: file.size,
          totalChunks: upload.totalChunks,
        });

        console.log("Upload started:", upload);
      }

      // 2. Create the chunks
      const chunks = createChunks(file);

      // 3. Initialize speed tracker
      speedTrackers[file.name] = {
        bytes: 0,
        time: performance.now(),
      };

      // 4. Initialize frontend upload state
      setUploads((current) => ({
        ...current,

        [file.name]: {
          file,
          uploadID: upload.uploadID,
          chunks,
          totalChunks: chunks.length,

          uploadedBytes: 0,
          progress: 0,

          speed: 0,
          eta: 0,

          status: "uploading",
          retry: null,
        },
      }));

      console.log("Upload started:", upload);

      // 5. Track bytes successfully uploaded
      let confirmedBytes = 0;

      // 6. Upload every chunk
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        // Skip chunks that are already on the server
        if (uploadedChunks.includes(chunkIndex)) {
          confirmedBytes += chunks[chunkIndex].size;

          const progress = (confirmedBytes / file.size) * 100;
          setUploads((currrent) => ({
            ...current,
            [file.name]: {
              ...currrent[file.name],

              uploadedBytes: confirmedBytes,
              progress,
              status: "uploading",
            },
          }));

          continue;
        }

        // Reset progress tracking for this chunk attempt
        let previousChunkBytes = 0;

        await retry(
          () =>
            uploadChunk({
              uploadID: upload.uploadID,
              chunk: chunks[chunkIndex],
              chunkIndex,

              onUploadProgress: (progressEvent) => {
                // Bytes uploaded for the current chunk attempt
                const currentChunkUploaded = progressEvent.loaded;

                // Used later for accurate speed calculation
                const bytesUploadedSinceLastEvent =
                  currentChunkUploaded - previousChunkBytes;

                previousChunkBytes = currentChunkUploaded;

                // Successfully uploaded previous chunks
                // + currently uploading bytes
                const uploadedBytes = confirmedBytes + currentChunkUploaded;

                // Overall file progress
                const progress = (uploadedBytes / file.size) * 100;

                // Current time
                const now = performance.now();

                const tracker = speedTrackers[file.name];

                // Current speed
                const bytesUploaded = uploadedBytes - tracker.bytes;

                const timeElapsed = (now - tracker.time) / 1000;

                let speed = 0;

                if (timeElapsed > 0) {
                  speed = bytesUploaded / timeElapsed;
                }

                // Remaining bytes
                const remainingBytes = file.size - uploadedBytes;

                // Estimated remaining time
                const eta = speed > 0 ? remainingBytes / speed : 0;

                // Update tracker
                tracker.bytes = uploadedBytes;

                tracker.time = now;

                // Update React state
                setUploads((current) => ({
                  ...current,

                  [file.name]: {
                    ...current[file.name],

                    uploadedBytes,
                    progress,
                    speed,
                    eta,
                  },
                }));
              },
            }),

          // Maximum retries
          3,

          // Initial retry delay
          1000,

          // Retry callback
          ({ retryNumber, maxRetries }) => {
            setUploads((current) => ({
              ...current,

              [file.name]: {
                ...current[file.name],

                status: "retrying",

                retry: {
                  chunkIndex,
                  retryNumber,
                  maxRetries,
                },
              },
            }));
          },
        );

        // 7. Chunk successfully completed.
        // Only now do we consider its bytes confirmed.
        confirmedBytes += chunks[chunkIndex].size;

        // 8. Reset state back to uploading
        setUploads((current) => ({
          ...current,

          [file.name]: {
            ...current[file.name],

            uploadedBytes: confirmedBytes,

            progress: (confirmedBytes / file.size) * 100,

            status: "uploading",
            retry: null,
          },
        }));
      }

      console.log("All chunks uploaded");

      // 9. Tell backend to verify and merge
      const result = await completeUpload(upload.uploadID);

      // 10. Remove upload from localStorage
      removeStoredUpload(upload.uploadID);

      console.log("Upload completed:", result);

      // 11. Mark upload as completed
      setUploads((current) => ({
        ...current,

        [file.name]: {
          ...current[file.name],

          progress: 100,
          uploadedBytes: file.size,

          status: "completed",

          speed: 0,
          eta: 0,

          retry: null,

          result,
        },
      }));

      // 12. Clean up speed tracker
      delete speedTrackers[file.name];
    } catch (error) {
      console.error("Upload failed:", error);

      // Mark upload as failed
      setUploads((current) => ({
        ...current,

        [file.name]: {
          ...current[file.name],

          status: "failed",

          error,
        },
      }));

      // Clean up tracker
      delete speedTrackers[file.name];
    }
  };

  return {
    uploads,
    startUpload,
  };
};
