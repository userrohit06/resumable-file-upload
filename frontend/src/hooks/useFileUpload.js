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

import { UploadQueue } from "../utils/upload.queue";
import { UPLOAD_STATUS } from "../constants/uploadStatus";

// ---------------------------------------------------------
// Global trackers
// ---------------------------------------------------------

const speedTrackers = {};
const uploadControllers = {};

// Maximum 2 files can upload simultaneously.
const uploadQueue = new UploadQueue(2);

// ---------------------------------------------------------
// Hook
// ---------------------------------------------------------

export const useFileUpload = () => {
  const [uploads, setUploads] = useState({});

  // -------------------------------------------------------
  // Perform actual upload
  // -------------------------------------------------------

  const performUpload = async (file, existingUploadID, controller) => {
    const storedUpload = findStoredUpload({
      fileName: file.name,
      fileSize: file.size,
    });

    const resumeUploadID = existingUploadID ?? storedUpload?.uploadID ?? null;

    try {
      // ---------------------------------------------------
      // 1. Get existing upload or initialize new upload
      // ---------------------------------------------------

      let upload;
      let uploadedChunks = [];

      if (resumeUploadID) {
        try {
          const status = await getUploadStatus(resumeUploadID);

          // -----------------------------------------------
          // Already completed
          // -----------------------------------------------

          if (status.status === UPLOAD_STATUS.COMPLETED) {
            removeStoredUpload(status.uploadID);

            setUploads((current) => ({
              ...current,

              [file.name]: {
                ...current[file.name],

                uploadID: status.uploadID,

                progress: 100,

                uploadedBytes: file.size,

                status: UPLOAD_STATUS.COMPLETED,

                speed: 0,
                eta: 0,

                retry: null,
              },
            }));

            return;
          }

          // -----------------------------------------------
          // Existing upload → resume
          // -----------------------------------------------

          upload = {
            uploadID: status.uploadID,

            totalChunks: status.totalChunks,
          };

          uploadedChunks = status.uploadedChunks ?? [];
        } catch (error) {
          // -----------------------------------------------
          // Stored upload is stale/missing
          // -----------------------------------------------

          console.error(
            "Stored upload no longer exists. Starting a new upload.",
          );

          removeStoredUpload(resumeUploadID);

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
        // -------------------------------------------------
        // New upload
        // -------------------------------------------------

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
      }

      // ---------------------------------------------------
      // 2. Create chunks
      // ---------------------------------------------------

      const chunks = createChunks(file);

      // ---------------------------------------------------
      // 3. Calculate already uploaded bytes
      // ---------------------------------------------------

      let confirmedBytes = 0;

      for (const chunkIndex of uploadedChunks) {
        if (chunkIndex >= 0 && chunkIndex < chunks.length) {
          confirmedBytes += chunks[chunkIndex].size;
        }
      }

      // ---------------------------------------------------
      // 4. Initialize rolling speed tracker
      // ---------------------------------------------------

      const now = performance.now();

      speedTrackers[file.name] = {
        samples: [
          {
            bytes: confirmedBytes,
            time: now,
          },
        ],
      };

      // ---------------------------------------------------
      // 5. Update UI with recovered progress
      // ---------------------------------------------------

      const initialProgress = (confirmedBytes / file.size) * 100;

      setUploads((current) => ({
        ...current,

        [file.name]: {
          ...current[file.name],

          file,

          uploadID: upload.uploadID,

          chunks,

          totalChunks: chunks.length,

          uploadedBytes: confirmedBytes,

          progress: initialProgress,

          speed: 0,

          eta: 0,

          status: UPLOAD_STATUS.UPLOADING,

          retry: null,

          error: null,
        },
      }));

      // ---------------------------------------------------
      // 6. Upload chunks
      // ---------------------------------------------------

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        // -----------------------------------------------
        // User paused the upload
        // -----------------------------------------------

        if (controller.signal.aborted) {
          return;
        }

        // -----------------------------------------------
        // Already uploaded → skip
        // -----------------------------------------------

        if (uploadedChunks.includes(chunkIndex)) {
          continue;
        }

        // -----------------------------------------------
        // Upload current chunk
        // -----------------------------------------------

        await retry(
          () =>
            uploadChunk({
              uploadID: upload.uploadID,

              chunk: chunks[chunkIndex],

              chunkIndex,

              signal: controller.signal,

              onUploadProgress: (progressEvent) => {
                // Don't update state after pause
                if (controller.signal.aborted) {
                  return;
                }

                const currentChunkUploaded = progressEvent.loaded;

                // -----------------------------------------
                // Overall uploaded bytes
                // -----------------------------------------

                const uploadedBytes = confirmedBytes + currentChunkUploaded;

                // -----------------------------------------
                // Overall progress
                // -----------------------------------------

                const progress = (uploadedBytes / file.size) * 100;

                // -----------------------------------------
                // Rolling speed
                // -----------------------------------------

                const currentTime = performance.now();

                const tracker = speedTrackers[file.name];

                if (!tracker) {
                  return;
                }

                tracker.samples.push({
                  bytes: uploadedBytes,

                  time: currentTime,
                });

                // Keep only the last 3 seconds
                const windowStart = currentTime - 3000;

                tracker.samples = tracker.samples.filter(
                  (sample) => sample.time >= windowStart,
                );

                let speed = 0;

                if (tracker.samples.length >= 2) {
                  const oldest = tracker.samples[0];

                  const newest = tracker.samples[tracker.samples.length - 1];

                  const bytesDifference = newest.bytes - oldest.bytes;

                  const timeDifference = (newest.time - oldest.time) / 1000;

                  if (timeDifference > 0) {
                    speed = bytesDifference / timeDifference;
                  }
                }

                // -----------------------------------------
                // ETA
                // -----------------------------------------

                const remainingBytes = Math.max(0, file.size - uploadedBytes);

                const eta = speed > 0 ? remainingBytes / speed : 0;

                // -----------------------------------------
                // Update state
                // -----------------------------------------

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

          // Initial delay
          1000,

          // Retry callback
          ({ retryNumber, maxRetries }) => {
            if (controller.signal.aborted) {
              return;
            }

            setUploads((current) => ({
              ...current,

              [file.name]: {
                ...current[file.name],

                status: UPLOAD_STATUS.RETRYING,

                retry: {
                  chunkIndex,

                  retryNumber,

                  maxRetries,
                },
              },
            }));
          },
        );

        // -----------------------------------------------
        // Check pause after request
        // -----------------------------------------------

        if (controller.signal.aborted) {
          return;
        }

        // -----------------------------------------------
        // Chunk successfully uploaded
        // -----------------------------------------------

        confirmedBytes += chunks[chunkIndex].size;

        // Add confirmed byte position to
        // speed tracker as a new sample.
        const currentTime = performance.now();

        const tracker = speedTrackers[file.name];

        if (tracker) {
          tracker.samples.push({
            bytes: confirmedBytes,
            time: currentTime,
          });
        }

        setUploads((current) => ({
          ...current,

          [file.name]: {
            ...current[file.name],

            uploadedBytes: confirmedBytes,

            progress: (confirmedBytes / file.size) * 100,

            status: UPLOAD_STATUS.UPLOADING,

            retry: null,
          },
        }));
      }

      // ---------------------------------------------------
      // 7. Don't complete after pause
      // ---------------------------------------------------

      if (controller.signal.aborted) {
        return;
      }

      // ---------------------------------------------------
      // 8. Complete upload
      // ---------------------------------------------------

      const result = await completeUpload(upload.uploadID);

      // ---------------------------------------------------
      // 9. Remove stored upload metadata
      // ---------------------------------------------------

      removeStoredUpload(upload.uploadID);

      // ---------------------------------------------------
      // 10. Mark as completed
      // ---------------------------------------------------

      setUploads((current) => ({
        ...current,

        [file.name]: {
          ...current[file.name],

          progress: 100,

          uploadedBytes: file.size,

          status: UPLOAD_STATUS.COMPLETED,

          speed: 0,

          eta: 0,

          retry: null,

          result,
        },
      }));

      // ---------------------------------------------------
      // 11. Cleanup trackers
      // ---------------------------------------------------

      delete speedTrackers[file.name];

      if (uploadControllers[file.name] === controller) {
        delete uploadControllers[file.name];
      }
    } catch (error) {
      // ---------------------------------------------------
      // Intentional pause
      // ---------------------------------------------------

      if (
        error.code === "ERR_CANCELED" ||
        error.name === "CanceledError" ||
        controller.signal.aborted
      ) {
        setUploads((current) => ({
          ...current,

          [file.name]: {
            ...current[file.name],

            status: UPLOAD_STATUS.PAUSED,

            speed: 0,

            eta: 0,

            retry: null,
          },
        }));

        delete speedTrackers[file.name];

        return;
      }

      // ---------------------------------------------------
      // Real failure
      // ---------------------------------------------------

      console.error("Upload failed:", error);

      setUploads((current) => ({
        ...current,

        [file.name]: {
          ...current[file.name],

          status: UPLOAD_STATUS.FAILED,

          error,

          retry: null,

          speed: 0,

          eta: 0,
        },
      }));

      delete speedTrackers[file.name];

      // Important:
      // tell the queue the task failed.
      throw error;
    }
  };

  // -------------------------------------------------------
  // QUEUE ENTRY POINT
  // -------------------------------------------------------

  const startUpload = (file, existingUploadID) => {
    // Each upload gets its own controller.
    const controller = new AbortController();

    uploadControllers[file.name] = controller;

    // Immediately show pending.
    setUploads((current) => ({
      ...current,

      [file.name]: {
        ...current[file.name],

        file,

        uploadID: existingUploadID ?? current[file.name]?.uploadID ?? null,

        uploadedBytes: current[file.name]?.uploadedBytes ?? 0,

        progress: current[file.name]?.progress ?? 0,

        speed: 0,

        eta: 0,

        status: UPLOAD_STATUS.PENDING,

        retry: null,

        error: null,
      },
    }));

    // Add upload to queue.
    uploadQueue.add(() => performUpload(file, existingUploadID, controller));
  };

  // -------------------------------------------------------
  // PAUSE
  // -------------------------------------------------------

  const pauseUpload = (fileName) => {
    const controller = uploadControllers[fileName];

    if (!controller) {
      return;
    }

    // Update UI immediately.
    setUploads((current) => ({
      ...current,

      [fileName]: {
        ...current[fileName],

        status: UPLOAD_STATUS.PAUSED,

        speed: 0,

        eta: 0,

        retry: null,
      },
    }));

    // Abort current HTTP request.
    controller.abort();
  };

  // -------------------------------------------------------
  // Return hook API
  // -------------------------------------------------------

  return {
    uploads,
    startUpload,
    pauseUpload,
  };
};
