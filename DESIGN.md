# BSuite Transcription Service - Design Document

## 1. Project Overview

A self-hosted web application for transcribing audio files using `whisper.cpp`. The application runs in a Docker container and acts as an orchestrator, spinning up ephemeral "worker" containers to process audio queues. It features a modern, type-safe UI and robust job management.

## 2. Technology Stack

### Backend

* **Language:** Go (Golang) 1.25+
* **Web Framework:** **Echo** (v4). chosen for its robust middleware ecosystem, performance, and ease of use.
* **Database:** SQLite using `mattn/go-sqlite3`. Embedded, serverless, and perfect for managing a job queue without the overhead of Postgres/MySQL.
* **Container SDK:** `docker/docker/client` (Official Go SDK).

### Frontend

* **Templating:** **Templ**. Allows writing HTML as Go code, ensuring type safety and compile-time error checking.
* **Styling:** **Tailwind CSS**. Utility-first CSS framework for rapid UI development.
* **Interactivity:** **HTMX**. Enables AJAX-like functionality (progress bars, queue updates) using HTML attributes, reducing the need for custom JavaScript.

### Infrastructure

* **Runtime:** Docker.
* **Orchestration:** "Sibling Container" pattern (Docker-out-of-Docker) via mounted `/var/run/docker.sock`.
* **Host Environment:** Proxmox LXC container with Docker nesting enabled.

---

## 3. Architecture Design

### 3.1. The "Sibling Container" Strategy

To avoid the security and performance pitfalls of running Docker *inside* Docker (DinD), we use the host's Docker daemon.

* **The Controller (App):** Our Go application container. It mounts the host's Docker socket.
* **The Workers:** When a job starts, the Controller tells the Host Daemon to spawn a new container. This new container sits *next to* the Controller, not inside it.
* **Shared Storage:** A single volume on the host is mounted to both the Controller and the Workers.
* *Controller* writes uploads to `/mnt/data/uploads`.
* *Worker* reads from `/mnt/data/uploads` and writes to `/mnt/data/transcripts`.



### 3.2. Data Flow Diagram

1. **User** uploads `audio.mp3` via Web UI.
2. **Go Handler** saves file to Shared Volume and creates a `PENDING` record in SQLite.
3. **Job Manager** (Background Routine) detects the pending job.
4. **Docker SDK** commands the host to pull/run `ghcr.io/ggerganov/whisper.cpp`.
5. **Whisper Container** mounts the Shared Volume, processes the audio, writes `audio.txt`, and exits.
6. **Job Manager** detects container exit, updates SQLite to `COMPLETED`.
7. **User** sees "Completed" status on UI and downloads the text file.

---

## 4. Component Details

### 4.1. Database Schema (SQLite)

A single table `jobs` is sufficient.

```sql
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,           -- UUID
    filename TEXT NOT NULL,        -- Original filename (e.g., "meeting.wav")
    storage_path TEXT NOT NULL,    -- Path on disk (e.g., "/data/uploads/uuid.wav")
    model TEXT DEFAULT 'base',     -- Whisper model size
    status TEXT NOT NULL,          -- pending, processing, completed, failed
    container_id TEXT,             -- Docker ID (for killing jobs)
    created_at DATETIME,
    updated_at DATETIME
);

```

### 4.2. The Worker Pool (Go Routines)

We will use a **buffered channel** to limit concurrency.

* **Configuration:** `MAX_CONCURRENT_JOBS` (e.g., 2).
* **Mechanism:**
* On startup, spawn 2 "Worker" goroutines.
* These workers loop forever, listening on a `jobQueue` channel.
* When a user uploads a file, we push the `JobID` into the channel.
* If the channel is full (2 jobs running), the push blocks (or we queue it in DB and have a poller push it when space is available).



### 4.3. Docker Execution Command

The Go app will programmatically construct a command similar to this CLI equivalent:

```bash
docker run --rm \
  -v /host/path/to/data:/data \  # Crucial: Maps host storage to worker
  ghcr.io/ggerganov/whisper.cpp:main \
  -m models/ggml-base.bin \
  -f /data/uploads/meeting.wav \
  -of /data/transcripts/meeting

```

---

## 5. UI/UX Workflow

### Dashboard (`/`)

* **Header:** Simple branding.
* **Upload Area:** A clean dropzone.
* *Action:* POST to `/upload`.
* *HTMX:* `hx-post="/upload" hx-target="#job-list" hx-swap="prepend"`.


* **Job Queue:** A list of cards.
* **Pending:** "Waiting in queue..." (Grey)
* **Processing:** "Transcribing..." (Blue/Animate) - Polls every 2s via HTMX.
* **Completed:** "Download Transcript" button (Green).
* **Failed:** Error message (Red).



### Transcription View (`/view/:id`)

* Read-only text area displaying the content of the generated `.txt` or `.vtt` file.
* "Copy to Clipboard" button.

---

## 6. Directory Structure

This structure separates concerns while keeping the project flat enough for a solo dev.

```text
/
├── cmd/
│   └── server/
│       └── main.go       # Entry point, dependency injection
├── internal/
│   ├── database/         # SQLite initialization and queries
│   ├── docker/           # Docker SDK wrapper (StartContainer, etc.)
│   ├── handlers/         # Echo web handlers
│   ├── models/           # Go structs (Job, Status)
│   └── worker/           # The Queue and Worker logic
├── views/                # Templ components
│   ├── layout/           # Base HTML layout
│   ├── pages/            # Home, View Transcript
│   └── components/       # JobCard, UploadForm
├── public/               # Static assets (CSS, images)
├── go.mod
├── Dockerfile            # For the Go App itself
└── compose.yml           # For local dev / production

```

---

## 7. Next Steps (Development Plan)

1. **Skeleton:** Initialize Go mod, Echo, and Templ.
2. **Docker Client:** Prove the Go app can list containers on the host.
3. **Database:** Set up SQLite and the Job struct.
4. **Worker:** Implement the producer/consumer queue.
5. **UI:** Build the Templ components and connect them.

