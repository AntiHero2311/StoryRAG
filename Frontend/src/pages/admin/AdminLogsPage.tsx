import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { adminService, type SystemLogsPage, type SystemLogItem } from '../../services/adminService';
import { AdminPageShell } from '../../components/admin/AdminShared';

const CATEGORIES = ['', 'User', 'Config', 'Payment', 'Auth'];
const LEVELS = ['', 'Info', 'Warning', 'Error'];

const CATEGORY_MAP: Record<string, string> = {
    'User': 'Người dùng',
    'Config': 'Cấu hình',
    'Payment': 'Thanh toán',
    'Auth': 'Xác thực'
};

const LEVEL_MAP: Record<string, string> = {
    'Info': 'Thông tin',
    'Warning': 'Cảnh báo',
    'Error': 'Lỗi'
};

const ACTION_MAP: Record<string, string> = {
    'Create': 'Tạo mới',
    'Update': 'Cập nhật',
    'Delete': 'Xóa',
    'Deactivate': 'Khóa',
    'Activate': 'Mở khóa',
    'Limits': 'Giới hạn hệ thống',
    'Register': 'Đăng ký',
    'Login': 'Đăng nhập',
    'OTP': 'Gửi OTP',
    'AssignGenres': 'Gán chuyên môn'
};

const KEY_LABELS: Record<string, string> = {
    // User fields
    'FullName': 'Họ tên',
    'Email': 'Email',
    'Role': 'Vai trò',
    'IsActive': 'Trạng thái hoạt động',

    // RAG Config keys
    'rag.chunk_size': 'Kích thước đoạn (Chunk Size)',
    'rag.chunk_overlap': 'Độ trùng lặp (Chunk Overlap)',
    'rag.top_k_chat': 'Top K tin nhắn (Top K Chat)',
    'rag.top_k_report': 'Top K báo cáo (Top K Report)',
    'rag.splitter': 'Bộ cắt đoạn văn bản (Splitter)',
    'rag.stage1_batch_chunks': 'Kích thước lô đoạn Stage 1',
    'rag.stage1_max_chunk_chars': 'Độ dài tối đa đoạn Stage 1',
    'rag.facts_json_max_chars': 'Giới hạn ký tự JSON thông tin',
    'rag.bible_max_chars': 'Giới hạn ký tự Story Bible',
    'rag.estimated_tokens_per_query_embed': 'Token ước lượng/Embedding truy vấn',
    'rag.rubric_batch_size': 'Kích thước lô Rubric',
    'gemini.analyze_rpm_limit': 'Giới hạn RPM phân tích Gemini',

    // System Limits keys
    'MaxUploadMb': 'Dung lượng tải lên tối đa (MB)',
    'MaxProjectsPerAuthor': 'Số dự án tối đa/Tác giả',
    'MaintenanceMode': 'Chế độ bảo trì hệ thống',
    'SmtpHost': 'SMTP Host',
    'SmtpPort': 'SMTP Port',
    'SmtpUsername': 'SMTP Username',
    'SmtpFromName': 'Tên người gửi Email',
    'SmtpFromAddress': 'Địa chỉ người gửi Email',
    'VnPayPaymentUrl': 'VNPay Payment URL',
    'VnPayTmnCode': 'VNPay TmnCode',
    'VnPayReturnUrl': 'VNPay Return URL'
};

const formatValue = (key: string, val: any) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') {
        if (key === 'MaintenanceMode') return val ? 'Bật bảo trì' : 'Bình thường';
        if (key === 'IsActive') return val ? 'Đang hoạt động' : 'Đã khóa';
        return val ? 'Bật' : 'Tắt';
    }
    return String(val);
};

