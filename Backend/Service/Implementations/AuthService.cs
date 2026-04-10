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
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IEmailService _emailService;

        public AuthService(AppDbContext context, IConfiguration config, IEmailService emailService)
        {
            _context = context;
            _config = config;
            _emailService = emailService;
        }

        public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
        {
            if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            {
                throw new Exception("Email already exists.");
            }

            CreatePasswordHash(request.Password, out string passwordHash, out string passwordSalt);

            // Generate raw DEK for the user, then encrypt it with system MasterKey
            string rawDek = EncryptionHelper.GenerateDataEncryptionKey();
            string masterKey = _config["Security:MasterKey"] ?? throw new Exception("MasterKey not found in config");
            string encryptedDek = EncryptionHelper.EncryptWithMasterKey(rawDek, masterKey);

            var user = new User
            {
                FullName = request.FullName,
                Email = request.Email,
                PasswordHash = passwordHash,
                PasswordSalt = passwordSalt,
                DataEncryptionKey = encryptedDek
            };

            var refreshToken = GenerateRefreshToken();
            user.Role = "Author"; // Force role to Author
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7); // 7 days expiry

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

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
            
            if (user == null || !VerifyPasswordHash(request.Password, user.PasswordHash, user.PasswordSalt))
            {
                throw new Exception("Email hoặc mật khẩu không chính xác.");
            }

            if (!user.IsActive)
            {
                throw new Exception("User is inactive.");
            }

            var refreshToken = GenerateRefreshToken();
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);

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
                    AvatarURL = payload.Picture,
                    Role = "Author",
                    DataEncryptionKey = encryptedDek,
                    IsActive = true
                };

                _context.Users.Add(user);
                isNewUser = true;
            }

            if (!user.IsActive)
            {
                throw new Exception("User is inactive.");
            }

            if (!string.IsNullOrWhiteSpace(payload.Picture))
            {
                user.AvatarURL = payload.Picture;
            }

            var refreshToken = GenerateRefreshToken();
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);

            await _context.SaveChangesAsync();

            if (isNewUser)
            {
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

            if (!VerifyPasswordHash(request.OldPassword, user.PasswordHash, user.PasswordSalt))
            {
                throw new Exception("Mật khẩu hiện tại không chính xác.");
            }

            CreatePasswordHash(request.NewPassword, out string passwordHash, out string passwordSalt);

            user.PasswordHash = passwordHash;
            user.PasswordSalt = passwordSalt;

            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            return true;
        }

        private void CreatePasswordHash(string password, out string passwordHash, out string passwordSalt)
        {
            byte[] saltBytes = new byte[16];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(saltBytes);
            }
            passwordSalt = Convert.ToBase64String(saltBytes);

            using (var hmac = new HMACSHA512(saltBytes))
            {
                var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(password));
                passwordHash = Convert.ToBase64String(hashBytes);
            }
        }

        private bool VerifyPasswordHash(string password, string storedHash, string storedSalt)
        {
            byte[] saltBytes = Convert.FromBase64String(storedSalt);
            using (var hmac = new HMACSHA512(saltBytes))
            {
                var computedHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(password));
                return Convert.ToBase64String(computedHash) == storedHash;
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
    }
}
