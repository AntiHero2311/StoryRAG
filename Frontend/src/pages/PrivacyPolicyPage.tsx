import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, Database, UserCheck, Bell, Mail, ChevronRight } from 'lucide-react';

const sections = [
    {
        id: 'overview',
        icon: Shield,
        color: '#818cf8',
        title: '1. Tổng quan',
        content: `StoryNest ("chúng tôi", "nền tảng") cam kết bảo vệ quyền riêng tư và dữ liệu cá nhân của bạn. Chính sách này mô tả cách chúng tôi thu thập, sử dụng và bảo vệ thông tin khi bạn sử dụng dịch vụ StoryNest — nền tảng sáng tác và đánh giá cốt truyện được hỗ trợ bởi trí tuệ nhân tạo.

Bằng việc tạo tài khoản và sử dụng dịch vụ, bạn đồng ý với các điều khoản trong Chính sách Bảo mật này.`,
    },
    {
        id: 'data-collect',
        icon: Database,
        color: '#a78bfa',
        title: '2. Dữ liệu chúng tôi thu thập',
        items: [
            { label: 'Thông tin tài khoản', desc: 'Họ tên, địa chỉ email, mật khẩu (được mã hóa HMACSHA512 với salt riêng).' },
            { label: 'Nội dung sáng tác', desc: 'Các cốt truyện, chương, ghi chú sáng tác bạn tải lên hệ thống để lưu trữ.' },
            { label: 'Dữ liệu sử dụng', desc: 'Thời gian đăng nhập, phiên làm việc, thao tác với nền tảng (dưới dạng ẩn danh).' },
            { label: 'Refresh Token', desc: 'Sử dụng để duy trì phiên bản đăng nhập bảo mật có thời hạn 7 ngày.' },
        ],
    },
    {
        id: 'encryption',
        icon: Lock,
        color: '#38bdf8',
        title: '3. Mã hóa & Bảo mật mạnh mẽ',
        content: `Mọi nội dung sáng tác bạn đăng tải đều được mã hóa bằng tiêu chuẩn mã hoá đa cấp (AES-256 GCM), đảm bảo ngay cả đội ngũ kỹ thuật của chúng tôi cũng không thể tự ý truy xuất tác phẩm của bạn.

Mật khẩu được lưu trữ dưới dạng băm 1 chiều không thể đảo ngược kèm salt mã hoá chuyên biệt.`,
    },
    {
        id: 'usage',
        icon: Eye,
        color: '#fbbf24',
        title: '4. Cách chúng tôi sử dụng dữ liệu',
        items: [
            { label: 'Cá nhân hóa AI độc lập', desc: 'Nội dung được dùng để cho AI hiểu văn phong của riêng bạn, dữ liệu này hoàn toàn vô hình đối với người dùng khác.' },
            { label: 'Vận hành dịch vụ', desc: 'Xác minh danh tính an toàn, đề xuất các công cụ sáng tác thông minh.' },
            { label: 'Tuyệt đối không bán dữ liệu', desc: 'Dữ liệu cá nhân, chất xám của bạn không bao giờ được chia sẻ hay thương mại hoá với bất kỳ bên thứ 3 nào.' },
        ],
    },
    {
        id: 'rights',
        icon: UserCheck,
        color: '#34d399',
        title: '5. Quyền kiểm soát của bạn',
        items: [
            { label: 'Tùy chỉnh & Xem lại', desc: 'Toàn quyền chỉnh sửa, giám sát thông tin hồ sơ của bạn.' },
            { label: 'Quyền Xóa bỏ Vĩnh viễn (Right to be Forgotten)', desc: 'Xoá triệt để tài khoản và toàn bộ bài hát/cốt truyện khỏi máy chủ bất cứ lúc nào.' },
            { label: 'Di chuyển dữ liệu', desc: 'Hỗ trợ xuất (Export) kho tàng văn bản của bạn dưới dạng offline.' },
        ],
    },
    {
        id: 'retention',
        icon: Bell,
        color: '#f472b6',
        title: '6. Thời gian phục hồi',
        content: `Bên cạnh việc lưu trữ an toàn trọn đời suốt quá trình hoạt động, sau khi tự nguyện xoá tài khoản, tài nguyên của bạn sẽ rơi vào "Bãi Rác Ảo" giới hạn 30 ngày. Trong 30 ngày này, bạn có thể gửi yêu cầu hỗ trợ khôi phục để cứu vãn tác phẩm nếu chuyển ý. Sau thời hạn trên, nền tảng sẽ phân rã vĩnh viễn dữ liệu.`,
    },
    {
        id: 'contact',
        icon: Mail,
        color: '#fb923c',
        title: '7. Liên hệ hỗ trợ',
        content: `Mọi ý kiến đóng góp, thắc mắc về luồng pháp lý và bảo mật vui lòng gửi về kênh nội bộ của StoryNest.

📧 storynestrag@gmail.com
🌐 storynest.com/contact`,
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
                if (el && el.getBoundingClientRect().top < 200) current = s.id;
            });
            setActiveId(current);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const scrollTo = (id: string) => {
        const offset = 100;
        const el = document.getElementById(id);
        if (el) {
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = el.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="min-h-screen bg-[#090514] text-white font-sans overflow-x-hidden">
            <style>{`
                ::selection { background: rgba(99,102,241,0.3); color: white; }
                .glass-card {
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(24px);
                    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
                }
                .text-gradient {
                    background-clip: text;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .glow-text {
                    text-shadow: 0 0 40px rgba(129,140,248,0.5);
                }
            `}</style>

            {/* Ambient Background Glows */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-indigo-900/30 blur-[150px] rounded-full mix-blend-screen opacity-50" />
                <div className="absolute top-[40%] right-[-10%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-purple-900/20 blur-[150px] rounded-full mix-blend-screen opacity-50" />
            </div>

            {/* Sticky Header */}
            <header className="sticky top-0 z-50 w-full glass-card border-x-0 border-t-0 border-b-white/5 bg-[#090514]/60">
                <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
                    <Link to="/register" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-all group font-bold text-[13px] tracking-wide uppercase">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors border border-white/5 group-hover:border-white/20">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                        </div>
                        Quay lại
                    </Link>
                    <div className="flex items-center gap-3 select-none">
                        <img src="/logo.png" alt="StoryNest" className="h-8 w-8 object-contain drop-shadow-lg" />
                        <span className="text-white font-black tracking-tight text-xl">StoryNest</span>
                    </div>
                </div>
            </header>

            <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
                
                {/* Hero Section */}
                <div className={`text-center max-w-3xl mx-auto mb-20 transition-all duration-1000 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-black uppercase tracking-[0.2em] mb-8 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                        <Shield className="w-4 h-4" />
                        Thiên Ý - Quyền Riêng Tư
                    </div>
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6 leading-[1.1] tracking-tight text-white glow-text">
                        Dữ liệu của bạn,<br />
                        <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-purple-400 text-gradient">quyền lực của bạn.</span>
                    </h1>
                    <p className="text-zinc-400 text-lg leading-relaxed font-medium">
                        Chúng tôi xây dựng StoryNest trên nền tảng của sự riêng tư tuyệt đối. Mọi ý tưởng, nhân vật và thế giới bạn tạo ra đều an toàn và hoàn toàn thuộc về bạn.
                    </p>
                    <p className="text-zinc-600 font-bold text-xs mt-6 tracking-wider uppercase">Cập nhật: 02 Tháng 04, 2026</p>
                </div>

                <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
                    
                    {/* Sidebar Table of Contents */}
                    <aside className="hidden lg:block w-[280px] shrink-0 sticky top-28 transition-all duration-700 delay-300 transform opacity-100">
                        <div className="glass-card rounded-[2rem] p-6 shadow-2xl">
                            <p className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-6 px-2">Danh mục chính sách</p>
                            <nav className="space-y-1.5 relative">
                                {/* Animated active background indicator */}
                                <div className="absolute left-0 w-full h-[40px] bg-white/5 border border-white/10 rounded-xl transition-all duration-300 ease-out pointer-events-none" 
                                    style={{ 
                                        top: `${Math.max(0, sections.findIndex(s => s.id === activeId)) * 46}px`,
                                        opacity: activeId ? 1 : 0
                                    }} 
                                />

                                {sections.map((s, index) => {
                                    const Icon = s.icon;
                                    const isActive = activeId === s.id;
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => scrollTo(s.id)}
                                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-[14px] font-bold transition-colors duration-200 relative z-10 h-[40px] ${
                                                isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 truncate">
                                                <Icon className="w-4 h-4 shrink-0 transition-colors" style={{ color: isActive ? s.color : 'currentColor' }} />
                                                <span className="truncate">{s.title.split('. ')[1]}</span>
                                            </div>
                                            {isActive && <ChevronRight className="w-4 h-4 text-zinc-400" />}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <main className="flex-1 w-full space-y-10">
                        {sections.map((s, idx) => {
                            const Icon = s.icon;
                            return (
                                <section
                                    key={s.id}
                                    id={s.id}
                                    className={`glass-card rounded-[2rem] p-8 sm:p-10 transition-all duration-700 hover:bg-white/[0.04] ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
                                    style={{ transitionDelay: `${idx * 150}ms` }}
                                >
                                    {/* Section Title */}
                                    <div className="flex items-center gap-5 mb-8">
                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                                            style={{ background: `linear-gradient(135deg, ${s.color}15, transparent)`, border: `1px solid ${s.color}40` }}>
                                            <Icon className="w-6 h-6" style={{ color: s.color }} />
                                        </div>
                                        <h2 className="text-2xl font-black text-white tracking-tight">{s.title}</h2>
                                    </div>

                                    {/* Content Formatting */}
                                    <div className="space-y-6">
                                        {'content' in s && (
                                            <p className="text-zinc-400 text-base leading-relaxed font-medium whitespace-pre-line">
                                                {s.content}
                                            </p>
                                        )}
                                        
                                        {'items' in s && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                                {s.items!.map((item, i) => (
                                                    <div key={i} className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors shadow-inner">
                                                        <div className="flex items-start gap-4">
                                                            <div className="w-2 h-2 rounded-full mt-2.5 shrink-0 shadow-[0_0_10px_currentColor]" style={{ backgroundColor: s.color, color: s.color }} />
                                                            <div>
                                                                <h4 className="text-white text-[15px] font-bold mb-1.5">{item.label}</h4>
                                                                <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            );
                        })}

                        {/* Awesome CTA Footer */}
                        <div className={`mt-16 rounded-[2rem] p-10 text-center relative overflow-hidden glass-card transition-all duration-1000 delay-1000 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`} style={{ border: '1px solid rgba(99,102,241,0.3)' }}>
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 opacity-50" />
                            
                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(99,102,241,0.4)]">
                                    <Shield className="w-8 h-8 text-indigo-400" />
                                </div>
                                <h3 className="text-2xl font-black text-white mb-3">An toàn và Chuyên nghiệp</h3>
                                <p className="text-zinc-400 text-base font-medium max-w-md mx-auto mb-8">Bắt đầu kể câu chuyện của riêng bạn với sự hỗ trợ của trí tuệ nhân tạo và bảo mật hàng đầu.</p>
                                
                                <Link
                                    to="/register"
                                    className="inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-white shadow-[0_10px_40px_-5px_rgba(99,102,241,0.6)] transform hover:-translate-y-1 transition-all duration-300"
                                    style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                                >
                                    Bắt đầu sáng tác <ArrowLeft className="w-5 h-5 rotate-180" />
                                </Link>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
