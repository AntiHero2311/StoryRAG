# 📋 StoryRAG — Tổng hợp Prompt AI

Tài liệu này tổng hợp toàn bộ các **prompt** đang được sử dụng trong hệ thống StoryRAG, nơi dùng prompt để giao tiếp với LLM (chạy qua LM Studio / OpenAI-compatible API).

---

## 🗂️ Danh sách Prompt

| # | Tên Prompt | Service | Mục đích |
|---|-----------|---------|---------|
| 1 | [RAG Chat — System Prompt](#1-rag-chat--system-prompt) | `AiChatService` | Trả lời câu hỏi về nội dung truyện |
| 2 | [AI Scoring — System Prompt](#2-ai-scoring--system-prompt) | `ProjectReportService` | Định hướng LLM chỉ trả về JSON |
| 3 | [AI Scoring — User Prompt](#3-ai-scoring--user-prompt) | `ProjectReportService` | Chấm điểm bản thảo theo rubric 100 điểm |

---

## 1. RAG Chat — System Prompt

**File:** `Backend/Service/Implementations/AiChatService.cs`  
**Method:** `BuildSystemPrompt()`  
**Kích hoạt khi:** User đặt câu hỏi trong `WorkspacePage` → `POST /api/ai/{projectId}/chat`

### Prompt (template)

```
Bạn là trợ lý AI giúp tác giả phân tích và trả lời câu hỏi về nội dung truyện "{projectTitle}".

Dưới đây là các đoạn nội dung liên quan từ truyện:

[Đoạn 1]
{chunk_1}

---

[Đoạn 2]
{chunk_2}

---

... (tối đa TopK = 5 đoạn)

Hướng dẫn:
- Chỉ trả lời dựa trên nội dung truyện được cung cấp ở trên.
- Nếu không tìm thấy thông tin trong context, hãy nói rõ "Tôi không tìm thấy thông tin này trong nội dung truyện."
- Trả lời bằng tiếng Việt, súc tích và chính xác.
- Không bịa đặt thông tin không có trong context.
```

### Biến động

| Biến | Giá trị | Ghi chú |
|------|---------|---------|
| `{projectTitle}` | Tên dự án truyện (decrypted) | Lấy từ DB, giải mã bằng DEK của user |
| `{chunk_1..N}` | Nội dung TopK chunks gần nhất | Tìm bằng cosine distance trên pgvector |
| `TopK` | `5` | Hằng số trong `AiChatService` |

### Luồng xử lý

```
User nhập câu hỏi
  → Embed câu hỏi (nomic-embed-text)
  → Vector Search cosine distance → Top 5 chunks
  → Decrypt chunks bằng DEK
  → BuildSystemPrompt(projectTitle, chunks)
  → ChatMessage[System] + ChatMessage[User = câu hỏi]
  → LLM (qwen/qwen3.5-9b) → Answer
```

---

## 2. AI Scoring — System Prompt

**File:** `Backend/Service/Implementations/ProjectReportService.cs`  
**Method:** `EvaluateWithAiAsync()`  
**Kích hoạt khi:** `POST /api/ai/{projectId}/analyze`

### Prompt

```
Bạn là chuyên gia đánh giá bản thảo văn học. Chỉ trả về JSON thuần túy.
```

> **Vai trò:** System message ngắn, định hướng LLM không xuất thêm text ngoài JSON. Kết hợp với User Prompt bên dưới.

---

## 3. AI Scoring — User Prompt

**File:** `Backend/Service/Implementations/ProjectReportService.cs`  
**Method:** `EvaluateWithAiAsync()`  
**Kích hoạt khi:** `POST /api/ai/{projectId}/analyze`

### Prompt (template)

```
Bạn là chuyên gia đánh giá bản thảo văn học Việt Nam. Hãy đánh giá tác phẩm "{projectTitle}" theo rubric sau.

Nội dung tác phẩm:
[Đoạn 1]
{chunk_1}

---

[Đoạn 2]
{chunk_2}

---

... (tối đa 20 đoạn đầu tiên)

Hãy chấm điểm theo 14 tiêu chí sau và trả về JSON array (không có text nào ngoài JSON):
[
  {"key":"1.1","score":<số>,"maxScore":10,"feedback":"<nhận xét tiếng Việt>"},
  {"key":"1.2","score":<số>,"maxScore":10,"feedback":"<nhận xét>"},
  {"key":"1.3","score":<số>,"maxScore":5,"feedback":"<nhận xét>"},
  {"key":"2.1","score":<số>,"maxScore":10,"feedback":"<nhận xét>"},
  {"key":"2.2","score":<số>,"maxScore":10,"feedback":"<nhận xét>"},
  {"key":"2.3","score":<số>,"maxScore":5,"feedback":"<nhận xét>"},
  {"key":"3.1","score":<số>,"maxScore":10,"feedback":"<nhận xét>"},
  {"key":"3.2","score":<số>,"maxScore":5,"feedback":"<nhận xét>"},
  {"key":"3.3","score":<số>,"maxScore":5,"feedback":"<nhận xét>"},
  {"key":"4.1","score":<số>,"maxScore":10,"feedback":"<nhận xét>"},
  {"key":"4.2","score":<số>,"maxScore":5,"feedback":"<nhận xét>"},
  {"key":"4.3","score":<số>,"maxScore":5,"feedback":"<nhận xét>"},
  {"key":"5.1","score":<số>,"maxScore":5,"feedback":"<nhận xét>"},
  {"key":"5.2","score":<số>,"maxScore":5,"feedback":"<nhận xét>"}
]
Chỉ trả về JSON array, không có markdown, không có giải thích thêm.
```

### Biến động

| Biến | Giá trị | Ghi chú |
|------|---------|---------|
| `{projectTitle}` | Tên dự án (decrypted) | |
| `{chunk_1..N}` | Tối đa 20 chunks đầu của project | Toàn bộ embedded chunks, không giới hạn theo câu hỏi |

### Rubric 14 tiêu chí (100 điểm)

| Key | Nhóm | Tiêu chí | Điểm tối đa |
|-----|------|----------|------------|
| 1.1 | Cốt truyện & Mạch lạc | Tính nhất quán nội bộ | 10 |
| 1.2 | Cốt truyện & Mạch lạc | Liên kết nhân quả & Sự kiện | 10 |
| 1.3 | Cốt truyện & Mạch lạc | Nút thắt & Giải quyết | 5 |
| 2.1 | Xây dựng Nhân vật | Động cơ & Hành động | 10 |
| 2.2 | Xây dựng Nhân vật | Chiều sâu nhân vật | 10 |
| 2.3 | Xây dựng Nhân vật | Tương tác & Đối thoại | 5 |
| 3.1 | Ngôn từ & Văn phong | Ngữ pháp & Sự rõ ràng | 10 |
| 3.2 | Ngôn từ & Văn phong | Đa dạng cấu trúc câu | 5 |
| 3.3 | Ngôn từ & Văn phong | Tránh sáo ngữ | 5 |
| 4.1 | Sáng tạo & Thể loại | Độ sáng tạo & Tránh lối mòn | 10 |
| 4.2 | Sáng tạo & Thể loại | Đặc trưng thể loại | 5 |
| 4.3 | Sáng tạo & Thể loại | Sức cuốn hút | 5 |
| 5.1 | Tuân thủ & Hoàn thiện | Mức độ hoàn thiện bản thảo | 5 |
| 5.2 | Tuân thủ & Hoàn thiện | Tuân thủ định dạng | 5 |

### Output JSON mong đợi

```json
[
  {
    "key": "1.1",
    "score": 8.5,
    "maxScore": 10,
    "feedback": "Câu chuyện có tính nhất quán tốt về bối cảnh và thời gian..."
  },
  ...
]
```

### Xử lý sau khi nhận response

1. Strip markdown code fence nếu LLM trả về (` ```json ... ``` `)
2. `JsonSerializer.Deserialize<List<AiScoreItem>>(raw)`
3. `Math.Clamp(score, 0, maxScore)` — chặn score không vượt ngưỡng
4. Nếu LLM fail → fallback sang `GenerateMockCriteria()` (random 50–85% mỗi tiêu chí)

---

## 🤖 Thông tin Model & Cấu hình

| Tham số | Giá trị mặc định | Config key |
|---------|-----------------|-----------|
| Chat model | `qwen/qwen3.5-9b` | `AI:ChatModel` |
| Embedding model | `nomic-embed-text` | `AI:EmbeddingModel` |
| Base URL | `http://localhost:1234/v1` | `AI:BaseUrl` |
| API Key | `lm-studio` | `AI:ApiKey` |

> Thay đổi model trong `appsettings.Development.json` — không cần sửa code.

---

## 🔄 Vòng đời Prompt trong RAG

```
[Nội dung truyện]
    │
    ▼ ChunkingService (1500 ký tự, overlap 150)
[Chunks]
    │
    ▼ EmbeddingService → nomic-embed-text
[Vectors] ─── lưu vào pgvector
    │
    ▼ (khi có câu hỏi / phân tích)
Vector Search (cosine distance)
    │
    ▼ Decrypt bằng DEK
[Context text]
    │
    ▼ BuildSystemPrompt / EvaluatePrompt
[LLM Call] → qwen/qwen3.5-9b
    │
    ▼
[Answer / JSON Score]
```

---

## 💡 Gợi ý cải tiến Prompt

| # | Vấn đề | Gợi ý |
|---|--------|-------|
| 1 | LLM nhỏ (3B) hay bịa đặt | Thêm dòng: `"Tuyệt đối không suy diễn ngoài context."` vào RAG Chat prompt |
| 2 | JSON parse fail thường xuyên | Dùng **structured output** / function calling nếu model hỗ trợ |
| 3 | Scoring prompt quá dài | Chia thành 2 lần gọi: lần 1 chấm nhóm 1-3, lần 2 nhóm 4-5 |
| 4 | Feedback quá ngắn | Thêm yêu cầu: `"feedback phải từ 20-50 từ, có ví dụ cụ thể từ tác phẩm"` |
| 5 | Model không biết thể loại | Thêm metadata: tên thể loại vào prompt scoring |
