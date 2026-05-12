using Service.Interfaces;
using System.Collections.Concurrent;

namespace Service.Implementations
{
    public class AnalysisJobCancellationRegistry : IAnalysisJobCancellationRegistry
    {
        private readonly ConcurrentDictionary<Guid, CancellationTokenSource> _sources = new();

        public CancellationToken Register(Guid jobId, CancellationToken parentToken)
        {
            var linkedSource = CancellationTokenSource.CreateLinkedTokenSource(parentToken);

            if (_sources.TryRemove(jobId, out var existing))
            {
                existing.Cancel();
                existing.Dispose();
            }

            _sources[jobId] = linkedSource;
            return linkedSource.Token;
        }

        public bool RequestCancellation(Guid jobId)
        {
            if (!_sources.TryGetValue(jobId, out var source))
                return false;

            source.Cancel();
            return true;
        }

        public void Unregister(Guid jobId)
        {
            if (_sources.TryRemove(jobId, out var source))
                source.Dispose();
        }
    }
}
