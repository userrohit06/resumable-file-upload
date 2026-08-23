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

const speedTrackers = {};

// One shared queue for the whole application.
// Maximum 2 files can upload simultaneously.
const uploadQueue = new UploadQueue(2);

export const useFileUpload = () => {
  const [uploads, setUploads] = useState({});

  const performUpload = async (file, existingUploadID) => {
    const storedUpload = findStoredUpload({
      fileName: file.name,
      fileSize: file.size,
    });

    const resumeUploadID = existingUploadID ?? storedUpload?.uploadID ?? null;

    try {
      // -----------------------------------------------------
      // 1. Get existing upload or initialize a new one
      // -----------------------------------------------------

      let upload;
      let uploadedChunks = [];

      if (resumeUploadID) {
        try {
          const status = await getUploadStatus(resumeUploadID);

          // Upload already completed
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

          // Upload still exists → resume it
          upload = {
            uploadID: status.uploadID,
            totalChunks: status.totalChunks,
          };

          uploadedChunks = status.uploadedChunks ?? [];
        } catch (error) {
          console.error(
            "Stored upload no longer exists. Starting a new upload.",
          );

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
      }

      // -----------------------------------------------------
      // 2. Create file chunks
      // -----------------------------------------------------

      const chunks = createChunks(file);

      // -----------------------------------------------------
      // 3. Initialize speed tracker
      // -----------------------------------------------------

      speedTrackers[file.name] = {
        bytes: 0,
        time: performance.now(),
      };

      // -----------------------------------------------------
      // 4. Update UI → uploading
      // -----------------------------------------------------

      setUploads((current) => ({
        ...current,

        [file.name]: {
          ...current[file.name],

          file,
          uploadID: upload.uploadID,
          chunks,
          totalChunks: chunks.length,
          uploadedBytes: 0,
          progress: 0,
          speed: 0,
          eta: 0,
          status: UPLOAD_STATUS.UPLOADING,
          retry: null,
          error: null,
        },
      }));

      // -----------------------------------------------------
      // 5. Track successfully confirmed bytes
      // -----------------------------------------------------

      let confirmedBytes = 0;

      // -----------------------------------------------------
      // 6. Upload every chunk
      // -----------------------------------------------------

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        // ---------------------------------------------------
        // Skip chunks already uploaded to the backend
        // ---------------------------------------------------

        if (uploadedChunks.includes(chunkIndex)) {
          confirmedBytes += chunks[chunkIndex].size;
          const progress = (confirmedBytes / file.size) * 100;
          setUploads((current) => ({
            ...current,

            [file.name]: {
              ...current[file.name],

              uploadedBytes: confirmedBytes,
              progress,
              status: UPLOAD_STATUS.UPLOADING,
            },
          }));

          continue;
        }

        // ---------------------------------------------------
        // Track current chunk progress
        // ---------------------------------------------------

        let previousChunkBytes = 0;

        await retry(
          () =>
            uploadChunk({
              uploadID: upload.uploadID,

              chunk: chunks[chunkIndex],

              chunkIndex,

              onUploadProgress: (progressEvent) => {
                const currentChunkUploaded = progressEvent.loaded;

                /*
                 * Bytes uploaded for the current chunk
                 * during this request.
                 */
                previousChunkBytes = currentChunkUploaded;

                /*
                 * Confirmed previous chunks
                 * +
                 * current chunk progress
                 */
                const uploadedBytes = confirmedBytes + currentChunkUploaded;

                // Overall percentage
                const progress = (uploadedBytes / file.size) * 100;

                // -----------------------------------------
                // Speed
                // -----------------------------------------

                const now = performance.now();
                const tracker = speedTrackers[file.name];

                if (!tracker) {
                  return;
                }

                const bytesUploaded = uploadedBytes - tracker.bytes;
                const timeElapsed = (now - tracker.time) / 1000;
                let speed = 0;

                if (timeElapsed > 0) {
                  speed = bytesUploaded / timeElapsed;
                }

                // -----------------------------------------
                // ETA
                // -----------------------------------------

                const remainingBytes = file.size - uploadedBytes;
                const eta = speed > 0 ? remainingBytes / speed : 0;

                // -----------------------------------------
                // Update tracker
                // -----------------------------------------

                tracker.bytes = uploadedBytes;
                tracker.time = now;

                // -----------------------------------------
                // Update React state
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

          // Initial retry delay
          1000,

          // Retry callback
          ({ retryNumber, maxRetries }) => {
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

        // ---------------------------------------------------
        // 7. Chunk successfully completed
        // ---------------------------------------------------

        confirmedBytes += chunks[chunkIndex].size;

        // ---------------------------------------------------
        // 8. Update state
        // ---------------------------------------------------

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

      // -----------------------------------------------------
      // 9. Ask backend to verify + merge
      // -----------------------------------------------------

      const result = await completeUpload(upload.uploadID);

      // -----------------------------------------------------
      // 10. Remove persistent upload information
      // -----------------------------------------------------

      removeStoredUpload(upload.uploadID);

      // -----------------------------------------------------
      // 11. Mark upload completed
      // -----------------------------------------------------

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

      // -----------------------------------------------------
      // 12. Cleanup speed tracker
      // -----------------------------------------------------

      delete speedTrackers[file.name];
    } catch (error) {
      console.error("Upload failed:", error);

      // -----------------------------------------------------
      // Mark upload as failed
      // -----------------------------------------------------

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

      // -----------------------------------------------------
      // Cleanup tracker
      // -----------------------------------------------------

      delete speedTrackers[file.name];

      /*
       * IMPORTANT:
       *
       * We rethrow the error.
       *
       * The UploadQueue needs to know that the task
       * finished with an error.
       */
      throw error;
    }
  };

  /*
   * ---------------------------------------------------------
   * QUEUE ENTRY POINT
   * ---------------------------------------------------------
   *
   * This function DOES NOT upload anything itself.
   *
   * It simply adds the upload task to the queue.
   */
  const startUpload = (file, existingUploadID) => {
    /*
     * Immediately show the file as pending.
     *
     * The queue may not start it immediately if all
     * concurrent upload slots are occupied.
     */
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

    /*
     * Add actual upload work to queue.
     *
     * Queue decides WHEN performUpload runs.
     */
    uploadQueue.add(() => performUpload(file, existingUploadID));
  };

  return {
    uploads,
    startUpload,
  };
};
