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

### Rubric 20 tiêu chí — 8 nhóm (100 điểm)

| Key | Nhóm | Tiêu chí | Max | Giải thích |
|-----|------|----------|-----|-----------|
| 1.1 | 🎯 Kỳ vọng | Thể loại | 5 | Tác phẩm có đáp ứng quy ước thể loại (romance, suspense, fantasy...) không? |
| 1.2 | 🎯 Kỳ vọng | Tiền đề | 5 | Tiền đề câu chuyện có hấp dẫn, rõ ràng và được khai thác tốt không? |
| 2.1 | 👤 Nhân vật | Phát triển nhân vật | 5 | Chất lượng backstory, động cơ, sự trưởng thành qua câu chuyện |
| 2.2 | 👤 Nhân vật | Tính cách & Sự hấp dẫn | 5 | Nhân vật có sức hút, thực tế, dễ đồng cảm? |
| 2.3 | 👤 Nhân vật | Mối quan hệ & Tương tác | 5 | Chemistry đối thoại, chất lượng tương tác giữa nhân vật |
| 2.4 | 👤 Nhân vật | Sự đa dạng nhân vật | 5 | Đa dạng nhân vật phụ, nhân vật đối lập; tránh nhân vật một chiều |
| 3.1 | 📖 Cốt truyện & Cấu trúc | Diễn biến cốt truyện | 5 | Nhịp độ, xung đột, plot twist, cách giải quyết vấn đề |
| 3.2 | 📖 Cốt truyện & Cấu trúc | Cấu trúc & Tổ chức | 5 | Mạch lạc, logic rising action / climax / falling action |
| 3.3 | 📖 Cốt truyện & Cấu trúc | Kết thúc | 5 | Kết thúc có thỏa mãn, có tiềm năng, phù hợp câu chuyện? |
| 4.1 | ✍️ Ngôn ngữ & Văn phong | Phong cách & Giọng văn | 5 | Tone, style, bầu không khí tác phẩm |
| 4.2 | ✍️ Ngôn ngữ & Văn phong | Ngữ pháp & Sự trôi chảy | 5 | Ngữ pháp, chính tả, sự mượt mà trong cách viết |
| 4.3 | ✍️ Ngôn ngữ & Văn phong | Tính dễ đọc | 5 | Câu văn rõ ràng, dễ theo dõi; tránh mơ hồ, rối rắm |
| 5.1 | 🌟 Sự hấp dẫn | Mức độ thú vị | 5 | Tổng thể thú vị? Tạo kỳ vọng cho phần tiếp theo? |
| 5.2 | 🌟 Sự hấp dẫn | Mức độ cuốn hút | 5 | Người đọc có muốn đọc tiếp? Tương tác qua quá trình đọc |
| 6.1 | 💔 Tác động cảm xúc | Sự đồng cảm | 5 | Khả năng gợi lên kết nối cảm xúc với người đọc |
| 6.2 | 💔 Tác động cảm xúc | Chiều sâu cảm xúc | 5 | Chiều sâu cảm xúc — có chạm đến cảm xúc sâu xa? |
| 7.1 | 💡 Chủ đề | Khám phá chủ đề | 5 | Chủ đề trình bày rõ ràng, khám phá sâu sắc? |
| 7.2 | 💡 Chủ đề | Chiều sâu chủ đề | 5 | Giá trị giáo dục, bình luận xã hội, triết lý sống |
| 8.1 | 🌍 Xây dựng thế giới | Xây dựng thế giới | 5 | Tính chân thực, phong phú của thế giới được xây dựng |
| 8.2 | 🌍 Xây dựng thế giới | Bối cảnh | 5 | Độ chính xác lịch sử, văn hóa, chi tiết kỹ thuật |

> **Phân bổ:** Kỳ vọng 10đ, Nhân vật 20đ, Cốt truyện 15đ, Ngôn ngữ 15đ, Hấp dẫn 10đ, Cảm xúc 10đ, Chủ đề 10đ, Thế giới 10đ → **Tổng 100đ**

### Output JSON mong đợi

```json
[
  {
    "key": "1.1",
    "score": 3.5,
    "maxScore": 5,
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
| Chat models fallback | `gemma-4-31b,gemma-4-26b` | `Gemini:ChatModels` |
| Primary Embedding model | `gemini-embedding-001` | `Gemini:EmbeddingModel` |
| Embedding dimensions | `768` | `Gemini:EmbeddingDimensions` |
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
