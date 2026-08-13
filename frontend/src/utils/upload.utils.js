export const CHUNK_SIZE = 5 * 1024 * 1024;

export const getTotalChunks = (fileSize) => {
  return Math.ceil(fileSize / CHUNK_SIZE);
};

export const createChunks = (file) => {
  const chunks = [];
  let start = 0;

  while (start < file.size) {
    const end = Math.min(start + CHUNK_SIZE, file.size);
    chunks.push(file.slice(start, end));
    start = end;
  }

  return chunks;
};
