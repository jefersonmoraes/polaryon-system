import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';
import { ShieldCheck, LogIn, Lock, RefreshCcw, Mail } from 'lucide-react';

export default function LoginPage() {
    const { login, isAuthenticated } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    // Captcha State
    const [num1, setNum1] = useState(0);
    const [num2, setNum2] = useState(0);
    const [captchaAnswer, setCaptchaAnswer] = useState('');
    const [isCaptchaValid, setIsCaptchaValid] = useState(false);

    // Auth State
    const [isLoading, setIsLoading] = useState(false);
    const from = location.state?.from || '/';

    useEffect(() => {
        // Redirect if already logged in
        if (isAuthenticated) {
            navigate(from, { replace: true });
        } else {
            generateCaptcha();
        }
    }, [isAuthenticated, navigate, from]);

    const generateCaptcha = () => {
        setNum1(Math.floor(Math.random() * 10) + 1);
        setNum2(Math.floor(Math.random() * 10) + 1);
        setCaptchaAnswer('');
        setIsCaptchaValid(false);
    };

    const handleCaptchaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setCaptchaAnswer(val);
        if (parseInt(val) === num1 + num2) {
            setIsCaptchaValid(true);
        } else {
            setIsCaptchaValid(false);
        }
    };

    const handleGoogleLoginMock = () => {
        if (!isCaptchaValid) {
            toast.error("Por favor, resolva o desafio matemático primeiro.", { position: 'top-center' });
            return;
        }

        setIsLoading(true);

        // Simulating OAuth / Google Popup Delay
        setTimeout(() => {
            // MOCK: Ask the user to input the email that Google "returned" 
            const mockedEmail = window.prompt(
                "SIMULAÇÃO GOOGLE OAUTH\n\nQual e-mail o Google retornou do seu celular/computador?",
                "admin@polaryon.com"
            );

            if (!mockedEmail) {
                setIsLoading(false);
                toast.info("Login com Google cancelado.");
                return;
            }

            // MOCK: Try to login against the Auth Store
            const success = login(mockedEmail.trim());

            if (success) {
                toast.success("Autenticação Google concluída com sucesso!");
                navigate(from, { replace: true });
            } else {
                toast.error(
                    "Acesso Negado. Este e-mail Google não está autorizado no sistema.",
                    {
                        description: "Peça para um Administrador cadastrar o seu e-mail previamente."
                    }
                );
            }
            setIsLoading(false);
        }, 800);
    };

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="p-8 pb-6 flex flex-col items-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 shadow-inner border border-primary/20">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-white text-center mb-2 tracking-tight">
                        Sistema de Gestão Segura
                    </h1>
                    <p className="text-neutral-400 text-sm text-center mb-8">
                        Seu fluxo de trabalho centralizado e protegido.
                    </p>

                    <div className="w-full space-y-6">
                        {/* Captcha Section */}
                        <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 shadow-inner">
                            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3 flex items-center gap-2">
                                <Lock className="w-3.5 h-3.5" /> Segurança Anti-Bot
                            </label>

                            <div className="flex items-center gap-3">
                                <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 flex items-center justify-center gap-2 font-mono text-lg font-bold text-white select-none">
                                    <span>{num1}</span>
                                    <span className="text-primary">+</span>
                                    <span>{num2}</span>
                                    <span className="text-neutral-500">=</span>
                                </div>

                                <input
                                    type="number"
                                    value={captchaAnswer}
                                    onChange={handleCaptchaChange}
                                    className="w-24 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-center text-lg font-bold font-mono text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-neutral-700"
                                    placeholder="?"
                                />

                                <button
                                    onClick={generateCaptcha}
                                    className="p-3 text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg transition-colors"
                                    title="Gerar novo desafio"
                                >
                                    <RefreshCcw className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-neutral-800"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-neutral-900 px-2 text-neutral-500 font-semibold tracking-wider">
                                    Identificação Segura
                                </span>
                            </div>
                        </div>

                        {/* Google Auth Button Mock */}
                        <button
                            onClick={handleGoogleLoginMock}
                            disabled={!isCaptchaValid || isLoading}
                            className={`w-full group relative flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-bold transition-all duration-300 overflow-hidden ${isCaptchaValid && !isLoading
                                    ? 'bg-white text-neutral-900 hover:bg-neutral-200 hover:shadow-lg hover:shadow-white/10'
                                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                }`}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        <path d="M1 1h22v22H1z" fill="none" />
                                    </svg>
                                    Sign in with Google
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="bg-neutral-800/50 p-4 border-t border-neutral-800 flex items-start gap-3">
                    <Mail className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-neutral-400 leading-relaxed">
                        Apenas e-mails autorizados pelo administrador possuem acesso. Solicite convite ao gestor do sistema.
                    </p>
                </div>
            </div>
        </div>
    );
}
