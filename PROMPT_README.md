# 📋 StoryRAG — Tổng hợp Prompt AI

Tài liệu này tổng hợp toàn bộ các **prompt** đang được sử dụng trong hệ thống StoryRAG.

---

## 🗂️ Danh sách Prompt

| # | Tên Prompt | Service | Mục đích |
|---|-----------|---------|---------|
| 1 | [RAG Chat — System Prompt](#1-rag-chat--system-prompt) | `AiChatService` | Trả lời câu hỏi về nội dung truyện |
| 2 | [AI Scoring — System Prompt](#2-ai-scoring--system-prompt) | `ProjectReportService` | Định hướng LLM chỉ trả về JSON |
| 3 | [AI Scoring — User Prompt](#3-ai-scoring--user-prompt) | `ProjectReportService` | Chấm điểm bản thảo theo rubric 100 điểm (completeness-aware) |

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

... (tối đa TopK = 3 đoạn chapter + 2 worldbuilding + 2 characters)

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
| `{chunk_1..N}` | Nội dung TopK chunks gần nhất | Tìm bằng cosine distance trên pgvector, **chỉ từ active version** |
| `TopK` | `3 chapters + 2 worldbuilding + 2 characters` | Hằng số trong `AiChatService` |

### Luồng xử lý

```
User nhập câu hỏi
  → Embed câu hỏi (Gemini embedding-001)
  → Lấy activeVersionIds từ Chapter.CurrentVersionId
  → Vector Search cosine distance (chỉ active versions)
  → Top 3 chapter chunks + Top 2 worldbuilding + Top 2 characters
  → Decrypt bằng DEK
  → BuildSystemPrompt(projectTitle, chunks)
  → LLM (Gemini 2.0 flash) → Answer
  → Chỉ trừ UsedTokens, KHÔNG trừ UsedAnalysisCount
```

---

## 2. AI Scoring — System Prompt

**File:** `Backend/Service/Implementations/ProjectReportService.cs`  
**Method:** `EvaluateWithAiAsync()`  
**Kích hoạt khi:** `POST /api/ai/{projectId}/analyze`

### Prompt

```
Bạn là chuyên gia đánh giá bản thảo văn học Việt Nam. Hãy phân tích sâu và nghiêm túc.
Chỉ trả về JSON thuần túy, không markdown, không giải thích.
```

---

## 3. AI Scoring — User Prompt

**File:** `Backend/Service/Implementations/ProjectReportService.cs`  
**Method:** `EvaluateWithAiAsync()`  
**Kích hoạt khi:** `POST /api/ai/{projectId}/analyze`

### Prompt (template)

```
Bạn là chuyên gia đánh giá bản thảo văn học Việt Nam. Hãy đánh giá tác phẩm "{projectTitle}".

Thông tin tác phẩm:
- Số chương: {chapterCount}
- Tổng số từ: {totalWords}
- Mức độ hoàn thiện: {completenessNote}

Nội dung tác phẩm (tối đa 20 đoạn đầu tiên):
[Đoạn 1]
{chunk_1}

---

...

Yêu cầu đánh giá:
- Với MỖI tiêu chí, bắt buộc phải nêu ÍT NHẤT 3 vấn đề cụ thể và 3 gợi ý cải thiện
- Trích dẫn câu/đoạn cụ thể từ tác phẩm để minh họa
- Thang điểm nghiêm túc — KHÔNG cho điểm cao khi tác phẩm còn sơ khai

Tiers điểm:
- Tác phẩm chưa hoàn thiện (< 5 chương hoặc < 3000 từ): tối đa 20-45% điểm mỗi tiêu chí
- Bản thảo sơ khai: tối đa 40-60%
- Khá đầy đủ: 60-75%
- Hoàn thiện tốt: 75-90%

Tiêu chí 5.1 (Hoàn thiện): {completenessNote}
→ Nếu tác phẩm chưa hoàn thiện, điểm 5.1 tối đa 2/5. Giải thích rõ lý do.

Trả về JSON array (không có text nào ngoài JSON):
[
  {"key":"1.1","score":<số>,"maxScore":10,"feedback":"<≥3 lỗi + ≥3 gợi ý + trích dẫn>"},
  ...
]
```

### Biến động

| Biến | Giá trị | Ghi chú |
|------|---------|---------|
| `{projectTitle}` | Tên dự án (decrypted) | |
| `{chapterCount}` | Số chương của project | Lấy từ DB, dùng để tính completeness |
| `{totalWords}` | Tổng số từ tất cả chương | |
| `{completenessNote}` | Mô tả mức độ hoàn thiện | Từ `BuildCompletenessNote()` |
| `{chunk_1..N}` | Tối đa 20 chunks đầu của project | Chỉ từ active version của mỗi chương |

### BuildCompletenessNote() mapping

| Điều kiện | Mô tả trả về |
|-----------|-------------|
| < 3 chương hoặc < 1000 từ | "Tác phẩm mới bắt đầu, rất ít nội dung" |
| < 10 chương hoặc < 5000 từ | "Bản thảo sơ khai, chưa đủ để đánh giá toàn diện" |
| < 30 chương hoặc < 20000 từ | "Bản thảo khá đầy đủ" |
| ≥ 30 chương và ≥ 20000 từ | "Tác phẩm dài và hoàn thiện" |

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
| 5.1 | Tuân thủ & Hoàn thiện | **Mức độ hoàn thiện bản thảo** | 5 |
| 5.2 | Tuân thủ & Hoàn thiện | Tuân thủ định dạng | 5 |

> **5.1 tự động bị phạt** nếu tác phẩm chưa hoàn thiện (< 5 chương hoặc < 3000 từ) → max 2/5.

### Output JSON mong đợi

```json
[
  {
    "key": "1.1",
    "score": 6.5,
    "maxScore": 10,
    "feedback": "Lỗi 1: Nhân vật A ở chương 1 nói X nhưng chương 3 lại làm Y... Lỗi 2:... Lỗi 3:... Gợi ý 1:... Gợi ý 2:... Gợi ý 3:..."
  },
  ...
]
```

### Xử lý sau khi nhận response

1. Strip markdown code fence nếu LLM trả về (` ```json ... ``` `)
2. `JsonSerializer.Deserialize<List<AiScoreItem>>(raw)`
3. `Math.Clamp(score, 0, maxScore)` — chặn score không vượt ngưỡng
4. Nếu LLM fail → fallback sang `GenerateMockCriteria()` (random 50–85% mỗi tiêu chí)
5. `sub.UsedAnalysisCount += 1` — trừ lượt phân tích

---

## 🤖 Thông tin Model & Cấu hình

| Tham số | Giá trị mặc định | Config key |
|---------|-----------------|-----------|
| Primary Chat model | `gemini-2.0-flash` | `Gemini:ChatModel` |
| Primary Embedding model | `gemini-embedding-001` | `Gemini:EmbeddingModel` |
| Embedding dimensions | `768` | `Gemini:EmbeddingDimensions` |
| Fallback Base URL | `http://localhost:1234/v1` | `AI:BaseUrl` |
| Fallback Chat model | tùy chọn | `AI:ChatModel` |
| Max tokens (analysis) | `4000` | hardcoded trong `EvaluateWithAiAsync` |

> Thay đổi model trong `appsettings.Development.json` — không cần sửa code.

---

## 🔄 Vòng đời Prompt trong RAG

```
[Nội dung truyện]
    │
    ▼ ChunkingService (1500 ký tự, overlap 150)
[Chunks]
    │
    ▼ EmbeddingService → gemini-embedding-001
[Vectors] ─── lưu vào pgvector (VersionId = active version)
    │
    ▼ (khi có câu hỏi → chỉ tìm trong active versions)
Vector Search (cosine distance)
    │
    ▼ Decrypt bằng DEK
[Context text]
    │
    ▼ BuildSystemPrompt / EvaluatePrompt
[LLM Call] → Gemini 2.0 flash
    │
    ▼
[Answer / JSON Score]
```
