namespace Service.Interfaces
{
    /// <summary>
    /// Hàng đợi lưu trữ và phân phối các job phân tích AI bất đồng bộ theo cơ chế ưu tiên (Priority Queue).
    /// </summary>
    public interface IAnalysisJobQueue
    {
        /// <summary>
        /// Đưa một job phân tích mới vào hàng đợi với độ ưu tiên được chỉ định (độ ưu tiên cao hơn sẽ được xử lý trước).
        /// </summary>
        ValueTask EnqueueAsync(Guid jobId, int priority = 0, CancellationToken cancellationToken = default);

        /// <summary>
        /// Lấy (dequeue) một job phân tích ra khỏi hàng đợi để tiến hành xử lý (chặn luồng đợi nếu hàng đợi trống).
        /// </summary>
        ValueTask<Guid> DequeueAsync(CancellationToken cancellationToken);
    }
}
