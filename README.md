# Async Video Processing

A robust, scalable asynchronous video processing system designed to handle large-scale video uploads, encoding, transcoding, and delivery with support for multiple formats and quality levels.

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Quick Start Guide](#quick-start-guide)
- [Setup Instructions](#setup-instructions)
- [Architecture Overview](#architecture-overview)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Deployment Considerations](#deployment-considerations)

## Project Overview

Async Video Processing is a production-ready system that enables:

- **Asynchronous Video Processing**: Upload videos and process them in the background without blocking user requests
- **Multi-format Support**: Convert videos to multiple formats (MP4, WebM, HLS)
- **Quality Optimization**: Automatic generation of multiple quality variants (480p, 720p, 1080p, 4K)
- **Progress Tracking**: Real-time progress updates on video processing status
- **Error Handling**: Comprehensive error handling and retry mechanisms
- **Scalability**: Horizontally scalable using queue-based architecture
- **CDN Integration**: Seamless integration with content delivery networks

### Key Features

- RESTful API for video upload and management
- WebSocket support for real-time progress updates
- Job queue system for background processing
- Video metadata extraction and optimization
- Thumbnail generation
- Concurrent processing capabilities

## Tech Stack

### Backend
- **Runtime**: Node.js / Python 3.9+
- **Framework**: Express.js / FastAPI
- **Queue System**: Redis / RabbitMQ
- **Job Processor**: Bull Queue / Celery
- **Video Processing**: FFmpeg
- **Database**: PostgreSQL
- **Cache**: Redis
- **Storage**: AWS S3 / MinIO

### Frontend (Optional)
- **Framework**: React / Vue.js
- **Real-time**: Socket.io
- **State Management**: Redux / Pinia

### DevOps & Infrastructure
- **Containerization**: Docker
- **Orchestration**: Kubernetes / Docker Compose
- **CI/CD**: GitHub Actions / GitLab CI
- **Monitoring**: Prometheus / Grafana
- **Logging**: ELK Stack / Datadog

## Quick Start Guide

### Prerequisites

- Docker and Docker Compose
- Node.js 16+ or Python 3.9+
- FFmpeg installed
- Redis instance
- PostgreSQL database

### Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/karthikreddi2016/async-video-processing.git
cd async-video-processing

# Start all services
docker-compose up -d

# Verify services are running
docker-compose ps

# Run migrations
docker-compose exec api npm run migrate
# or for Python
docker-compose exec api python manage.py migrate
```

### Manual Setup

```bash
# Install dependencies
npm install
# or
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
nano .env

# Start Redis and PostgreSQL
redis-server
# In another terminal
postgres

# Run database migrations
npm run migrate
# or
python manage.py migrate

# Start the API server
npm start
# or
python app.py

# Start the job processor (in another terminal)
npm run worker
# or
python worker.py
```

## Setup Instructions

### 1. Environment Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=video_processing
DB_USER=postgres
DB_PASSWORD=your_password
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/video_processing

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# AWS S3 / MinIO
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=video-processing-uploads
S3_ENDPOINT=https://s3.amazonaws.com
# For MinIO, use local endpoint
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# FFmpeg
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe

# Processing
MAX_VIDEO_SIZE=5GB
ALLOWED_FORMATS=mp4,mov,avi,mkv,webm
OUTPUT_FORMATS=mp4,webm,hls
QUALITY_LEVELS=480p,720p,1080p,4k

# JWT/Auth
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRY=24h

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Logging
LOG_LEVEL=info
```

### 2. Database Setup

```bash
# Create database
createdb video_processing

# Run migrations
npm run migrate

# Seed initial data (optional)
npm run seed
```

### 3. Install System Dependencies

For Ubuntu/Debian:

```bash
# Update package manager
sudo apt-get update

# Install FFmpeg
sudo apt-get install ffmpeg

# Install other dependencies
sudo apt-get install postgresql redis-server nodejs npm

# Verify installations
ffmpeg -version
redis-cli --version
node --version
```

For macOS:

```bash
# Using Homebrew
brew install ffmpeg postgresql redis node

# Verify installations
ffmpeg -version
redis-cli --version
node --version
```

### 4. Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                     │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTP/WebSocket
             ▼
┌─────────────────────────────────────────────────────────────┐
│              API Gateway / Load Balancer                    │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────┴─────────┬──────────────────┐
    │                  │                  │
    ▼                  ▼                  ▼
┌─────────┐      ┌──────────┐      ┌─────────────┐
│  API    │      │ Websocket│      │    Auth     │
│ Server  │      │  Server  │      │   Service   │
└────┬────┘      └────┬─────┘      └──────┬──────┘
     │                │                   │
     └────────────────┼───────────────────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
          ▼           ▼           ▼
       ┌──────┐   ┌────────┐  ┌────────┐
       │Redis │   │Postgres│  │  S3    │
       │Queue │   │  DB    │  │/MinIO  │
       └───┬──┘   └────────┘  └────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌─────────┐  ┌─────────┐
│ Worker 1│  │ Worker N│
│(Processing)│
└─────────┘  └─────────┘
    │             │
    └──────┬──────┘
           │
           ▼
┌──────────────────────┐
│  FFmpeg Processing   │
│  Encoding/Transcoding│
└──────────────────────┘
```

### Data Flow

1. **Upload Phase**: Client uploads video → API validates and stores in S3 → Database record created
2. **Queue Phase**: Job created in Redis queue → Workers pick up job
3. **Processing Phase**: Worker runs FFmpeg → Generates multiple formats/qualities
4. **Notification Phase**: Completion notification → WebSocket update to client
5. **Delivery Phase**: Processed videos available via CDN

## API Endpoints

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
All endpoints (except health check) require JWT bearer token:
```
Authorization: Bearer <jwt_token>
```

### Video Management

#### Upload Video
```
POST /videos/upload
Content-Type: multipart/form-data

Body:
  - file: <video_file>
  - title: string
  - description: string (optional)
  - metadata: object (optional)

Response (201):
{
  "id": "uuid",
  "filename": "string",
  "title": "string",
  "status": "uploading|pending|processing|completed|failed",
  "uploadProgress": 0-100,
  "createdAt": "ISO8601",
  "url": "string"
}
```

#### Get Video Status
```
GET /videos/:videoId/status

Response (200):
{
  "id": "uuid",
  "title": "string",
  "status": "completed|processing|failed",
  "progress": 0-100,
  "processingDetails": {
    "formats": [
      {
        "format": "mp4",
        "qualities": ["480p", "720p", "1080p"],
        "status": "completed",
        "urls": {
          "480p": "https://cdn.example.com/video_480p.mp4",
          "720p": "https://cdn.example.com/video_720p.mp4",
          "1080p": "https://cdn.example.com/video_1080p.mp4"
        }
      }
    ]
  },
  "duration": 3600,
  "fileSize": 1024000000,
  "createdAt": "ISO8601",
  "completedAt": "ISO8601"
}
```

#### List Videos
```
GET /videos?page=1&limit=20&status=completed

Response (200):
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "status": "string",
      "duration": 3600,
      "fileSize": 1024000000,
      "createdAt": "ISO8601"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

#### Delete Video
```
DELETE /videos/:videoId

Response (204): No Content
```

#### Get Video Metadata
```
GET /videos/:videoId/metadata

Response (200):
{
  "duration": 3600,
  "format": "mp4",
  "resolution": "1920x1080",
  "frameRate": 30,
  "bitrate": "5000k",
  "audioCodec": "aac",
  "videoCodec": "h264",
  "fileSize": 1024000000
}
```

#### Download Processed Video
```
GET /videos/:videoId/download?format=mp4&quality=720p

Response: Binary file download
```

### Processing Jobs

#### Get Job Status
```
GET /jobs/:jobId

Response (200):
{
  "id": "uuid",
  "videoId": "uuid",
  "status": "pending|processing|completed|failed",
  "progress": 0-100,
  "currentTask": "string",
  "startedAt": "ISO8601",
  "completedAt": "ISO8601",
  "error": null
}
```

#### Retry Failed Job
```
POST /jobs/:jobId/retry

Response (200):
{
  "id": "uuid",
  "status": "pending",
  "retriedAt": "ISO8601"
}
```

### Health & Monitoring

#### Health Check
```
GET /health

Response (200):
{
  "status": "healthy",
  "timestamp": "ISO8601",
  "services": {
    "database": "ok",
    "redis": "ok",
    "storage": "ok"
  }
}
```

#### System Stats
```
GET /stats

Response (200):
{
  "totalVideos": 1000,
  "processingVideos": 5,
  "completedToday": 150,
  "failedToday": 2,
  "averageProcessingTime": 1200,
  "queueLength": 23
}
```

## Database Schema

### Videos Table
```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  filename VARCHAR(255) NOT NULL,
  original_size BIGINT NOT NULL,
  duration INTEGER,
  resolution VARCHAR(50),
  fps INTEGER,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  s3_key VARCHAR(255) NOT NULL,
  s3_bucket VARCHAR(255) NOT NULL,
  metadata JSONB,
  thumbnail_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'uploading', 'processing', 'completed', 'failed')),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

### Processing Jobs Table
```sql
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  job_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  current_task VARCHAR(255),
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  CONSTRAINT valid_job_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
  INDEX idx_video_id (video_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

### Processing Results Table
```sql
CREATE TABLE processing_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  format VARCHAR(50) NOT NULL,
  quality VARCHAR(50) NOT NULL,
  file_size BIGINT NOT NULL,
  duration INTEGER,
  bitrate VARCHAR(50),
  codec VARCHAR(50),
  s3_key VARCHAR(255) NOT NULL,
  s3_url VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_video_id (video_id),
  INDEX idx_job_id (job_id),
  UNIQUE KEY unique_format_quality (video_id, format, quality)
);
```

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX idx_email (email),
  INDEX idx_username (username)
);
```

### Audit Log Table
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_resource (resource_type, resource_id),
  INDEX idx_created_at (created_at)
);
```

## Deployment Considerations

### Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrations tested and ready
- [ ] SSL/TLS certificates obtained
- [ ] S3/MinIO buckets created and configured
- [ ] Redis cluster configured (if production)
- [ ] CDN configured and tested
- [ ] Monitoring and logging set up
- [ ] Backup and disaster recovery plan in place

### Deployment Strategies

#### Option 1: Docker Compose (Development/Small Scale)

```bash
docker-compose -f docker-compose.prod.yml up -d
```

#### Option 2: Kubernetes (Production/Large Scale)

```bash
# Build and push Docker images
docker build -t your-registry/api:latest .
docker push your-registry/api:latest

# Deploy to Kubernetes
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/api.yaml
kubectl apply -f k8s/worker.yaml
```

### Scaling Considerations

1. **Horizontal Scaling**
   - Add more worker instances to handle increased video processing
   - Use load balancer for API distribution
   - Implement autoscaling based on queue length

2. **Database Optimization**
   - Enable connection pooling
   - Regular index maintenance
   - Archive old processing logs

3. **Caching Strategy**
   - Cache video metadata in Redis
   - Implement CDN caching headers
   - Cache frequently accessed endpoints

### Performance Optimization

```nginx
# Nginx configuration for load balancing
upstream api {
  least_conn;
  server api1:3000;
  server api2:3000;
  server api3:3000;
}

server {
  listen 80;
  server_name api.example.com;

  location / {
    proxy_pass http://api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }
}
```

### Monitoring & Logging

```yaml
# Prometheus scrape configuration
scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'

  - job_name: 'workers'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
```

### Backup Strategy

```bash
# Database backup
pg_dump video_processing | gzip > backup_$(date +%Y%m%d).sql.gz

# S3 backup (using AWS CLI)
aws s3 sync s3://video-processing-uploads s3://video-processing-backups/daily-$(date +%Y%m%d)/ --region us-east-1

# Schedule with cron
0 2 * * * /path/to/backup-script.sh
```

### Security Best Practices

- Use HTTPS/TLS for all connections
- Implement JWT token rotation
- Enable database encryption at rest
- Use IAM roles for AWS S3 access
- Implement rate limiting on API endpoints
- Regular security audits and penetration testing
- Keep dependencies updated
- Use secrets management (AWS Secrets Manager, HashiCorp Vault)

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please:
- Open an issue on GitHub
- Contact: support@example.com
- Documentation: https://docs.example.com

---

**Last Updated**: December 16, 2025
