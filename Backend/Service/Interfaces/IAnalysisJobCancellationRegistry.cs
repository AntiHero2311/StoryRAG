namespace Service.Interfaces
{
    public interface IAnalysisJobCancellationRegistry
    {
        CancellationToken Register(Guid jobId, CancellationToken parentToken);
        bool RequestCancellation(Guid jobId);
        void Unregister(Guid jobId);
    }
}
