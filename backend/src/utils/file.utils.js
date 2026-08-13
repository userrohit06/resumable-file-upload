import path from "path";

export const CHUNK_SIZE = 5 * 1024 * 1024;

export const getChunkDirectory = (uploadID) => {
  return path.join(process.cwd(), "storage", "chunks", uploadID);
};
