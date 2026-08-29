import React from "react";

import { UPLOAD_STATUS } from "../../constants/uploadStatus";

const FileUploadCard = ({ file, upload, onStart, onPause }) => {
  const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);

  const progress = upload?.progress ?? 0;
  const uploadedBytes = upload?.uploadedBytes ?? 0;
  const speed = upload?.speed ?? 0;
  const eta = upload?.eta ?? 0;

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 B";

    const units = ["B", "KB", "MB", "GB", "TB"];

    const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${(bytes / Math.pow(1024, unitIndex)).toFixed(
      2,
    )} ${units[unitIndex]}`;
  };

  const formatSpeed = (bytesPerSecond) => {
    if (!bytesPerSecond) {
      return "0 MB/s";
    }

    return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
  };

  const formatETA = (seconds) => {
    if (!seconds || !Number.isFinite(seconds)) {
      return "--";
    }

    const roundedSeconds = Math.ceil(seconds);

    if (roundedSeconds < 60) {
      return `${roundedSeconds}s`;
    }

    const minutes = Math.floor(roundedSeconds / 60);

    const remainingSeconds = roundedSeconds % 60;

    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);

    const remainingMinutes = minutes % 60;

    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <article className="file-card">
      <div className="file-card-header">
        <div className="file-info">
          <div className="file-icon">↑</div>

          <div>
            <h3 title={file.name}>{file.name}</h3>

            <p>{sizeInMB} MB</p>
          </div>
        </div>

        <span
          className={`file-status ${
            upload?.status === UPLOAD_STATUS.COMPLETED
              ? "file-status-success"
              : upload?.status === UPLOAD_STATUS.RETRYING
                ? "file-status-retrying"
                : upload?.status === UPLOAD_STATUS.PAUSED
                  ? "file-status-paused"
                  : upload?.status === UPLOAD_STATUS.FAILED
                    ? "file-status-failed"
                    : ""
          }`}
        >
          {upload?.status === UPLOAD_STATUS.RETRYING
            ? `Retrying chunk ${upload.retry?.chunkIndex + 1}...`
            : upload?.status === UPLOAD_STATUS.PENDING
              ? "Waiting in queue..."
              : upload?.status === UPLOAD_STATUS.PAUSED
                ? "Paused"
                : upload?.status === UPLOAD_STATUS.FAILED
                  ? "Upload failed"
                  : (upload?.status ?? UPLOAD_STATUS.WAITING)}
        </span>
      </div>

      <div className="progress-section">
        <div className="progress-track">
          <div
            className="progress-bar"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <div className="progress-meta">
          <span>{Math.round(progress)}%</span>

          <span>
            {upload
              ? `${formatBytes(uploadedBytes)} / ${formatBytes(file.size)}`
              : "Waiting to upload"}
          </span>
        </div>

        {upload?.status === UPLOAD_STATUS.UPLOADING && (
          <div className="upload-stats">
            <span>↑ {formatSpeed(speed)}</span>

            <span>{formatETA(eta)} left</span>
          </div>
        )}
      </div>

      {/* WAITING IN QUEUE */}
      {upload?.status === UPLOAD_STATUS.PENDING && (
        <button className="start-upload-button" disabled>
          Waiting...
        </button>
      )}

      {/* CURRENTLY UPLOADING */}
      {upload?.status === UPLOAD_STATUS.UPLOADING && (
        <button
          className="start-upload-button pause-button"
          onClick={() => onPause(file.name)}
        >
          Pause
        </button>
      )}

      {/* AUTOMATIC RETRY */}
      {upload?.status === UPLOAD_STATUS.RETRYING && (
        <button className="start-upload-button" disabled>
          Retrying...
        </button>
      )}

      {/* PAUSED */}
      {upload?.status === UPLOAD_STATUS.PAUSED && (
        <button
          className="start-upload-button resume-button"
          onClick={() => onStart(file, upload.uploadID)}
        >
          Resume
        </button>
      )}

      {/* FAILED AFTER ALL RETRIES */}
      {upload?.status === UPLOAD_STATUS.FAILED && (
        <button
          className="start-upload-button retry-button"
          onClick={() => onStart(file, upload.uploadID)}
        >
          Retry upload
        </button>
      )}
    </article>
  );
};

export default FileUploadCard;
