using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using MimeKit;
using Service.Interfaces;
using System.Threading.Tasks;

namespace Service.Implementations
{
    /// <summary>
    /// Dịch vụ gửi email thông báo, chào mừng và liên kết đặt lại mật khẩu qua Gmail SMTP sử dụng MailKit.
    /// </summary>
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;
        private readonly ISystemConfigService _sysConfig;

        public EmailService(IConfiguration config, ISystemConfigService sysConfig)
        {
            _config = config;
            _sysConfig = sysConfig;
        }

        private async Task<(string Host, int Port, string Username, string Password, string FromName, string FromAddress)> GetSmtpSettingsAsync()
        {
            var host = await _sysConfig.GetAsync("smtp.host", _config["Email:SmtpHost"] ?? "smtp.gmail.com");
            var portRaw = await _sysConfig.GetAsync("smtp.port", _config["Email:SmtpPort"] ?? "587");
            var port = int.TryParse(portRaw.ToString(), out var p) ? p : 587;
            var username = await _sysConfig.GetAsync("smtp.username", _config["Email:Username"] ?? "");
            var password = await _sysConfig.GetAsync("smtp.password", _config["Email:Password"] ?? "");
            var fromName = await _sysConfig.GetAsync("smtp.from_name", _config["Email:FromName"] ?? "StoryNest");
            var fromAddress = await _sysConfig.GetAsync("smtp.from_address", _config["Email:FromAddress"] ?? username);
            return (host, port, username, password, fromName, fromAddress);
        }

        public async Task SendWelcomeEmailAsync(string toEmail, string fullName)
        {
            var (smtpHost, smtpPort, smtpUser, smtpPass, fromName, fromAddress) = await GetSmtpSettingsAsync();

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(fromName, fromAddress));
            message.To.Add(new MailboxAddress(fullName, toEmail));
            message.Subject = "Chào mừng bạn đến với StoryNest! 🎉";

            var frontendUrl = _config["App:FrontendUrl"] ?? "http://localhost:5173";
            var bodyBuilder = new BodyBuilder
            {
                HtmlBody = BuildHtmlBody(fullName, frontendUrl),
                TextBody = $"Chào {fullName},\n\nChào mừng bạn đến với StoryNest!\n\nTài khoản của bạn đã được tạo thành công. Hãy bắt đầu hành trình sáng tác cùng AI ngay hôm nay.\n\nTrân trọng,\nĐội ngũ StoryNest"
            };
            message.Body = bodyBuilder.ToMessageBody();

