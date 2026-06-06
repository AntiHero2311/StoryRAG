const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tiêu đề đọc được — không phải UUID hay chuỗi mã hóa/base64 dài. */
export function isReadableProjectTitle(title?: string | null): boolean {
    if (!title?.trim()) return false;
    const t = title.trim();
    if (UUID_RE.test(t)) return false;
    if (t.length > 48 && !/\s/.test(t) && /^[A-Za-z0-9+/=_-]+$/.test(t)) return false;
    return true;
}

type ProjectLabelOpts = {
    reportId?: string | null;
    projectId?: string | null;
    authorName?: string | null;
    fallback?: string;
};

/** Nhãn dự án/báo cáo thân thiện — không hiển thị UUID hay mã nội bộ. */
export function getProjectDisplayLabel(title?: string | null, opts?: ProjectLabelOpts): string {
    if (isReadableProjectTitle(title)) return title!.trim();

    const author = opts?.authorName?.trim();
    if (opts?.reportId) {
        return author ? `Báo cáo phân tích · ${author}` : 'Báo cáo phân tích';
    }
    if (opts?.projectId) {
        return author ? `Dự án của ${author}` : (opts.fallback ?? 'Dự án không tên');
    }
    return opts?.fallback ?? 'Dự án không tên';
}

type FeedbackLabelItem = {
    projectTitle?: string | null;
    projectReportId?: string | null;
    projectId?: string;
    authorName?: string;
};

export function getFeedbackContextLabel(item: FeedbackLabelItem): string | null {
    if (isReadableProjectTitle(item.projectTitle)) return item.projectTitle!.trim();
    if (item.projectReportId) return 'Phản hồi về báo cáo phân tích';
    if (item.projectId) return 'Phản hồi về dự án';
    return null;
}

/** Chưa có phản hồi → ai cũng reply được; đã có → chỉ người đã reply mới sửa. */
export function canEditStaffReply(
    item: { staffId?: string; staffNote?: string | null },
    currentUserId?: string | null,
): boolean {
    if (!item.staffNote?.trim()) return true;
    if (!currentUserId) return false;
    return item.staffId === currentUserId;
}

export function isStaffReplyViewOnly(
    item: { staffId?: string; staffNote?: string | null },
    currentUserId?: string | null,
): boolean {
    return !!item.staffNote?.trim() && !canEditStaffReply(item, currentUserId);
}

/** Tên bộ truyện hiển thị cho staff — không dùng ID. */
export function getStoryLabel(title?: string | null, authorName?: string | null): string {
    if (isReadableProjectTitle(title)) return title!.trim();
    if (authorName?.trim()) return `Bộ truyện của ${authorName.trim()}`;
    return 'Bộ truyện không tên';
}

type StoryTitleSource = {
    projectTitle?: string | null;
    projectId?: string;
    authorName?: string | null;
    reportId?: string | null;
};

/** Ưu tiên tên truyện đọc được từ job, báo cáo, hoặc map dự án. */
export function resolveStoryTitle(
    source: StoryTitleSource,
    titleByProject: Map<string, string>,
    titleByReport: Map<string, string>,
): string {
    if (isReadableProjectTitle(source.projectTitle)) return source.projectTitle!.trim();

    if (source.reportId) {
        const fromReport = titleByReport.get(source.reportId);
        if (isReadableProjectTitle(fromReport)) return fromReport!.trim();
    }

    if (source.projectId) {
        const fromProject = titleByProject.get(source.projectId);
        if (isReadableProjectTitle(fromProject)) return fromProject!.trim();
    }

    return getStoryLabel(source.projectTitle, source.authorName);
}
