import React, { useState, useEffect } from 'react';
import '../styles/TaskList.css';

/**
 * TaskList Component
 * Displays and manages video processing tasks with real-time status updates
 */
const TaskList = ({ tasks = [], onTaskDelete, onTaskRetry, onRefresh }) => {
  const [filteredTasks, setFilteredTasks] = useState(tasks);
  const [filterStatus, setFilterStatus] = useState('all'); // all, pending, processing, completed, failed
  const [sortBy, setSortBy] = useState('created_at'); // created_at, status, name
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  // Filter and sort tasks
  useEffect(() => {
    let filtered = tasks;

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === filterStatus);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        task =>
          task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'status':
          return a.status.localeCompare(b.status);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created_at':
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    setFilteredTasks(sorted);
  }, [tasks, filterStatus, searchQuery, sortBy]);

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      pending: 'status-badge status-pending',
      processing: 'status-badge status-processing',
      completed: 'status-badge status-completed',
      failed: 'status-badge status-failed',
    };
    return statusMap[status] || 'status-badge status-default';
  };

  const getProgressPercentage = (task) => {
    if (task.status === 'completed') return 100;
    if (task.status === 'failed') return 0;
    return task.progress || 0;
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const handleTaskDelete = (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      onTaskDelete?.(taskId);
    }
  };

  const handleTaskRetry = (taskId) => {
    onTaskRetry?.(taskId);
  };

  const toggleTaskExpanded = (taskId) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  return (
    <div className="task-list-container">
      {/* Header Section */}
      <div className="task-list-header">
        <h1 className="task-list-title">Video Processing Tasks</h1>
        <button className="btn-refresh" onClick={onRefresh} title="Refresh tasks">
          🔄 Refresh
        </button>
      </div>

      {/* Controls Section */}
      <div className="task-list-controls">
        {/* Search Bar */}
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search by task name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="btn-clear-search"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter and Sort Controls */}
        <div className="filter-sort-container">
          <div className="filter-group">
            <label htmlFor="status-filter">Status:</label>
            <select
              id="status-filter"
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="sort-by">Sort by:</label>
            <select
              id="sort-by"
              className="filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="created_at">Date Created</option>
              <option value="status">Status</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task List Section */}
      <div className="task-list-content">
        {filteredTasks.length === 0 ? (
          <div className="task-list-empty">
            <p className="empty-message">
              {tasks.length === 0
                ? 'No tasks available. Start processing a video!'
                : 'No tasks match your filters.'}
            </p>
          </div>
        ) : (
          <div className="task-list">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`task-card ${task.status} ${
                  expandedTaskId === task.id ? 'expanded' : ''
                }`}
              >
                {/* Task Card Header */}
                <div
                  className="task-card-header"
                  onClick={() => toggleTaskExpanded(task.id)}
                >
                  <div className="task-info-summary">
                    <h3 className="task-name">{task.name}</h3>
                    <span className={getStatusBadgeClass(task.status)}>
                      {task.status.charAt(0).toUpperCase() +
                        task.status.slice(1)}
                    </span>
                  </div>
                  <div className="task-progress-summary">
                    <span className="progress-text">
                      {getProgressPercentage(task)}%
                    </span>
                    <span className="expand-icon">
                      {expandedTaskId === task.id ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {/* Task Progress Bar */}
                <div className="task-progress-bar">
                  <div
                    className="task-progress-fill"
                    style={{ width: `${getProgressPercentage(task)}%` }}
                  />
                </div>

                {/* Task Card Expanded Content */}
                {expandedTaskId === task.id && (
                  <div className="task-card-details">
                    {/* Basic Information */}
                    <div className="detail-section">
                      <h4 className="detail-section-title">Basic Information</h4>
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">Task ID:</span>
                          <span className="detail-value">{task.id}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Status:</span>
                          <span className={getStatusBadgeClass(task.status)}>
                            {task.status.charAt(0).toUpperCase() +
                              task.status.slice(1)}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Created:</span>
                          <span className="detail-value">
                            {formatDate(task.created_at)}
                          </span>
                        </div>
                        {task.updated_at && (
                          <div className="detail-item">
                            <span className="detail-label">Updated:</span>
                            <span className="detail-value">
                              {formatDate(task.updated_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Video Information */}
                    <div className="detail-section">
                      <h4 className="detail-section-title">Video Information</h4>
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">Input File:</span>
                          <span className="detail-value">
                            {task.input_file || 'N/A'}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">File Size:</span>
                          <span className="detail-value">
                            {formatFileSize(task.file_size)}
                          </span>
                        </div>
                        {task.duration && (
                          <div className="detail-item">
                            <span className="detail-label">Duration:</span>
                            <span className="detail-value">
                              {formatDuration(task.duration)}
                            </span>
                          </div>
                        )}
                        {task.output_file && (
                          <div className="detail-item">
                            <span className="detail-label">Output File:</span>
                            <span className="detail-value">
                              {task.output_file}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Processing Settings */}
                    {task.settings && (
                      <div className="detail-section">
                        <h4 className="detail-section-title">
                          Processing Settings
                        </h4>
                        <div className="detail-grid">
                          {Object.entries(task.settings).map(
                            ([key, value]) => (
                              <div key={key} className="detail-item">
                                <span className="detail-label">
                                  {key.replace(/_/g, ' ')}:
                                </span>
                                <span className="detail-value">
                                  {typeof value === 'object'
                                    ? JSON.stringify(value)
                                    : String(value)}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Error Information */}
                    {task.status === 'failed' && task.error_message && (
                      <div className="detail-section error-section">
                        <h4 className="detail-section-title">Error Details</h4>
                        <p className="error-message">{task.error_message}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="task-actions">
                      {task.status === 'failed' && (
                        <button
                          className="btn btn-retry"
                          onClick={() => handleTaskRetry(task.id)}
                          title="Retry this task"
                        >
                          🔄 Retry
                        </button>
                      )}
                      <button
                        className="btn btn-delete"
                        onClick={() => handleTaskDelete(task.id)}
                        title="Delete this task"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {filteredTasks.length > 0 && (
        <div className="task-list-footer">
          <p className="task-count">
            Showing {filteredTasks.length} of {tasks.length} task(s)
          </p>
        </div>
      )}
    </div>
  );
};

export default TaskList;
