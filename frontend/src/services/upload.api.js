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
}) => {
  const formData = new FormData();

  formData.append("chunk", chunk, `chunk-${chunkIndex}`);

  const response = await api.post(`/${uploadID}/chunk`, formData, {
    headers: {
      "X-Chunk-Index": chunkIndex,
    },

    onUploadProgress,
  });

  return response.data;
};

export const completeUpload = async (uploadID) => {
  const response = await api.post(`/${uploadID}/complete`);
  return response.data;
};
