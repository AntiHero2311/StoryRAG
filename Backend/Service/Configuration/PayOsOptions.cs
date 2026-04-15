namespace Service.Configuration
{
    public class PayOsOptions
    {
        public string BaseUrl { get; set; } = "https://api-merchant.payos.vn";
        public string CreatePaymentPath { get; set; } = "/v2/payment-requests";
        public string ClientId { get; set; } = string.Empty;
        public string ApiKey { get; set; } = string.Empty;
        public string ChecksumKey { get; set; } = string.Empty;
        public string ReturnUrl { get; set; } = string.Empty;
        public string CancelUrl { get; set; } = string.Empty;
        public string? PartnerCode { get; set; }
    }
}
