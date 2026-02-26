import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, Database, UserCheck, Bell, Mail } from 'lucide-react';

const sections = [
    {
        id: 'overview',
        icon: Shield,
        color: '#6366f1',
        title: '1. Tổng quan',
        content: `StoryNest ("chúng tôi", "nền tảng") cam kết bảo vệ quyền riêng tư và dữ liệu cá nhân của bạn. Chính sách này mô tả cách chúng tôi thu thập, sử dụng và bảo vệ thông tin khi bạn sử dụng dịch vụ StoryNest — nền tảng sáng tác và đánh giá cốt truyện được hỗ trợ bởi trí tuệ nhân tạo.

Bằng việc tạo tài khoản và sử dụng dịch vụ, bạn đồng ý với các điều khoản trong Chính sách Bảo mật này.`,
    },
    {
        id: 'data-collect',
        icon: Database,
        color: '#8b5cf6',
        title: '2. Dữ liệu chúng tôi thu thập',
        items: [
            { label: 'Thông tin tài khoản', desc: 'Họ tên, địa chỉ email, mật khẩu (được mã hóa HMACSHA512 với salt riêng).' },
            { label: 'Nội dung sáng tác', desc: 'Các cốt truyện, chương, ghi chú sáng tác bạn tải lên hệ thống.' },
            { label: 'Dữ liệu sử dụng', desc: 'Thời gian đăng nhập, phiên làm việc, thao tác với nền tảng (analytics ẩn danh).' },
            { label: 'Refresh Token', desc: 'Token làm mới phiên đăng nhập, lưu trữ có thời hạn 7 ngày.' },
        ],
    },
    {
        id: 'encryption',
        icon: Lock,
        color: '#06b6d4',
        title: '3. Mã hóa & Bảo mật dữ liệu',
        content: `Mọi nội dung sáng tác bạn đăng tải đều được mã hóa bằng Data Encryption Key (DEK) riêng cho từng tài khoản, sinh ngẫu nhiên khi đăng ký. DEK chính lại được mã hóa thêm một lớp bằng Master Key của hệ thống (AES-256 GCM), đảm bảo ngay cả đội ngũ kỹ thuật của chúng tôi cũng không thể đọc nội dung của bạn mà không có đủ quyền.

Mật khẩu được băm với HMACSHA512 và salt ngẫu nhiên 16 byte — không bao giờ lưu trực tiếp.`,
    },
    {
        id: 'usage',
        icon: Eye,
        color: '#f59e0b',
        title: '4. Cách chúng tôi sử dụng dữ liệu',
        items: [
            { label: 'Cá nhân hóa AI', desc: 'Nội dung của bạn chỉ được dùng để huấn luyện mô hình đánh giá AI riêng cho tài khoản của bạn — không chia sẻ chéo giữa các người dùng.' },
            { label: 'Vận hành dịch vụ', desc: 'Xác thực, gợi ý sáng tác, phân tích cốt truyện và phản hồi thông báo trong ứng dụng.' },
            { label: 'Cải thiện nền tảng', desc: 'Dữ liệu tổng hợp ẩn danh (không thể nhận dạng cá nhân) dùng để cải thiện trải nghiệm chung.' },
            { label: 'Không bán dữ liệu', desc: 'Chúng tôi không bao giờ bán, cho thuê hay chia sẻ dữ liệu cá nhân của bạn với bên thứ ba vì mục đích thương mại.' },
        ],
    },
    {
        id: 'rights',
        icon: UserCheck,
        color: '#22c55e',
        title: '5. Quyền của bạn',
        items: [
            { label: 'Truy cập & Chỉnh sửa', desc: 'Bạn có thể xem và cập nhật thông tin cá nhân bất kỳ lúc nào tại trang Hồ sơ.' },
            { label: 'Xóa dữ liệu', desc: 'Bạn có quyền yêu cầu xóa toàn bộ tài khoản và dữ liệu liên quan bằng cách liên hệ với chúng tôi.' },
            { label: 'Di chuyển dữ liệu', desc: 'Bạn có thể yêu cầu xuất toàn bộ nội dung sáng tác của mình dưới dạng file (JSON/Markdown).' },
            { label: 'Thu hồi đồng ý', desc: 'Bạn có thể thu hồi sự đồng ý sử dụng dữ liệu cho AI bất kỳ lúc nào, dữ liệu sẽ ngừng được dùng để huấn luyện.' },
        ],
    },
    {
        id: 'retention',
        icon: Bell,
        color: '#ec4899',
        title: '6. Thời gian lưu trữ',
        content: `Dữ liệu tài khoản được lưu trữ cho đến khi bạn yêu cầu xóa. Refresh Token hết hạn sau 7 ngày kể từ lần đăng nhập gần nhất. Dữ liệu analytics ẩn danh được giữ tối đa 12 tháng.

Khi tài khoản bị xóa, toàn bộ dữ liệu cá nhân và nội dung sáng tác sẽ bị xóa vĩnh viễn khỏi hệ thống trong vòng 30 ngày.`,
    },
    {
        id: 'contact',
        icon: Mail,
        color: '#f97316',
        title: '7. Liên hệ',
        content: `Nếu bạn có câu hỏi về Chính sách Bảo mật hoặc muốn thực hiện quyền của mình, vui lòng liên hệ:

📧 privacy@storyrag.io
🌐 storyrag.io/contact

Chúng tôi cam kết phản hồi trong vòng 5 ngày làm việc.`,
    },
];

