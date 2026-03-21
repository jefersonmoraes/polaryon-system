import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ArrowRight,
  Target,
  Shield,
  Users,
  Building2,
  Briefcase,
  Mail,
  Instagram,
  Linkedin,
  Facebook
} from 'lucide-react';

import api from '@/lib/api';
import logo from '@/assets/logo.png';

// Import Google Fonts in a style tag or via a link in index.html. 
// For this component, we'll assume they are loaded.

const LandingPage = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Features inspired by the articles in Geospace
  const features = [
    {
      id: 1,
      title: "Jeff Bezos is going to space on first crewed flight of rocket", // Original text for structural match
      alias: "POLARYON domina o mercado de licitações com inteligência",
      tag: "ESTRATÉGIA",
      author: "Equipe Polaryon",
      bgImage: "/polaryon_hero_bg_1774099790662.png"
    },
    {
      id: 2,
      title: "Octopus punches fish in the head — just because it can",
      alias: "Agilidade absoluta na preparação de editais complexos",
      tag: "TECNOLOGIA",
      author: "Software Integrado",
      bgImage: "/polaryon_hero_bg_1774099790662.png"
    },
    {
      id: 3,
      title: "This startup wants to build VR headsets with 'human eye-resolution'",
      alias: "Transparência total em cada etapa do seu certame",
      tag: "COMPLIANCE",
      author: "Jurídico Especializado",
      bgImage: "/polaryon_hero_bg_1774099790662.png"
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-600/40 overflow-x-hidden">
      {/* Dynamic Font Import */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Fjalla+One&family=Oswald:wght@200;400;700&display=swap');
        
        .font-anton { font-family: 'Anton', sans-serif; }
        .font-oswald { font-family: 'Oswald', sans-serif; }
        .font-fjalla { font-family: 'Fjalla One', sans-serif; }
        
        .scrolling-text {
          white-space: nowrap;
          display: inline-block;
          animation: scroll 20s linear infinite;
        }
        
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .glass-card {
          background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.9));
        }

        .cap-letter {
          float: left;
          font-size: 140px;
          line-height: 0.8;
          font-weight: 900;
          margin-right: 20px;
          color: #0066ff;
        }
      `}</style>

      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'bg-black/80 backdrop-blur-md py-4' : 'bg-transparent py-8'}`}>
        <div className="max-w-[1800px] mx-auto px-10 flex justify-between items-center text-xs font-bold tracking-[0.2em] uppercase">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-8 h-8 object-contain drop-shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
            <span className="text-blue-500 font-oswald text-xl tracking-tighter">POLARYON</span>
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            <span className="text-white/40 hidden md:block">Sistema de Licitações Premium</span>
          </div>
          
          <div className="flex items-center gap-10">
            <a href="#about" className="hover:text-blue-500 transition-colors hidden md:block">Quem Somos</a>
            <a href="#contact" className="hover:text-blue-500 transition-colors hidden md:block">Contato</a>
            <Link to="/login" className="bg-white text-black px-6 py-2 rounded-full hover:bg-blue-500 hover:text-white transition-all transform active:scale-95">
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Horizontal Cards Sections (Geospace Style) */}
      <section className="flex flex-col lg:flex-row h-auto lg:h-[100vh] border-b border-white/10">
        {features.map((feature, idx) => (
          <motion.div 
            key={feature.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: idx * 0.2 }}
            className={`relative group flex-1 h-[60vh] lg:h-full overflow-hidden cursor-pointer border-white/10 ${idx !== 2 ? 'lg:border-r' : ''}`}
          >
            {/* Background Image Panel */}
            <div className="absolute inset-0 z-0">
              <div 
                className="w-full h-full bg-cover bg-center transition-transform duration-1000 group-hover:scale-110 opacity-40"
                style={{ backgroundImage: `url(${feature.bgImage})` }}
              />
              <div className="absolute inset-0 glass-card" />
            </div>

            {/* Content */}
            <div className="absolute inset-0 z-10 p-10 flex flex-col justify-end gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-blue-500 border border-blue-500/50 px-2 py-0.5 rounded uppercase tracking-widest">{feature.tag}</span>
                  <div className="w-1 h-1 bg-white/20 rounded-full" />
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{feature.author}</span>
                </div>
                <h2 className="text-4xl xl:text-5xl font-oswald font-bold leading-[1.1] uppercase tracking-tighter transition-all group-hover:text-blue-400">
                  {feature.alias}
                </h2>
              </div>
              
              {/* Animated Scroll Line like Geospace */}
              <div className="overflow-hidden border-t border-white/10 pt-4 mt-4 hidden lg:block translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                <div className="flex gap-10 animate-infinite-scroll whitespace-nowrap">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">{feature.title}</span>
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">{feature.title}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </section>

      {/* XLarge Scrolling Paragraph (Geospace Style) */}
      <section className="py-20 lg:py-40 bg-white text-black overflow-hidden relative">
        <div className="whitespace-nowrap flex py-10 rotate-[-1deg] scale-105">
          <div className="scrolling-text font-anton text-[15vh] lg:text-[25vh] leading-none uppercase tracking-tighter opacity-100 px-4">
            Polaryon System • Licitações Públicas • Excelência Operacional • Tecnologia de Ponta • 
          </div>
          <div className="scrolling-text font-anton text-[15vh] lg:text-[25vh] leading-none uppercase tracking-tighter opacity-100 px-4">
            Polaryon System • Licitações Públicas • Excelência Operacional • Tecnologia de Ponta • 
          </div>
        </div>
      </section>

      {/* Detail Section (Story Style) */}
      <section id="about" className="py-32 px-10">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-20">
          <div>
            <div className="flex items-center gap-4 text-blue-500 font-bold text-xs uppercase tracking-[0.3em] mb-10">
              <span>01 — 03</span>
              <div className="w-8 h-[1px] bg-blue-500" />
              <span>Conceito</span>
            </div>
            <h1 className="text-6xl lg:text-8xl font-oswald font-black uppercase leading-[0.9] tracking-tighter mb-10">
              Nascida no <br />
              <span className="text-blue-600">Terreno.</span>
            </h1>
            <div className="divider-circle bg-blue-500 w-4 h-4 rounded-full mb-10" />
            <div className="text-white/60 text-xl lg:text-2xl leading-relaxed font-medium">
              <span className="cap-letter font-anton">P</span>
              olaryon não é apenas um software, é o resultado de anos de experiência prática em licitações públicas. Entendemos que cada segundo conta na fase de lances e cada documento é crucial para a habilitação. Nossa plataforma foi desenhada para quem vive o dia a dia dos editais.
            </div>
          </div>

          <div className="relative">
            <div className="sticky top-40 bg-white/5 border border-white/10 rounded-[2.5rem] p-12 overflow-hidden overflow-y-auto max-h-[70vh] custom-scrollbar">
              <h3 className="text-2xl font-oswald font-bold uppercase mb-8 border-b border-white/10 pb-4">Nossa Missão</h3>
              <p className="text-white/40 mb-10 leading-relaxed">
                Nossa missão é democratizar o acesso a grandes contratos públicos através da tecnologia. Agregamos valor à sua empresa automatizando processos chatos e focando no que realmente importa: a estratégia de vitória.
              </p>
              
              <div className="grid grid-cols-1 gap-8">
                <div className="flex gap-6 items-start">
                  <Shield className="w-10 h-10 text-blue-500 shrink-0" />
                  <div>
                    <h4 className="font-bold uppercase tracking-widest text-sm mb-2">Segurança de Dados</h4>
                    <p className="text-xs text-white/30">Criptografia de ponta a ponta para seus documentos mais sensíveis.</p>
                  </div>
                </div>
                <div className="flex gap-6 items-start">
                  <Target className="w-10 h-10 text-blue-500 shrink-0" />
                  <div>
                    <h4 className="font-bold uppercase tracking-widest text-sm mb-2">Precisão Absoluta</h4>
                    <p className="text-xs text-white/30">Monitoramento em tempo real de editais e prazos finais.</p>
                  </div>
                </div>
                <div className="flex gap-6 items-start">
                   <Users className="w-10 h-10 text-blue-500 shrink-0" />
                  <div>
                    <h4 className="font-bold uppercase tracking-widest text-sm mb-2">Fluxo de Equipe</h4>
                    <p className="text-xs text-white/30">Gestão simplificada de responsabilidades e tarefas.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Footer (Geospace Style) */}
      <footer id="contact" className="py-20 px-10 border-t border-white/5 bg-black">
        <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
              <h2 className="text-4xl font-anton uppercase tracking-tighter">Polaryon</h2>
            </div>
            <p className="max-w-xs text-white/30 text-xs font-bold leading-relaxed tracking-widest uppercase">
              Excelência em Licitações Públicas. <br />
              Um produto JJ Corporation.
            </p>
          </div>
          
          <div className="flex flex-col gap-4 text-xs font-bold uppercase tracking-widest">
            <span className="text-blue-500">Localização</span>
            <span className="text-white/40">Curitiba, PR — Brasil</span>
          </div>

          <div className="flex flex-col gap-4 text-xs font-bold uppercase tracking-widest">
            <span className="text-blue-500">Contato</span>
            <a href="mailto:contato@polaryon.com.br" className="text-white/40 hover:text-white transition-colors underline-none decoration-transparent">contato@polaryon.com.br</a>
          </div>

          <div className="flex gap-6">
            <a href="#" className="p-3 bg-white/5 rounded-full hover:bg-blue-600 transition-all"><Instagram size={18} /></a>
            <a href="#" className="p-3 bg-white/5 rounded-full hover:bg-blue-600 transition-all"><Linkedin size={18} /></a>
            <a href="#" className="p-3 bg-white/5 rounded-full hover:bg-blue-600 transition-all"><Facebook size={18} /></a>
          </div>
        </div>
        
        <div className="mt-20 pt-10 border-t border-white/5 text-center text-[9px] font-bold text-white/10 uppercase tracking-[0.5em]">
          GeoSpace • Inspired Design • 2026 • Polaryon System
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
