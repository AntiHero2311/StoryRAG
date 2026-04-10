using Service.DTOs;

namespace Service.Interfaces
{
    public interface IAuthService
    {
        Task<AuthResponse> RegisterAsync(RegisterRequest request);
        Task<AuthResponse> LoginAsync(LoginRequest request);
        Task<AuthResponse> LoginWithGoogleAsync(GoogleLoginRequest request);
        Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordRequest request);
        Task ForgotPasswordAsync(ForgotPasswordRequest request);
        Task ResetPasswordAsync(ResetPasswordRequest request);
    }
}
