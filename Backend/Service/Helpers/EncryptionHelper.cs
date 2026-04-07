using System.Security.Cryptography;
using System.Text;

namespace Service.Helpers
{
    public static class EncryptionHelper
    {
        // Encrypts DEK using the System Master Key
        public static string EncryptWithMasterKey(string plainText, string masterKey)
        {
            if (string.IsNullOrEmpty(plainText)) return plainText;
            
            // Generate a 16-byte IV
            byte[] iv = new byte[16];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(iv);
            }

            using (Aes aes = Aes.Create())
            {
                // Key should be 32 bytes (256-bit)
                aes.Key = GetValidKey(masterKey, 32); 
                aes.IV = iv;
                aes.Mode = CipherMode.CBC;

                using (var encryptor = aes.CreateEncryptor())
                using (var ms = new MemoryStream())
                {
                    // Write IV first, so we know it when decrypting
                    ms.Write(iv, 0, iv.Length);
                    using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
                    {
                        byte[] plainBytes = Encoding.UTF8.GetBytes(plainText);
                        cs.Write(plainBytes, 0, plainBytes.Length);
                    }
                    
                    return Convert.ToBase64String(ms.ToArray());
                }
            }
        }

        public static string DecryptWithMasterKey(string cipherText, string masterKey)
        {
            if (string.IsNullOrEmpty(cipherText)) return cipherText;

            try
            {
                byte[] fullCipher = Convert.FromBase64String(cipherText);
                if (fullCipher.Length < 16) return cipherText; // Quá ngắn để chứa IV

                byte[] iv = new byte[16];
                Array.Copy(fullCipher, 0, iv, 0, iv.Length);

                using (Aes aes = Aes.Create())
                {
                    aes.Key = GetValidKey(masterKey, 32);
                    aes.IV = iv;
                    aes.Mode = CipherMode.CBC;

                    using (var decryptor = aes.CreateDecryptor())
                    using (var ms = new MemoryStream(fullCipher, iv.Length, fullCipher.Length - iv.Length))
                    using (var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read))
                    using (var reader = new StreamReader(cs, Encoding.UTF8))
                    {
                        return reader.ReadToEnd();
                    }
                }
            }
            catch (Exception)
            {
                // Nếu lỗi Base64 (FormatException) hoặc lỗi giải mã (CryptographicException)
                // -> Chuỗi có thể chưa được mã hóa (Plain text), trả về nguyên gốc.
                return cipherText;
            }
        }

        // Generate a cryptographically secure random Data Encryption Key (DEK)
        public static string GenerateDataEncryptionKey()
        {
            byte[] key = new byte[32]; // 256 bits
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(key);
            }
            return Convert.ToBase64String(key);
        }

        private static byte[] GetValidKey(string key, int size)
        {
            // If the key is less than required, pad it. If more, truncate it.
            // Using SHA256 to consistently get 32 bytes from any string length is better.
            using (SHA256 sha256 = SHA256.Create())
            {
                return sha256.ComputeHash(Encoding.UTF8.GetBytes(key));
            }
        }
    }
}
