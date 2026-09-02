import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:9000/api/uploads",
});

export const initializeUpload = async ({ fileName, fileSize }) => {
  const response = await api.post("/init", { fileName, fileSize });
  return response.data;
};

export const uploadChunk = async ({
  uploadID,
  chunk,
  chunkIndex,
  onUploadProgress,
  signal,
}) => {
  const formData = new FormData();

  formData.append("chunk", chunk, `chunk-${chunkIndex}`);

  const response = await api.post(`/${uploadID}/chunk`, formData, {
    headers: {
      "X-Chunk-Index": chunkIndex,
    },

    onUploadProgress,
    signal,
  });

  return response.data;
};

export const completeUpload = async (uploadID) => {
  const response = await api.post(`/${uploadID}/complete`);
  return response.data;
};

export const getUploadStatus = async (uploadID) => {
  const response = await api.get(`/${uploadID}/status`);
  return response.data;
};

export const cancelUpload = async (uploadID) => {
  const response = await api.delete(`/${uploadID}/cancel`);
  return response.data;
};

export const pauseUpload = async (uploadID) => {
  const response = await api.post(`/${uploadID}/pause`);
  return response.data;
};

export const resumeUpload = async (uploadID) => {
  const response = await api.post(`/${uploadID}/resume`);
  return response.data;
};

export const getUploads = async ({
  page = 1,
  pageSize = 20,
  status,
  search,
}) => {
  const response = await api.get("/", {
    params: {
      page,
      limit,
      ...(status ? { status } : {}),
      ...(search?.trim() ? { search: search?.trim() } : {}),
    },
  });

  return response.data;
};
