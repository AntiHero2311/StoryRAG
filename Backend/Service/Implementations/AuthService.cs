using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;

namespace Service.Implementations
{
    public class AuthService : IAuthService
    {
        private const int LegacyPasswordFormatVersion = 1;
        private const int Pbkdf2PasswordFormatVersion = 2;
        private const int Pbkdf2Iterations = 120_000;
        private const int Pbkdf2SaltSize = 16;
        private const int Pbkdf2KeySize = 64;

        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IEmailService _emailService;

        public AuthService(AppDbContext context, IConfiguration config, IEmailService emailService)
        {
            _context = context;
            _config = config;
            _emailService = emailService;
        }

        public async Task SendRegisterOtpAsync(SendOtpRequest request)
        {
            var email = request.Email.Trim().ToLower();
            if (!System.Text.RegularExpressions.Regex.IsMatch(email, @"^[a-zA-Z0-9._%+-]+@gmail\.com$"))
            {
                throw new Exception("Chỉ chấp nhận đăng ký bằng tài khoản Gmail (@gmail.com).");
            }

            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (existingUser != null)
            {
                if (existingUser.IsActive)
                {
                    throw new Exception("Email đã được sử dụng.");
                }
                if (!string.IsNullOrEmpty(existingUser.PasswordHash))
                {
                    throw new Exception("Tài khoản của bạn đã bị vô hiệu hóa hoặc khóa. Vui lòng liên hệ quản trị viên.");
                }
            }

            var otp = Random.Shared.Next(100000, 999999).ToString();
            var expiry = DateTime.UtcNow.AddMinutes(10);

            if (existingUser == null)
            {
                existingUser = new User
                {
                    FullName = "Người dùng",
                    Email = email,
                    PasswordHash = string.Empty,
                    PasswordSalt = string.Empty,
                    IsActive = false,
                    Role = "Author",
                    EmailVerificationOtp = otp,
                    EmailVerificationOtpExpiry = expiry,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Users.Add(existingUser);
            }
            else
            {
                existingUser.EmailVerificationOtp = otp;
                existingUser.EmailVerificationOtpExpiry = expiry;
                _context.Users.Update(existingUser);
            }

            await _context.SaveChangesAsync();

            // Gửi mail OTP (fire-and-forget)
            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendOtpEmailAsync(existingUser.Email, existingUser.FullName, otp);
                }
                catch
                {
                    // Log error or ignore
                }
            });
        }

        public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
        {
            var email = request.Email.Trim().ToLower();
            if (!System.Text.RegularExpressions.Regex.IsMatch(email, @"^[a-zA-Z0-9._%+-]+@gmail\.com$"))
            {
                throw new Exception("Chỉ chấp nhận đăng ký bằng tài khoản Gmail (@gmail.com).");
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null || user.IsActive || !string.IsNullOrEmpty(user.PasswordHash))
            {
                throw new Exception("Yêu cầu đăng ký không hợp lệ hoặc đã bị khóa.");
            }

            if (user.EmailVerificationOtp != request.Otp || user.EmailVerificationOtpExpiry < DateTime.UtcNow)
            {
                throw new Exception("Mã OTP không chính xác hoặc đã hết hạn.");
            }

            CreatePasswordHash(request.Password, out string passwordHash, out string passwordSalt);

            // Generate raw DEK for the user, then encrypt it with system MasterKey
            if (string.IsNullOrEmpty(user.DataEncryptionKey))
            {
                string rawDek = EncryptionHelper.GenerateDataEncryptionKey();
                string masterKey = _config["Security:MasterKey"] ?? throw new Exception("MasterKey not found in config");
                string encryptedDek = EncryptionHelper.EncryptWithMasterKey(rawDek, masterKey);
                user.DataEncryptionKey = encryptedDek;
            }

            user.FullName = request.FullName.Trim();
            user.PasswordHash = passwordHash;
            user.PasswordSalt = passwordSalt;
            user.PasswordFormatVersion = Pbkdf2PasswordFormatVersion;
            user.IsActive = true;
            user.EmailVerificationOtp = null;
            user.EmailVerificationOtpExpiry = null;

            var refreshToken = GenerateRefreshToken();
            user.Role = "Author"; // Force role to Author
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7); // 7 days expiry

            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            // Cấp gói Free mặc định cho user mới
            await CreateFreeSubscriptionAsync(user.Id);

            // Gửi email chào mừng (fire-and-forget, không ảnh hưởng response)
            _ = Task.Run(async () =>
            {
                try { await _emailService.SendWelcomeEmailAsync(user.Email, user.FullName); }
                catch { /* Lỗi gửi mail không làm fail đăng ký */ }
            });

            return new AuthResponse
            {
                UserId = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                AccessToken = GenerateJwtToken(user),
                RefreshToken = user.RefreshToken
            };
        }

        public async Task<AuthResponse> LoginAsync(LoginRequest request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            
            if (user == null || !VerifyPasswordHash(request.Password, user, out var shouldRehash))
            {
                throw new Exception("Email hoặc mật khẩu không chính xác.");
            }

            if (user.IsBanned)
            {
                throw new Exception("Tài khoản của bạn đã bị khóa do vi phạm tiêu chuẩn cộng đồng.");
            }

            if (!user.IsActive)
            {
                throw new Exception("User is inactive.");
            }

            var refreshToken = GenerateRefreshToken();
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
            if (shouldRehash)
            {
                CreatePasswordHash(request.Password, out var upgradedHash, out var upgradedSalt);
                user.PasswordHash = upgradedHash;
                user.PasswordSalt = upgradedSalt;
                user.PasswordFormatVersion = Pbkdf2PasswordFormatVersion;
            }

            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            return new AuthResponse
            {
                UserId = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                AccessToken = GenerateJwtToken(user),
                RefreshToken = user.RefreshToken
            };
        }

        public async Task<AuthResponse> LoginWithGoogleAsync(GoogleLoginRequest request)
        {
            var googleClientId = _config["GoogleAuth:ClientId"];
            if (string.IsNullOrWhiteSpace(googleClientId))
            {
                throw new Exception("Google login chưa được cấu hình.");
            }

            GoogleJsonWebSignature.Payload payload;
            try
            {
                payload = await GoogleJsonWebSignature.ValidateAsync(
                    request.IdToken,
                    new GoogleJsonWebSignature.ValidationSettings
                    {
                        Audience = new[] { googleClientId }
                    });
            }
            catch (InvalidJwtException)
            {
                throw new Exception("Google token không hợp lệ.");
            }

            if (string.IsNullOrWhiteSpace(payload.Email) || payload.EmailVerified != true)
            {
                throw new Exception("Email Google chưa được xác thực.");
            }

            var normalizedEmail = payload.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);
            var isNewUser = false;

            if (user == null)
            {
                var generatedPassword = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
                CreatePasswordHash(generatedPassword, out string passwordHash, out string passwordSalt);

                // Generate raw DEK for the user, then encrypt it with system MasterKey
                string rawDek = EncryptionHelper.GenerateDataEncryptionKey();
                string masterKey = _config["Security:MasterKey"] ?? throw new Exception("MasterKey not found in config");
                string encryptedDek = EncryptionHelper.EncryptWithMasterKey(rawDek, masterKey);

                user = new User
                {
                    FullName = string.IsNullOrWhiteSpace(payload.Name) ? normalizedEmail.Split('@')[0] : payload.Name.Trim(),
                    Email = normalizedEmail,
                    PasswordHash = passwordHash,
                    PasswordSalt = passwordSalt,
                    PasswordFormatVersion = Pbkdf2PasswordFormatVersion,
                    AvatarURL = payload.Picture,
                    Role = "Author",
                    DataEncryptionKey = encryptedDek,
                    IsActive = true
                };

                _context.Users.Add(user);
                isNewUser = true;
            }

            if (user.IsBanned)
            {
                throw new Exception("Tài khoản của bạn đã bị khóa do vi phạm tiêu chuẩn cộng đồng.");
            }

            if (!user.IsActive)
            {
                throw new Exception("User is inactive.");
            }

            if (!string.IsNullOrWhiteSpace(payload.Picture) && string.IsNullOrWhiteSpace(user.AvatarURL))
            {
                user.AvatarURL = payload.Picture;
            }

            var refreshToken = GenerateRefreshToken();
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);

            await _context.SaveChangesAsync();

            if (isNewUser)
            {
                // Cấp gói Free mặc định cho user mới đăng ký qua Google
                await CreateFreeSubscriptionAsync(user.Id);

                _ = Task.Run(async () =>
                {
                    try { await _emailService.SendWelcomeEmailAsync(user.Email, user.FullName); }
                    catch { /* Lỗi gửi mail không làm fail đăng ký */ }
                });
            }

            return new AuthResponse
            {
                UserId = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                AccessToken = GenerateJwtToken(user),
                RefreshToken = user.RefreshToken
            };
        }

        public async Task<AuthResponse> RefreshTokenAsync(RefreshTokenRequest request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u =>
                u.RefreshToken == request.RefreshToken &&
                u.RefreshTokenExpiryTime > DateTime.UtcNow);

            if (user == null)
            {
                throw new Exception("Refresh token không hợp lệ hoặc đã hết hạn.");
            }

            if (user.IsBanned)
            {
                throw new Exception("Tài khoản của bạn đã bị khóa do vi phạm tiêu chuẩn cộng đồng.");
            }

            if (!user.IsActive)
            {
                throw new Exception("User is inactive.");
            }

            var refreshToken = GenerateRefreshToken();
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);

            await _context.SaveChangesAsync();

            return new AuthResponse
            {
                UserId = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                AccessToken = GenerateJwtToken(user),
                RefreshToken = user.RefreshToken
            };
        }

        public async Task ForgotPasswordAsync(ForgotPasswordRequest request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email && u.IsActive);
            // Always return success to avoid email enumeration
            if (user == null) return;

            // Generate secure token
            var tokenBytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(tokenBytes);
            var token = Convert.ToBase64String(tokenBytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');

            user.PasswordResetToken = token;
            user.PasswordResetTokenExpiryTime = DateTime.UtcNow.AddHours(1);
            await _context.SaveChangesAsync();

            var frontendUrl = _config["App:FrontendUrl"] ?? "http://localhost:5173";
            var resetLink = $"{frontendUrl}/reset-password?token={token}";

            _ = Task.Run(async () =>
            {
                try { await _emailService.SendPasswordResetEmailAsync(user.Email, user.FullName, resetLink); }
                catch { /* gửi mail thất bại không làm fail request */ }
            });
        }

        public async Task ResetPasswordAsync(ResetPasswordRequest request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u =>
                u.PasswordResetToken == request.Token &&
                u.PasswordResetTokenExpiryTime > DateTime.UtcNow);

            if (user == null)
                throw new Exception("Token không hợp lệ hoặc đã hết hạn.");

            CreatePasswordHash(request.NewPassword, out string hash, out string salt);
            user.PasswordHash = hash;
            user.PasswordSalt = salt;
            user.PasswordFormatVersion = Pbkdf2PasswordFormatVersion;
            user.PasswordResetToken = null;
            user.PasswordResetTokenExpiryTime = null;

            await _context.SaveChangesAsync();
        }

        public async Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordRequest request)
        {
            var user = await _context.Users.FindAsync(userId);
            
            if (user == null)
            {
                throw new Exception("User not found.");
            }

            if (!VerifyPasswordHash(request.OldPassword, user, out _))
            {
                throw new Exception("Mật khẩu hiện tại không chính xác.");
            }

            if (request.OldPassword == request.NewPassword)
            {
                throw new Exception("Mật khẩu mới không được trùng với mật khẩu hiện tại.");
            }

            CreatePasswordHash(request.NewPassword, out string passwordHash, out string passwordSalt);

            user.PasswordHash = passwordHash;
            user.PasswordSalt = passwordSalt;
            user.PasswordFormatVersion = Pbkdf2PasswordFormatVersion;

            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            return true;
        }

        private void CreatePasswordHash(string password, out string passwordHash, out string passwordSalt)
        {
            byte[] saltBytes = RandomNumberGenerator.GetBytes(Pbkdf2SaltSize);
            passwordSalt = Convert.ToBase64String(saltBytes);

            var hashBytes = Rfc2898DeriveBytes.Pbkdf2(
                password,
                saltBytes,
                Pbkdf2Iterations,
                HashAlgorithmName.SHA512,
                Pbkdf2KeySize);

            passwordHash = Convert.ToBase64String(hashBytes);
        }

        private bool VerifyPasswordHash(string password, User user, out bool shouldRehash)
        {
            shouldRehash = false;
            if (user.PasswordFormatVersion > LegacyPasswordFormatVersion)
            {
                return VerifyPbkdf2Hash(password, user.PasswordHash, user.PasswordSalt);
            }

            var validLegacy = VerifyLegacyHmacHash(password, user.PasswordHash, user.PasswordSalt);
            shouldRehash = validLegacy;
            return validLegacy;
        }

        private static bool VerifyPbkdf2Hash(string password, string storedHash, string storedSalt)
        {
            try
            {
                byte[] saltBytes = Convert.FromBase64String(storedSalt);
                byte[] expectedHash = Convert.FromBase64String(storedHash);

                var computedHash = Rfc2898DeriveBytes.Pbkdf2(
                    password,
                    saltBytes,
                    Pbkdf2Iterations,
                    HashAlgorithmName.SHA512,
                    expectedHash.Length);

                return CryptographicOperations.FixedTimeEquals(computedHash, expectedHash);
            }
            catch (FormatException)
            {
                return false;
            }
            catch (CryptographicException)
            {
                return false;
            }
        }

        private static bool VerifyLegacyHmacHash(string password, string storedHash, string storedSalt)
        {
            try
            {
                byte[] saltBytes = Convert.FromBase64String(storedSalt);
                using var hmac = new HMACSHA512(saltBytes);
                var computedHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(password));
                var expectedHash = Convert.FromBase64String(storedHash);
                return CryptographicOperations.FixedTimeEquals(computedHash, expectedHash);
            }
            catch (FormatException)
            {
                return false;
            }
            catch (CryptographicException)
            {
                return false;
            }
        }

        private string GenerateJwtToken(User user)
        {
            var jwtKey = _config["Jwt:Key"] ?? throw new Exception("Jwt:Key not found");
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            
            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(ClaimTypes.Name, user.FullName),
                new Claim(ClaimTypes.Role, user.Role)
            };

            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha512Signature);
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddHours(2),
                SigningCredentials = creds,
                Issuer = _config["Jwt:Issuer"],
                Audience = _config["Jwt:Audience"]
            };

            var tokenHandler = new JwtSecurityTokenHandler();
            var token = tokenHandler.CreateToken(tokenDescriptor);
            
            return tokenHandler.WriteToken(token);
        }

        private string GenerateRefreshToken()
        {
            var randomNumber = new byte[32];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(randomNumber);
            return Convert.ToBase64String(randomNumber);
        }

        /// <summary>
        /// Tìm gói Free (Price == 0) và cấp cho user mới đăng ký.
        /// Non-fatal: nếu không tìm thấy gói Free thì bỏ qua.
        /// </summary>
        private async Task CreateFreeSubscriptionAsync(Guid userId)
        {
            try
            {
                var freePlan = await _context.SubscriptionPlans
                    .Where(p => p.Price == 0 && p.IsActive)
                    .OrderBy(p => p.Id)
                    .FirstOrDefaultAsync();

                if (freePlan == null) return;

                var now = DateTime.UtcNow;
                _context.UserSubscriptions.Add(new UserSubscription
                {
                    UserId = userId,
                    PlanId = freePlan.Id,
                    StartDate = now,
                    EndDate = now.AddYears(1),
                    Status = "Active",
                    UsedAnalysisCount = 0,
                    UsedTokens = 0,
                    CreatedAt = now,
                });
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // Không để lỗi cấp subscription làm fail quá trình đăng ký
                _ = ex;
            }
        }
    }
}
