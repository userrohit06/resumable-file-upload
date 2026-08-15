const UPLOAD_STORAGE_KEY = "resumable-uploads";

export const getStoredUploads = () => {
  const stored = localStorage.getItem(UPLOAD_STORAGE_KEY);
  if (!stored) return {};

  return JSON.parse(stored);
};

export const saveStoredUpload = (upload) => {
  const uploads = getStoredUploads();

  upload[upload.uploadID] = upload;

  localStorage.setItem(UPLOAD_STORAGE_KEY, JSON.stringify(uploads));
};

export const findStoredUpload = ({ fileName, fileSize }) => {
  const uploads = getStoredUploads();

  return Object.values(uploads).find(
    (upload) => upload.fileName === fileName && upload.fileSize === fileSize,
  );
};

export const removeStoredUpload = (uploadID) => {
  const uploads = getStoredUploads();
  delete uploads[uploadID];
  localStorage.setItem(UPLOAD_STORAGE_KEY, JSON.stringify(uploads));
};
