import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { UserInfo } from '../utils/jwtHelper';

function PaymentCancelContent() {
    const navigate = useNavigate();

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-4">
            <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8 text-center space-y-4">
                <XCircle className="w-14 h-14 text-amber-400 mx-auto" />
                <p className="text-zinc-100 font-bold text-2xl">Bạn đã hủy thanh toán</p>
                <p className="text-zinc-400 text-sm">Giao dịch chưa được thực hiện. Bạn có thể thử lại bất cứ lúc nào.</p>
                <button
                    onClick={() => navigate('/plans')}
                    className="mt-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
                >
                    Quay lại bảng giá
                </button>
            </div>
        </div>
    );
}

export default function PaymentCancelPage() {
    return (
        <MainLayout pageTitle="Hủy thanh toán">
            {(_: UserInfo) => <PaymentCancelContent />}
        </MainLayout>
    );
}

