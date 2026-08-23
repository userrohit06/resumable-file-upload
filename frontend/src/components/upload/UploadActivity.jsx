import React from "react";
import { createPortal } from "react-dom";
import { UPLOAD_STATUS } from "../../constants/uploadStatus";

const UploadActivity = ({ uploads = {} }) => {
  const uploadList = Object.values(uploads);

  const activeUploads = uploadList.filter(
    (upload) =>
      upload.status === UPLOAD_STATUS.UPLOADING ||
      upload.status === UPLOAD_STATUS.RETRYING,
  );

  const pendingUploads = uploadList.filter(
    (upload) => upload.status === UPLOAD_STATUS.PENDING,
  );

  if (activeUploads.length === 0 && pendingUploads.length === 0) return null;

  return createPortal(
    <div className="upload-activity">
      <div className="upload-activity-icon">↑</div>

      <div className="upload-activity-content">
        <strong>
          {activeUploads.length > 0
            ? `${activeUploads.length} ${activeUploads.length === 1 ? "upload" : "uploads"} in progress`
            : "Waiting to upload"}
        </strong>

        {pendingUploads.length > 0 && (
          <span>{pendingUploads.length} waiting in queue</span>
        )}
      </div>
    </div>,
    document.getElementById("portal-root"),
  );
};

export default UploadActivity;
