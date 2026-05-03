using Pgvector;
using Repository.Entities;
using Service.Helpers;

namespace Service.Tests;

public class RagComponentsTests
{
    [Fact]
    public void RubricQueryTemplates_has_fixed_query_for_each_rubric_key()
    {
        var keys = new[]
        {
            "1.1", "1.2", "2.1", "2.2", "2.3", "2.4", "3.1", "3.2", "3.3",
            "4.1", "4.2", "4.3", "5.1", "5.2", "6.1", "6.2", "7.1", "7.2", "8.1", "8.2",
        };
        foreach (var k in keys)
        {
            var q = RubricQueryTemplates.GetRetrievalQuery(k);
            Assert.False(string.IsNullOrWhiteSpace(q));
            Assert.True(q.Length > 10);
        }

        Assert.Equal(20, RubricQueryTemplates.AllKeys.Count);
    }

    [Fact]
    public void RagChunkRanking_orders_by_cosine_closer_first()
    {
        var dim = 8;
        var makeEmb = (float[] v) => new Vector(Pad(v, dim));

        var chunks = new List<ChapterChunk>
        {
            new() { Id = Guid.Parse("00000000-0000-4000-8000-000000000001"), Embedding = makeEmb(new float[] { 1f, 0, 0, 0, 0, 0, 0, 0 }) },
            new() { Id = Guid.Parse("00000000-0000-4000-8000-000000000002"), Embedding = makeEmb(new float[] { 0f, 1f, 0, 0, 0, 0, 0, 0 }) },
            new() { Id = Guid.Parse("00000000-0000-4000-8000-000000000003"), Embedding = makeEmb(new float[] { 0.95f, 0.05f, 0, 0, 0, 0, 0, 0 }) },
        };

        var ord = new Dictionary<Guid, int>
        {
            [chunks[0].Id] = 0,
            [chunks[1].Id] = 1,
            [chunks[2].Id] = 2,
        };

        var query = Pad(new float[] { 1f, 0, 0, 0, 0, 0, 0, 0 }, dim);
        var top = RagChunkRanking.TopKByCosine(chunks, ord, query, k: 2);

        Assert.Equal(2, top.Count);
        Assert.Equal(0, top[0].Ordinal);
        Assert.Equal(2, top[1].Ordinal);
    }

    private static float[] Pad(float[] shorter, int dim)
    {
        var a = new float[dim];
        Array.Copy(shorter, a, Math.Min(shorter.Length, dim));
        return a;
    }
}
