# StoryRAG — Review 2: Tài Liệu Hệ Thống & Công Nghệ

> **Phiên bản tài liệu:** 1.0  
> **Cập nhật lần cuối:** Tháng 3/2026

---

## Mục Lục

**PHẦN 1 — DOCUMENT: KIẾN TRÚC & THIẾT KẾ**
1. [Tổng Quan Kiến Trúc Hệ Thống](#1-tổng-quan-kiến-trúc-hệ-thống)
2. [Logical ERD — Cơ Sở Dữ Liệu](#2-logical-erd--cơ-sở-dữ-liệu)
3. [State Machine Diagrams](#3-state-machine-diagrams)
4. [Activity Diagrams — Luồng Nghiệp Vụ Chính](#4-activity-diagrams--luồng-nghiệp-vụ-chính)

**PHẦN 2 — PRODUCT / TECH**

5. [Dịch Vụ Bên Thứ 3](#5-dịch-vụ-bên-thứ-3)
6. [Công Nghệ Sử Dụng](#6-công-nghệ-sử-dụng)
7. [Source Code Management & DevOps](#7-source-code-management--devops)
8. [Môi Trường Deploy](#8-môi-trường-deploy)

---

## PHẦN 1 — DOCUMENT: KIẾN TRÚC & THIẾT KẾ

---

## 1. Tổng Quan Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────────────┐
│                            ACTORS                                    │
│      👤 Author (Tác giả)       👔 Staff       🔑 Admin              │
└─────────────────────┬───────────────────────────────────────────────┘
                      │  HTTPS / REST API
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                FRONTEND — React 19 + Vite + TypeScript               │
│          Tailwind CSS · React Router · Axios · Framer Motion        │
│     localhost:5173 (dev)  ·  storyrag-frontend.onrender.com (prod)  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ REST API (JSON / JWT Bearer)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  BACKEND — ASP.NET Core .NET 8                       │
│   ┌──────────────┐   ┌──────────────────┐   ┌─────────────────┐    │
│   │  Controllers │──►│    Services      │──►│  Repository /   │    │
│   │  (11 APIs)   │   │  (17 classes)    │   │  EF Core        │    │
│   └──────────────┘   └──────────────────┘   └─────────────────┘    │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ Middleware: JWT Auth · Rate Limiter · CORS · Request Timeout│   │
│   └─────────────────────────────────────────────────────────────┘   │
│   localhost:7259 (dev)  ·  storyrag-backend.onrender.com (prod)     │
└──────────────┬──────────────────────────┬───────────────────────────┘
               │ Npgsql / EF Core          │ HttpClient
               ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────────────────┐
│   Supabase PostgreSQL    │   │   Google Gemini API  (PRIMARY)       │
│   + pgvector (768-dim)   │   │   ├─ Chat:  gemma-3-27b-it           │
│   + Supabase Storage     │   │   └─ Embed: gemini-embedding-001     │
│   Region: ap-northeast-1 │   ├──────────────────────────────────────┤
│   (Singapore)            │   │   LM Studio LOCAL  (FALLBACK)        │
└──────────────────────────┘   │   ├─ Chat:  qwen2.5-1.5b-instruct    │
                               │   └─ Embed: nomic-embed-text-v1.5    │
                               └──────────────┬───────────────────────┘
                                              │
                               ┌──────────────▼───────────┐
                               │   Gmail SMTP (MailKit)   │
                               │   Welcome + Reset email  │
                               └──────────────────────────┘
```

### Mô tả các thành phần

| Thành phần | Vai trò |
|---|---|
| **Frontend** | SPA React — giao diện tác giả, staff, admin |
| **Backend API** | REST API, xử lý toàn bộ business logic, bảo mật |
| **Supabase PostgreSQL** | Database chính, lưu trữ tất cả dữ liệu |
| **pgvector** | Extension lưu và tìm kiếm vector embedding 768 chiều |
| **Supabase Storage** | Lưu file nhị phân: avatar, ảnh bìa truyện |
| **Google Gemini API** | LLM chính: chat, rewrite, analyze, embedding |
| **LM Studio** | LLM fallback chạy local khi Gemini không khả dụng |
| **Gmail SMTP** | Gửi email tự động: chào mừng, đặt lại mật khẩu |

---

## 2. Logical ERD — Cơ Sở Dữ Liệu

```
┌──────────────────┐         ┌───────────────────────┐
│      Users       │         │    SubscriptionPlans  │
│──────────────────│         │───────────────────────│
│ Id (PK, uuid)    │         │ Id (PK, int)           │
│ FullName         │         │ Name                  │
│ Email (unique)   │         │ Price                 │
│ PasswordHash     │         │ MaxTokenLimit (long)  │
│ PasswordSalt     │         │ MaxAnalysisCount (int)│
│ AvatarURL        │         └──────────┬────────────┘
│ Role             │                    │ 1
│ IsActive         │                    │
│ DataEncryptionKey│         ┌──────────▼────────────┐
│ RefreshToken     │    1    │   UserSubscriptions   │
│ PasswordReset*   │◄────────┤ Id (PK, int)          │
│ CreatedAt        │         │ UserId (FK)           │
└──────┬───────────┘         │ PlanId (FK)           │
       │ 1                   │ StartDate / EndDate   │
       │                     │ Status                │
       │                     │ UsedTokens (long)     │
       │                     │ UsedAnalysisCount     │
       │                     └───────────────────────┘
       │ 1:N
       ▼
┌──────────────────────────────────────────────────────┐
│                      Projects                        │
│──────────────────────────────────────────────────────│
│ Id (PK, uuid)          Status: Draft/Published       │
│ AuthorId (FK→Users)    IsDeleted                     │
│ Title          [AES-256]                             │
│ Summary        [AES-256]                             │
│ AiInstructions [AES-256]                             │
│ CoverImageURL  (plain, CDN)                          │
│ SummaryEmbedding vector(768)                         │
│ CreatedAt / UpdatedAt                                │
└──┬───────────────────────────────────────────────┬───┘
   │ 1:N                                           │ M:N
   │                                ┌──────────────▼──────┐
   │                                │    ProjectGenres    │
   │                                │ ProjectId (FK)      │
   │                                │ GenreId (FK)        │
   │                                └──────────────┬──────┘
   │                                               │ N:1
   │                                ┌──────────────▼──────┐
   │                                │       Genres        │
   │                                │ Id / Name           │
   │                                └─────────────────────┘
   │
   ├────────────────────────────────────────────┐
   │                                            │
   │ 1:N                                        │ 1:N
   ▼                                            ▼
┌────────────────────────┐     ┌────────────────────────────┐
│       Chapters         │     │   WorldbuildingEntries     │
│────────────────────────│     │────────────────────────────│
│ Id (PK, uuid)          │     │ Id / ProjectId (FK)        │
│ ProjectId (FK)         │     │ Title    [AES-256]         │
│ ChapterNumber          │     │ Content  [AES-256]         │
│ Title                  │     │ Category                   │
│ WordCount              │     │ Embedding vector(768)      │
│ Status                 │     └────────────────────────────┘
│ CurrentVersionId (FK)  │
│ DraftContent [AES-256] │     ┌────────────────────────────┐
│ IsDeleted              │     │     CharacterEntries       │
└──────┬─────────────────┘     │────────────────────────────│
       │ 1:N                   │ Id / ProjectId (FK)        │
       ▼                       │ Name        [AES-256]      │
┌─────────────────────────┐    │ Description [AES-256]      │
│     ChapterVersions     │    │ Background  [AES-256]      │
│─────────────────────────│    │ Role                       │
│ Id (PK, uuid)           │    │ Embedding vector(768)      │
│ ChapterId (FK)          │    └────────────────────────────┘
│ VersionNumber           │
│ Title                   │    ┌────────────────────────────┐
│ Content     [AES-256]   │    │      AiChatMessages        │
│ ChangeNote  [AES-256]   │    │────────────────────────────│
│ WordCount / TokenCount  │    │ Id / ProjectId(FK)         │
│ IsChunked               │    │ UserId (FK)                │
│ IsEmbedded              │    │ Question [AES-256]         │
│ IsPinned                │    │ Answer   [AES-256]         │
│ CreatedBy (FK→Users)    │    │ InputTokens/OutputTokens   │
└──────┬──────────────────┘    │ TotalTokens                │
       │ 1:N                   └────────────────────────────┘
       ▼
┌─────────────────────────┐    ┌────────────────────────────┐
│      ChapterChunks      │    │     RewriteHistories       │
│─────────────────────────│    │────────────────────────────│
│ Id (PK, uuid)           │    │ Id / ProjectId / ChapterId │
│ VersionId (FK)          │    │ UserId (FK)                │
│ ProjectId (FK)          │    │ OriginalText  [AES-256]    │
│ Content     [AES-256]   │    │ RewrittenText [AES-256]    │
│ ChunkIndex              │    │ Instruction   [AES-256]    │
│ Embedding vector(768)   │    │ TotalTokens                │
└─────────────────────────┘    └────────────────────────────┘

                               ┌────────────────────────────┐
                               │      ProjectReports        │
                               │────────────────────────────│
                               │ Id / ProjectId / UserId    │
                               │ TotalScore (decimal)       │
                               │ CriteriaJson (JSONB)       │
                               │ Status                     │
                               │ CreatedAt                  │
                               └────────────────────────────┘

                               ┌────────────────────────────┐
                               │        BugReports          │
                               │────────────────────────────│
                               │ Id / UserId (FK)           │
                               │ Title / Description        │
                               │ Category / Priority        │
                               │ Status                     │
                               │ StaffNote                  │
                               └────────────────────────────┘

                               ┌────────────────────────────┐
                               │       UserSettings         │
                               │────────────────────────────│
                               │ UserId (FK, PK)            │
                               │ FontFamily / FontSize      │
                               └────────────────────────────┘
```

### Ghi Chú Mã Hóa

Tất cả trường `[AES-256]` được mã hóa với **Data Encryption Key (DEK)** riêng của từng user.  
DEK được mã hóa bằng **MasterKey** lưu trong environment variable — không bao giờ lưu trực tiếp vào DB.

---

## 3. State Machine Diagrams

### 3.1 Project

```
                    ┌─────────┐
           [CREATE] │         │
      ─────────────►│  Draft  │
                    │         │
                    └────┬────┘
                         │ [Publish]
                         ▼
                    ┌─────────────┐       ┌───────────────┐
                    │  Published  │──────►│   Archived    │
                    └──────┬──────┘       │  (manual)     │
                           │              └───────────────┘
                           │ [Soft Delete]
                           ▼
                    ┌──────────────┐
                    │   Deleted    │
                    │ IsDeleted=true│
                    └──────────────┘
```

### 3.2 Chapter

```
                    ┌─────────┐
           [CREATE] │         │
      ─────────────►│  Draft  │◄─────────────────┐
                    │         │                  │ [Revert version]
                    └────┬────┘                  │
                         │ [Finalize]            │
                         ▼                       │
                    ┌──────────┐                 │
                    │  Final   │─────────────────┘
                    └────┬─────┘
                         │ [Delete]
                         ▼
                    ┌──────────────┐
                    │   Deleted    │
                    │ IsDeleted=true│
                    └──────────────┘
```

### 3.3 ChapterVersion (Version Control)

```
                        ┌────────────────┐
             [CREATE]   │    Created     │
      ──────────────────►  IsChunked=false│
                        │  IsEmbedded=false│
                        └───────┬────────┘
                                │ [POST /chunk]
                                ▼
                        ┌────────────────┐
                        │    Chunked     │
                        │ IsChunked=true │
                        └───────┬────────┘
                                │ [POST /embed]
                                ▼
                        ┌────────────────┐
                        │   Embedded     │◄──────────────┐
                        │ IsEmbedded=true│               │
                        └───────┬────────┘               │ [Unpin]
                                │ [Pin]                  │
                                ▼                        │
                        ┌────────────────┐               │
                        │    Pinned      │───────────────┘
                        │ IsPinned=true  │
                        │ (bảo vệ khỏi  │
                        │  auto-prune)  │
                        └────────────────┘

  Auto-prune rule: khi số version > 20 → xóa oldest non-pinned + chunks
```

### 3.4 UserSubscription

```
               ┌──────────────────┐
    [Subscribe]│                  │  [Renew / Upgrade]
    ──────────►│     Active       │◄──────────────────┐
               │ Status="Active"  │                   │
               │ UsedTokens: 0    │                   │
               └──────┬───────────┘                   │
                      │                               │
          [EndDate     │              [Cancel]         │
           < Now()]    │         ┌────────────────┐   │
                      ▼         │   Cancelled    │   │
               ┌──────────────┐ └────────────────┘   │
               │   Expired    │                       │
               └──────┬───────┘                       │
                      └───────────────────────────────┘
```

### 3.5 BugReport

```
    [Author Submit]    ┌──────────┐    [Staff Assign]   ┌─────────────┐
    ──────────────────►│   Open   │──────────────────► │ In Progress │
                       └──────────┘                     └──────┬──────┘
                                                               │ [Staff Resolve]
                       ┌──────────┐                            │
                       │ Resolved │◄───────────────────────────┘
                       └──────────┘
                            │ [Admin Delete]
                            ▼
                       ┌──────────┐
                       │ Deleted  │
                       └──────────┘
```

---

## 4. Activity Diagrams — Luồng Nghiệp Vụ Chính

### 4.1 Đăng Ký & Onboarding

```
   Author                      System                     Gmail SMTP
     │                            │                           │
     │─── Register ──────────────►│                           │
     │    (name, email, password) │                           │
     │                            │── Validate unique email   │
     │                            │── Hash password (bcrypt)  │
     │                            │── Generate DEK (AES-256)  │
     │                            │── Encrypt DEK/MasterKey   │
     │                            │── Assign Free plan        │
     │                            │── Save User + Subscription│
     │                            │──────── Send Welcome ────►│
     │◄─── JWT + RefreshToken ────│                           │── Email sent
     │                            │                           │
     │─── Login ─────────────────►│                           │
     │    (email, password)        │── Verify hash            │
     │◄─── JWT + RefreshToken ────│── Rotate RefreshToken     │
```

### 4.2 Quản Lý Version Chương (Git-style)

```
   Author                              System (Backend)
     │                                      │
     │─── Create Project ─────────────────►│── Encrypt Title/Summary (AES-256)
     │◄── projectId ───────────────────────│── Save → Status: Draft
     │                                      │
     │─── Create Chapter ─────────────────►│── Chapter + Version 1 (auto)
     │◄── chapterId, versionNum=1 ─────────│── CurrentVersionId = v1
     │                                      │
     │─── Write & Auto-save ──────────────►│── Encrypt DraftContent → DB
     │    (every N seconds)                 │   (không tạo version mới)
     │                                      │
     │─── Create Snapshot (Version) ──────►│── Clone DraftContent → new Version
     │◄── versionNum=2 ────────────────────│── CurrentVersionNum++
     │                                      │
     │─── Pin Version v1 ─────────────────►│── IsPinned = true
     │◄── ok ──────────────────────────────│── Protected from auto-prune
     │                                      │
     │─── Switch to v2 ───────────────────►│── CurrentVersionId = v2
     │◄── ok ──────────────────────────────│── RAG dùng chunks của v2
     │                                      │
     │   [Khi > 20 versions]               │── Auto-prune:
     │                                      │   Xóa oldest non-pinned + chunks
```

### 4.3 AI Chat (RAG Pipeline)

```
   Author              Backend                 pgvector DB         Gemini API
     │                    │                         │                   │
     │─── Gửi câu hỏi ──►│                         │                   │
     │                    │── 1. Verify ownership   │                   │
     │                    │── 2. Check token budget │                   │
     │                    │── 3. Sanitize question  │                   │
     │                    │── 4. Embed question ────────────────────── ►│
     │                    │◄── vector[768] ─────────────────────────── │
     │                    │── 5. Vector search ────►│                   │
     │                    │   WHERE projectId=X     │                   │
     │                    │   Top3 ChapterChunks    │                   │
     │                    │   Top2 Worldbuilding    │                   │
     │                    │◄── context chunks ─────│                   │
     │                    │   Top2 Characters       │                   │
     │                    │── 6. Build prompt       │                   │
     │                    │   (XML delimiter wrap)  │                   │
     │                    │── 7. Call Gemini ───────────────────────── ►│
     │                    │◄── answer ──────────────────────────────── │
     │                    │── 8. Validate output    │                   │
     │                    │── 9. Encrypt & save     │                   │
     │                    │── 10. Deduct tokens     │                   │
     │◄─── answer ────────│                         │                   │
```

### 4.4 Embed Chapter (RAG Preparation)

```
   Author              Backend                  Gemini Embed API     Database
     │                    │                           │                  │
     │─── POST /embed ───►│                           │                  │
     │                    │── Verify ownership        │                  │
     │                    │── Fetch active version    │                  │
     │                    │── Decrypt content         │                  │
     │                    │── ChunkingService:        │                  │
     │                    │   Split ~1500 chars       │                  │
     │                    │   Overlap 150 chars       │                  │
     │                    │── batchEmbedContents ─────►│                 │
     │                    │◄── vectors[768] ──────── │                  │
     │                    │── Save ChapterChunks ─────────────────────►│
     │                    │── IsEmbedded = true ───────────────────────►│
     │◄─── ok ────────────│                           │                  │
```

### 4.5 Phân Tích Chất Lượng Truyện

```
   Author              Backend                  Gemini API           Database
     │                    │                          │                   │
     │─── POST /analyze ─►│                          │                   │
     │                    │── 1. Verify ownership    │                   │
     │                    │── 2. Check analysis count│                   │
     │                    │── 3. Check token budget  │                   │
     │                    │── 4. Fetch all chunks ──────────────────────►│
     │                    │◄── chunks ─────────────────────────────────-│
     │                    │── 5. Decrypt + Sanitize  │                   │
     │                    │── 6. Build rubric prompt │                   │
     │                    │   (14 tiêu chí, temp=0.1)│                   │
     │                    │── 7. Call Gemini ────────►│                  │
     │                    │◄── JSON 14 criteria ─────│                  │
     │                    │── 8. Parse + validate    │                   │
     │                    │── 9. Save ProjectReport ────────────────────►│
     │                    │── 10. Deduct: +1 analysis│                   │
     │                    │        + tokens consumed │                   │
     │◄─── Report ────────│                          │                   │
     │    (score/feedback)│                          │                   │
```

### 4.6 Quản Lý Báo Cáo Lỗi

```
   Author              Staff / Admin             System
     │                      │                       │
     │─── Submit BugReport ─────────────────────── ►│── Save (Status: Open)
     │◄── confirmation ─────────────────────────── │
     │                      │                       │
     │                      │─── View all bugs ────►│── Filter by status/category
     │                      │◄── list ──────────── │
     │                      │                       │
     │                      │─── Update status + ──►│── Status = InProgress
     │                          staff note           │   Save StaffNote
     │                      │                       │
     │                      │─── Resolve ──────────►│── Status = Resolved
     │                      │                       │
     │              Admin ──│─── Delete ───────────►│── Hard delete
```

### 4.7 Quên Mật Khẩu

```
   Author                  System                   Gmail SMTP
     │                        │                          │
     │─── POST /forgot ──────►│                          │
     │    (email)              │── Generate reset token  │
     │                        │── Hash token → DB        │
     │                        │── Set expiry (15 phút)   │
     │                        │─── Send reset link ─────►│── Email với token
     │◄─── "Email đã gửi" ───│                          │
     │                        │                          │
     │─── Click link          │                          │
     │─── POST /reset ───────►│                          │
     │    (token, newPassword) │── Validate token + expiry│
     │                        │── Hash new password      │
     │                        │── Invalidate token       │
     │◄─── "Đổi mật khẩu OK"─│                          │
```

---

## PHẦN 2 — PRODUCT / TECH

---

## 5. Dịch Vụ Bên Thứ 3

| Danh mục | Dịch vụ | Mục đích cụ thể | Ghi chú |
|---|---|---|---|
| **AI — LLM (Primary)** | Google Gemini API | Chat AI, Rewrite văn, Phân tích truyện | Model: `gemma-3-27b-it` |
| **AI — Embedding (Primary)** | Google Gemini API | Vector embedding 768 chiều cho RAG | Model: `gemini-embedding-001` |
| **AI — LLM (Fallback)** | LM Studio (Local) | Chat khi Gemini không khả dụng | `qwen2.5-1.5b-instruct` |
| **AI — Embedding (Fallback)** | LM Studio (Local) | Embedding local khi Gemini fail | `nomic-embed-text-v1.5` |
| **Database** | Supabase PostgreSQL | Lưu trữ toàn bộ dữ liệu hệ thống | Region: Singapore (aws-ap-northeast-1) |
| **Vector Search** | pgvector (PostgreSQL ext.) | Cosine similarity search cho RAG | 768 chiều |
| **File Storage** | Supabase Storage | Avatar user, ảnh bìa dự án truyện | CDN public URL |
| **Authentication** | JWT (tự triển khai) | Bearer token + Refresh token rotation | HS256, lưu RefreshToken trong DB |
| **Email** | Gmail SMTP (Google Workspace) | Email chào mừng, đặt lại mật khẩu | MailKit, STARTTLS port 587 |
| **Deployment** | Render.com | Host Backend API (Docker container) | Region Singapore, Free plan |
| **Deployment** | Render.com | Host Frontend (Static Site) | CDN toàn cầu |

---

## 6. Công Nghệ Sử Dụng

### 6.1 Frontend

| Công nghệ | Phiên bản | Vai trò |
|---|---|---|
| **React** | 19.2.0 | UI Framework — SPA |
| **TypeScript** | 5.9.3 | Ngôn ngữ chính |
| **Vite** | 7.3.1 | Build tool / Dev server |
| **Tailwind CSS** | 4.2.1 | Styling utility-first |
| **React Router DOM** | 7.13.1 | Client-side routing |
| **Axios** | 1.13.5 | HTTP client (REST API calls) |
| **React Hook Form** | 7.71.2 | Form management + validation |
| **Framer Motion** | 12.35.0 | Animations & transitions |
| **Lucide React** | 0.575.0 | Icon library |

### 6.2 Backend

| Công nghệ | Phiên bản | Vai trò |
|---|---|---|
| **.NET** | 8.0 LTS | Runtime |
| **ASP.NET Core** | 8.0 | Web framework, REST API |
| **Entity Framework Core** | 9.0 | ORM — Code First |
| **Npgsql** | 9.0.1 | PostgreSQL native driver |
| **Pgvector.EntityFrameworkCore** | 0.3.0 | Vector operations với EF Core |
| **OpenAI SDK** | 2.1.0 | Gemini API + LM Studio client |
| **JWT Bearer** | 8.0.0 | Token authentication |
| **MailKit** | 4.9.0 | Email qua SMTP (Gmail) |
| **Swashbuckle (Swagger)** | 6.6.2 | API documentation tự động |
| **Docker** | — | Containerization cho deployment |

**Pattern kiến trúc Backend:** 3-layer (Controller → Service → Repository), Dependency Injection built-in .NET.

### 6.3 Database & Storage

| Công nghệ | Vai trò |
|---|---|
| **PostgreSQL 15+** | Primary relational database (Supabase cloud) |
| **pgvector extension** | Lưu và tìm kiếm vector embedding 768-dim |
| **Supabase Storage** | Object storage cho file nhị phân (S3-compatible) |

### 6.4 Mobile

> ❌ **Không có** — Hệ thống hiện tại là **Web App** (responsive design). Chưa có ứng dụng mobile native (iOS/Android) hoặc React Native.

### 6.5 AI / ML

| Công nghệ | Loại | Vai trò |
|---|---|---|
| **Google Gemini API** | Cloud API (trả phí) | LLM chính: chat RAG, rewrite, analyze |
| **Gemini Embedding API** | Cloud API (trả phí) | Embedding 768-dim cho vector search |
| **LM Studio** | Local server | LLM fallback chạy offline |
| **Qwen 2.5 1.5B Instruct** | Open-source model | Chat model local (fallback) |
| **Nomic Embed Text v1.5** | Open-source model | Embedding model local (fallback) |

---

## 7. Source Code Management & DevOps

| Danh mục | Công cụ | Chi tiết |
|---|---|---|
| **Source Control** | **GitHub** | Repository `StoryRAG`, branch-based workflow |
| **Containerization** | **Docker** | `Backend/Dockerfile`, build context `./Backend` |
| **Infrastructure as Code** | **render.yaml** | Declarative deployment config (service, region, env vars) |
| **CI/CD** | **Render.com Auto Deploy** | Tự động deploy khi push lên `main` branch |
| **API Documentation** | **Swagger / Swashbuckle** | Tự động sinh từ code, truy cập tại `/swagger` |
| **Secrets Management** | **Render.com Env Vars** | Keys nhạy cảm không commit vào git (`sync: false`) |
| **DB Schema Management** | **EF Core Migrations** | Code First, `supabase_full_reset.sql` cho full reset |

> ⚠️ **Chưa triển khai:**
> - GitHub Actions CI/CD pipeline (automated tests, lint, build check)
> - Staging / UAT environment
> - Automated unit/integration tests
> - Monitoring & alerting (Sentry, Datadog, v.v.)

---

## 8. Môi Trường Deploy

### 8.1 Tổng Quan

| Môi trường | Backend URL | Frontend URL | Mục đích |
|---|---|---|---|
| **Development (Local)** | `https://localhost:7259` | `http://localhost:5173` | Phát triển, debug, test local |
| **Production** | `https://storyrag-backend.onrender.com` | `https://storyrag-frontend.onrender.com` | Live environment cho end-users |

### 8.2 Cấu Hình Production (render.yaml)

```yaml
Platform:   Render.com
Runtime:    Docker  (Backend — containerized .NET 8)
Region:     Singapore (aws-1-ap-northeast-1)
Plan:       Free tier
Auto-deploy: Yes (on push to main)

LLM Primary:  Google Gemini API (cloud)
LLM Fallback: Không có (LM Studio chỉ chạy local)
Database:     Supabase PostgreSQL Pooler — port 6543
Email:        Gmail SMTP — port 587 (STARTTLS)
Storage:      Supabase Storage (S3-compatible)
```

### 8.3 Biến Môi Trường Production

| Biến | Mục đích | Lưu trong git? |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | Supabase PostgreSQL connection string | ❌ `sync: false` |
| `Jwt__Key` | HMAC-SHA256 signing key cho JWT | ❌ `sync: false` |
| `Jwt__Issuer` | `StoryRAG_Issuer` | ✅ hardcoded |
| `Jwt__Audience` | `StoryRAG_Audience` | ✅ hardcoded |
| `Security__MasterKey` | Key mã hóa DEK của user (AES-256) | ❌ `sync: false` |
| `Gemini__ChatApiKey` | Google Gemini API key cho chat | ❌ `sync: false` |
| `Gemini__EmbedApiKey` | Google Gemini API key cho embedding | ❌ `sync: false` |
| `Gemini__ChatModel` | `gemma-3-27b-it` | ✅ hardcoded |
| `Gemini__EmbeddingModel` | `gemini-embedding-001` | ✅ hardcoded |
| `Gemini__EmbeddingDimensions` | `768` | ✅ hardcoded |
| `Email__SmtpHost` | `smtp.gmail.com` | ✅ hardcoded |
| `Email__SmtpPort` | `587` | ✅ hardcoded |
| `Email__Username` | Gmail address | ❌ `sync: false` |
| `Email__Password` | Gmail App Password | ❌ `sync: false` |
| `Email__FromName` | `StoryNest` | ✅ hardcoded |
| `Cors__AllowedOrigins` | Whitelist frontend domain | ❌ `sync: false` |

### 8.4 So Sánh Development vs Production

| Điểm khác biệt | Development | Production |
|---|---|---|
| LLM Fallback | LM Studio (localhost:1234) | Không có (Gemini only) |
| HTTPS Redirect | Tắt (localhost) | Render xử lý SSL externally |
| Database | Supabase cloud (same) | Supabase cloud (pooler port 6543) |
| Rate Limiting | Có (sliding window) | Có (sliding window) |
| Logging | Console + Debug | Console (Render log stream) |
| Swagger | Bật | Bật (cần disable trong prod nếu cần bảo mật) |

---

*Tài liệu này là một phần của bộ tài liệu StoryRAG.*  
*Xem thêm: [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) · [AI_SECURITY_GUIDE.md](AI_SECURITY_GUIDE.md) · [PROMPT_README.md](PROMPT_README.md)*
