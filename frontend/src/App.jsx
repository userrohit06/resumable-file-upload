import React, { useState } from "react";
import FileDropzone from "./components/upload/FileDropzone";
import FileUploadCard from "./components/upload/FileUploadCard";
import { initializeUpload, uploadChunk } from "./services/upload.api";
import { createChunks } from "./utils/upload.utils";
import { useFileUpload } from "./hooks/useFileUpload";

const App = () => {
  const { uploads, startUpload } = useFileUpload();

  const [files, setFiles] = useState([]);

  const handleFilesSelected = (selectedFiles) => {
    setFiles(selectedFiles);
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
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
};

export default App;
