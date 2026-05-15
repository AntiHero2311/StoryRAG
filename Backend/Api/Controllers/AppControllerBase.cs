using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Api.Controllers
{
    /// <summary>
    /// Base controller cung cấp các helper dùng chung cho mọi controller cần xác thực:
    /// GetUserId(), GetRequiredUserId().
    /// </summary>
    public abstract class AppControllerBase : ControllerBase
    {
        /// <summary>
        /// Trả về userId từ JWT claim, hoặc null nếu token không hợp lệ / chưa đăng nhập.
        /// Kiểm tra cả claim "nameidentifier" và "sub" để tương thích nhiều identity provider.
        /// </summary>
        protected Guid? GetUserId()
        {
            var value = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst("sub")?.Value;
            return Guid.TryParse(value, out var id) ? id : null;
        }

        /// <summary>
        /// Trả về userId, throw UnauthorizedAccessException nếu không có.
        /// Dùng cho các endpoint bắt buộc phải có token hợp lệ (kết hợp với try/catch Unauthorized).
        /// </summary>
        protected Guid GetRequiredUserId()
        {
            return GetUserId() ?? throw new UnauthorizedAccessException("Không xác định được người dùng.");
        }
    }
}