export default function AdminLogsPage() {
    const navigate = useNavigate();
    const [data, setData] = useState<SystemLogsPage | null>(null);
    const [page, setPage] = useState(1);
    const [category, setCategory] = useState('');
    const [level, setLevel] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<SystemLogItem | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            setData(await adminService.getLogs(page, 30, category || undefined, level || undefined));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem('token')) { navigate('/login'); return; }
        void load();
    }, [navigate, page, category, level]);

    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

    return (
        <MainLayout pageTitle="Nhật ký">
            {() => (
                <AdminPageShell
                    title="Nhật ký hệ thống"
                    action={
                        <button type="button" onClick={() => void load()} className="p-2 rounded-xl border border-[var(--border-color)]">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    }
                >
                    {data?.storageReady === false && (
                        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                            Bảng nhật ký chưa sẵn sàng trên database. Chạy migration hoặc script{' '}
                            <code className="text-xs">Backend/Scripts/add_system_logs.sql</code>, sau đó thử lại.
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
                            className="rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm">
                            <option value="">Tất cả danh mục</option>
                            {CATEGORIES.filter(Boolean).map(c => <option key={c} value={c}>{CATEGORY_MAP[c] || c}</option>)}
                        </select>
                        <select value={level} onChange={e => { setLevel(e.target.value); setPage(1); }}
                            className="rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm">
                            <option value="">Tất cả mức độ</option>
                            {LEVELS.filter(Boolean).map(l => <option key={l} value={l}>{LEVEL_MAP[l] || l}</option>)}
                        </select>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
                    ) : (
                        <div className="rounded-2xl border border-[var(--border-color)] overflow-hidden bg-[var(--bg-surface)]">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--border-color)] text-xs uppercase text-[var(--text-secondary)]">
                                        <th className="text-left px-4 py-3">Thời gian</th>
                                        <th className="text-left px-4 py-3">Mức</th>
                                        <th className="text-left px-4 py-3">Danh mục</th>
                                        <th className="text-left px-4 py-3">Hành động</th>
                                        <th className="text-left px-4 py-3">Nội dung</th>
                                        <th className="text-left px-4 py-3">Người thực hiện</th>
                                        <th className="text-left px-4 py-3">Chi tiết</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    {(data?.items ?? []).map(log => (
                                        <tr key={log.id} className="hover:bg-[var(--text-primary)]/5">
                                            <td className="px-4 py-2 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                                                {new Date(log.createdAt).toLocaleString('vi-VN')}
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className={`text-xs font-semibold ${log.level === 'Error' ? 'text-rose-400' : log.level === 'Warning' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                    {LEVEL_MAP[log.level] || log.level}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-xs">{CATEGORY_MAP[log.category] || log.category}</td>
                                            <td className="px-4 py-2 text-xs">{ACTION_MAP[log.action] || log.action}</td>
                                            <td className="px-4 py-2 max-w-md truncate" title={log.message}>{log.message}</td>
                                            <td className="px-4 py-2 text-xs text-[var(--text-secondary)]">{log.actorName ?? '—'}</td>
                                            <td className="px-4 py-2">
                                                {log.metadataJson ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedLog(log)}
                                                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold hover:underline"
                                                    >
                                                        Xem chi tiết
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-[var(--text-secondary)]">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {data?.items.length === 0 && (
                                        <tr><td colSpan={7} className="px-4 py-12 text-center text-[var(--text-secondary)]">Chưa có nhật ký.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {data && data.total > data.pageSize && (
                        <div className="flex items-center justify-center gap-3">
                            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-lg border border-[var(--border-color)] text-sm disabled:opacity-40">Trước</button>
                            <span className="text-sm text-[var(--text-secondary)]">{page} / {totalPages}</span>
                            <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg border border-[var(--border-color)] text-sm disabled:opacity-40">Sau</button>
                        </div>
                    )}

                    {selectedLog && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <div className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                                {/* Header */}
                                <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">Chi tiết thay đổi nhật ký</h3>
                                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                            {CATEGORY_MAP[selectedLog.category] || selectedLog.category} &bull; {ACTION_MAP[selectedLog.action] || selectedLog.action}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedLog(null)}
                                        className="p-1 rounded-lg hover:bg-[var(--text-primary)]/10 text-[var(--text-secondary)] hover:text-white"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                
                                {/* Content */}
                                <div className="p-6 overflow-y-auto space-y-4">
                                    {/* Meta info info card */}
                                    <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[var(--text-primary)]/5 border border-[var(--border-color)] text-xs">
                                        <div>
                                            <span className="text-[var(--text-secondary)] block">Thời gian</span>
                                            <span className="font-medium text-white">{new Date(selectedLog.createdAt).toLocaleString('vi-VN')}</span>
                                        </div>
                                        <div>
                                            <span className="text-[var(--text-secondary)] block">Người thực hiện</span>
                                            <span className="font-medium text-white">{selectedLog.actorName ?? '—'}</span>
                                        </div>
                                    </div>

                                    {/* Diffs Table */}
                                    <div>
                                        <h4 className="text-sm font-medium mb-2 text-white">So sánh thay đổi</h4>
                                        {(() => {
                                            let parsed: { old?: Record<string, any>; new?: Record<string, any> } = {};
                                            try {
                                                if (selectedLog.metadataJson) {
                                                    parsed = JSON.parse(selectedLog.metadataJson);
                                                }
                                            } catch (e) {
                                                return <p className="text-xs text-rose-400">Không thể giải mã dữ liệu metadata json.</p>;
                                            }

                                            const oldObj = parsed.old || {};
                                            const newObj = parsed.new || {};
                                            const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

                                            if (keys.length === 0) {
                                                return <p className="text-xs text-[var(--text-secondary)] italic">Không tìm thấy thông tin cấu hình thay đổi chi tiết.</p>;
                                            }

                                            return (
                                                <div className="rounded-xl border border-[var(--border-color)] overflow-hidden bg-[var(--bg-surface)]">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="border-b border-[var(--border-color)] bg-[var(--text-primary)]/5 text-[var(--text-secondary)] font-medium">
                                                                <th className="text-left px-4 py-2.5">Trường thông tin / Cấu hình</th>
                                                                <th className="text-left px-4 py-2.5">Giá trị cũ</th>
                                                                <th className="text-left px-4 py-2.5">Giá trị mới</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-[var(--border-color)]">
                                                            {keys.map(key => {
                                                                const oldVal = oldObj[key];
                                                                const newVal = newObj[key];
                                                                const isChanged = oldVal !== newVal;
                                                                return (
                                                                    <tr key={key} className={isChanged ? "bg-indigo-500/5" : ""}>
                                                                        <td className="px-4 py-2.5 font-medium text-white">
                                                                            {KEY_LABELS[key] || key}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-[var(--text-secondary)] break-all max-w-[200px]">
                                                                            {formatValue(key, oldVal)}
                                                                        </td>
                                                                        <td className={`px-4 py-2.5 break-all max-w-[200px] ${isChanged ? "text-emerald-400 font-semibold" : "text-white"}`}>
                                                                            {formatValue(key, newVal)}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-6 py-4 border-t border-[var(--border-color)] flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedLog(null)}
                                        className="px-4 py-2 rounded-xl bg-[var(--text-primary)]/10 hover:bg-[var(--text-primary)]/20 text-sm font-medium transition text-white"
                                    >
                                        Đóng
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </AdminPageShell>
            )}
        </MainLayout>
    );
}
