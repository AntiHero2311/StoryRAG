const fs = require('fs');

let content = fs.readFileSync('src/pages/RegisterPage.tsx', 'utf8');

// 1. Imports
content = content.replace(/BookOpen, /g, '');

// 2. Left Panel Icon
content = content.replace(
    /<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500\/20 border border-white\/10">\s*<BookOpen className="w-5 h-5 text-white" \/>\s*<\/div>/g,
    `<div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white shadow-lg shadow-amber-500/20 border border-white/10">
                    <img src="/logo.png" alt="StoryNest Logo" className="w-7 h-7 object-contain" />
                </div>`
);

// 3. Left Panel padding
content = content.replace(/p-14 overflow-hidden/g, 'p-10 overflow-hidden');
content = content.replace(/mb-16/g, 'mb-10');
content = content.replace(/mb-6/g, 'mb-4');

// 4. Mobile Header
content = content.replace(
    /<Link to="\/" className="flex items-center gap-3 mb-12 lg:hidden w-fit group">[\s\S]*?<span className="text-\[var\(--text-primary\)\] font-bold tracking-wide text-lg">StoryNest<\/span>\s*<\/Link>/,
    `<Link to="/" className="flex items-center gap-3 mb-4 lg:hidden w-fit group">
                        <div className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center bg-white shadow-lg shadow-amber-500/20 border border-[var(--border-color)] group-hover:scale-105 transition-transform duration-300">
                            <img src="/logo.png" alt="StoryNest Logo" className="w-6 h-6 object-contain" />
                        </div>
                        <span className="text-[var(--text-primary)] font-bold tracking-wide text-lg">StoryNest</span>
                    </Link>`
);

// 5. Main wrapper
content = content.replace('min-h-screen grid lg:grid-cols-2 bg-[var(--bg-app)]', 'h-screen overflow-hidden grid lg:grid-cols-2 bg-[var(--bg-app)]');

content = content.replace(
    /min-h-screen py-8 lg:py-0 w-full col-span-1 flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto lg:overflow-visible overflow-x-hidden pt-12/,
    'h-full w-full col-span-1 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden pt-4 lg:pt-0'
);

// 6. Spacing tweaks in Right Panel
content = content.replace('className="mb-10 lg:text-center"', 'className="mb-4 lg:text-center"');
content = content.replace('className="space-y-5"', 'className="space-y-3"');
content = content.replace(/py-3\.5/g, 'py-2.5');
content = content.replace(/py-3/g, 'py-2.5');
content = content.replace('mb-4 px-4 py-3.5', 'mb-4 px-4 py-3');
content = content.replace('h-14 mt-6 rounded-2xl', 'h-12 mt-4 rounded-xl');
content = content.replace('h-14 mt-6 rounded-xl', 'h-12 mt-4 rounded-xl');
content = content.replace('h-14 mt-4 rounded-2xl', 'h-12 mt-4 rounded-xl');
content = content.replace('mt-10 text-center relative border-t', 'mt-4 text-center relative border-t');
content = content.replace('pt-8', 'pt-6');

fs.writeFileSync('src/pages/RegisterPage.tsx', content, 'utf8');
console.log('Modified RegisterPage.tsx');
