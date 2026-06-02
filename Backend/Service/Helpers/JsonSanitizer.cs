using System;
using System.Text;
using System.Text.Json;

namespace Service.Helpers
{
    public static class JsonSanitizer
    {
        public static string Sanitize(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return json;

            // If already valid JSON, don't sanitize at all to avoid messing up properly escaped quotes!
            try
            {
                using (JsonDocument.Parse(json))
                {
                    return json;
                }
            }
            catch
            {
                // Proceed to sanitize only if it is malformed
            }

            var sb = new StringBuilder(json.Length);
            bool inString = false;

            for (int i = 0; i < json.Length; i++)
            {
                char c = json[i];

                if (c == '"')
                {
                    // Check if this quote is escaped in the source
                    int backslashCount = 0;
                    for (int j = i - 1; j >= 0; j--)
                    {
                        if (json[j] == '\\')
                            backslashCount++;
                        else
                            break;
                    }

                    bool isEscaped = backslashCount % 2 != 0;

                    if (isEscaped)
                    {
                        // It's already escaped in the source, keep it as-is
                        sb.Append(c);
                    }
                    else if (!inString)
                    {
                        // Entering a string
                        inString = true;
                        sb.Append(c);
                    }
                    else
                    {
                        // We are in a string. Is this double quote the true closing quote?
                        // It is the true closing quote if and only if it is followed by one of:
                        // - whitespace then ':'
                        // - whitespace then ','
                        // - whitespace then '}'
                        // - whitespace then ']'
                        // - end of input
                        bool isClosing = false;
                        int nextIdx = i + 1;
                        while (nextIdx < json.Length)
                        {
                            char nextChar = json[nextIdx];
                            if (nextChar == ':' || nextChar == ',' || nextChar == '}' || nextChar == ']')
                            {
                                isClosing = true;
                                break;
                            }
                            if (!char.IsWhiteSpace(nextChar))
                            {
                                break; // Found non-whitespace that is not a valid JSON delimiter
                            }
                            nextIdx++;
                        }

                        if (nextIdx >= json.Length || isClosing)
                        {
                            // Yes, this is the true closing quote!
                            inString = false;
                            sb.Append(c);
                        }
                        else
                        {
                            // No, it's an unescaped double quote inside the string! Escape it.
                            sb.Append("\\\"");
                        }
                    }
                }
                else if (inString)
                {
                    if (c == '\n')
                    {
                        sb.Append("\\n");
                    }
                    else if (c == '\r')
                    {
                        // skip \r
                    }
                    else if (c == '\\')
                    {
                        // Check if it's a valid escape sequence
                        if (i + 1 < json.Length)
                        {
                            char next = json[i + 1];
                            if (next == '"' || next == '\\' || next == '/')
                            {
                                sb.Append(c);
                            }
                            else if (next == 'n')
                            {
                                // Check if \n is followed by a letter (which means it's a path/word like \new)
                                bool isPath = false;
                                if (i + 2 < json.Length)
                                {
                                    char afterN = json[i + 2];
                                    if (char.IsLetter(afterN))
                                        isPath = true;
                                }

                                if (isPath)
                                {
                                    sb.Append("\\\\");
                                }
                                else
                                {
                                    sb.Append(c);
                                }
                            }
                            else if (next == 'u')
                            {
                                // Check if followed by 4 hex digits
                                bool isUnicode = true;
                                for (int h = 0; h < 4; h++)
                                {
                                    if (i + 2 + h >= json.Length) { isUnicode = false; break; }
                                    char hc = json[i + 2 + h];
                                    if (!((hc >= '0' && hc <= '9') || (hc >= 'a' && hc <= 'f') || (hc >= 'A' && hc <= 'F')))
                                    {
                                        isUnicode = false;
                                        break;
                                    }
                                }

                                if (isUnicode)
                                {
                                    sb.Append(c);
                                }
                                else
                                {
                                    sb.Append("\\\\");
                                }
                            }
                            else
                            {
                                // Invalid/raw backslash sequence (like \file, \test, \bin, \r, \t, etc.), escape the backslash
                                sb.Append("\\\\");
                            }
                        }
                        else
                        {
                            sb.Append("\\\\");
                        }
                    }
                    else
                    {
                        sb.Append(c);
                    }
                }
                else
                {
                    sb.Append(c);
                }
            }

            return sb.ToString();
        }
    }
}
