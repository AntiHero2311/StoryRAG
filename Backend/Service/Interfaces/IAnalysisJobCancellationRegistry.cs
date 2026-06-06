namespace Service.Interfaces
{
    /// <summary>
    /// Bộ đăng ký và quản lý việc hủy bỏ (cancellation) các job phân tích AI đang thực thi bất đồng bộ.
    /// Giúp theo dõi và gửi tín hiệu hủy thông qua CancellationToken.
    /// </summary>
    public interface IAnalysisJobCancellationRegistry
    {
        /// <summary>
        /// Đăng ký một CancellationToken cho job phân tích đang chạy, liên kết với token cha.
        /// </summary>
        CancellationToken Register(Guid jobId, CancellationToken parentToken);

        /// <summary>
        /// Yêu cầu hủy bỏ một job phân tích cụ thể bằng cách kích hoạt CancellationToken tương ứng.
        /// </summary>
        /// <returns>True nếu yêu cầu hủy thành công, ngược lại False.</returns>
        bool RequestCancellation(Guid jobId);

        /// <summary>
        /// Hủy đăng ký và giải phóng tài nguyên của job sau khi hoàn tất hoặc bị hủy.
        /// </summary>
        void Unregister(Guid jobId);
    }
}
