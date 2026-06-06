using Service.Interfaces;

namespace Service.Implementations
{
    /// <summary>
    /// Hàng đợi lưu trữ và phân phối các job phân tích AI bất đồng bộ theo cơ chế ưu tiên.
    /// </summary>
    public class AnalysisJobQueue : IAnalysisJobQueue
    {
        private readonly object _sync = new();
        private readonly PriorityQueue<Guid, int> _queue = new();
        private readonly HashSet<Guid> _queuedJobIds = [];
        private readonly SemaphoreSlim _signal = new(0);

        /// <summary>
        /// Đưa một job phân tích mới vào hàng đợi với độ ưu tiên được chỉ định (độ ưu tiên cao hơn sẽ được xử lý trước).
        /// </summary>
        public ValueTask EnqueueAsync(Guid jobId, int priority = 0, CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var added = false;
            lock (_sync)
            {
                if (_queuedJobIds.Add(jobId))
                {
                    // PriorityQueue lấy số nhỏ nhất trước, nên đảo dấu để ưu tiên giá trị lớn hơn.
                    _queue.Enqueue(jobId, -priority);
                    added = true;
                }
            }

            if (added)
                _signal.Release();

            return ValueTask.CompletedTask;
        }

        /// <summary>
        /// Lấy (dequeue) một job phân tích ra khỏi hàng đợi để tiến hành xử lý (chặn luồng đợi nếu hàng đợi trống).
        /// </summary>
        public async ValueTask<Guid> DequeueAsync(CancellationToken cancellationToken)
        {
            while (true)
            {
                await _signal.WaitAsync(cancellationToken);

                lock (_sync)
                {
                    if (_queue.TryDequeue(out var jobId, out _))
                    {
                        _queuedJobIds.Remove(jobId);
                        return jobId;
                    }
                }
            }
        }
    }
}
