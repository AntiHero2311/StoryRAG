namespace Service.Interfaces
{
    public interface IExportService
    {
        Task<byte[]> ExportChapterAsync(Guid projectId, Guid chapterId, Guid userId, string format);
        Task<byte[]> ExportProjectAsync(Guid projectId, Guid userId, string format);
        string GetContentType(string format);
        string GetFileExtension(string format);
    }
}
