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
  BookOpen,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { getUserInfo } from '../utils/jwtHelper';
import { faqService, type Faq, type FaqUpsertRequest } from '../services/faqService';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function categoryChip(cat: string) {
  const c = (cat || 'General').trim();
  const hash = Array.from(c).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const hue = hash % 360;
  return { label: c, bg: `hsla(${hue}, 90%, 60%, 0.12)`, border: `hsla(${hue}, 90%, 60%, 0.28)`, text: `hsla(${hue}, 80%, 70%, 1)` };
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
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.12)' }}>
            <BookOpen className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
          </div>
          <div className="min-w-0">
            <p className="text-[var(--text-primary)] font-bold text-base truncate">{title}</p>
            <p className="text-[var(--text-secondary)] text-xs">Quản lý FAQs hiển thị công khai</p>
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

export default function StaffFaqPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'published' | 'draft'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FaqUpsertRequest>({
    question: '',
    answer: '',
    category: 'General',
    order: 0,
    published: false,
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ question: '', answer: '', category: 'General', order: 0, published: false });
    setModalOpen(true);
  };

  const openEdit = (faq: Faq) => {
    setEditing(faq);
    setForm({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      order: faq.order,
      published: faq.published,
    });
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
      const category =
        categoryFilter === 'all' ? undefined : categoryFilter;

      const data = await faqService.getAll({ category, published });
      setItems(data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.message ??
        (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.Message ??
        'Không thể tải FAQs.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, publishedFilter]);

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

  const categories = useMemo(() => {
    const set = new Set(items.map(x => (x.category || 'General').trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = items;
    if (!q) return base;
    return base.filter(x =>
      x.question.toLowerCase().includes(q) ||
      x.answer.toLowerCase().includes(q) ||
      x.category.toLowerCase().includes(q)
    );
  }, [items, search]);

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      setError('Question và Answer là bắt buộc.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: FaqUpsertRequest = {
        ...form,
        question: form.question.trim(),
        answer: form.answer.trim(),
        category: (form.category || 'General').trim(),
        order: Number.isFinite(form.order) ? form.order : 0,
      };

      if (editing) {
        const updated = await faqService.update(editing.id, payload);
        setItems(prev => prev.map(x => (x.id === updated.id ? updated : x)));
      } else {
        const created = await faqService.create(payload);
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

  const handleDelete = async (faq: Faq) => {
    if (!confirm(`Xoá FAQ: "${faq.question}"?`)) return;
    setError('');
    try {
      await faqService.delete(faq.id);
      setItems(prev => prev.filter(x => x.id !== faq.id));
    } catch {
      setError('Xoá thất bại.');
    }
  };

  const handleTogglePublish = async (faq: Faq) => {
    setError('');
    try {
      const updated = await faqService.togglePublish(faq.id, !faq.published);
      setItems(prev => prev.map(x => (x.id === updated.id ? updated : x)));
    } catch {
      setError('Cập nhật publish thất bại.');
    }
  };

  const body = (
        <div className={embedded ? 'w-full space-y-5' : 'p-6 max-w-6xl mx-auto w-full space-y-5'}>
          <div
            className="rounded-3xl p-5 flex items-center justify-between"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
                <BookOpen className="w-5 h-5" style={{ color: 'var(--accent-text)' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-bright)' }}>FAQ Manager</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  CRUD + publish toggle · Public endpoint chỉ trả published=true
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
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
              >
                <Plus className="w-4 h-4" />
                Tạo FAQ
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
                placeholder="Tìm theo question/answer/category..."
                className="w-full pl-9 pr-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div className="relative">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="appearance-none pl-3 pr-9 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="all">Tất cả category</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
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
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Không có FAQ nào</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Tạo item mới để hiển thị cho user.</p>
            </div>
          ) : (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      {['Question', 'Category', 'Order', 'Publish', 'Updated', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {filtered
                      .slice()
                      .sort((a, b) => (a.category.localeCompare(b.category) || a.order - b.order || b.updatedAt.localeCompare(a.updatedAt)))
                      .map(faq => {
                        const chip = categoryChip(faq.category);
                        return (
                          <tr key={faq.id} className="hover:bg-[var(--text-primary)]/3 transition-colors">
                            <td className="px-4 py-3 max-w-[520px]">
                              <button onClick={() => openEdit(faq)} className="text-left w-full">
                                <p className="text-[var(--text-primary)] text-sm font-semibold line-clamp-2">{faq.question}</p>
                                <p className="text-[var(--text-secondary)] text-xs mt-1 line-clamp-2">{faq.answer}</p>
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border"
                                style={{ background: chip.bg, borderColor: chip.border, color: chip.text }}
                              >
                                {chip.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                {faq.order}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <PublishToggle value={faq.published} onChange={() => void handleTogglePublish(faq)} />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {fmtDate(faq.updatedAt)}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => void handleDelete(faq)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                title="Xoá"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {modalOpen && (
            <Modal title={editing ? 'Sửa FAQ' : 'Tạo FAQ'} onClose={() => setModalOpen(false)}>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">Category</label>
                    <input
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
                      placeholder="General / Billing / AI / ..."
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">Order</label>
                    <input
                      type="number"
                      value={form.order}
                      onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))}
                      className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">Question *</label>
                  <input
                    value={form.question}
                    onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="Câu hỏi..."
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">Answer *</label>
                  <textarea
                    value={form.answer}
                    onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
                    rows={6}
                    className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                    placeholder="Câu trả lời..."
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
                      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
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
    <MainLayout pageTitle="Quản lý FAQs">
      {() => body}
    </MainLayout>
  );
}

