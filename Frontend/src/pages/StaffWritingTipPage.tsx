import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Trash2,
  Save,
  X,
  Search,
  ChevronDown,
  Sparkles,
  Tag,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { getUserInfo } from '../utils/jwtHelper';
import { writingTipService, type WritingTip, type WritingTipUpsertRequest } from '../services/writingTipService';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'var(--bg-modal)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-3xl)',
          boxShadow: 'var(--shadow-2xl)',
        }}
      >
        <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(168,85,247,0.12)' }}>
            <Sparkles className="w-4 h-4" style={{ color: '#c4b5fd' }} />
          </div>
          <div className="min-w-0">
            <p className="text-[var(--text-primary)] font-bold text-base truncate">{title}</p>
            <p className="text-[var(--text-secondary)] text-xs">Quản lý Writing Tips hiển thị công khai</p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function PublishToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="h-9 px-3 rounded-xl text-sm font-semibold transition-colors"
      style={{
        background: value ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.10)',
        border: value ? '1px solid rgba(16,185,129,0.30)' : '1px solid var(--border-color)',
        color: value ? '#34d399' : 'var(--text-secondary)',
      }}
      title="Toggle publish"
    >
      {value ? 'Published' : 'Draft'}
    </button>
  );
}

function parseTags(raw: string): string[] {
  const parts = raw
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export default function StaffWritingTipPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<WritingTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'published' | 'draft'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WritingTip | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<WritingTipUpsertRequest>({
    title: '',
    content: '',
    tags: [],
    published: false,
  });
  const [formTags, setFormTags] = useState('');

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', content: '', tags: [], published: false });
    setFormTags('');
    setModalOpen(true);
  };

  const openEdit = (tip: WritingTip) => {
    setEditing(tip);
    setForm({ title: tip.title, content: tip.content, tags: tip.tags ?? [], published: tip.published });
    setFormTags((tip.tags ?? []).join(', '));
    setModalOpen(true);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const published =
        publishedFilter === 'all'
          ? undefined
          : publishedFilter === 'published';
      const tag = tagFilter === 'all' ? undefined : tagFilter;

      const data = await writingTipService.getAll({ tag, published });
      setItems(data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.message ??
        (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.Message ??
        'Không thể tải Writing Tips.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [publishedFilter, tagFilter]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const info = getUserInfo(token);
    if (info.role !== 'Staff' && info.role !== 'Admin') {
      navigate('/home');
      return;
    }
    void load();
  }, [load, navigate]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      for (const t of it.tags ?? []) {
        if (t?.trim()) set.add(t.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(x =>
      x.title.toLowerCase().includes(q) ||
      x.content.toLowerCase().includes(q) ||
      (x.tags ?? []).some(t => t.toLowerCase().includes(q))
    );
  }, [items, search]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title và Content là bắt buộc.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const tags = parseTags(formTags);
      const payload: WritingTipUpsertRequest = {
        ...form,
        title: form.title.trim(),
        content: form.content.trim(),
        tags,
      };

      if (editing) {
        const updated = await writingTipService.update(editing.id, payload);
        setItems(prev => prev.map(x => (x.id === updated.id ? updated : x)));
      } else {
        const created = await writingTipService.create(payload);
        setItems(prev => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.message ??
        (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.Message ??
        'Lưu thất bại.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tip: WritingTip) => {
    if (!confirm(`Xoá writing tip: "${tip.title}"?`)) return;
    setError('');
    try {
      await writingTipService.delete(tip.id);
      setItems(prev => prev.filter(x => x.id !== tip.id));
    } catch {
      setError('Xoá thất bại.');
    }
  };

  const handleTogglePublish = async (tip: WritingTip) => {
    setError('');
    try {
      const updated = await writingTipService.togglePublish(tip.id, !tip.published);
      setItems(prev => prev.map(x => (x.id === updated.id ? updated : x)));
    } catch {
      setError('Cập nhật publish thất bại.');
    }
  };

  const body = (
        <div className={embedded ? 'w-full space-y-5' : 'p-6 max-w-6xl mx-auto w-full space-y-5'}>
          <div className="rounded-3xl p-5 flex items-center justify-between" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.12)' }}>
                <Sparkles className="w-5 h-5" style={{ color: '#c4b5fd' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-bright)' }}>Writing Tips Manager</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  CRUD + publish toggle · Public endpoint filter theo tag
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void load()}
                className="h-10 px-3 rounded-xl flex items-center gap-2 text-sm font-semibold transition-colors"
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
              <button
                onClick={openCreate}
                className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-semibold text-white transition-all hover:opacity-95"
                style={{ background: 'linear-gradient(135deg,#a855f7,#6366f1)' }}
              >
                <Plus className="w-4 h-4" />
                Tạo Tip
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm theo title/content/tag..."
                className="w-full pl-9 pr-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div className="relative">
              <select
                value={tagFilter}
                onChange={e => setTagFilter(e.target.value)}
                className="appearance-none pl-3 pr-9 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="all">Tất cả tags</option>
                {allTags.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={publishedFilter}
                onChange={e => setPublishedFilter(e.target.value as any)}
                className="appearance-none pl-3 pr-9 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="all">All</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-text)' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 rounded-3xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Không có Writing Tip nào</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Tạo item mới để hiển thị cho user.</p>
            </div>
          ) : (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      {['Title', 'Tags', 'Publish', 'Updated', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {filtered
                      .slice()
                      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                      .map(tip => (
                        <tr key={tip.id} className="hover:bg-[var(--text-primary)]/3 transition-colors">
                          <td className="px-4 py-3 max-w-[520px]">
                            <button onClick={() => openEdit(tip)} className="text-left w-full">
                              <p className="text-[var(--text-primary)] text-sm font-semibold line-clamp-2">{tip.title}</p>
                              <p className="text-[var(--text-secondary)] text-xs mt-1 line-clamp-2">{tip.content}</p>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            {(tip.tags ?? []).length === 0 ? (
                              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {(tip.tags ?? []).slice(0, 4).map(tag => (
                                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold"
                                    style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.22)', color: 'var(--accent-text)' }}>
                                    <Tag className="w-3 h-3" />
                                    {tag}
                                  </span>
                                ))}
                                {(tip.tags ?? []).length > 4 && (
                                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    +{(tip.tags ?? []).length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <PublishToggle value={tip.published} onChange={() => void handleTogglePublish(tip)} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {fmtDate(tip.updatedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => void handleDelete(tip)}
                              className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Xoá"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {modalOpen && (
            <Modal title={editing ? 'Sửa Writing Tip' : 'Tạo Writing Tip'} onClose={() => setModalOpen(false)}>
              <div className="space-y-4">
                <div>
                  <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">Title *</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="Tiêu đề..."
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">Tags (comma-separated)</label>
                  <input
                    value={formTags}
                    onChange={e => setFormTags(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="plot, character, pacing..."
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">Content *</label>
                  <textarea
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    rows={8}
                    className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                    placeholder="Nội dung..."
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Publish</span>
                    <PublishToggle value={form.published} onChange={v => setForm(f => ({ ...f, published: v }))} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setModalOpen(false)}
                      className="h-10 px-4 rounded-xl text-sm font-semibold transition-colors"
                      style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                      disabled={saving}
                    >
                      Hủy
                    </button>
                    <button
                      onClick={() => void handleSave()}
                      className="h-10 px-4 rounded-xl text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg,#a855f7,#6366f1)' }}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Lưu
                    </button>
                  </div>
                </div>
              </div>
            </Modal>
          )}
        </div>
  );

  if (embedded) return body;
  return (
    <MainLayout pageTitle="Mẹo viết truyện">
      {() => body}
    </MainLayout>
  );
}

