using Service.DTOs;

namespace Service.Interfaces
{
    public interface IProjectImportService
    {
        /// <summary>
        /// Nhận file bản thảo (.txt, .docx, .pdf), tạo Project mới, chia chương,
        /// và lưu nội dung vào hệ thống (không chạy AI phân tích tự động trong bước import).
        /// </summary>
        Task<ProjectImportResult> ImportFromManuscriptAsync(
            Guid userId,
            string fileName,
            string? contentType,
            byte[] fileBytes);

        /// <summary>
        /// Thử lại bước AI trích xuất (Summary/Nhân vật/Bối cảnh/Timeline) cho project đã import.
        /// Chỉ bổ sung các trường còn trống — không xóa dữ liệu người dùng đã chỉnh sửa.
        /// </summary>
        Task<ReExtractResult> ReExtractAsync(Guid projectId, Guid userId);
    }
}
