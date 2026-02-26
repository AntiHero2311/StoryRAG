using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using MimeKit;
using Service.Interfaces;
using System.Threading.Tasks;

namespace Service.Implementations
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;

        public EmailService(IConfiguration config)
        {
            _config = config;
        }

        public async Task SendWelcomeEmailAsync(string toEmail, string fullName)
        {
            var smtpHost     = _config["Email:SmtpHost"]     ?? "smtp.gmail.com";
            var smtpPort     = int.Parse(_config["Email:SmtpPort"] ?? "587");
            var smtpUser     = _config["Email:Username"]     ?? "";
            var smtpPass     = _config["Email:Password"]     ?? "";
            var fromName     = _config["Email:FromName"]     ?? "StoryNest";
            var fromAddress  = _config["Email:FromAddress"]  ?? smtpUser;

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(fromName, fromAddress));
            message.To.Add(new MailboxAddress(fullName, toEmail));
            message.Subject = "Chào mừng bạn đến với StoryNest! 🎉";

            var bodyBuilder = new BodyBuilder
            {
                HtmlBody = BuildHtmlBody(fullName),
                TextBody = $"Chào {fullName},\n\nChào mừng bạn đến với StoryNest!\n\nTài khoản của bạn đã được tạo thành công. Hãy bắt đầu hành trình sáng tác cùng AI ngay hôm nay.\n\nTrân trọng,\nĐội ngũ StoryNest"
            };
            message.Body = bodyBuilder.ToMessageBody();

            using var smtp = new SmtpClient();
            await smtp.ConnectAsync(smtpHost, smtpPort, SecureSocketOptions.StartTls);
            await smtp.AuthenticateAsync(smtpUser, smtpPass);
            await smtp.SendAsync(message);
            await smtp.DisconnectAsync(true);
        }

        private static string BuildHtmlBody(string fullName) => $"""
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
                  <a href="http://localhost:5173/login"
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

        private static string FeatureRow(string icon, string text) =>
            $"""<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;"><span style="font-size:16px;min-width:22px;">{icon}</span><span style="font-size:14px;color:rgba(255,255,255,0.65);line-height:1.5;">{text}</span></div>""";
    }
}
