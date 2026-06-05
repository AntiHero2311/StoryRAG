import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Loader2, AlertTriangle, CheckCircle2, ThumbsUp, ThumbsDown } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { feedbackService, type StaffFeedbackResponse } from '../services/feedbackService';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FeedbackPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<StaffFeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const unreadCount = useMemo(() => items.filter(x => !x.readAt).length, [items]);

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await feedbackService.getMy();
        if (disposed) return;
        setItems(data);
      } catch {
        if (disposed) return;
        setError('Không thể tải feedback. Vui lòng thử lại.');
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    void load();
    return () => {
      disposed = true;
    };
  }, []);

  return (
    <MainLayout pageTitle="Feedback từ Staff">
      {() => (
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          <div
            className="rounded-3xl p-5 flex items-center justify-between"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
                <MessageSquare className="w-5 h-5" style={{ color: 'var(--accent-text)' }} />
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-bright)' }}>
                Hộp thư phản hồi
                {unreadCount > 0 && (
                  <span className="ml-2 text-xs font-semibold text-amber-300">({unreadCount} chưa đọc)</span>
                )}
              </p>
            </div>
            {unreadCount === 0 && (
              <div className="hidden sm:flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl"
                style={{ color: '#34d399', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <CheckCircle2 className="w-4 h-4" />
                Đã cập nhật
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-text)' }} />
            </div>
          ) : items.length === 0 ? (
            <div
              className="text-center py-16 rounded-3xl"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
            >
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Chưa có feedback</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Khi staff gửi phản hồi, bạn sẽ thấy ở đây.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(fb => {
                const unread = !fb.readAt;
                return (
                  <button
                    key={fb.id}
                    onClick={() => navigate(`/feedback/${fb.id}`)}
                    className="w-full text-left rounded-3xl p-5 transition-all duration-150 hover:-translate-y-0.5"
                    style={{
                      background: 'var(--bg-surface)',
                      border: unread ? '1px solid rgba(239,68,68,0.35)' : '1px solid var(--border-color)',
                      boxShadow: unread ? '0 0 0 4px rgba(239,68,68,0.06)' : undefined,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: unread ? '#ef4444' : 'rgba(148,163,184,0.35)' }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-bright)' }}>
                              {fb.staffName || 'Staff'} · {fb.status}
                            </p>
                            {fb.staffGenres && fb.staffGenres.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {fb.staffGenres.slice(0, 3).map(g => (
                                  <span
                                    key={g.id}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold"
                                    style={{
                                      backgroundColor: `${g.color}15`,
                                      color: g.color,
                                      border: `1px solid ${g.color}30`
                                    }}
                                  >
                                    {g.name}
                                  </span>
                                ))}
                                {fb.staffGenres.length > 3 && (
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-help"
                                    title={fb.staffGenres.slice(3).map(g => g.name).join(', ')}
                                  >
                                    +{fb.staffGenres.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <p className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>{fmtDate(fb.createdAt)}</p>
                        </div>
                        {fb.projectReportId && (
                          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                            Phản hồi từ report phân tích
                          </p>
                        )}
                        <p className="text-sm mt-2 whitespace-pre-wrap line-clamp-3" style={{ color: 'var(--text-primary)' }}>
                          {fb.content}
                        </p>
                        {fb.staffNote && (
                          <p className="text-xs mt-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                            Ghi chú: {fb.staffNote}
                          </p>
                        )}
                        {(fb.userReaction || fb.userFeedback) && (
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-semibold"
                              style={fb.userReaction === 'Like'
                                ? { background: 'rgba(34,197,94,0.12)', color: '#86efac' }
                                : { background: 'rgba(239,68,68,0.12)', color: '#fca5a5' }}
                            >
                              {fb.userReaction === 'Like' ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                              {fb.userReaction === 'Like' ? 'Đã thích' : 'Đã không thích'}
                            </span>
                            {fb.userFeedback && (
                              <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                                {fb.userFeedback}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}