export default function PrivacyPolicyPage() {
    const [activeId, setActiveId] = useState('overview');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const onScroll = () => {
            let current = 'overview';
            sections.forEach(s => {
                const el = document.getElementById(s.id);
                if (el && el.getBoundingClientRect().top < 160) current = s.id;
            });
            setActiveId(current);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const scrollTo = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <>
            <style>{`
                @keyframes fade-up {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .fade-up { animation: fade-up 0.5s cubic-bezier(.22,.68,0,1.2) both; }
            `}</style>

            <div className="min-h-screen bg-[#0a0a14] text-white">
                {/* Ambient blobs */}
                <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[140px] rounded-full" />
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/8 blur-[120px] rounded-full" />
                </div>

                {/* Top nav */}
                <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0a0a14]/80 backdrop-blur-xl">
                    <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                        <Link to="/register" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group text-sm">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Quay lại đăng ký
                        </Link>
                        <div className="flex items-center gap-2">
                            <img src="/logo.png" alt="StoryNest" className="h-7 w-auto" />
                            <span className="text-white/60 text-sm font-medium tracking-widest uppercase">StoryNest</span>
                        </div>
                    </div>
                </header>

                <div className="max-w-6xl mx-auto px-6 py-12 lg:py-16">
                    {/* Hero */}
                    <div className={`text-center mb-16 ${mounted ? 'fade-up' : 'opacity-0'}`}>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-6">
                            <Shield className="w-3.5 h-3.5" />
                            Chính sách Bảo mật
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
                            Dữ liệu của bạn,<br />
                            <span className="text-transparent bg-clip-text"
                                style={{ backgroundImage: 'linear-gradient(90deg, #818cf8, #c084fc)' }}>
                                thuộc về bạn.
                            </span>
                        </h1>
                        <p className="text-slate-400 max-w-xl mx-auto leading-relaxed">
                            Chúng tôi tin tưởng vào sự minh bạch. Trang này giải thích rõ ràng cách StoryNest thu thập, bảo vệ và sử dụng thông tin của bạn.
                        </p>
                        <p className="text-slate-600 text-xs mt-4">Cập nhật lần cuối: 25 tháng 2, 2026</p>
                    </div>

                    <div className="flex gap-10 items-start">
                        {/* Sidebar TOC */}
                        <aside className="hidden lg:block w-56 shrink-0 sticky top-24">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Nội dung</p>
                            <nav className="space-y-1">
                                {sections.map(s => {
                                    const Icon = s.icon;
                                    const isActive = activeId === s.id;
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => scrollTo(s.id)}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm transition-all duration-200 ${isActive
                                                ? 'bg-white/8 text-white'
                                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/4'
                                                }`}
                                        >
                                            <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: isActive ? s.color : undefined }} />
                                            <span className="truncate">{s.title.replace(/^\d+\.\s/, '')}</span>
                                        </button>
                                    );
                                })}
                            </nav>
                        </aside>

                        {/* Main content */}
                        <main className="flex-1 min-w-0 space-y-8">
                            {sections.map((s, idx) => {
                                const Icon = s.icon;
                                return (
                                    <section
                                        key={s.id}
                                        id={s.id}
                                        className="bg-white/3 border border-white/7 rounded-3xl p-8 scroll-mt-28 fade-up"
                                        style={{ animationDelay: `${idx * 0.06}s` }}
                                    >
                                        {/* Section header */}
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                                                style={{ backgroundColor: `${s.color}18`, border: `1px solid ${s.color}30` }}>
                                                <Icon className="w-5 h-5" style={{ color: s.color }} />
                                            </div>
                                            <h2 className="text-lg font-bold text-white">{s.title}</h2>
                                        </div>

                                        {/* Divider */}
                                        <div className="h-px mb-5" style={{ background: `linear-gradient(90deg, ${s.color}30, transparent)` }} />

                                        {/* Content */}
                                        {'content' in s && (
                                            <p className="text-slate-400 text-sm leading-7 whitespace-pre-line">{s.content}</p>
                                        )}
                                        {'items' in s && (
                                            <ul className="space-y-4">
                                                {s.items!.map((item, i) => (
                                                    <li key={i} className="flex gap-3">
                                                        <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                                                            style={{ backgroundColor: s.color }} />
                                                        <div>
                                                            <p className="text-white text-sm font-semibold mb-0.5">{item.label}</p>
                                                            <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </section>
                                );
                            })}

                            {/* Agree prompt */}
                            <div className="rounded-3xl p-8 text-center"
                                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.08))', border: '1px solid rgba(139,92,246,0.2)' }}>
                                <Shield className="w-10 h-10 mx-auto mb-4 text-indigo-400" />
                                <h3 className="text-white font-bold text-lg mb-2">Bạn đã sẵn sàng?</h3>
                                <p className="text-slate-400 text-sm mb-6">Tạo tài khoản miễn phí và bắt đầu hành trình sáng tác cùng AI.</p>
                                <Link
                                    to="/register"
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95"
                                    style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                                >
                                    Đăng ký ngay →
                                </Link>
                            </div>
                        </main>
                    </div>
                </div>
            </div>
        </>
    );
}
