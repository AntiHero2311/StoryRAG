using System;
using System.Collections.Generic;
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

            // Pass 1: Strip comments (single & multi-line) and invalid dots/ellipsis outside strings
            var sb1 = new StringBuilder(json.Length);
            bool inString1 = false;
            for (int i = 0; i < json.Length; i++)
            {
                char c = json[i];
                if (c == '"')
                {
                    int backslashCount = 0;
                    for (int j = i - 1; j >= 0; j--)
                    {
                        if (json[j] == '\\') backslashCount++;
                        else break;
                    }
                    bool isEscaped = backslashCount % 2 != 0;
                    if (!isEscaped)
                    {
                        inString1 = !inString1;
                    }
                    sb1.Append(c);
                }
                else if (inString1)
                {
                    sb1.Append(c);
                }
                else
                {
                    // Outside of string: check comments and dots
                    if (c == '/' && i + 1 < json.Length && json[i + 1] == '/')
                    {
                        // Skip single-line comment
                        while (i < json.Length && json[i] != '\n')
                        {
                            i++;
                        }
                        if (i < json.Length) sb1.Append(json[i]); // Keep the newline
                    }
                    else if (c == '/' && i + 1 < json.Length && json[i + 1] == '*')
                    {
                        // Skip multi-line comment
                        i += 2;
                        while (i + 1 < json.Length && !(json[i] == '*' && json[i + 1] == '/'))
                        {
                            i++;
                        }
                        i++; // Skip the '/'
                    }
                    else if (c == '.')
                    {
                        // Only keep decimal point if surrounded by digits (e.g. 4.5)
                        bool isDecimalDot = false;
                        if (i > 0 && i + 1 < json.Length)
                        {
                            char prev = json[i - 1];
                            char next = json[i + 1];
                            if (char.IsDigit(prev) && char.IsDigit(next))
                            {
                                isDecimalDot = true;
                            }
                        }
                        if (isDecimalDot)
                        {
                            sb1.Append(c);
                        }
                    }
                    else
                    {
                        sb1.Append(c);
                    }
                }
            }

            string pass1 = sb1.ToString();

            // Pass 2: Handle unescaped double quotes inside strings and strip trailing commas outside strings
            var sb2 = new StringBuilder(pass1.Length);
            bool inString2 = false;

            for (int i = 0; i < pass1.Length; i++)
            {
                char c = pass1[i];

                if (c == '"')
                {
                    // Check if this quote is escaped in the source
                    int backslashCount = 0;
                    for (int j = i - 1; j >= 0; j--)
                    {
                        if (pass1[j] == '\\')
                            backslashCount++;
                        else
                            break;
                    }

                    bool isEscaped = backslashCount % 2 != 0;

                    if (isEscaped)
                    {
                        // It's already escaped in the source, keep it as-is
                        sb2.Append(c);
                    }
                    else if (!inString2)
                    {
                        // Entering a string
                        inString2 = true;
                        sb2.Append(c);
                    }
                    else
                    {
                        // We are in a string. Is this double quote the true closing quote?
                        bool isClosing = false;
                        int nextIdx = i + 1;
                        while (nextIdx < pass1.Length)
                        {
                            char nextChar = pass1[nextIdx];
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

                        if (nextIdx >= pass1.Length || isClosing)
                        {
                            // Yes, this is the true closing quote!
                            inString2 = false;
                            sb2.Append(c);
                        }
                        else
                        {
                            // No, it's an unescaped double quote inside the string! Escape it.
                            sb2.Append("\\\"");
                        }
                    }
                }
                else if (inString2)
                {
                    if (c == '\n')
                    {
                        sb2.Append("\\n");
                    }
                    else if (c == '\r')
                    {
                        // skip \r
                    }
                    else if (c == '\\')
                    {
                        // Check if it's a valid escape sequence
                        if (i + 1 < pass1.Length)
                        {
                            char next = pass1[i + 1];
                            if (next == '"' || next == '\\' || next == '/')
                            {
                                sb2.Append(c);
                            }
                            else if (next == 'n')
                            {
                                // Check if \n is followed by a letter (which means it's a path/word like \new)
                                bool isPath = false;
                                if (i + 2 < pass1.Length)
                                {
                                    char afterN = pass1[i + 2];
                                    if (char.IsLetter(afterN))
                                        isPath = true;
                                }

                                if (isPath)
                                {
                                    sb2.Append("\\\\");
                                }
                                else
                                {
                                    sb2.Append(c);
                                }
                            }
                            else if (next == 'u')
                            {
                                // Check if followed by 4 hex digits
                                bool isUnicode = true;
                                for (int h = 0; h < 4; h++)
                                {
                                    if (i + 2 + h >= pass1.Length) { isUnicode = false; break; }
                                    char hc = pass1[i + 2 + h];
                                    if (!((hc >= '0' && hc <= '9') || (hc >= 'a' && hc <= 'f') || (hc >= 'A' && hc <= 'F')))
                                    {
                                        isUnicode = false;
                                        break;
                                    }
                                }

                                if (isUnicode)
                                {
                                    sb2.Append(c);
                                }
                                else
                                {
                                    sb2.Append("\\\\");
                                }
                            }
                            else
                            {
                                // Invalid/raw backslash sequence, escape the backslash
                                sb2.Append("\\\\");
                            }
                        }
                        else
                        {
                            sb2.Append("\\\\");
                        }
                    }
                    else
                    {
                        sb2.Append(c);
                    }
                }
                else
                {
                    // Outside of string: strip trailing comma if next non-whitespace char is } or ]
                    if (c == ',')
                    {
                        bool isTrailing = false;
                        int nextIdx = i + 1;
                        while (nextIdx < pass1.Length)
                        {
                            char nextChar = pass1[nextIdx];
                            if (nextChar == '}' || nextChar == ']')
                            {
                                isTrailing = true;
                                break;
                            }
                            if (!char.IsWhiteSpace(nextChar))
                            {
                                break;
                            }
                            nextIdx++;
                        }
                        if (isTrailing)
                        {
                            continue; // Skip appending the trailing comma
                        }
                    }
                    sb2.Append(c);
                }
            }

            string pass2 = sb2.ToString();
            return RepairTruncatedJson(pass2);
        }

        public static string RepairTruncatedJson(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return "{}";

            json = json.Trim();

            // Try to parse first, if valid return as-is
            try
            {
                using (JsonDocument.Parse(json))
                {
                    return json;
                }
            }
            catch
            {
                // Proceed to repair
            }

            var sb = new StringBuilder(json);
            bool inString = false;
            bool isEscaped = false;
            var stack = new List<char>();

            for (int i = 0; i < sb.Length; i++)
            {
                char c = sb[i];
                if (inString)
                {
                    if (isEscaped)
                    {
                        isEscaped = false;
                    }
                    else if (c == '\\')
                    {
                        isEscaped = true;
                    }
                    else if (c == '"')
                    {
                        inString = false;
                    }
                }
                else
                {
                    if (c == '"')
                    {
                        inString = true;
                    }
                    else if (c == '{')
                    {
                        stack.Add('{');
                    }
                    else if (c == '[')
                    {
                        stack.Add('[');
                    }
                    else if (c == '}')
                    {
                        if (stack.Count > 0 && stack[^1] == '{')
                            stack.RemoveAt(stack.Count - 1);
                    }
                    else if (c == ']')
                    {
                        if (stack.Count > 0 && stack[^1] == '[')
                            stack.RemoveAt(stack.Count - 1);
                    }
                }
            }

            if (inString)
            {
                if (sb.Length > 0 && sb[^1] == '\\')
                {
                    sb.Length--;
                }
                sb.Append('"');
            }

            while (sb.Length > 0)
            {
                char last = sb[^1];
                if (char.IsWhiteSpace(last) || last == ',' || last == ':')
                {
                    sb.Length--;
                }
                else
                {
                    break;
                }
            }

            for (int i = stack.Count - 1; i >= 0; i--)
            {
                char open = stack[i];
                if (open == '{')
                {
                    sb.Append('}');
                }
                else if (open == '[')
                {
                    sb.Append(']');
                }
            }

            string repaired = sb.ToString();

            try
            {
                using (JsonDocument.Parse(repaired))
                {
                    return repaired;
                }
            }
            catch
            {
                // Fallback
            }

            return repaired;
        }
    }
}
