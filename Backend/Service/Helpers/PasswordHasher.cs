using System.Security.Cryptography;

namespace Service.Helpers
{
    public static class PasswordHasher
    {
        public const int Pbkdf2PasswordFormatVersion = 2;
        private const int Pbkdf2Iterations = 120_000;
        private const int Pbkdf2SaltSize = 16;
        private const int Pbkdf2KeySize = 64;

        public static void CreateHash(string password, out string passwordHash, out string passwordSalt)
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
    }
}
