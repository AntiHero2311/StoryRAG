namespace Service.Interfaces
{
    public interface IReportExportService
    {
        Task<byte[]> ExportReportPdfAsync(Guid projectId, Guid reportId, Guid userId);
    }
}
