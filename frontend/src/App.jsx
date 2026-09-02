import React, { useState } from "react";
import FileDropzone from "./components/upload/FileDropzone";
import FileUploadCard from "./components/upload/FileUploadCard";
import { useFileUpload } from "./hooks/useFileUpload";
import UploadActivity from "./components/upload/UploadActivity";

const App = () => {
  const {
    uploads,
    startUpload,
    pauseUpload,
    cancelUploadFile,
    resumeUploadFile,
    startUploads,
  } = useFileUpload();

  const [files, setFiles] = useState([]);

  const handleFilesSelected = (selectedFiles) => {
    const existingKeys = new Set(
      files.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
    );

    const newFiles = selectedFiles.filter((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      return !existingKeys.has(key);
    });

    if (newFiles.length === 0) return;

    setFiles((currentFiles) => [...currentFiles, ...newFiles]);

    startUploads(newFiles);
  };

  const handleCancelUpload = async (fileName) => {
    await cancelUploadFile(fileName);

    setFiles((currentFiles) =>
      currentFiles.filter((file) => file.name !== fileName),
    );
  };

  return (
    <div className="app">
      <main className="upload-container">
        <header className="page-header">
          <div>
            <p className="eyebrow">RESUMABLE FILE UPLOADER</p>

            <h1>
              {/* Upload Large Files
              <span> Without starting over.</span> */}
              Upload Large Files Reliably.
            </h1>

            <p className="subtitle">
              {/* Chunked uploads with resume support, real-time progress, retry
              handling and upload speed tracking. */}
              Chunked uploads with real-time progress, upload speed tracking,
              automatic retry handling and chunk-level failure recovery.
            </p>
          </div>
        </header>

        <section className="upload-panel">
          <FileDropzone onFilesSelected={handleFilesSelected} />
        </section>

        {files.length > 0 && (
          <section className="file-list">
            {files.map((file) => (
              <FileUploadCard
                key={`${file.name}-${file.lastModified}`}
                file={file}
                upload={uploads[file.name]}
                onStart={startUpload}
                onPause={pauseUpload}
                onCancel={handleCancelUpload}
                onResume={resumeUploadFile}
              />
            ))}
          </section>
        )}
      </main>

      <UploadActivity uploads={uploads} />
    </div>
  );
};

export default App;
