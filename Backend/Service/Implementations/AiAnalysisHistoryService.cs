using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Repository.Data;
using Repository.Entities;
using Service.Helpers;
using Service.Interfaces;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Service.Implementations
{
    public class AiAnalysisHistoryService : IAiAnalysisHistoryService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        public AiAnalysisHistoryService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        public async Task SaveHistoryAsync(Guid projectId, Guid? chapterId, Guid userId, string analysisType, string jsonResult, int totalTokens)
        {
            var masterKey = _config["Security:MasterKey"] ?? throw new InvalidOperationException("Master key not configured.");
            var user = await _context.Users.FindAsync(userId) 
                ?? throw new KeyNotFoundException("Người dùng không tồn tại.");
                
            var rawDek = EncryptionHelper.DecryptWithMasterKey(user.DataEncryptionKey!, masterKey);

            var history = new AiAnalysisHistory
            {
                ProjectId = projectId,
                ChapterId = chapterId,
                UserId = userId,
                AnalysisType = analysisType,
                EncryptedContext = string.Empty, // Bỏ qua context để tiết kiệm db space
                EncryptedResult = EncryptionHelper.EncryptWithMasterKey(jsonResult, rawDek),
                TotalTokens = totalTokens,
            };

            _context.AiAnalysisHistories.Add(history);
            await _context.SaveChangesAsync();
        }

        public async Task<AiAnalysisHistoryResult> GetHistoryAsync(Guid projectId, Guid userId, string analysisType, int page, int pageSize)
        {
            var project = await _context.Projects
                .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted && p.AuthorId == userId)
                ?? throw new KeyNotFoundException("Dự án không tồn tại hoặc bạn không có quyền truy cập.");

            var masterKey = _config["Security:MasterKey"] ?? throw new InvalidOperationException("Master key not configured.");
            var user = await _context.Users.FindAsync(userId);
            var rawDek = EncryptionHelper.DecryptWithMasterKey(user!.DataEncryptionKey!, masterKey);

            var query = _context.AiAnalysisHistories
                .Where(h => h.ProjectId == projectId && h.UserId == userId && h.AnalysisType == analysisType);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(h => h.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var dtos = items.Select(h => new AiAnalysisHistoryDto
            {
                Id = h.Id,
                ProjectId = h.ProjectId,
                ChapterId = h.ChapterId,
                AnalysisType = h.AnalysisType,
                ResultJson = EncryptionHelper.DecryptWithMasterKey(h.EncryptedResult, rawDek),
                TotalTokens = h.TotalTokens,
                CreatedAt = h.CreatedAt
            }).ToList();

            return new AiAnalysisHistoryResult
            {
                Items = dtos,
                TotalCount = total,
                Page = page,
                PageSize = pageSize
            };
        }
    }
}
