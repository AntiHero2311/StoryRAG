import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertTriangle, MessageSquare, CheckCircle2, ThumbsUp, ThumbsDown } from 'lucide-react';
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

export default function FeedbackDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<StaffFeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reaction, setReaction] = useState<'Like' | 'Dislike'>('Like');
  const [reply, setReply] = useState('');

  const isRead = useMemo(() => Boolean(item?.readAt), [item?.readAt]);

  useEffect(() => {
    if (!id) {
      setError('Thiếu id feedback.');
      setLoading(false);
      return;
    }

    let disposed = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch list to get details (since backend only exposes list + mark-read in scope)
        const list = await feedbackService.getMy();
        const found = list.find(x => x.id === id) ?? null;
        if (disposed) return;
        if (!found) {
          setError('Không tìm thấy feedback.');
          setLoading(false);
          return;
        }
        setItem(found);
        setReaction(found.userReaction === 'Dislike' ? 'Dislike' : 'Like');
        setReply(found.userFeedback ?? '');

        // Mark read idempotent
        if (!found.readAt) {
          const updated = await feedbackService.markRead(id);
          if (!disposed) setItem(updated);
        }
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
  }, [id]);

  const handleSubmit = async () => {
    if (!id || saving) return;
    setSaving(true);
    setError('');
    try {
      const updated = await feedbackService.respond(id, {
        reaction,
        content: reply.trim() || undefined,
      });
      setItem(updated);
      setReaction(updated.userReaction === 'Dislike' ? 'Dislike' : 'Like');
      setReply(updated.userFeedback ?? '');
    } catch {
      setError('Không thể gửi phản hồi. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout pageTitle="Chi tiết feedback">
      {() => (
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/feedback')}
              className="h-10 px-3 rounded-xl flex items-center gap-2 text-sm font-semibold transition-colors"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại
            </button>
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
          ) : item ? (
            <div
              className="rounded-3xl p-6 space-y-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
                    <MessageSquare className="w-5 h-5" style={{ color: 'var(--accent-text)' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--text-bright)' }}>
                      {item.staffName || 'Staff'} · {item.status}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDate(item.createdAt)}
                    </p>
                    {item.projectReportId && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        Gắn với report phân tích
                      </p>
                    )}
                  </div>
                </div>

                {isRead && (
                  <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl"
                    style={{ color: '#34d399', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <CheckCircle2 className="w-4 h-4" />
                    Đã đọc
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Nội dung
                </p>
                <div className="rounded-2xl px-4 py-3 whitespace-pre-wrap text-sm leading-relaxed"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                  {item.content}
                </div>
              </div>

              {item.staffNote && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Ghi chú của staff
                  </p>
                  <div className="rounded-2xl px-4 py-3 whitespace-pre-wrap text-sm leading-relaxed"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--text-primary)' }}>
                    {item.staffNote}
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                  Phản hồi của bạn
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setReaction('Like')}
                    className="h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
                    style={reaction === 'Like'
                      ? { background: 'rgba(34,197,94,0.12)', color: '#86efac', border: '1px solid rgba(34,197,94,0.28)' }
                      : { background: 'var(--input-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Thích
                  </button>
                  <button
                    type="button"
                    onClick={() => setReaction('Dislike')}
                    className="h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
                    style={reaction === 'Dislike'
                      ? { background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.28)' }
                      : { background: 'var(--input-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Không thích
                  </button>
                </div>
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  rows={5}
                  placeholder="Gửi thêm góp ý cho staff..."
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {item.userRespondedAt ? `Đã phản hồi lúc ${fmtDate(item.userRespondedAt)}` : 'Bạn có thể gửi một phản hồi kèm đánh giá.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                    className="h-10 px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}
                  >
                    {saving ? 'Đang gửi...' : 'Gửi phản hồi'}
                  </button>
                </div>
              </div>

              <div className="pt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Trạng thái đọc: {item.readAt ? `Đã đọc lúc ${fmtDate(item.readAt)}` : 'Chưa đọc'}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </MainLayout>
  );
}
