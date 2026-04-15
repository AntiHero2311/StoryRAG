import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { paymentService } from '../services/paymentService';
import { UserInfo } from '../utils/jwtHelper';

function PaymentSuccessContent() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const orderCode = useMemo(() => Number(searchParams.get('orderCode') ?? 0), [searchParams]);
    const [status, setStatus] = useState<'loading' | 'completed' | 'failed' | 'pending'>('loading');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!orderCode || Number.isNaN(orderCode)) {
            setStatus('failed');
            setError('Không tìm thấy orderCode hợp lệ.');
            return;
        }

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const check = async () => {
            try {
                const result = await paymentService.getPayOsOrderStatus(orderCode);
                if (cancelled) return;

                if (result.status === 'Completed') {
                    setStatus('completed');
                    return;
                }

                if (result.status === 'Pending') {
                    setStatus('pending');
                    timer = setTimeout(check, 3000);
                    return;
                }

                setStatus('failed');
                setError(`Thanh toán chưa thành công. Trạng thái: ${result.status}`);
            } catch (err: any) {
                if (cancelled) return;
                setStatus('failed');
                setError(err?.response?.data?.error ?? err?.response?.data?.message ?? 'Không thể kiểm tra trạng thái đơn hàng.');
            }
        };

        void check();
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [orderCode]);

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-4">
            <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8 text-center">
                {status === 'loading' && (
                    <div className="space-y-4">
                        <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mx-auto" />
                        <p className="text-zinc-200 font-semibold">Đang xác nhận giao dịch...</p>
                    </div>
                )}

                {status === 'pending' && (
                    <div className="space-y-4">
                        <Loader2 className="w-12 h-12 animate-spin text-amber-400 mx-auto" />
                        <p className="text-zinc-100 font-bold text-xl">Đơn hàng đang chờ xác nhận</p>
                        <p className="text-zinc-400 text-sm">Hệ thống đang đợi webhook PayOS để kích hoạt gói của bạn.</p>
                    </div>
                )}

                {status === 'completed' && (
                    <div className="space-y-4">
                        <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
                        <p className="text-zinc-100 font-bold text-2xl">Thanh toán thành công</p>
                        <p className="text-zinc-400 text-sm">Gói của bạn đã được kích hoạt.</p>
                        <button
                            onClick={() => navigate('/subscription')}
                            className="mt-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
                        >
                            Đi tới gói của tôi
                        </button>
                    </div>
                )}

                {status === 'failed' && (
                    <div className="space-y-4">
                        <XCircle className="w-14 h-14 text-rose-400 mx-auto" />
                        <p className="text-zinc-100 font-bold text-2xl">Không thể xác nhận thanh toán</p>
                        <p className="text-rose-300 text-sm">{error}</p>
                        <button
                            onClick={() => navigate('/plans')}
                            className="mt-2 px-5 py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-semibold transition-colors"
                        >
                            Quay lại bảng giá
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function PaymentSuccessPage() {
    return (
        <MainLayout pageTitle="Thanh toán thành công">
            {(_: UserInfo) => <PaymentSuccessContent />}
        </MainLayout>
    );
}

