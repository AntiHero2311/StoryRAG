namespace Service.Interfaces
{
    public interface IAnalysisJobQueue
    {
        ValueTask EnqueueAsync(Guid jobId, int priority = 0, CancellationToken cancellationToken = default);
        ValueTask<Guid> DequeueAsync(CancellationToken cancellationToken);
    }
}
