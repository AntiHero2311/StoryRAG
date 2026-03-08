# 🚀 Hướng dẫn Cài đặt & Cấu hình AI Model (LM Studio) cho StoryRAG

StoryRAG sử dụng công nghệ Local LLM thông qua ứng dụng **LM Studio** để xử lý 2 tác vụ chính:
1. **Embedding**: Chuyển đổi văn bản câu chuyện thành Vector để lưu vào Database.
2. **Chat/Scoring (LLM)**: Phân tích, trò chuyện và chấm điểm bản thảo nội dung dựa trên vector ngữ cảnh.

Bài viết này sẽ hướng dẫn bạn chi tiết từng bước để tải và khởi chạy môi trường AI hoàn toàn offline trên máy tính của bạn thông qua LM Studio.

---

## 🛠️ Bước 1: Tải và Cài đặt LM Studio

1. Truy cập trang chủ [LM Studio](https://lmstudio.ai/).
2. Nhấn nút **Download** cho hệ điều hành của bạn (Windows/macOS/Linux).
3. Chạy file cài đặt và hoàn tất quá trình thiết lập.

---

## 📥 Bước 2: Tải các AI Model cần thiết

Mở ứng dụng LM Studio, chọn tab **Search (biểu tượng kính lúp)** ở thanh bên trái. Bạn cần tìm và tải 2 model sau:

### 1. Model Embedding (Dùng để mã hóa văn bản thành Vector)
Gõ vào ô tìm kiếm: `nomic-embed-text`
- Khuyên dùng: Chọn bản `nomic-embed-text-v1.5` do `nomic-ai` phát hành, định dạng **GGUF**.
- Bấm **Download** (Dung lượng rất nhẹ, ~200MB - 300MB).

> ⚠️ **Lưu ý quan trọng về tên model:** Trong LM Studio, sau khi load model lên Server, hãy kiểm tra cột `id` trong mục **Available Models**. Tên thực tế thường là `text-embedding-nomic-embed-text-v1.5` (không phải `nomic-embed-text`). Copy chính xác tên `id` đó vào `appsettings.Development.json` ở trường `EmbeddingModel`.

### 2. Model Chat / Reasoning (Dùng để trả lời câu chuyện, chấm điểm)
Gõ vào ô tìm kiếm: `qwen3.5-9b` (hoặc `qwen/qwen3.5-9b`)
- Khuyên dùng: Chọn model của `bartowski` hoặc phiên bản đuôi **Q4_K_M** (để cân bằng hiệu năng và tốc độ).
- Bấm **Download** (Dung lượng: ~6.55GB).

*(Ghi chú: Đây là model nhẹ nhất, phù hợp để test nhanh. Để AI mạnh hơn, xem **Bước 6: Model mạnh hơn** ở cuối tài liệu này.)*

---

## ⚙️ Bước 3: Cấu hình Local Server

Sau khi tải xong cả 2 Model, chúng ta cần bật API Server để Backend C# có thể giao tiếp với LM Studio.

1. Bấm vào icon **Developer (biểu tượng `< >`)** hoặc **Local Server** trên thanh bên trái của LM Studio.
2. Ở phần **Model Loading**, bạn sẽ thấy một dropdown để chọn Model:
   - Trong dropdown, chọn Model Chat: `qwen/qwen3.5-9b...`
   - Đợi LM Studio tải Model vào RAM/VRAM máy tính.
3. Ở khung **Server Options** bên phải màn hình:
   - **Cổng Server (Port)**: Chắc chắn là `1234`.
   - Bật tính năng **CORS** (Tick vào mục Allow CORS).
   - **Context Length**: Đặt giá trị `Context Length` ≥ **8192** tokens. Tính năng Phân tích AI (Scoring) gửi tới ~20 đoạn nội dung (~10,000 tokens) lên server — nếu context quá nhỏ sẽ bị cắt và kết quả sai.
   - **Tích chọn "Load Embedding Model"** nếu có nút này, và trỏ nó vào `nomic-embed-text-v1.5`. (Một số phiên bản LM Studio yêu cầu tải đồng thời cả model chat và model embed lên server; nếu bạn đang dùng LM Studio phiên bản mới, ngay trong tab Developer Server, bạn có thể chọn "Multiple Models" để load cả 2).
4. Nhấn nút xanh **"Start Server"**.

Nếu bạn thấy terminal (chữ trắng màn đen) bên dưới bắt đầu hiện ra các dòng như:
```sh
[LM STUDIO SERVER] Started on http://localhost:1234
[LM STUDIO SERVER] Loaded multi-models...
```
Thì có nghĩa là API AI của bạn đang chạy! 🎉

---

## 🔗 Bước 4: Đồng bộ Cấu hình với Backend (StoryRAG)

Khi Local Server đã chạy trơn tru, hãy mở source code Backend StoryRAG.

1. Tìm đến file `Backend/Api/appsettings.Development.json` (hoặc `appsettings.json`).
2. Sửa hoặc đối chiếu lại block `AI`:

```json
  "AI": {
    "BaseUrl": "http://localhost:1234/v1",
    "ApiKey": "lm-studio",
    "EmbeddingModel": "text-embedding-nomic-embed-text-v1.5",
    "ChatModel": "qwen/qwen3.5-9b"
  }
```

> **Lưu ý Quan trọng:** 
> Tên của model trong file `appsettings.json` phải trùng khớp với **Alias Name (Tên định danh API)** đang hiển thị trên LM Studio.
> Trong tab thẻ Server của LM Studio, cuộn xuống phần `Available Models`, nhìn vào cột `id` – hãy copy/paste chính xác cái `id` đó. Tên thực tế thường là `text-embedding-nomic-embed-text-v1.5` (không phải `nomic-embed-text`).

---

## 🎯 Bước 5: Kiểm tra tính năng

1. **Test tính năng Chunking & Embedding**: Mở dự án trên StoryRAG Workspace, gõ thử vài dòng vào mục lục. Chờ tính năng **Lưu tự động** (Auto-save) chạy. Nếu thành công, Backend sẽ gọi API Embed của LM Studio, và trên terminal của LM Studio sẽ có log báo call API (`POST /v1/embeddings... 200 OK`).
2. **Test RAG (Chat Assistant)**: Tại góc phải màn hình Workspace ở mục *Trợ lý AI*, bấm hỏi một câu (Ví dụ: *"Bạn biết gì về anh thợ săn trong truyện này?"*). Nếu terminal LM studio nhận được Request `POST /v1/chat/completions`, bạn đã setup RAG hoàn chỉnh.
3. **Test AI Scoring**: Ra ngoài trang tính năng **Phân Tích (Analysis)**, ấn phân tích truyện. LLM sẽ trả về bảng rubric tự động.

---

## ⚠️ Khắc phục sự cố thường gặp (Troubleshooting)

- **Lỗi Timeout hoặc Backend báo lỗi 500 khi gọi AI**:
  - Tắt ứng dụng ứng dụng LM Studio và bật cấu hình chạy bằng **Run as Administrator**.
  - Đảm bảo Local Server đã Start.
- **Laptop gặp tình trạng quá tản nhiệt (Nóng/Quạt hú)**:
  - Ở mục tải Model, tích chọn **GPU Offload (Max)** nếu máy bạn có card rời (NVIDIA/AMD) khi Load Model. RAM card đồ họa (VRAM) xử lý AI sẽ mát và mượt hơn CPU rất nhiều.
- **Model trả lời sai ngôn ngữ tiếng Việt**: 
  - File Model có thể chưa tối ưu. StoryRAG đã tối ưu *System Prompt*, nhưng nếu model cứng đầu thì có thể tải các dạng Qwen (Qwen 1.5/2.5) hoặc VinaLlama để thay thế Llama 3.2. Đừng quên đổi `ChatModel` config bên Backend nếu bạn thay loại AI.

---

## 🚀 Bước 6: Nâng cấp Model AI mạnh hơn

Mặc định StoryRAG dùng `qwen/qwen3.5-9b` (9 tỷ tham số, ~6.55GB) — benchmark cao, hỗ trợ tiếng Việt tốt, Vision + Reasoning + Tool Use, context 262k. Dưới đây là các model đã được kiểm tra, sắp xếp theo chất lượng.

### So sánh các Chat Model (đã kiểm tra)

| Model | Size | GPU offload | Tốc độ | Ctx | Ghi chú |
|-------|------|-------------|--------|-----|---------|
| `llama-3.2-3b-instruct` | ~2 GB | ✅ Full GPU | ~100 tok/s | 8k | Default — dùng để test |
| `Qwen/Qwen2.5-1.5B-Instruct` | ~1 GB | ✅ Full GPU | 125 tok/s | 32k | Nhẹ, nhanh, tiếng Việt ổn |
| `Qwen/Qwen2.5-3B-Instruct` | ~2 GB | ✅ Full GPU | 74.5 tok/s | 32k | Chất lượng tốt, dùng nhiều VRAM |
| **`qwen/qwen3.5-9b`** ⭐ | **6.55 GB** | **⚡ Partial (53%)** | **~15-25 tok/s** | **262k** | **Khuyến nghị** — benchmark tốt nhất, Vision+Reasoning, hybrid GPU+RAM |
| `qwen/qwen3-30b-a3b-2507` | 15.90 GB | ⚠️ Partial (25%) | ~5-10 tok/s | 262k | Chất lượng cao nhất nhưng chậm — mostly CPU |

> **Khuyến nghị:** Dùng **`qwen/qwen3.5-9b`** (6.55 GB) — với GTX 1650 4GB VRAM, model này offload được ~53% lên GPU, còn lại chạy RAM. Benchmark vượt trội: MMLU-Pro 82.5, GPQA Diamond 81.7, hỗ trợ **Vision + Reasoning + Tool Use**, context **262k tokens**. Nhanh gấp 2-3x so với Qwen3-30B-A3B trên phần cứng này.

> ⚠️ **Tránh các model 7B Qwen2.5** — `Qwen2.5-7B` và `Qwen2.5-Math-7B` đều chiếm tới **89% bộ nhớ** (Marginal), dễ gây crash khi chạy song song với các tác vụ khác.

### So sánh các Embedding Model

| Model | Chiều vector | Chất lượng | Dung lượng |
|-------|-------------|------------|------------|
| `nomic-embed-text-v1.5` | 768 | Tốt | ~270MB |
| `mxbai-embed-large-v1` | 1024 | **Cao hơn** | ~670MB |

> **Lưu ý:** Nếu đổi embedding model, bạn phải **embed lại toàn bộ nội dung** đã có trong database vì chiều vector thay đổi. Đồng thời cập nhật `vector(768)` → `vector(1024)` trong migration nếu dùng `mxbai-embed-large-v1`.

### Cách đổi model

1. Tải model mới trong LM Studio (tab Search).
2. Load model mới lên Server (tab Developer).
3. Copy chính xác tên `id` từ cột **Available Models**.
4. Cập nhật `appsettings.Development.json`:

```json
"AI": {
  "ChatModel": "qwen/qwen3.5-9b",
  "EmbeddingModel": "text-embedding-nomic-embed-text-v1.5"
}
```

5. Khởi động lại Backend (`dotnet run --project Api`). Không cần sửa code.
