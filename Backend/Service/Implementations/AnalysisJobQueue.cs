using Service.Interfaces;
using System.Threading.Channels;

namespace Service.Implementations
{
    public class AnalysisJobQueue : IAnalysisJobQueue
    {
        private readonly Channel<Guid> _queue = Channel.CreateUnbounded<Guid>(new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
            AllowSynchronousContinuations = false,
        });

        public ValueTask EnqueueAsync(Guid jobId, CancellationToken cancellationToken = default)
            => _queue.Writer.WriteAsync(jobId, cancellationToken);

        public ValueTask<Guid> DequeueAsync(CancellationToken cancellationToken)
            => _queue.Reader.ReadAsync(cancellationToken);
    }
}