            using var smtp = new SmtpClient();
            await smtp.ConnectAsync(smtpHost, smtpPort, SecureSocketOptions.StartTls);
            await smtp.AuthenticateAsync(smtpUser, smtpPass);
            await smtp.SendAsync(message);
            await smtp.DisconnectAsync(true);
        }

        public async Task SendPasswordResetEmailAsync(string toEmail, string fullName, string resetLink)
        {
            var (smtpHost, smtpPort, smtpUser, smtpPass, fromName, fromAddress) = await GetSmtpSettingsAsync();

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(fromName, fromAddress));
            message.To.Add(new MailboxAddress(fullName, toEmail));
            message.Subject = "Đặt lại mật khẩu StoryNest 🔐";

            var bodyBuilder = new BodyBuilder
            {
                HtmlBody = BuildResetHtmlBody(fullName, resetLink),
                TextBody = $"Chào {fullName},\n\nBạn đã yêu cầu đặt lại mật khẩu.\nNhấn vào link sau để tiếp tục (có hiệu lực trong 1 giờ):\n{resetLink}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.\n\nTrân trọng,\nĐội ngũ StoryNest"
            };
            message.Body = bodyBuilder.ToMessageBody();

            using var smtp = new SmtpClient();
            await smtp.ConnectAsync(smtpHost, smtpPort, SecureSocketOptions.StartTls);
            await smtp.AuthenticateAsync(smtpUser, smtpPass);
            await smtp.SendAsync(message);
            await smtp.DisconnectAsync(true);
        }

        private static string BuildResetHtmlBody(string fullName, string resetLink) => $"""
            <!DOCTYPE html>
            <html lang="vi">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#0a0a14;font-family:'Segoe UI',sans-serif;">
              <div style="max-width:520px;margin:40px auto;background:linear-gradient(145deg,#141427,#1e1b4b);border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">
                <div style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899);"></div>
                <div style="padding:40px 36px;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:32px;">
                    <div style="width:36px;height:36px;background:rgba(99,102,241,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">🔐</div>
                    <span style="color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;">StoryNest</span>
                  </div>
                  <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;">Đặt lại mật khẩu</h1>
                  <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.5);line-height:1.7;">
                    Xin chào <strong style="color:rgba(255,255,255,0.8);">{fullName}</strong>,<br/>
                    Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.<br/>
                    Link có hiệu lực trong <strong style="color:#a78bfa;">1 giờ</strong>.
                  </p>
                  <a href="{resetLink}"
                     style="display:block;text-align:center;padding:14px 28px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:14px;letter-spacing:0.3px;margin-bottom:24px;">
                    Đặt lại mật khẩu →
                  </a>
                  <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.3);line-height:1.6;">
                    Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Tài khoản của bạn vẫn an toàn.
                  </p>
                </div>
                <div style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
                  <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2);text-align:center;">© 2026 StoryNest · Email tự động, vui lòng không trả lời.</p>
                </div>
              </div>
            </body>
            </html>
            """;

        private static string BuildHtmlBody(string fullName, string frontendUrl) => $"""
            <!DOCTYPE html>
            <html lang="vi">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#0a0a14;font-family:'Segoe UI',sans-serif;">
              <div style="max-width:520px;margin:40px auto;background:linear-gradient(145deg,#141427,#1e1b4b);border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">
                <!-- Header gradient bar -->
                <div style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899);"></div>

                <div style="padding:40px 36px;">
                  <!-- Logo / brand -->
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:32px;">
                    <div style="width:36px;height:36px;background:rgba(99,102,241,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">✨</div>
                    <span style="color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;">StoryNest</span>
                  </div>

                  <!-- Headline -->
                  <h1 style="margin:0 0 8px;font-size:28px;font-weight:700;color:#ffffff;line-height:1.3;">
                    Chào mừng, {fullName}! 🎉
                  </h1>
                  <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.5);line-height:1.7;">
                    Tài khoản của bạn đã được tạo thành công. Bắt đầu hành trình sáng tác cốt truyện cùng AI ngay hôm nay.
                  </p>

                  <!-- Feature highlights -->
                  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px;margin-bottom:28px;">
                    <p style="margin:0 0 14px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:2px;">Bạn có thể</p>
                    {FeatureRow("🔒", "Lưu trữ cốt truyện được mã hóa end-to-end")}
                    {FeatureRow("🤖", "Nhận đánh giá AI cá nhân hóa theo phong cách của bạn")}
                    {FeatureRow("✍️", "Sáng tác thông minh với gợi ý hướng đi từ AI")}
                  </div>

                  <!-- CTA -->
                  <a href="{frontendUrl}/login"
                     style="display:block;text-align:center;padding:14px 28px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:14px;letter-spacing:0.3px;">
                    Đăng nhập ngay →
                  </a>
                </div>

                <!-- Footer -->
                <div style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
                  <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2);text-align:center;">
                    © 2026 StoryNest · Bạn nhận được email này vì vừa đăng ký tài khoản.
                  </p>
                </div>
              </div>
            </body>
            </html>
            """;

        public async Task SendModerationWarningEmailAsync(string toEmail, string fullName, string message)
        {
            var (smtpHost, smtpPort, smtpUser, smtpPass, fromName, fromAddress) = await GetSmtpSettingsAsync();

            var mime = new MimeMessage();
            mime.From.Add(new MailboxAddress(fromName, fromAddress));
            mime.To.Add(new MailboxAddress(fullName, toEmail));
            mime.Subject = "Thông báo từ đội ngũ StoryNest";

            var safeMessage = System.Net.WebUtility.HtmlEncode(message);
            var bodyBuilder = new BodyBuilder
            {
                HtmlBody = $"""
                    <p>Chào {System.Net.WebUtility.HtmlEncode(fullName)},</p>
                    <p>Đội ngũ StoryNest gửi bạn thông báo liên quan đến tài khoản hoặc nội dung của bạn:</p>
                    <blockquote style="border-left:3px solid #6366f1;padding-left:12px;color:#333;">{safeMessage}</blockquote>
                    <p>Nếu bạn cho rằng đây là nhầm lẫn, hãy phản hồi qua mục Hỗ trợ hoặc Kháng cáo trong ứng dụng.</p>
                    <p>Trân trọng,<br/>Đội ngũ StoryNest</p>
                    """,
                TextBody = $"Chào {fullName},\n\n{message}\n\nTrân trọng,\nĐội ngũ StoryNest"
            };
            mime.Body = bodyBuilder.ToMessageBody();

            using var smtp = new SmtpClient();
            await smtp.ConnectAsync(smtpHost, smtpPort, SecureSocketOptions.StartTls);
            await smtp.AuthenticateAsync(smtpUser, smtpPass);
            await smtp.SendAsync(mime);
            await smtp.DisconnectAsync(true);
        }

        public async Task SendOtpEmailAsync(string toEmail, string fullName, string otp)
        {
            var (smtpHost, smtpPort, smtpUser, smtpPass, fromName, fromAddress) = await GetSmtpSettingsAsync();

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(fromName, fromAddress));
            message.To.Add(new MailboxAddress(fullName, toEmail));
            message.Subject = $"{otp} là mã xác minh StoryNest của bạn 🔑";

            var bodyBuilder = new BodyBuilder
            {
                HtmlBody = BuildOtpHtmlBody(fullName, otp),
                TextBody = $"Chào {fullName},\n\nMã xác minh OTP của bạn là: {otp}\n\nMã này có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.\n\nTrân trọng,\nĐội ngũ StoryNest"
            };
            message.Body = bodyBuilder.ToMessageBody();

            using var smtp = new SmtpClient();
            await smtp.ConnectAsync(smtpHost, smtpPort, SecureSocketOptions.StartTls);
            await smtp.AuthenticateAsync(smtpUser, smtpPass);
            await smtp.SendAsync(message);
            await smtp.DisconnectAsync(true);
        }

        private static string BuildOtpHtmlBody(string fullName, string otp) => $"""
            <!DOCTYPE html>
            <html lang="vi">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#0a0a14;font-family:'Segoe UI',sans-serif;">
              <div style="max-width:520px;margin:40px auto;background:linear-gradient(145deg,#141427,#1e1b4b);border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">
                <div style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899);"></div>
                <div style="padding:40px 36px;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:32px;">
                    <div style="width:36px;height:36px;background:rgba(99,102,241,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">🔑</div>
                    <span style="color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;">StoryNest</span>
                  </div>
                  <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;">Xác minh email của bạn</h1>
                  <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.5);line-height:1.7;">
                    Xin chào <strong style="color:rgba(255,255,255,0.8);">{fullName}</strong>,<br/>
                    Cảm ơn bạn đã đăng ký StoryNest. Vui lòng sử dụng mã OTP dưới đây để hoàn tất đăng ký tài khoản. Mã này có hiệu lực trong <strong style="color:#a78bfa;">10 phút</strong>:
                  </p>
                  <div style="text-align:center;padding:20px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;margin-bottom:28px;">
                    <span style="font-size:36px;font-weight:800;color:#ffffff;letter-spacing:8px;display:inline-block;padding-left:8px;">{otp}</span>
                  </div>
                  <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.3);line-height:1.6;text-align:center;">
                    Nếu bạn không yêu cầu đăng ký tài khoản này, vui lòng bỏ qua email này.
                  </p>
                </div>
                <div style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
                  <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2);text-align:center;">© 2026 StoryNest · Email tự động, vui lòng không trả lời.</p>
                </div>
              </div>
            </body>
            </html>
            """;

        private static string FeatureRow(string icon, string text) =>
            $"""<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;"><span style="font-size:16px;min-width:22px;">{icon}</span><span style="font-size:14px;color:rgba(255,255,255,0.65);line-height:1.5;">{text}</span></div>""";
    }
}
