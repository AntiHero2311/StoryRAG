using Service.DTOs;

namespace Service.Interfaces
{
    /// <summary>
    /// Dịch vụ xác thực và quản lý tài khoản người dùng (Đăng ký, Đăng nhập, Quên mật khẩu, Refresh Token, Đăng nhập Google).
    /// </summary>
    public interface IAuthService
    {
        /// <summary>
        /// Đăng ký tài khoản người dùng mới.
        /// </summary>
        Task<AuthResponse> RegisterAsync(RegisterRequest request);

        /// <summary>
        /// Gửi OTP đăng ký tài khoản qua email để xác thực.
        /// </summary>
        Task SendRegisterOtpAsync(SendOtpRequest request);

        /// <summary>
        /// Đăng nhập bằng tài khoản email và mật khẩu thông thường.
        /// </summary>
        Task<AuthResponse> LoginAsync(LoginRequest request);

        /// <summary>
        /// Đăng nhập hoặc tự động đăng ký bằng tài khoản Google (OAuth2).
        /// </summary>
        Task<AuthResponse> LoginWithGoogleAsync(GoogleLoginRequest request);

        /// <summary>
        /// Làm mới JWT Access Token bằng Refresh Token để duy trì trạng thái đăng nhập.
        /// </summary>
        Task<AuthResponse> RefreshTokenAsync(RefreshTokenRequest request);

        /// <summary>
        /// Thay đổi mật khẩu tài khoản của người dùng hiện tại.
        /// </summary>
        Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordRequest request);

        /// <summary>
        /// Yêu cầu gửi email chứa mã thông báo (token) để đặt lại mật khẩu khi bị quên.
        /// </summary>
        Task ForgotPasswordAsync(ForgotPasswordRequest request);

        /// <summary>
        /// Đặt lại mật khẩu mới sử dụng token xác thực được gửi qua email.
        /// </summary>
        Task ResetPasswordAsync(ResetPasswordRequest request);
    }
}
