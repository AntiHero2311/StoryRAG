using Service.Interfaces;
using System.Collections.Concurrent;

namespace Service.Implementations
{
    /// <summary>
    /// Bộ đăng ký và quản lý việc hủy bỏ các job phân tích AI đang thực thi bất đồng bộ thông qua CancellationToken.
    /// </summary>
    public class AnalysisJobCancellationRegistry : IAnalysisJobCancellationRegistry
    {
        private readonly ConcurrentDictionary<Guid, CancellationTokenSource> _sources = new();

        /// <summary>
        /// Đăng ký một CancellationToken cho job phân tích đang chạy, liên kết với token cha.
        /// </summary>
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

        /// <summary>
        /// Yêu cầu hủy bỏ một job phân tích cụ thể bằng cách kích hoạt CancellationToken tương ứng.
        /// </summary>
        /// <returns>True nếu yêu cầu hủy thành công, ngược lại False.</returns>
        public bool RequestCancellation(Guid jobId)
        {
            if (!_sources.TryGetValue(jobId, out var source))
                return false;

            source.Cancel();
            return true;
        }

        /// <summary>
        /// Hủy đăng ký và giải phóng tài nguyên của job sau khi hoàn tất hoặc bị hủy.
        /// </summary>
        public void Unregister(Guid jobId)
        {
            if (_sources.TryRemove(jobId, out var source))
                source.Dispose();
        }
    }
}
