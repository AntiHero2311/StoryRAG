import re

with open('src/pages/RegisterPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = re.sub(r'BookOpen, ', '', content)

# 2. Left Panel Icon
content = re.sub(
    r'<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-white/10">\s*<BookOpen className="w-5 h-5 text-white" />\s*</div>',
    '<div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white shadow-lg shadow-amber-500/20 border border-white/10">\\n                    <img src="/logo.png" alt="StoryNest Logo" className="w-7 h-7 object-contain" />\\n                </div>',
    content
)

# 3. Left Panel padding
content = content.replace('p-14 overflow-hidden', 'p-10 overflow-hidden')
content = content.replace('mb-16', 'mb-10')
content = content.replace('mb-6', 'mb-4')

# 4. Mobile Header
content = re.sub(
    r'<Link to="/" className="flex items-center gap-3 mb-12 lg:hidden w-fit group">\s*<div className="w-9 h-9 rounded-xl.*?bg-gradient-to-br.*?>\s*<BookOpen className="w-4 h-4 text-white" />\s*</div>\s*<span className="text-\[var\(--text-primary\)\] font-bold tracking-wide text-lg">StoryNest</span>\s*</Link>',
    '<Link to="/" className="flex items-center gap-3 mb-4 lg:hidden w-fit group">\\n                        <div className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center bg-white shadow-lg shadow-amber-500/20 border border-[var(--border-color)] group-hover:scale-105 transition-transform duration-300">\\n                            <img src="/logo.png" alt="StoryNest Logo" className="w-6 h-6 object-contain" />\\n                        </div>\\n                        <span className="text-[var(--text-primary)] font-bold tracking-wide text-lg">StoryNest</span>\\n                    </Link>',
    content,
    flags=re.DOTALL
)

# 5. Main wrapper
content = content.replace('min-h-screen grid lg:grid-cols-2 bg-[var(--bg-app)]', 'h-screen overflow-hidden grid lg:grid-cols-2 bg-[var(--bg-app)]')

content = re.sub(
    r'min-h-screen py-8 lg:py-0 w-full col-span-1 flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto lg:overflow-visible overflow-x-hidden pt-12',
    'h-full w-full col-span-1 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden pt-4 lg:pt-0',
    content
)


# 6. Spacing tweaks in Right Panel
content = content.replace('className="mb-10 lg:text-center"', 'className="mb-4 lg:text-center"')
content = content.replace('className="space-y-5"', 'className="space-y-3"')
content = content.replace('py-3.5', 'py-2.5')
content = content.replace('py-3', 'py-2.5')
content = content.replace('mb-4 px-4 py-3.5', 'mb-4 px-4 py-3')
content = content.replace('h-14 mt-6 rounded-2xl', 'h-12 mt-4 rounded-xl')
content = content.replace('h-14 mt-6 rounded-xl', 'h-12 mt-4 rounded-xl')
content = content.replace('h-14 mt-4 rounded-2xl', 'h-12 mt-4 rounded-xl')
content = content.replace('mt-10 text-center relative border-t', 'mt-4 text-center relative border-t')
content = content.replace('pt-8', 'pt-6')

with open('src/pages/RegisterPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Modified RegisterPage.tsx')
