import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { 
  ArrowRight, 
  MapPin, 
  Mail, 
  Phone, 
  Linkedin, 
  Instagram, 
  Facebook,
  Shield,
  Layers,
  Zap,
  ChevronDown
} from 'lucide-react';

import api from '@/lib/api';
import logo from '@/assets/logo-polaryon.svg';

// Custom Scroll Hook for Parallax
const ScrollParaCard = ({ children, offset = 50 }: { children: React.ReactNode, offset?: number }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1, 0.95]);

  return (
    <motion.div ref={ref} style={{ y, opacity, scale }}>
      {children}
    </motion.div>
  );
};

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-oswald selection:bg-blue-600 selection:text-white transition-colors overflow-x-hidden">
      {/* Dynamic Font Import */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Fjalla+One&family=Oswald:wght@200;400;700&display=swap');
        
        .font-anton { font-family: 'Anton', sans-serif; }
        .font-fjalla { font-family: 'Fjalla One', sans-serif; }
        .font-oswald { font-family: 'Oswald', sans-serif; }

        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        @keyframes drift {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(100px, 50px) scale(1.1); }
          66% { transform: translate(-50px, 150px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }

        .smoke-orb {
          filter: blur(120px);
          opacity: 0.15;
          animation: drift 20s ease-in-out infinite;
        }

        .scrolling-text {
          animation: scroll 30s linear infinite;
        }

        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* FIXED NEON SMOKE BACKGROUND */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="smoke-orb absolute top-[10%] left-[10%] w-[600px] h-[600px] bg-blue-900 rounded-full" />
        <div className="smoke-orb absolute bottom-[10%] right-[10%] w-[700px] h-[700px] bg-blue-700/50 rounded-full" style={{ animationDelay: '-5s' }} />
        <div className="smoke-orb absolute top-[40%] right-[30%] w-[500px] h-[500px] bg-blue-950 rounded-full" style={{ animationDelay: '-10s' }} />
        <div className="smoke-orb absolute bottom-[30%] left-[20%] w-[800px] h-[800px] bg-indigo-900/40 rounded-full" style={{ animationDelay: '-15s' }} />
        
        {/* Neon Glow Layer */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,102,255,0.05)_0%,transparent_70%)]" />
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'bg-black/60 backdrop-blur-xl py-4' : 'bg-transparent py-8'}`}>
        <div className="max-w-[1800px] mx-auto px-10 flex justify-between items-center text-xs font-bold tracking-[0.2em] uppercase">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-8 h-8 object-contain drop-shadow-[0_0_15px_rgba(37,99,235,0.6)]" />
            <span className="text-white font-oswald text-xl tracking-tighter">POLARYON</span>
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
          </div>

          <div className="flex items-center gap-10">
            <a href="#about" className="hover:text-blue-500 transition-colors">Sobre</a>
            <a href="#contact" className="hover:text-blue-500 transition-colors">Contato</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center pt-20 overflow-hidden z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/40 to-black z-1" />
        
        <div className="relative z-10 text-center max-w-6xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            <h1 className="text-[12rem] lg:text-[16rem] font-anton text-white leading-[0.85] tracking-tighter uppercase mb-6 opacity-80">
              POLA<br />RYON
            </h1>
            <p className="text-blue-500 text-lg font-bold tracking-[0.5em] uppercase mb-12">
              Futuro & Excelência em Licitações
            </p>
            <div className="flex justify-center gap-10">
              <a href="#about" className="group flex items-center gap-4 text-white/50 hover:text-white transition-all">
                <span className="text-xs font-bold uppercase tracking-[0.3em]">Nossa História</span>
                <div className="w-10 h-[1px] bg-white/20 group-hover:w-20 group-hover:bg-blue-600 transition-all" />
              </a>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-20">
          <ChevronDown size={30} />
        </div>
      </section>

      {/* Vertical Cards with Movement */}
      <section className="relative py-40 px-6 z-10">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <ScrollParaCard offset={100}>
              <div className="glass-card p-12 rounded-[3rem] group">
                <span className="text-blue-500 text-xs font-bold tracking-[0.4em] mb-8 block uppercase">01 / Inteligência</span>
                <h3 className="text-6xl font-anton uppercase leading-none mb-8 tracking-tighter">
                  ANÁLISE <br /> <span className="text-white/40">ESTRATÉGICA</span>
                </h3>
                <p className="text-white/50 text-base leading-relaxed tracking-wider mb-10 font-light">
                  Transformamos dados complexos em oportunidades claras. Nossa metodologia de análise para editais públicos garante vantagem competitiva no mercado de licitações.
                </p>
                <Zap className="text-blue-600 w-12 h-12 opacity-40" />
              </div>
            </ScrollParaCard>

            <ScrollParaCard offset={150}>
              <div className="glass-card p-12 rounded-[3rem] md:translate-y-20">
                <span className="text-blue-500 text-xs font-bold tracking-[0.4em] mb-8 block uppercase">02 / Segurança</span>
                <h3 className="text-6xl font-anton uppercase leading-none mb-8 tracking-tighter">
                  COMPLIANCE <br /> <span className="text-white/40">RIGOROSO</span>
                </h3>
                <p className="text-white/50 text-base leading-relaxed tracking-wider mb-10 font-light">
                  A Polaryon opera com os mais altos padrões de transparência e ética, assegurando conformidade total em todos os processos de contratação e supply chain.
                </p>
                <Shield className="text-blue-600 w-12 h-12 opacity-40" />
              </div>
            </ScrollParaCard>
          </div>
        </div>
      </section>

      {/* Giant Scrolling Text */}
      <section className="py-40 bg-zinc-950/20 overflow-hidden relative z-10">
        <div className="flex whitespace-nowrap scrolling-text">
          <p className="text-[12rem] font-anton text-white/5 uppercase leading-none pr-20 select-none">
            EFICIÊNCIA • ESTRATÉGIA • POLARYON • EXCELÊNCIA • TECNOLOGIA • COMPLIANCE • 
          </p>
          <p className="text-[12rem] font-anton text-white/5 uppercase leading-none pr-20 select-none">
            EFICIÊNCIA • ESTRATÉGIA • POLARYON • EXCELÊNCIA • TECNOLOGIA • COMPLIANCE • 
          </p>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-40 px-10 relative z-10">
        <div className="max-w-[1800px] mx-auto grid lg:grid-cols-2 gap-20">
          <div className="sticky top-40 h-fit">
            <h2 className="text-8xl lg:text-9xl font-anton uppercase leading-tight tracking-[0.05em] mb-12">
              SOBRE A <br />
              <span className="text-blue-600">POLARYON.</span>
            </h2>
            <div className="w-32 h-2 bg-blue-600" />
          </div>
          
          <div className="space-y-24">
            <ScrollParaCard offset={40}>
              <p className="text-7xl font-anton text-white opacity-80 uppercase leading-none tracking-tight">
                Nós não apenas participamos de licitações. <br />
                <span className="text-white/20">Nós redefinimos o sucesso nelas.</span>
              </p>
            </ScrollParaCard>
            
            <div className="grid md:grid-cols-2 gap-12 pt-20">
              <div className="glass-card p-10 rounded-3xl">
                <h4 className="text-2xl font-anton uppercase mb-4">Visão</h4>
                <p className="text-white/40 text-sm leading-relaxed tracking-widest uppercase">
                  Ser a principal referência em fornecimento especializado para o setor público, unindo agilidade e confiança.
                </p>
              </div>
              <div className="glass-card p-10 rounded-3xl">
                <h4 className="text-2xl font-anton uppercase mb-4">Valores</h4>
                <p className="text-white/40 text-sm leading-relaxed tracking-widest uppercase">
                  Integridade absoluta, foco no resultado e inovação constante em cada etapa dos processos licitatórios.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final Contact Section with New Business Card */}
      <section id="contact" className="py-40 px-10 relative z-10 bg-black/40">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-24 items-center">
            <div>
              <h2 className="text-7xl font-anton uppercase leading-tight mb-8">
                FALE COM O <br />
                <span className="text-blue-600">COMERCIAL.</span>
              </h2>
              <p className="text-white/30 text-xs font-bold uppercase tracking-[0.5em] mb-12">
                Conecte-se conosco para parcerias e editais internos.
              </p>
              
              {/* CONTACT CARD */}
              <motion.div 
                whileHover={{ scale: 1.02, rotateY: 5 }}
                className="glass-card p-12 rounded-[4rem] relative overflow-hidden group shadow-2xl"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[60px]" />
                <div className="space-y-8 relative z-10">
                  <div className="flex items-start gap-6">
                    <MapPin className="text-blue-600 shrink-0" size={24} />
                    <span className="text-sm font-bold uppercase tracking-widest text-white/60">Curitiba, PR — Brasil</span>
                  </div>
                  <div className="flex items-start gap-6">
                    <Mail className="text-blue-600 shrink-0" size={24} />
                    <a href="mailto:contato@polaryon.com.br" className="text-sm font-bold uppercase tracking-widest hover:text-blue-500 transition-colors">contato@polaryon.com.br</a>
                  </div>
                  <div className="pt-8 border-t border-white/10 flex gap-6">
                    <a href="#" className="p-4 bg-white/5 rounded-2xl hover:bg-blue-600 transition-all transform hover:-translate-y-1"><Instagram size={20} /></a>
                    <a href="#" className="p-4 bg-white/5 rounded-2xl hover:bg-blue-600 transition-all transform hover:-translate-y-1"><Linkedin size={20} /></a>
                    <a href="#" className="p-4 bg-white/5 rounded-2xl hover:bg-blue-600 transition-all transform hover:-translate-y-1"><Facebook size={20} /></a>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="flex flex-col gap-8">
              <Link to="/login" className="group glass-card p-12 rounded-[3.5rem] flex flex-col justify-between hover:bg-white/10 transition-all">
                <div className="space-y-4">
                  <h3 className="text-3xl font-anton uppercase tracking-tighter">Portal de Acesso</h3>
                  <p className="text-white/20 text-[10px] font-bold uppercase tracking-[0.3em]">Ambiente seguro para gestores e parceiros.</p>
                </div>
                <div className="flex justify-end pt-12">
                  <ArrowRight size={32} className="text-white/20 group-hover:text-blue-600 group-hover:translate-x-4 transition-all" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="py-10 px-10 border-t border-white/5 text-center text-white/20 text-[10px] uppercase font-bold tracking-[0.5em] z-10 relative">
        &copy; 2026 POLARYON SYSTEM — DESENVOLVIDO PELA JJ CORPORATION
      </footer>
    </div>
  );
}
