using System;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text;
using System.Collections.Generic;

namespace Service.Helpers
{
    public class SafeStringConverter : JsonConverter<string>
    {
        public override string Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            switch (reader.TokenType)
            {
                case JsonTokenType.String:
                    return reader.GetString() ?? string.Empty;
                case JsonTokenType.Number:
                    if (reader.TryGetInt64(out long l)) return l.ToString();
                    if (reader.TryGetDouble(out double d)) return d.ToString(System.Globalization.CultureInfo.InvariantCulture);
                    using (var doc = JsonDocument.ParseValue(ref reader))
                    {
                        return doc.RootElement.GetRawText();
                    }
                case JsonTokenType.True:
                    return "true";
                case JsonTokenType.False:
                    return "false";
                case JsonTokenType.Null:
                    return string.Empty;
                case JsonTokenType.StartArray:
                    using (var doc = JsonDocument.ParseValue(ref reader))
                    {
                        var sb = new StringBuilder();
                        foreach (var item in doc.RootElement.EnumerateArray())
                        {
                            if (sb.Length > 0) sb.Append("\n");
                            if (item.ValueKind == JsonValueKind.String)
                                sb.Append(item.GetString());
                            else
                                sb.Append(item.GetRawText());
                        }
                        return sb.ToString();
                    }
                case JsonTokenType.StartObject:
                    using (var doc = JsonDocument.ParseValue(ref reader))
                    {
                        return doc.RootElement.GetRawText();
                    }
                default:
                    using (var doc = JsonDocument.ParseValue(ref reader))
                    {
                        return doc.RootElement.GetRawText();
                    }
            }
        }

        public override void Write(Utf8JsonWriter writer, string value, JsonSerializerOptions options)
        {
            writer.WriteStringValue(value);
        }
    }

    public class SafeStringListConverter : JsonConverter<List<string>>
    {
        public override List<string> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            var list = new List<string>();
            switch (reader.TokenType)
            {
                case JsonTokenType.Null:
                    return list;
                case JsonTokenType.StartArray:
                    using (var doc = JsonDocument.ParseValue(ref reader))
                    {
                        foreach (var item in doc.RootElement.EnumerateArray())
                        {
                            if (item.ValueKind == JsonValueKind.String)
                                list.Add(item.GetString() ?? string.Empty);
                            else
                                list.Add(item.GetRawText());
                        }
                    }
                    break;
                case JsonTokenType.String:
                    var s = reader.GetString();
                    if (!string.IsNullOrWhiteSpace(s))
                    {
                        // Split by comma or newline if Gemini returned comma separated
                        var parts = s.Split(new[] { ',', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                        foreach (var p in parts)
                        {
                            list.Add(p.Trim());
                        }
                    }
                    break;
                default:
                    using (var doc = JsonDocument.ParseValue(ref reader))
                    {
                        var raw = doc.RootElement.GetRawText();
                        if (!string.IsNullOrWhiteSpace(raw))
                            list.Add(raw);
                    }
                    break;
            }
            return list;
        }

        public override void Write(Utf8JsonWriter writer, List<string> value, JsonSerializerOptions options)
        {
            JsonSerializer.Serialize(writer, value, options);
        }
    }

    public class SafeIntListConverter : JsonConverter<List<int>>
    {
        public override List<int> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            var list = new List<int>();
            switch (reader.TokenType)
            {
                case JsonTokenType.Null:
                    return list;
                case JsonTokenType.StartArray:
                    using (var doc = JsonDocument.ParseValue(ref reader))
                    {
                        foreach (var item in doc.RootElement.EnumerateArray())
                        {
                            if (item.ValueKind == JsonValueKind.Number && item.TryGetInt32(out int val))
                            {
                                list.Add(val);
                            }
                            else if (item.ValueKind == JsonValueKind.String)
                            {
                                if (int.TryParse(item.GetString(), out int sVal))
                                    list.Add(sVal);
                            }
                        }
                    }
                    break;
                case JsonTokenType.Number:
                    if (reader.TryGetInt32(out int num))
                        list.Add(num);
                    break;
                case JsonTokenType.String:
                    var s = reader.GetString();
                    if (!string.IsNullOrWhiteSpace(s))
                    {
                        var parts = s.Split(new[] { ',', ';', ' ', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                        foreach (var p in parts)
                        {
                            if (int.TryParse(p.Trim(), out int parsedVal))
                                list.Add(parsedVal);
                        }
                    }
                    break;
            }
            return list;
        }

        public override void Write(Utf8JsonWriter writer, List<int> value, JsonSerializerOptions options)
        {
            JsonSerializer.Serialize(writer, value, options);
        }
    }
}
