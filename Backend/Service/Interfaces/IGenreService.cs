using Service.DTOs;

namespace Service.Interfaces
{
    public interface IGenreService
    {
        Task<List<GenreResponse>> GetAllGenresAsync();
        Task<GenreResponse> GetGenreByIdAsync(int id);
        Task<GenreResponse> CreateGenreAsync(CreateGenreRequest request);
        Task<GenreResponse> UpdateGenreAsync(int id, UpdateGenreRequest request);
        Task DeleteGenreAsync(int id);
    }
}
