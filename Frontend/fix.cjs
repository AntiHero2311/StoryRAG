const fs = require('fs');
let text = fs.readFileSync('src/pages/WorkspacePage.tsx', 'utf8');

// 1. Remove handleContinueWriting definition
const handleContinueIndex = text.indexOf('// ── Continue Writing ────────────────────────────────────────────────────');
if (handleContinueIndex !== -1) {
    const endHandleContinueIndex = text.indexOf('finally {\r\n            setIsContinuingWriting(false);\r\n        }\r\n    };\r\n', handleContinueIndex);
    if (endHandleContinueIndex !== -1) {
        text = text.substring(0, handleContinueIndex) + text.substring(endHandleContinueIndex + 'finally {\r\n            setIsContinuingWriting(false);\r\n        }\r\n    };\r\n'.length);
    }
}

// 2. Remove Selection toolbar (polish only) logic
const selectionToolbarIndex = text.indexOf('// ── Selection toolbar (polish only) ────────────────────────────────────');
if (selectionToolbarIndex !== -1) {
    const endSelectionToolbarIndex = text.indexOf('}, [activeChapter, polishPanelOpen]);\r\n', selectionToolbarIndex);
    if (endSelectionToolbarIndex !== -1) {
        text = text.substring(0, selectionToolbarIndex) + text.substring(endSelectionToolbarIndex + '}, [activeChapter, polishPanelOpen]);\r\n'.length);
    }
}

// 3. Remove Floating selection toolbar (Trau chuốt only) UI
const uiSelectionIndex = text.indexOf('{/* ── Floating selection toolbar (Trau chuốt only) ── */}');
if (uiSelectionIndex !== -1) {
    const endUiSelectionIndex = text.indexOf('Viết lại\r\n                        </button>\r\n                </div>\r\n            )}\r\n', uiSelectionIndex);
    if (endUiSelectionIndex !== -1) {
        text = text.substring(0, uiSelectionIndex) + text.substring(endUiSelectionIndex + 'Viết lại\r\n                        </button>\r\n                </div>\r\n            )}\r\n'.length);
    }
}

// 4. Remove Polish Panel UI
const uiRewriteIndex = text.indexOf('{/* ── Polish Panel ── */}');
if (uiRewriteIndex !== -1) {
    const endUiRewriteIndex = text.indexOf('setPolishPanelOpen(false);\r\n                    }}\r\n                />\r\n            )}\r\n', uiRewriteIndex);
    if (endUiRewriteIndex !== -1) {
        text = text.substring(0, uiRewriteIndex) + text.substring(endUiRewriteIndex + 'setPolishPanelOpen(false);\r\n                    }}\r\n                />\r\n            )}\r\n'.length);
    }
}

// 5. Remove Embed button
const embedBtnIndex = text.indexOf('<button\r\n                                onClick={doForceEmbedNow}');
if (embedBtnIndex !== -1) {
    const endEmbedBtnIndex = text.indexOf('Embed ngay\r\n                            </button>\r\n', embedBtnIndex);
    if (endEmbedBtnIndex !== -1) {
        text = text.substring(0, embedBtnIndex) + text.substring(endEmbedBtnIndex + 'Embed ngay\r\n                            </button>\r\n'.length);
    }
}

// 6. Remove aiWriter tab
const aiWriterTabIndex = text.indexOf('{ tab: \'aiWriter\' as ActiveTab, label: \'AI Writer\'');
if (aiWriterTabIndex !== -1) {
    const endAiWriterTabIndex = text.indexOf('},\r\n', aiWriterTabIndex);
    if (endAiWriterTabIndex !== -1) {
        text = text.substring(0, aiWriterTabIndex) + text.substring(endAiWriterTabIndex + '},\r\n'.length);
    }
}

// 7. Remove onScroll from editorScrollRef
const onScrollRegex = /className=\"flex-1 overflow-y-auto flex justify-center p-6 lg:p-12 scrollbar-thin\"\r?\n\s*onScroll=\{\(e\) => \{\r?\n\s*const scrolled = \(e\.currentTarget as HTMLDivElement\)\.scrollTop > 200;\r?\n\s*setShowFloatingAiBtn\(scrolled\);\r?\n\s*\}\}/;
text = text.replace(onScrollRegex, 'className=\"flex-1 overflow-y-auto flex justify-center p-6 lg:p-12 scrollbar-thin\"');

// 8. Remove AI Viết tiếp button in meta bar
const metaBtnIndex = text.indexOf('<button\r\n                                                    onClick={() => handleContinueWriting(\'normal\')}');
if (metaBtnIndex !== -1) {
    const endMetaBtnIndex = text.indexOf('AI Viết tiếp\r\n                                                </button>\r\n', metaBtnIndex);
    if (endMetaBtnIndex !== -1) {
        text = text.substring(0, metaBtnIndex) + text.substring(endMetaBtnIndex + 'AI Viết tiếp\r\n                                                </button>\r\n'.length);
    }
}

// 9. Remove AiWriterPanel Tab
const aiWriterUIIndex = text.indexOf('{/* ── AI Writer Tab ── */}');
if (aiWriterUIIndex !== -1) {
    const endAiWriterUIIndex = text.indexOf('markEditorDirty();\r\n                                    }\r\n                                }}\r\n                            />\r\n                        )}\r\n', aiWriterUIIndex);
    if (endAiWriterUIIndex !== -1) {
        text = text.substring(0, aiWriterUIIndex) + text.substring(endAiWriterUIIndex + 'markEditorDirty();\r\n                                    }\r\n                                }}\r\n                            />\r\n                        )}\r\n'.length);
    }
}

fs.writeFileSync('src/pages/WorkspacePage.tsx', text);
console.log('Script ran successfully!');
