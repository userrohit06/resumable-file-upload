import React, { useRef, useState } from "react";

const FileDropzone = ({ onFilesSelected }) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (fileList) => {
    const files = Array.from(fileList);

    if (!files.length) {
      return;
    }

    onFilesSelected(files);
  };

  const handleInputChange = (event) => {
    handleFiles(event.target.files);
    event.target.value = ""; // allows selecting the same file again later
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  return (
    <div
      className={`dropzone ${isDragging ? "dropzone-active" : ""}`}
      onClick={openFilePicker}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={inputRef}
        multiple
        hidden
        onChange={handleInputChange}
      />

      <div className="upload-icon">↑</div>

      <h2>Drop your files here</h2>

      <p>
        or <span className="browse-text">click to browse</span>
      </p>

      <span className="file-hint">Multiple files supported</span>
    </div>
  );
};

export default FileDropzone;
