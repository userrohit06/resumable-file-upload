import React from "react";

import { UPLOAD_STATUS } from "../../constants/uploadStatus";

const FileUploadCard = ({
  file,
  upload,
  onStart,
  onPause,
  onCancel,
  onResume,
}) => {
  const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);

  const progress = upload?.progress ?? 0;
  const uploadedBytes = upload?.uploadedBytes ?? 0;
  const speed = upload?.speed ?? 0;
  const eta = upload?.eta ?? 0;

  const formatBytes = (bytes) => {
    if (bytes === 0) {
      return "0 B";
    }

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

  const getStatusClass = () => {
    if (!upload?.status) {
      return "";
    }

    switch (upload.status) {
      case UPLOAD_STATUS.COMPLETED:
        return "file-status-success";

      case UPLOAD_STATUS.RETRYING:
        return "file-status-retrying";

      case UPLOAD_STATUS.PAUSED:
        return "file-status-paused";

      case UPLOAD_STATUS.FAILED:
        return "file-status-failed";

      default:
        return "";
    }
  };

  const getStatusText = () => {
    if (!upload?.status) {
      return UPLOAD_STATUS.WAITING;
    }

    switch (upload.status) {
      case UPLOAD_STATUS.RETRYING:
        return upload.retry
          ? `Retrying chunk ${upload.retry.chunkIndex + 1}...`
          : "Retrying...";

      case UPLOAD_STATUS.PENDING:
        return "Waiting in queue...";

      case UPLOAD_STATUS.PAUSED:
        return "Paused";

      case UPLOAD_STATUS.FAILED:
        return "Upload failed";

      case UPLOAD_STATUS.UPLOADING:
        return "Uploading";

      case UPLOAD_STATUS.COMPLETED:
        return "Completed";

      default:
        return upload.status;
    }
  };

  return (
    <article className="file-card">
      {/* ------------------------------------------------ */}
      {/* HEADER */}
      {/* ------------------------------------------------ */}

      <div className="file-card-header">
        <div className="file-info">
          <div className="file-icon">↑</div>

          <div>
            <h3 title={file.name}>{file.name}</h3>

            <p>{sizeInMB} MB</p>
          </div>
        </div>

        <span className={`file-status ${getStatusClass()}`}>
          {getStatusText()}
        </span>
      </div>

      {/* ------------------------------------------------ */}
      {/* PROGRESS */}
      {/* ------------------------------------------------ */}

      <div className="progress-section">
        <div className="progress-track">
          <div
            className="progress-bar"
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
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

        {/* ------------------------------------------------ */}
        {/* SPEED + ETA */}
        {/* ------------------------------------------------ */}

        {upload?.status === UPLOAD_STATUS.UPLOADING && (
          <div className="upload-stats">
            <span>↑ {formatSpeed(speed)}</span>

            <span>{formatETA(eta)} left</span>
          </div>
        )}
      </div>

      {/* ------------------------------------------------ */}
      {/* PENDING */}
      {/* ------------------------------------------------ */}

      {upload?.status === UPLOAD_STATUS.PENDING && (
        <button
          className="start-upload-button pause-button"
          onClick={() => onPause(file.name)}
          style={{
            marginTop: "18px",
          }}
        >
          Pause
        </button>
      )}

      {/* ------------------------------------------------ */}
      {/* UPLOADING */}
      {/* ------------------------------------------------ */}

      {upload?.status === UPLOAD_STATUS.UPLOADING && (
        <div className="upload-actions">
          <button
            className="start-upload-button pause-button"
            onClick={() => onPause(file.name)}
          >
            Pause
          </button>

          <button
            className="cancel-upload-button"
            onClick={() => onCancel(file.name)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ------------------------------------------------ */}
      {/* RETRYING */}
      {/* ------------------------------------------------ */}

      {upload?.status === UPLOAD_STATUS.RETRYING && (
        <button className="start-upload-button" disabled>
          Retrying...
        </button>
      )}

      {/* ------------------------------------------------ */}
      {/* PAUSED */}
      {/* ------------------------------------------------ */}

      {upload?.status === UPLOAD_STATUS.PAUSED && (
        <div className="upload-actions">
          <button
            className="start-upload-button resume-button"
            onClick={() => onResume(file)}
          >
            Resume
          </button>

          <button
            className="cancel-upload-button"
            onClick={() => onCancel(file.name)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ------------------------------------------------ */}
      {/* FAILED */}
      {/* ------------------------------------------------ */}

      {upload?.status === UPLOAD_STATUS.FAILED && (
        <div className="upload-actions">
          <button
            className="start-upload-button retry-button"
            onClick={() => onStart(file, upload.uploadID)}
          >
            Retry upload
          </button>

          <button
            className="cancel-upload-button"
            onClick={() => onCancel(file.name)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ------------------------------------------------ */}
      {/* COMPLETED */}
      {/* ------------------------------------------------ */}

      {upload?.status === UPLOAD_STATUS.COMPLETED && (
        <div className="upload-complete-message">
          ✓ Upload completed successfully
        </div>
      )}
    </article>
  );
};

export default FileUploadCard;
