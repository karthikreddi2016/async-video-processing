import React, { useState, useRef } from 'react';
import './VideoUpload.css';

const VideoUpload = ({ onUploadSuccess, onUploadError }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [error, setError] = useState(null);
  const [fileSize, setFileSize] = useState(0);
  const fileInputRef = useRef(null);

  // Configuration constants
  const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
  const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
  const ALLOWED_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];

  /**
   * Validate video file
   * @param {File} file - File to validate
   * @returns {Object} - Validation result with isValid boolean and error message
   */
  const validateFile = (file) => {
    // Check file type
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return {
        isValid: false,
        error: `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
      };
    }

    // Check file extension
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return {
        isValid: false,
        error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
      };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      const maxSizeGB = (MAX_FILE_SIZE / (1024 * 1024 * 1024)).toFixed(2);
      return {
        isValid: false,
        error: `File size exceeds maximum limit of ${maxSizeGB}GB`
      };
    }

    // Check file size is not zero
    if (file.size === 0) {
      return {
        isValid: false,
        error: 'File is empty'
      };
    }

    return { isValid: true, error: null };
  };

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Size in bytes
   * @returns {string} - Formatted size string
   */
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  /**
   * Handle file upload to server
   * @param {File} file - File to upload
   */
  const uploadFile = async (file) => {
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('video', file);

    try {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      // Handle upload completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201) {
          const response = JSON.parse(xhr.responseText);
          setUploadedFile({
            name: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            ...response
          });
          setIsUploading(false);
          setUploadProgress(100);

          if (onUploadSuccess) {
            onUploadSuccess(response);
          }
        } else {
          throw new Error(`Upload failed with status ${xhr.status}`);
        }
      });

      // Handle upload error
      xhr.addEventListener('error', () => {
        const errorMsg = 'Upload failed. Please try again.';
        setError(errorMsg);
        setIsUploading(false);
        setUploadProgress(0);

        if (onUploadError) {
          onUploadError(new Error(errorMsg));
        }
      });

      // Handle upload abort
      xhr.addEventListener('abort', () => {
        const errorMsg = 'Upload was cancelled.';
        setError(errorMsg);
        setIsUploading(false);
        setUploadProgress(0);

        if (onUploadError) {
          onUploadError(new Error(errorMsg));
        }
      });

      // Start upload
      xhr.open('POST', '/api/videos/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('authToken')}`);
      xhr.send(formData);
    } catch (err) {
      const errorMsg = err.message || 'An error occurred during upload';
      setError(errorMsg);
      setIsUploading(false);
      setUploadProgress(0);

      if (onUploadError) {
        onUploadError(err);
      }
    }
  };

  /**
   * Handle file selection
   * @param {File[]} files - Selected files
   */
  const handleFileSelect = (files) => {
    if (files && files.length > 0) {
      const file = files[0];
      const validation = validateFile(file);

      if (!validation.isValid) {
        setError(validation.error);
        setUploadedFile(null);
        return;
      }

      setFileSize(file.size);
      setError(null);
      uploadFile(file);
    }
  };

  /**
   * Handle click on file input
   */
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Handle file input change
   */
  const handleFileInputChange = (e) => {
    handleFileSelect(e.target.files);
  };

  /**
   * Handle drag over
   */
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  /**
   * Handle drag leave
   */
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  /**
   * Handle drop
   */
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  /**
   * Handle clear/reset
   */
  const handleClear = () => {
    setUploadedFile(null);
    setUploadProgress(0);
    setError(null);
    setFileSize(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="video-upload-container">
      <div className="video-upload-wrapper">
        {!uploadedFile ? (
          <>
            <div
              className={`drag-drop-area ${dragActive ? 'active' : ''} ${isUploading ? 'uploading' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={!isUploading ? handleClick : undefined}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_EXTENSIONS.join(',')}
                onChange={handleFileInputChange}
                disabled={isUploading}
                className="file-input"
              />

              <div className="drag-drop-content">
                <div className="upload-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>

                <div className="drag-drop-text">
                  <p className="primary-text">
                    {isUploading ? 'Uploading...' : 'Drag and drop your video here'}
                  </p>
                  <p className="secondary-text">
                    {isUploading
                      ? 'Please wait while your file is being uploaded'
                      : `or click to select (Max ${formatFileSize(MAX_FILE_SIZE)})`}
                  </p>
                </div>

                {isUploading && (
                  <div className="progress-section">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="progress-text">{uploadProgress}%</p>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="error-message">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="file-info">
              <h3>Supported Formats</h3>
              <ul>
                {ALLOWED_EXTENSIONS.map((ext) => (
                  <li key={ext}>{ext}</li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div className="success-section">
            <div className="success-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2>Upload Successful!</h2>

            <div className="file-details">
              <div className="file-name">
                <strong>File Name:</strong>
                <p>{uploadedFile.name}</p>
              </div>
              <div className="file-size">
                <strong>File Size:</strong>
                <p>{formatFileSize(uploadedFile.size)}</p>
              </div>
              <div className="upload-time">
                <strong>Uploaded At:</strong>
                <p>{new Date(uploadedFile.uploadedAt).toLocaleString()}</p>
              </div>
            </div>

            <button
              className="clear-button"
              onClick={handleClear}
              disabled={isUploading}
            >
              Upload Another Video
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoUpload;
