import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';
import { LogIn, Lock, RefreshCcw, Mail } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import api from '@/lib/api';
import logo from '@/assets/logo.png';

// Change this to your actual Google Client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'sua-chave-do-google-aqui.apps.googleusercontent.com';

export default function LoginPage() {
    const { loginWithGoogle, isAuthenticated } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Captcha State
    const [captchaText, setCaptchaText] = useState('');
    const [captchaAnswer, setCaptchaAnswer] = useState('');
    const [isCaptchaValid, setIsCaptchaValid] = useState(false);

    // Anti-Bot Security Enhancements
    const [honeypot, setHoneypot] = useState('');
    const [loadTime, setLoadTime] = useState(0);

    // Auth State
    const [isLoading, setIsLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const from = location.state?.from || '/';

    useEffect(() => {
        // Redirect if already logged in
        if (isAuthenticated) {
            navigate(from, { replace: true });
        } else {
            setLoadTime(Date.now());
            generateCaptcha();
        }
    }, [isAuthenticated, navigate, from]);

    const generateCaptcha = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background noise
        ctx.fillStyle = '#171717'; // neutral-900
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Security against OCR: Use confusing characters, avoid I, 1, O, 0.
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let text = '';
        for (let i = 0; i < 5; i++) {
            text += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setCaptchaText(text);

        // Draw noise lines to confuse simple AI/OCR
        for (let i = 0; i < 7; i++) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.random() * 0.4 + 0.1})`;
            ctx.lineWidth = Math.random() * 2 + 1;
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.stroke();
        }

        // Draw noise dots
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.4 + 0.1})`;
            ctx.beginPath();
            ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw Text with varying rotation, size, and slight offset
        ctx.font = 'bold 28px monospace';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < text.length; i++) {
            ctx.save();
            const x = 20 + i * 22;
            const y = canvas.height / 2 + (Math.random() - 0.5) * 12;
            ctx.translate(x, y);
            ctx.rotate((Math.random() - 0.5) * 0.6); // Random rotation to confuse OCR tools
            ctx.fillStyle = `hsl(${Math.random() * 360}, 50%, 80%)`; // Slight color variation
            ctx.fillText(text[i], 0, 0);
            ctx.restore();
        }

        setCaptchaAnswer('');
        setIsCaptchaValid(false);
    };

    const handleCaptchaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.toUpperCase();
        setCaptchaAnswer(val);
        if (val === captchaText && captchaText.length > 0) {
            setIsCaptchaValid(true);
        } else {
            setIsCaptchaValid(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        if (!isCaptchaValid && window.location.hostname !== 'localhost') {
            toast.error("Por favor, resolva o desafio de segurança primeiro.", { position: 'top-center' });
            return;
        }

        setIsLoading(true);

        try {
            // Send the Google JWT to our Backend for validation and user creation
            const res = await api.post('/auth/google', {
                credential: credentialResponse.credential
            });

            const { token, user } = res.data;

            // Map the backend DB user to the frontend SystemUser structure
            const systemUser = {
                id: user.id,
                email: user.email,
                name: user.name,
                photoURL: user.picture,
                role: user.role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER',
                permissions: user.role.toUpperCase() === 'ADMIN'
                    ? { canView: true, canEdit: true, canDownload: true }
                    : { canView: true, canEdit: false, canDownload: false },
                status: 'active',
                createdAt: new Date().toISOString()
            };



            // Save to Zustand and Session
            loginWithGoogle(systemUser as any, token);

            toast.success("Autenticação Google concluída com sucesso!");
            navigate(from, { replace: true });
        } catch (error: any) {
            console.error('Login error:', error);
            toast.error(
                error.response?.data?.error || "Falha na autenticação do Google. O servidor não respondeu.",
                { description: "Por favor, tente novamente mais tarde." }
            );
            generateCaptcha();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="p-8 pb-6 flex flex-col items-center">
                    <div className="w-48 h-24 flex items-center justify-center mb-6">
                        <img src={logo} alt="Polaryon Logo" className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]" />
                    </div>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400 text-center mb-3 tracking-[0.2em] uppercase">
                        POLARYON
                    </h1>
                    <p className="text-neutral-400 text-sm text-center mb-8">
                        Seu fluxo de trabalho centralizado e protegido.
                    </p>

                    {/* Honeypot field (hidden from real users, attractive to spam bots) */}
                    <input
                        type="text"
                        name="email_secondary_verification"
                        className="opacity-0 absolute -z-50 w-0 h-0"
                        tabIndex={-1}
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                        autoComplete="off"
                    />

                    <div className="w-full space-y-6">
                        {/* Captcha Section */}
                        <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 shadow-inner">
                            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3 flex items-center justify-between">
                                <span className="flex items-center gap-2"><Lock className="w-3.5 h-3.5" /> Segurança Anti-Bot Avançada</span>
                            </label>

                            <div className="flex flex-col gap-3">
                                <div className="flex gap-3 items-center">
                                    <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex items-center justify-center relative h-[60px]">
                                        <canvas
                                            ref={canvasRef}
                                            width="150"
                                            height="60"
                                            className="w-full h-full object-cover"
                                        />
                                        {!captchaText && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
                                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={generateCaptcha}
                                        className="p-3 h-[60px] text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg transition-colors flex items-center justify-center"
                                        title="Gerar novo desafio"
                                    >
                                        <RefreshCcw className="w-5 h-5" />
                                    </button>
                                </div>

                                <input
                                    type="text"
                                    value={captchaAnswer}
                                    onChange={handleCaptchaChange}
                                    maxLength={5}
                                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-center text-lg font-bold font-mono text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-neutral-700 uppercase tracking-[0.5em]"
                                    placeholder="DIGITE O CÓDIGO"
                                />
                            </div>
                        </div>

                        {/* Remember Me Checkbox */}
                        <label className="flex items-center justify-center gap-3 cursor-pointer group mt-2">
                            <div className="relative flex items-center justify-center w-5 h-5">
                                <input
                                    type="checkbox"
                                    className="peer appearance-none w-5 h-5 bg-neutral-950 border-2 border-neutral-700 rounded-md checked:bg-primary checked:border-primary transition-all cursor-pointer"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <svg className="absolute w-3.5 h-3.5 text-neutral-900 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 14 14" fill="none">
                                    <path d="M3 8L6 11L11 3.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-neutral-400 group-hover:text-white transition-colors select-none">
                                Lembrar-me neste navegador
                            </span>
                        </label>

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

                        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                            <div className="mt-4 flex justify-center w-full min-h-[44px]">
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess}
                                    onError={() => {
                                        toast.error('O Google recusou a conexão ou o Popup foi fechado.');
                                    }}
                                    theme="filled_black"
                                    size="large"
                                    shape="pill"
                                    text="continue_with"
                                    width="100%"
                                />
                            </div>
                        </GoogleOAuthProvider>

                        {/* Auto-Login for Localhost only */}
                        {window.location.hostname === 'localhost' && (
                            <button
                                onClick={() => {
                                    const defaultAdmin = useAuthStore.getState().systemUsers[0];
                                    if (defaultAdmin) {
                                        useAuthStore.getState().login(defaultAdmin.email, rememberMe);
                                        toast.success("Login automático (Localhost)");
                                        navigate(from, { replace: true });
                                    }
                                }}
                                className="mt-4 w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50 text-xs font-bold py-3 rounded-xl transition-colors"
                            >
                                Bypass Login (Localhost)
                            </button>
                        )}

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

