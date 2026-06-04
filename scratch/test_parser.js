const raw = [
    `"insights" : [`,
    `" Tác phẩm sở hữu một nhịp điệu kể chuyện biến hóa linh hoạt, duy trì ở mức độ trung bình..."`
];

const result = [];
raw.forEach(rawInsight => {
    let insight = rawInsight.trim();

    // 1. Normalize quotes to straight quotes for parsing and stripping
    insight = insight
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

    // 2. Filter out obvious JSON structure lines
    const lowerInsight = insight.toLowerCase().trim();
    const hasNoLettersOrDigits = !/[a-zA-Z0-9\u00C0-\u1EF9]/.test(insight);
    const isJsonBoilerplate = 
        hasNoLettersOrDigits ||
        lowerInsight === '{' || 
        lowerInsight === '}' || 
        lowerInsight === '[' || 
        lowerInsight === ']' || 
        lowerInsight === '],' || 
        lowerInsight === '},' ||
        lowerInsight === ',' ||
        lowerInsight.includes('"insights"') ||
        lowerInsight.includes('insights:') ||
        lowerInsight.includes('insights" :') ||
        /^\s*["']?insights["']?\s*:/i.test(insight) ||
        /^\s*["']?insights["']?\s*:\s*\[/i.test(insight) ||
        lowerInsight === '"insights"' ||
        lowerInsight === 'insights';

    console.log(`Input: ${rawInsight}`);
    console.log(`isJsonBoilerplate: ${isJsonBoilerplate}`);
    console.log(`hasNoLettersOrDigits: ${hasNoLettersOrDigits}`);
    console.log(`Regex 1: ${/^\s*["']?insights["']?\s*:/i.test(insight)}`);
    console.log(`Regex 2: ${/^\s*["']?insights["']?\s*:\s*\[/i.test(insight)}`);

    if (isJsonBoilerplate || !insight) return;

    // 3. Strip leading/trailing double/single quotes, commas, brackets, braces, and formatting spaces
    insight = insight.replace(/^["'\s,\[\]\{\}“”«»]+|["'\s,\[\]\{\}“”«»]+$/g, '').trim();
    console.log(`Cleaned: ${insight}`);
});
