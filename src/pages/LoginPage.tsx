import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { useUserPrefsStore } from '@/store/user-prefs-store';
import { toast } from 'sonner';
import { Lock, RefreshCcw, Mail, ArrowLeft } from 'lucide-react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import api from '@/lib/api';
import logo from '@/assets/logo-polaryon.svg';
import { clearCorruptedStorage } from '@/lib/storage-utils';

// Change this to your actual Google Client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'sua-chave-do-google-aqui.apps.googleusercontent.com';

const CustomGoogleLoginButton = ({ onSuccess, onError, disabled }: { onSuccess: (res: any) => void, onError: () => void, disabled: boolean }) => {
    const login = useGoogleLogin({
        onSuccess,
        onError,
        flow: 'implicit'
    });

    return (
        <button
            onClick={() => login()}
            disabled={disabled}
            className={`w-full bg-blue-600 text-white font-anton uppercase tracking-[0.2em] py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-blue-500 transition-all transform active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.3)] ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white" opacity="0.8"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="white" opacity="0.6"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white" opacity="0.9"/>
            </svg>
            Entrar com o Google
        </button>
    );
};

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
    const [rememberMe, setRememberMe] = useState(true);
    const from = location.state?.from || '/tarefas';

    useEffect(() => {
        // Redirect if already logged in
        if (isAuthenticated) {
            navigate(from, { replace: true });
        } else {
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
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Security against OCR
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let text = '';
        for (let i = 0; i < 5; i++) {
            text += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setCaptchaText(text);

        // Draw noise lines
        for (let i = 0; i < 7; i++) {
            ctx.strokeStyle = `rgba(37, 99, 235, ${Math.random() * 0.4 + 0.1})`;
            ctx.lineWidth = Math.random() * 2 + 1;
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.stroke();
        }

        // Draw Text
        ctx.font = 'bold 28px monospace';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < text.length; i++) {
            ctx.save();
            const x = 20 + i * 22;
            const y = canvas.height / 2 + (Math.random() - 0.5) * 12;
            ctx.translate(x, y);
            ctx.rotate((Math.random() - 0.5) * 0.6);
            ctx.fillStyle = `hsl(215, 100%, ${70 + Math.random() * 20}%)`;
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

    const handleGoogleSuccess = async (tokenResponse: any) => {
        if (!isCaptchaValid && window.location.hostname !== 'localhost') {
            toast.error("Por favor, resolva o desafio de segurança primeiro.", { position: 'top-center' });
            return;
        }

        setIsLoading(true);

        try {
            const res = await api.post('/auth/google', {
                accessToken: tokenResponse.access_token
            });

            const { token, user } = res.data;
            const existingSystemUser = useAuthStore.getState().systemUsers.find(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());

            const systemUser = {
                id: user.id || existingSystemUser?.id || crypto.randomUUID(),
                email: user.email,
                name: user.name || existingSystemUser?.name,
                photoURL: user.picture || existingSystemUser?.photoURL,
                role: user.role.toUpperCase(),
                permissions: user.permissions || (user.role.toUpperCase() === 'ADMIN'
                    ? { canView: true, canEdit: true, canDownload: true, allowedScreens: ['ALL'] }
                    : (user.role.toUpperCase() === 'CONTADOR'
                        ? { canView: true, canEdit: false, canDownload: true, allowedScreens: ['ACCOUNTING', 'DOCUMENTATION'] }
                        : { canView: true, canEdit: false, canDownload: false, allowedScreens: ['DASHBOARD', 'KANBAN', 'OPORTUNIDADES', 'CALENDAR', 'TEAM', 'SUPPLIERS', 'DOCUMENTATION', 'ACCOUNTING', 'BUDGETS'] })),
                status: 'active',
                createdAt: existingSystemUser?.createdAt || new Date().toISOString()
            };

            loginWithGoogle(systemUser as any, token, rememberMe);
            useUserPrefsStore.getState().loadPreferences(systemUser.id);

            toast.success("Autenticação Google concluída!");
            navigate(from, { replace: true });
        } catch (error: any) {
            console.error('Login error:', error);
            toast.error(error.response?.data?.error || "Falha na autenticação do Google.");
            generateCaptcha();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden font-oswald antialiased">
            {/* Dynamic Font Import */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@200;400;700&display=swap');
                .font-anton { font-family: 'Anton', sans-serif; }
                .font-oswald { font-family: 'Oswald', sans-serif; }
            `}</style>

            {/* Background Ambience */}
            <div className="absolute inset-0 bg-[url('/polaryon_hero_bg_1774099790662.png')] bg-cover bg-center opacity-20 filter blur-sm scale-110" />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black/40" />
            
            <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[150px] rounded-full" />
            <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] bg-blue-400/5 blur-[150px] rounded-full" />

            <Link to="/" className="absolute top-10 left-10 flex items-center gap-2 text-white/40 hover:text-white transition-all group z-20">
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Voltar</span>
            </Link>

            <div className="w-full max-w-lg z-10 animate-in fade-in zoom-in-95 duration-1000">
                <div className="text-center mb-6 md:mb-12 px-4">
                    <img src={logo} alt="Polaryon" className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 drop-shadow-[0_0_20px_rgba(37,99,235,0.4)]" />
                    <h1 className="text-4xl md:text-7xl lg:text-8xl font-anton text-white tracking-tighter uppercase leading-[0.9] md:leading-none mb-4">
                        Acesso <br className="hidden md:block" />
                        <span className="text-blue-600">Restrito.</span>
                    </h1>
                    <div className="w-12 h-1 bg-blue-600 mx-auto rounded-full" />
                </div>

                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 md:p-10 shadow-2xl relative overflow-hidden">
                    {/* Security Overlay for Bots */}
                    <input
                        id="login-honeypot"
                        type="text"
                        name="email_secondary_verification"
                        className="fixed -top-100 -left-100 opacity-0 pointer-events-none"
                        tabIndex={-1}
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                        autoComplete="off"
                    />

                    <div className="space-y-8">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40 mb-4 block flex items-center gap-2">
                                <Lock size={12} className="text-blue-600" /> Verificação de Identidade
                            </label>
                            
                            <div className="bg-black/40 rounded-2xl p-6 border border-white/5 space-y-4">
                                <div className="flex gap-4 items-center">
                                    <div className="flex-1 bg-black rounded-xl overflow-hidden h-[60px] border border-white/10">
                                        <canvas ref={canvasRef} width="150" height="60" className="w-full h-full object-center opacity-80" />
                                    </div>
                                    <button
                                        onClick={generateCaptcha}
                                        className="w-12 h-[60px] flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all text-white/40 hover:text-white"
                                    >
                                        <RefreshCcw size={20} />
                                    </button>
                                </div>
                                <input
                                    id="login-captcha"
                                    name="captchaAnswer"
                                    type="text"
                                    value={captchaAnswer}
                                    onChange={handleCaptchaChange}
                                    maxLength={5}
                                    className="w-full bg-transparent border-b-2 border-white/10 focus:border-blue-600 px-2 py-4 text-center text-2xl md:text-3xl font-anton text-white outline-none transition-all placeholder:text-white/5 tracking-[0.3em] md:tracking-[0.5em]"
                                    placeholder="CÓDIGO"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-4">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    id="login-remember"
                                    name="rememberMe"
                                    type="checkbox"
                                    className="w-5 h-5 bg-black/40 border-2 border-white/10 rounded-md checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer appearance-none"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">
                                    Lembrar dispositivo
                                </span>
                            </label>
                        </div>

                        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                            <div className="relative group">
                                {!isCaptchaValid && window.location.hostname !== 'localhost' && (
                                    <div
                                        className="absolute inset-0 z-20 cursor-not-allowed"
                                        onClick={() => toast.error("Digite o código de segurança para liberar o acesso.")}
                                    />
                                )}
                                <div className={!isCaptchaValid && window.location.hostname !== 'localhost' ? 'opacity-20 grayscale' : 'opacity-100'}>
                                    <CustomGoogleLoginButton 
                                        onSuccess={handleGoogleSuccess} 
                                        onError={() => toast.error('Falha na conexão com Google.')}
                                        disabled={!isCaptchaValid && window.location.hostname !== 'localhost'}
                                    />
                                </div>
                            </div>
                        </GoogleOAuthProvider>

                        {["localhost", "127.0.0.1"].includes(window.location.hostname) && (
                            <button
                                onClick={() => {
                                    const defaultAdmin = useAuthStore.getState().systemUsers[0];
                                    if (defaultAdmin) {
                                        useAuthStore.getState().login(defaultAdmin.email, rememberMe);
                                        navigate(from, { replace: true });
                                    }
                                }}
                                className="w-full py-3 text-[10px] font-bold uppercase tracking-widest text-blue-500/50 hover:text-blue-500 transition-colors border border-blue-500/10 rounded-xl"
                            >
                                Bypass Dev Mode
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-10 flex items-start gap-4 px-10">
                    <Mail size={16} className="text-blue-600 shrink-0 mt-1" />
                    <p className="text-[10px] font-medium text-white/20 uppercase leading-relaxed tracking-widest">
                        Entre em contato com o administrador para habilitar seu e-mail corporativo.
                    </p>
                </div>

                <div className="mt-12 text-center pb-10">
                    <button 
                        onClick={() => {
                            if (window.confirm("Isso irá limpar o cache local do seu navegador para resolver problemas de carregamento (como no Edge). Seus dados no servidor estão seguros. Deseja continuar?")) {
                                clearCorruptedStorage();
                            }
                        }}
                        className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/10 hover:text-blue-500/50 transition-all"
                    >
                        Problemas de Acesso? Reparar Armazenamento local
                    </button>
                </div>
            </div>
        </div>
    );
}
