# System Architecture - Async Video Processing

## Table of Contents
1. [Overview](#overview)
2. [Component Architecture](#component-architecture)
3. [Component Responsibilities](#component-responsibilities)
4. [Task Lifecycle](#task-lifecycle)
5. [State Persistence](#state-persistence)
6. [Error Handling](#error-handling)
7. [Frontend Synchronization](#frontend-synchronization)
8. [Scalability Considerations](#scalability-considerations)
9. [Data Flow Diagrams](#data-flow-diagrams)
10. [Deployment Architecture](#deployment-architecture)

## Overview

The Async Video Processing system is designed to handle long-running video processing tasks asynchronously, decoupling request handling from processing execution. The architecture follows a microservices-inspired pattern with clear separation of concerns, enabling horizontal scaling and resilience.

### Key Principles
- **Asynchronous Processing**: Heavy operations are offloaded to background workers
- **State Management**: Persistent state tracking for task lifecycle management
- **Decoupled Communication**: Queue-based messaging between components
- **Real-time Updates**: WebSocket/polling for frontend synchronization
- **Fault Tolerance**: Graceful degradation and automatic retry mechanisms

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ React/Vue Frontend UI                                      │ │
│  │ - Video Upload                                             │ │
│  │ - Task Monitoring                                          │ │
│  │ - Real-time Status Updates                                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↕↕ (HTTP/WebSocket)
┌─────────────────────────────────────────────────────────────────┐
│                    API Server (Express/FastAPI)                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ API Routes & Controllers                                 │   │
│  │ - POST /api/videos/upload                                │   │
│  │ - GET /api/tasks/{id}                                    │   │
│  │ - GET /api/tasks                                         │   │
│  │ - DELETE /api/tasks/{id}                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ WebSocket Server                                         │   │
│  │ - Real-time Status Updates                               │   │
│  │ - Server-Sent Events                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕↕
┌─────────────────────────────────────────────────────────────────┐
│                    Message Queue (Redis/RabbitMQ)                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Task Queue: video_processing                             │   │
│  │ - Enqueues jobs from API                                 │   │
│  │ - Provides task delivery guarantees                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Update Channel: task_updates                             │   │
│  │ - Status change broadcasts                               │   │
│  │ - Progress notifications                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕↕
┌─────────────────────────────────────────────────────────────────┐
│                    Worker Processes (Celery/Bull)                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Worker Pool (N instances)                                │   │
│  │ - Task Dequeue & Execution                               │   │
│  │ - Progress Tracking                                      │   │
│  │ - Error Handling & Retries                               │   │
│  │ - Result Publishing                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕↕
┌─────────────────────────────────────────────────────────────────┐
│                    Data Layer                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Primary Database (PostgreSQL/MongoDB)                    │   │
│  │ - Task Records                                           │   │
│  │ - User Information                                       │   │
│  │ - Video Metadata                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Cache Layer (Redis)                                      │   │
│  │ - Task State (TTL-based)                                 │   │
│  │ - Session Data                                           │   │
│  │ - Rate Limiting                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Object Storage (S3/MinIO)                                │   │
│  │ - Source Videos                                          │   │
│  │ - Processed Videos                                       │   │
│  │ - Thumbnails & Previews                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

1. **API Server**: RESTful endpoint for task submission and status queries
2. **Message Queue**: Task distribution and event broadcasting
3. **Worker Pool**: Parallel task execution with resource management
4. **Database**: Persistent state and historical data
5. **Cache**: Fast access to frequently queried data
6. **Object Storage**: Video and result file persistence
7. **WebSocket Server**: Real-time client updates

---

## Component Responsibilities

### API Server

**Responsibilities:**
- Accept video upload requests and validate input
- Create task records in the database
- Enqueue tasks to the message queue
- Provide task status query endpoints
- Handle authentication and authorization
- Rate limiting and quota management
- Return task IDs to clients for tracking

**Key Interfaces:**
```
POST /api/videos/upload
  - Input: video file, processing options
  - Output: { task_id, status, timestamp }

GET /api/tasks/{task_id}
  - Output: { task_id, status, progress, result_url, error }

GET /api/tasks
  - Query params: status, limit, offset
  - Output: [{ task_id, status, created_at, updated_at }]

DELETE /api/tasks/{task_id}
  - Cancels task if still queued
```

### Message Queue (Task Broker)

**Responsibilities:**
- Decouple API from processing workers
- Ensure task persistence and delivery guarantees
- Maintain task ordering and priority
- Provide acknowledgment-based processing
- Support task retries on failure
- Broadcast status updates to subscribers

**Features:**
- At-least-once delivery semantics
- Priority queue support for expedited processing
- Dead-letter queue for permanently failed tasks
- Task TTL and expiration handling
- Backpressure handling with queue depth limits

### Worker Process

**Responsibilities:**
- Dequeue tasks from the message broker
- Download source video from object storage
- Execute video processing operations
- Track progress and publish updates
- Handle processing errors gracefully
- Upload results to object storage
- Update task state in database
- Acknowledge task completion to broker

**Processing Pipeline:**
```
1. Task Acquisition
   - Dequeue from broker
   - Validate task data
   - Acquire task lock

2. Preparation
   - Download source video
   - Validate video format
   - Initialize processing context

3. Processing
   - Execute video transformation
   - Track progress (0-100%)
   - Publish progress updates

4. Post-Processing
   - Validate output video
   - Generate metadata
   - Upload to storage

5. Finalization
   - Update database with results
   - Publish completion event
   - Release task lock
   - Acknowledge to broker
```

### Database Layer

**Responsibilities:**
- Persist task records with full lifecycle history
- Store video metadata and processing options
- Track user submissions and quotas
- Maintain audit trails for compliance

**Core Schema:**
```sql
Tasks Table:
- id (UUID)
- user_id (Foreign Key)
- status (ENUM: queued, processing, completed, failed, cancelled)
- input_video_url (S3 path)
- output_video_url (S3 path, nullable)
- progress (0-100)
- error_message (nullable)
- processing_options (JSON)
- created_at
- updated_at
- started_at (nullable)
- completed_at (nullable)
- estimated_completion (nullable)
- retry_count
- max_retries

Users Table:
- id (UUID)
- email (unique)
- quota_limit
- quota_used
- created_at

Processing Logs Table:
- id (UUID)
- task_id (Foreign Key)
- event_type (ENUM)
- details (JSON)
- timestamp
```

### Cache Layer (Redis)

**Responsibilities:**
- Cache frequently accessed task state
- Reduce database load for status queries
- Store session and authentication tokens
- Implement distributed rate limiting
- Temporary storage for processing metadata

**Cache Keys:**
```
task:{task_id}           -> Full task state (TTL: 24h)
task:{task_id}:progress  -> Progress details (TTL: 1h)
user:{user_id}:quota     -> Quota tracking (TTL: 1h)
session:{session_id}     -> User session (TTL: 8h)
rate_limit:{user_id}     -> Request count (TTL: 60s)
```

### Object Storage (S3/MinIO)

**Responsibilities:**
- Store source video files securely
- Store processed output videos
- Generate and cache thumbnails
- Provide signed URLs for download
- Implement access control and versioning

**Bucket Structure:**
```
video-processing-bucket/
├── uploads/
│   └── {task_id}/source.mp4
├── outputs/
│   └── {task_id}/processed.mp4
├── thumbnails/
│   └── {task_id}/thumb.jpg
└── temp/
    └── {task_id}/temp-files
```

### WebSocket Server

**Responsibilities:**
- Maintain persistent connections with clients
- Push real-time status updates
- Handle client reconnection logic
- Manage connection pooling and heartbeats
- Publish events from task broker

**Events:**
```
task_created
  - { task_id, status: 'queued' }

task_started
  - { task_id, status: 'processing', started_at }

task_progress
  - { task_id, progress: 0-100, estimated_time_remaining }

task_completed
  - { task_id, status: 'completed', result_url, duration }

task_failed
  - { task_id, status: 'failed', error_code, error_message }

task_cancelled
  - { task_id, status: 'cancelled' }
```

---

## Task Lifecycle

### State Diagram

```
                        ┌──────────┐
                        │ INITIAL  │
                        └────┬─────┘
                             │ (upload accepted)
                             ↓
                        ┌──────────┐
                   ┌────│ QUEUED   │◄────┐
                   │    └────┬─────┘     │ (retry)
                   │         │          │
                   │    (task acquired)  │
                   │         ↓          │
                   │    ┌──────────┐    │
              (cancelled) │PROCESSING├────┤ (error)
                   │    └────┬─────┘    │
                   │         │          │
                   │  (100% progress)   │
                   │         ↓          │
                   │    ┌──────────┐    │
                   └───→│COMPLETED │    │
                        └──────────┘    │
                                        │
                        ┌──────────┐    │
                        │  FAILED  │◄───┘
                        └──────────┘
```

### Detailed State Transitions

#### 1. **INITIAL** → **QUEUED**
- **Trigger**: Successful file upload
- **Actions**:
  - Store video in S3
  - Create task record in database with status=QUEUED
  - Enqueue message to task broker
  - Return task_id to client
- **Expected Duration**: < 500ms

#### 2. **QUEUED** → **PROCESSING**
- **Trigger**: Worker picks up task
- **Actions**:
  - Worker acquires task lock
  - Updates database: status=PROCESSING, started_at=now
  - Downloads source video from S3
  - Validates video format and codec
  - Starts actual processing pipeline
- **Expected Duration**: < 2 seconds

#### 3. **PROCESSING** → **COMPLETED**
- **Trigger**: Processing finishes successfully
- **Actions**:
  - Validates output video
  - Uploads result to S3
  - Updates database with result URL and metadata
  - Updates status to COMPLETED
  - Sets completed_at timestamp
  - Publishes completion event
  - Acknowledges task to broker
- **Expected Duration**: Variable (1-60+ minutes depending on video)

#### 4. **PROCESSING** → **FAILED**
- **Trigger**: Processing error occurs
- **Actions**:
  - Logs error details to database
  - Increments retry_count
  - If retry_count < max_retries:
    - Updates status to QUEUED
    - Re-enqueues task with backoff delay
  - Else:
    - Sets status to FAILED
    - Stores error message
    - Moves to dead-letter queue
  - Publishes failure event
- **Expected Duration**: < 2 seconds

#### 5. **Any State** → **CANCELLED**
- **Trigger**: User cancellation request
- **Actions**:
  - If state == QUEUED: Remove from queue, delete stored data
  - If state == PROCESSING: Signal worker to stop, cleanup resources
  - Update status to CANCELLED in database
  - Publish cancellation event
- **Expected Duration**: < 1 second

### State Persistence Strategy

**Checkpointing for Large Tasks:**
For videos > 30 minutes, implement checkpoint-based processing:
- Process in 5-minute chunks
- Save progress after each chunk
- Enable resumption from last checkpoint if worker fails
- Update progress in database every 30 seconds

---

## State Persistence

### Database Persistence Layer

**Primary Storage** (PostgreSQL/MongoDB):

```python
# Task Model Example
class Task(Document):
    _id: ObjectId
    task_id: UUID
    user_id: UUID
    video_filename: str
    input_video_url: str
    output_video_url: Optional[str]
    
    # Status tracking
    status: Literal['queued', 'processing', 'completed', 'failed', 'cancelled']
    progress: int  # 0-100
    error_message: Optional[str]
    error_code: Optional[str]
    
    # Timing
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    estimated_completion: Optional[datetime]
    
    # Processing details
    processing_options: dict  # {quality, format, resolution, etc.}
    video_duration: Optional[float]  # seconds
    output_duration: Optional[float]
    
    # Retry logic
    retry_count: int = 0
    max_retries: int = 3
    last_error_at: Optional[datetime]
    
    # Metadata
    tags: List[str]
    metadata: dict
```

### Distributed State in Cache

**Redis Cache Strategy:**
```
# Task state cache with TTL
SETEX task:{task_id} 86400 {
  "status": "processing",
  "progress": 45,
  "updated_at": 1702796400,
  "worker_id": "worker-3",
  "checkpoint": {
    "last_chunk": 5,
    "last_checkpoint_time": 1702796200
  }
}

# Progress tracking for real-time updates
HSET task:{task_id}:progress
  "current" "45"
  "estimated_total_time" "120"
  "elapsed_time" "60"
  "current_phase" "encoding"

# Lock for exclusive processing
SET task:{task_id}:lock {
  "worker_id": "worker-3",
  "acquired_at": 1702796300,
  "ttl": 600
}
```

### Transaction Safety

**Optimistic Locking** for concurrent updates:
```python
# In database update:
# WHERE status = 'processing' AND version = current_version
# SET version = version + 1, progress = new_progress

# Prevents lost updates when multiple components update same task
```

**Distributed Locks** using Redis:
```python
# Worker acquires lock before processing
LOCK_KEY = f"task:{task_id}:processing"
SET LOCK_KEY worker_id NX EX 600  # 10 minute TTL

# Release lock on completion or timeout
DEL LOCK_KEY
```

### Eventual Consistency Model

**Update Propagation**:
1. Database updated first (source of truth)
2. Cache invalidated or updated asynchronously
3. WebSocket notifications pushed to clients
4. Old cache entries expire automatically (TTL)

**Conflict Resolution**:
- Database state always wins
- Cache is secondary for performance only
- Periodic reconciliation job (daily) checks discrepancies

---

## Error Handling

### Error Classification

```python
class ErrorSeverity(Enum):
    RETRIABLE = "retriable"      # Can retry safely
    PERMANENT = "permanent"      # Should not retry
    TRANSIENT = "transient"      # May resolve itself
    FATAL = "fatal"              # System failure

class VideoProcessingError(Exception):
    def __init__(self, code, message, severity, details):
        self.code = code           # e.g., "CODEC_NOT_SUPPORTED"
        self.message = message
        self.severity = severity
        self.details = details     # e.g., { found_codec: "h265" }
```

### Error Types & Handling

| Error Type | Cause | Severity | Action | Max Retries |
|-----------|-------|----------|--------|------------|
| FORMAT_NOT_SUPPORTED | Unsupported video codec | PERMANENT | Fail immediately | 0 |
| UPLOAD_FAILED | Network issues | RETRIABLE | Exponential backoff | 3 |
| STORAGE_ERROR | S3 unavailable | TRANSIENT | Retry with backoff | 5 |
| WORKER_TIMEOUT | Processing exceeds limit | TRANSIENT | Checkpoint & resume | 2 |
| OUT_OF_MEMORY | Insufficient resources | RETRIABLE | Distribute to idle worker | 3 |
| INVALID_PARAMETERS | Bad processing options | PERMANENT | Fail immediately | 0 |

### Retry Strategy

**Exponential Backoff with Jitter:**
```python
def calculate_retry_delay(retry_count, max_retries=3):
    """
    Retry delays: 1s, 2s, 4s (with ±20% jitter)
    """
    base_delay = 2 ** (retry_count - 1)
    jitter = random.uniform(0.8, 1.2)
    return min(base_delay * jitter, 300)  # Cap at 5 minutes
```

**Backoff Configuration:**
```
Attempt 1: Immediate
Attempt 2: Wait 1-1.2s, then retry
Attempt 3: Wait 1.6-2.4s, then retry
Attempt 4: Wait 3.2-4.8s, then retry
Final Failure: Move to dead-letter queue
```

### Dead-Letter Queue (DLQ)

**Purpose**: Store permanently failed tasks for manual review

**Properties**:
- Tasks moved to DLQ after max retries exceeded
- Can be manually reprocessed after fixes
- Monitored and alerted on DLQ growth
- Archived after 30 days for compliance

**Example DLQ Entry**:
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "failed_at": "2024-12-16T09:47:45Z",
  "retry_count": 3,
  "final_error": {
    "code": "UNSUPPORTED_CODEC",
    "message": "H.265 codec not supported",
    "details": { "found_codec": "hevc" }
  },
  "original_task": { /* full task data */ }
}
```

### Graceful Degradation

**Worker Failure Handling**:
```python
# Worker heartbeat mechanism
- Worker sends heartbeat every 30 seconds
- If no heartbeat > 3 minutes, task reassigned
- Task state reverted to QUEUED for re-processing

# Partial failure
- If 1 of 5 processing stages fails:
  - Rollback completed stages
  - Attempt from last checkpoint
  - Update progress accordingly
```

### Error Logging & Monitoring

```python
# Structured error logging
logger.error(
    "Video processing failed",
    extra={
        "task_id": task_id,
        "error_code": error.code,
        "severity": error.severity,
        "worker_id": worker_id,
        "processing_time": elapsed_time,
        "video_duration": video_duration,
        "processing_options": options
    }
)

# Metrics
- errors_total (counter)
- error_rate_by_type (gauge)
- retry_attempts (histogram)
- dlq_size (gauge)
```

---

## Frontend Synchronization

### Communication Protocols

#### 1. **WebSocket (Real-time, Recommended)**

**Connection Lifecycle:**
```javascript
// Client establishes WebSocket connection
const ws = new WebSocket('wss://api.example.com/ws');

ws.onopen = () => {
  // Subscribe to task updates
  ws.send(JSON.stringify({
    action: 'subscribe',
    task_ids: ['task-id-1', 'task-id-2']
  }));
};

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  // Handle: progress, status changes, errors
  updateUI(update);
};

ws.onerror = (error) => {
  // Fallback to polling
  startPollingFallback();
};
```

**Server-side Event Broadcasting:**
```python
# When task state changes
async def broadcast_task_update(task_id, event_type, data):
    """
    Publish to WebSocket subscribers and message queue
    """
    message = {
        "type": event_type,
        "task_id": task_id,
        "timestamp": datetime.utcnow().isoformat(),
        "data": data
    }
    
    # Broadcast to connected WebSocket clients
    await websocket_manager.broadcast(task_id, message)
    
    # Also publish to message broker for distributed subscribers
    await message_queue.publish("task_updates", message)
```

**WebSocket Message Types:**
```json
// Task created
{
  "type": "task_created",
  "task_id": "550e8400",
  "status": "queued",
  "position_in_queue": 15
}

// Progress update
{
  "type": "task_progress",
  "task_id": "550e8400",
  "progress": 35,
  "current_phase": "transcoding",
  "estimated_time_remaining_seconds": 180
}

// Status change
{
  "type": "task_status_changed",
  "task_id": "550e8400",
  "old_status": "processing",
  "new_status": "completed",
  "result_url": "s3://bucket/outputs/550e8400/output.mp4",
  "duration_seconds": 420
}

// Error occurred
{
  "type": "task_error",
  "task_id": "550e8400",
  "error_code": "CODEC_NOT_SUPPORTED",
  "error_message": "H.265 codec is not supported",
  "can_retry": false
}
```

#### 2. **HTTP Polling (Fallback)**

**Client Implementation:**
```javascript
class TaskPoller {
  constructor(taskId, intervalMs = 2000) {
    this.taskId = taskId;
    this.intervalMs = intervalMs;
    this.lastProgress = 0;
  }

  async start() {
    this.interval = setInterval(async () => {
      const response = await fetch(`/api/tasks/${this.taskId}`);
      const task = await response.json();
      
      if (task.progress > this.lastProgress) {
        this.onProgress(task);
        this.lastProgress = task.progress;
      }
      
      if (['completed', 'failed', 'cancelled'].includes(task.status)) {
        this.stop();
        this.onComplete(task);
      }
    }, this.intervalMs);
  }

  stop() {
    clearInterval(this.interval);
  }
}
```

**Polling Strategy:**
- Initial interval: 2 seconds
- Backoff to 5 seconds after 1 minute
- Backoff to 10 seconds after 5 minutes
- Stop polling after task completion

#### 3. **Server-Sent Events (SSE)**

**Alternative to WebSocket for unidirectional updates:**
```javascript
const eventSource = new EventSource(`/api/tasks/${taskId}/stream`);

eventSource.addEventListener('progress', (event) => {
  const data = JSON.parse(event.data);
  updateProgressBar(data.progress);
});

eventSource.addEventListener('completed', (event) => {
  const data = JSON.parse(event.data);
  showResultsUI(data.result_url);
  eventSource.close();
});
```

### Client-Side State Management

**React Example:**
```jsx
function TaskMonitor({ taskId }) {
  const [task, setTask] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket
    const ws = new WebSocket('wss://api.example.com/ws');
    
    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({
        action: 'subscribe',
        task_ids: [taskId]
      }));
    };

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      
      setTask(prev => ({
        ...prev,
        ...update.data,
        // Optimistic update
        lastUpdate: Date.now()
      }));
    };

    ws.onclose = () => {
      setConnected(false);
      // Start polling fallback
      startPolling(taskId);
    };

    return () => ws.close();
  }, [taskId]);

  if (!connected && !task) {
    return <div>Reconnecting...</div>;
  }

  return (
    <div>
      <ProgressBar progress={task?.progress || 0} />
      <StatusBadge status={task?.status} />
      {task?.error_message && <ErrorAlert message={task.error_message} />}
    </div>
  );
}
```

### Connection Resilience

**Reconnection Strategy:**
```python
# Client-side
const reconnectDelays = [1000, 2000, 5000, 10000, 30000];
let reconnectAttempt = 0;

function connectWebSocket() {
  ws = new WebSocket(wsUrl);
  
  ws.onerror = () => {
    if (reconnectAttempt < reconnectDelays.length) {
      const delay = reconnectDelays[reconnectAttempt++];
      setTimeout(connectWebSocket, delay);
    } else {
      fallbackToPolling();
    }
  };
  
  ws.onopen = () => {
    reconnectAttempt = 0;  // Reset on successful connection
  };
}
```

### Update Queue Management

**For High-Frequency Updates:**
```javascript
// Batch updates to avoid overwhelming UI
class UpdateBatcher {
  constructor(batchIntervalMs = 500) {
    this.queue = [];
    this.batchIntervalMs = batchIntervalMs;
  }

  addUpdate(update) {
    // Keep only latest value for each field
    this.queue = [update];
  }

  start(onBatch) {
    this.interval = setInterval(() => {
      if (this.queue.length > 0) {
        onBatch(this.queue[0]);
        this.queue = [];
      }
    }, this.batchIntervalMs);
  }

  stop() {
    clearInterval(this.interval);
  }
}
```

---

## Scalability Considerations

### Horizontal Scaling

#### 1. **Worker Scaling**

**Auto-scaling Policy:**
```
Queue Depth → Worker Count:
- 0-5 tasks: 1 worker
- 5-20 tasks: 2 workers
- 20-50 tasks: 5 workers
- 50+ tasks: 10+ workers

Scaling Triggers:
- Scale up if: avg_queue_depth > 20 for 2 minutes
- Scale down if: avg_queue_depth < 3 for 10 minutes
- Max workers: 20 (configurable)
```

**Implementation (Kubernetes):**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: video-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: video-worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: queue_depth
      target:
        type: AverageValue
        averageValue: "30"
```

#### 2. **Database Scaling**

**Read Replicas for Task Queries:**
```
Primary (Write): 1 instance
Read Replicas: 3-5 instances

Query routing:
- Status queries → Read replicas (eventual consistency acceptable)
- Task creation → Primary (strong consistency required)
- Updates → Primary with async replication to replicas
```

**Sharding Strategy (at scale):**
```
Shard by user_id to distribute load:
- Hash(user_id) % num_shards
- Allows independent scaling per shard
- Requires application-level routing

Initial: 1 shard, scale to N shards as needed
```

#### 3. **Cache Scaling**

**Redis Cluster Setup:**
```
Master: 1 node
Replicas: 2 nodes (high availability)
Cluster mode: Disabled (single master sufficient)

Memory allocation:
- 32 GB for cache layer initially
- Monitor hit ratio (target > 90%)
- Eviction policy: allkeys-lru
```

**Cache Partitioning by TTL:**
- Hot data (active tasks): TTL = 1 hour, 8 GB
- Warm data (recent tasks): TTL = 24 hours, 16 GB
- Cold data (session tokens): TTL = 8 hours, 8 GB

#### 4. **API Server Scaling**

**Load Balancing:**
```
                    ┌─────────────┐
                    │ Load Balancer
                    │ (nginx/HAProxy)
                    └────────┬────┘
                             │
            ┌────────────────┼────────────────┐
            ↓                ↓                ↓
       ┌─────────┐      ┌─────────┐     ┌─────────┐
       │API Srv 1│      │API Srv 2│     │API Srv 3│
       └─────────┘      └─────────┘     └─────────┘
            │                ↓                ↓
            └────────────────┴────────────────┘
                             ↓
                    ┌─────────────────┐
                    │ Message Queue
                    │ (shared)
                    └─────────────────┘
```

**Stateless Design**:
- All API servers identical (no session affinity)
- Session state stored in Redis
- Easily add/remove servers based on load

### Load Testing & Capacity Planning

**Benchmark Targets:**
```
API Server:
- Throughput: 100+ requests/second per instance
- P99 Latency: < 500ms for upload, < 100ms for status query
- Horizontal scaling: Linear improvement up to 10 servers

Worker:
- Processing rate: 10 videos/hour (1080p, 30 min avg)
- CPU utilization: 80-85% optimal
- Memory per worker: 4 GB

Queue:
- Processing latency: < 100ms from enqueue to dequeue
- P99 queue wait time: < 5 minutes

Database:
- Read throughput: 10K+ queries/second
- Write throughput: 1K+ writes/second
- Query response time P99: < 50ms
```

**Stress Test Scenario:**
```python
# Simulate peak load
for i in range(1000):
    submit_video(
        video_file=random_video(),
        processing_options=random_options()
    )

# Monitor:
- Queue depth growth rate
- Worker processing time
- API response time degradation
- Database connection pool saturation
- Cache hit ratio changes
```

### Resource Optimization

#### 1. **CPU Optimization**
- Use hardware video encoding (NVIDIA CUDA, Intel QSV)
- Multi-threaded processing for I/O-bound operations
- CPU affinity for cache locality

#### 2. **Memory Optimization**
```python
# Streaming video processing instead of loading entire file
with open('input.mp4', 'rb') as f:
    for chunk in read_chunks(f, chunk_size=10MB):
        process_chunk(chunk)
        # Immediately write output, don't accumulate
```

#### 3. **Storage Optimization**
- Compress old videos (H.265 codec)
- Implement retention policies
- Archive videos > 30 days to cheaper tier
- Delete source videos after 7 days (keep output)

```python
# Archive policy
if task.completed_at < 30_days_ago:
    move_to_cold_storage(task.input_video_url)
    
if task.completed_at < 90_days_ago:
    delete_input_video(task.input_video_url)  # Keep output
```

### Network Optimization

**CDN for Outputs:**
```
User Download Paths:
1. User uploads → API Server (direct)
2. API Server → S3 (direct, same region)
3. S3 → CloudFront CDN cache
4. User downloads → CloudFront (cached)
```

**Bandwidth Optimization:**
- Enable compression for metadata responses
- Implement resumable uploads/downloads
- Use multipart uploads for large files

### Monitoring & Alerting

**Key Metrics:**
```
Performance:
- API response time (p50, p95, p99)
- Worker processing time
- Queue wait time
- Cache hit ratio

Capacity:
- CPU utilization per component
- Memory usage and trend
- Disk I/O operations
- Network bandwidth

Health:
- Error rate by type
- Retry rate
- DLQ queue depth
- Worker heartbeat failures
- Database connection pool utilization

Business:
- Task success rate
- Average processing time
- Cost per task
- User queue position
```

**Alert Examples:**
```
- P99 API response time > 1 second
- Queue depth > 50 for 5+ minutes
- Worker error rate > 5%
- Cache hit ratio < 80%
- Database replication lag > 1 second
- Cost per task exceeds threshold
```

### Cost Optimization

**Resource Right-Sizing:**
```
Based on typical workload:
- API Servers: t3.large (2 vCPU, 8GB) × 3
- Workers: c5.xlarge (4 vCPU, 8GB) × 5 (auto-scaled to 20)
- Database: db.r6g.xlarge (4 vCPU, 32GB) + 2 read replicas
- Cache: r6g.2xlarge (8 vCPU, 64GB)
- Storage: S3 standard + Glacier tier

Estimated monthly cost: $2,000-$3,000 at 10K daily tasks
Cost per task: $0.20-$0.30
```

**Cost Reduction Strategies:**
- Reserved instances for baseline capacity (30% discount)
- Spot instances for burst capacity (70% discount)
- Scheduled scaling (reduce overnight capacity)
- Video compression to reduce storage costs
- Cache optimization to reduce database costs

---

## Data Flow Diagrams

### Upload & Task Creation Flow

```
Client                          API Server              Queue               Database
  │                               │                      │                    │
  ├─ POST /upload (video file) ─→│                      │                    │
  │                               │                      │                    │
  │                               ├─ Validate file       │                    │
  │                               │                      │                    │
  │                               ├─ Upload to S3 ──────────→ S3              │
  │                               │                      │                    │
  │                               ├─ Create task record ─────────────────────→│
  │                               │ (status=QUEUED)      │                    │
  │                               │                      │                    │
  │                               ├─ Enqueue to broker ──→├─ Queue task       │
  │                               │                      │                    │
  │  ← Task ID & Status (201) ───┤                      │                    │
  │                               │                      │                    │
```

### Task Processing Flow

```
Queue                Worker Pool                   Database             Storage
  │                      │                            │                    │
  ├─ Task available ────→├─ Dequeue task             │                    │
  │                      │                            │                    │
  │                      ├─ Acquire lock ────────────→├─ Lock task        │
  │                      │                            │                    │
  │                      ├─ Download video ─────────────────────────────→│
  │                      │                            │                    │
  │                      ├─ Begin processing         │                    │
  │                      │  (update progress)        │                    │
  │                      ├─ Update status ───────────→├─ Set status       │
  │                      │  (every 10%)               │  PROCESSING       │
  │                      │                            │                    │
  │                      ├─ Process video ──→ ... ───→ ... (various) ... │
  │                      │                            │                    │
  │                      ├─ Upload output ─────────────────────────────→│
  │                      │                            │                    │
  │                      ├─ Update results ──────────→├─ Set completed_at│
  │                      │                            │  Set output_url   │
  │                      │  Acknowledge ────→├─ Remove from queue       │
  │                      │                            │                    │
```

### Frontend Synchronization Flow (WebSocket)

```
Client                      API/WebSocket Server        Queue              Cache
  │                               │                       │                  │
  ├─ Connect ──────────────────→  │                       │                  │
  │                               │                       │                  │
  ├─ Subscribe(task_id) ────────→ ├─ Register client     │                  │
  │                               │                       │                  │
  │  ◄──── task_created ─────────┤                       │                  │
  │  ◄──── task_queued ──────────┤                       │                  │
  │                               │                       │                  │
  │                               │ ◄─ Poll updates ────┤                  │
  │                               │                       │                  │
  │                               │ ◄─ Get from cache ──────────────────→│
  │  ◄──── task_progress ────────┤                       │                  │
  │  ◄──── task_progress ────────┤ (batched, 1/sec)     │                  │
  │  ◄──── task_progress ────────┤                       │                  │
  │                               │                       │                  │
  │                               │ ◄─ Task completed ──┤                  │
  │  ◄──── task_completed ──────┤                       │                  │
  │                               │                       │                  │
  ├─ Unsubscribe ────────────────→├─ Deregister client   │                  │
  │                               │                       │                  │
```

---

## Deployment Architecture

### Development Environment

```
Docker Compose Stack:
- api-server: Express/FastAPI container
- celery-worker: Video processing worker (1 instance)
- redis: Message broker and cache
- postgres: Primary database
- minio: S3-compatible storage
- mailhog: Email testing (optional)

Commands:
docker-compose up -d
docker-compose logs -f api-server
```

### Production Deployment (Kubernetes)

```yaml
# Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: video-processing

---
# API Server Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: video-processing
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
    spec:
      containers:
      - name: api-server
        image: registry.example.com/api-server:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: redis-config
              key: url
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10

---
# Worker Deployment with HPA
apiVersion: apps/v1
kind: Deployment
metadata:
  name: video-worker
  namespace: video-processing
spec:
  replicas: 2
  selector:
    matchLabels:
      app: video-worker
  template:
    metadata:
      labels:
        app: video-worker
    spec:
      containers:
      - name: worker
        image: registry.example.com/worker:latest
        env:
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: redis-config
              key: url
        - name: AWS_ACCESS_KEY_ID
          valueFrom:
            secretKeyRef:
              name: aws-credentials
              key: access-key
        resources:
          requests:
            cpu: 2000m
            memory: 4Gi
          limits:
            cpu: 4000m
            memory: 8Gi
```

### CI/CD Pipeline

```
GitHub Push
    ↓
├─ Unit Tests (Jest, Pytest)
├─ Integration Tests
├─ Code Quality (SonarQube)
├─ Security Scan (Snyk)
├─ Build Docker Image
├─ Push to Registry
└─ Deploy to Staging
    ↓
Manual Approval
    ↓
Deploy to Production (Blue-Green)
    ├─ Run on 10% traffic (Canary)
    ├─ Monitor metrics (5 min)
    ├─ 100% traffic if healthy
    └─ Rollback if issues
```

### Backup & Disaster Recovery

**Database Backups:**
- Automated daily backups to S3 (7 day retention)
- Replication to secondary region
- RTO (Recovery Time Objective): 1 hour
- RPO (Recovery Point Objective): 24 hours

**Storage Backups:**
- S3 versioning enabled
- Cross-region replication for critical outputs
- Delete protection on old videos

---

## Summary

This architecture provides:

✅ **Scalability**: Horizontal scaling of all components
✅ **Reliability**: Redundancy, error handling, retry mechanisms
✅ **Performance**: Caching, async processing, CDN integration
✅ **Maintainability**: Clear separation of concerns, documented components
✅ **Observability**: Comprehensive logging, metrics, alerting
✅ **Cost Efficiency**: Resource optimization, auto-scaling

The system is designed to handle 10,000+ daily video processing requests with < 5 minute average queue time and 99.9% uptime SLA.
