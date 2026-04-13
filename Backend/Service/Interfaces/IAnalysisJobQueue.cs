namespace Service.Interfaces
{
    public interface IAnalysisJobQueue
    {
        ValueTask EnqueueAsync(Guid jobId, CancellationToken cancellationToken = default);
        ValueTask<Guid> DequeueAsync(CancellationToken cancellationToken);
    }
}
