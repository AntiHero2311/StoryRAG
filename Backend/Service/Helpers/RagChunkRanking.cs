using Repository.Entities;

namespace Service.Helpers
{
    public static class RagChunkRanking
    {
        /// <summary>
        /// Chọn top-K chunk theo cosine distance (1 − cosine similarity), tính trên RAM — không dùng CosineDistance EF (client-eval).
        /// <paramref name="ordinalByChunk"/> map <see cref="ChapterChunk.Id"/> → chỉ số phẳng trong lần phân tích (evidence_chunk_ids).
        /// </summary>
        public static List<(ChapterChunk Chunk, int Ordinal)> TopKByCosine(
            IReadOnlyList<ChapterChunk> chunks,
            IReadOnlyDictionary<Guid, int> ordinalByChunk,
            float[] queryEmbedding,
            int k)
        {
            if (chunks.Count == 0 || queryEmbedding.Length == 0)
                return new List<(ChapterChunk, int)>();

            var qNorm = L2Norm(queryEmbedding);
            if (qNorm < 1e-12f)
                qNorm = 1e-12f;

            var kClamped = Math.Clamp(k, 1, 64);
            return chunks
                .Where(c => c.Embedding != null && ordinalByChunk.ContainsKey(c.Id))
                .Select(c =>
                {
                    var v = c.Embedding!.ToArray();
                    var dist = CosineDistance(v, queryEmbedding, qNorm);
                    return (Chunk: c, Ord: ordinalByChunk[c.Id], Dist: dist);
                })
                .OrderBy(x => x.Dist)
                .Take(kClamped)
                .Select(x => (x.Chunk, x.Ord))
                .ToList();
        }

        private static float L2Norm(float[] v)
        {
            double s = 0;
            for (var i = 0; i < v.Length; i++)
                s += v[i] * v[i];
            return (float)Math.Sqrt(s);
        }

        /// <summary>Cosine distance = 1 − (a·b)/(‖a‖‖b‖), cùng hướng với pgvector cosine ops.</summary>
        private static float CosineDistance(float[] a, float[] q, float qNorm)
        {
            if (a.Length != q.Length)
                return 2f;

            double dot = 0, aNorm = 0;
            for (var i = 0; i < a.Length; i++)
            {
                dot += a[i] * q[i];
                aNorm += a[i] * a[i];
            }

            var aN = (float)Math.Sqrt(aNorm);
            if (aN < 1e-12f)
                aN = 1e-12f;

            var sim = (float)(dot / (aN * qNorm));
            if (sim > 1f)
                sim = 1f;
            if (sim < -1f)
                sim = -1f;
            return 1f - sim;
        }
    }
}
