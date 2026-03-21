import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Target, 
  Users, 
  MessageSquare, 
  Instagram, 
  Linkedin, 
  Facebook, 
  ArrowRight,
  Menu,
  X,
  Building2,
  Briefcase,
  FileText,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import { useState, useEffect } from 'react';

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const services = [
    {
      title: "Consultoria em Licitações",
      description: "Análise estratégica de editais e preparação completa para participação em certames públicos.",
      icon: Target,
      color: "from-blue-600/20 to-blue-900/40"
    },
    {
      title: "Gestão de Cadastros",
      description: "Manutenção e atualização de registros em portais como SICAF, Compras.gov e outros.",
      icon: Building2,
      color: "from-indigo-600/20 to-indigo-900/40"
    },
    {
      title: "Atestados Técnicos",
      description: "Organização e validação de acervo técnico para comprovação de capacidade operacional.",
      icon: Briefcase,
      color: "from-blue-500/20 to-blue-800/40"
    }
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-blue-500/30">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-black/40 backdrop-blur-xl border-b border-white/10 py-4' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-900 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              <span className="font-black text-xl">P</span>
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase italic">Polaryon</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#sobre" className="text-sm font-medium hover:text-blue-400 transition-colors uppercase tracking-widest text-white/70">Sobre</a>
            <a href="#servicos" className="text-sm font-medium hover:text-blue-400 transition-colors uppercase tracking-widest text-white/70">Serviços</a>
            <a href="#contato" className="text-sm font-medium hover:text-blue-400 transition-colors uppercase tracking-widest text-white/70">Contato</a>
            <Link to="/login" className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-2.5 rounded-full text-sm font-bold hover:bg-white/20 transition-all active:scale-95 flex items-center gap-2 group">
              Acessar Sistema
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button className="md:hidden p-2 text-white/70 hover:text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-0 z-40 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center gap-8 md:hidden"
        >
          <a href="#sobre" onClick={() => setIsMenuOpen(false)} className="text-2xl font-black uppercase tracking-widest">Sobre</a>
          <a href="#servicos" onClick={() => setIsMenuOpen(false)} className="text-2xl font-black uppercase tracking-widest">Serviços</a>
          <a href="#contato" onClick={() => setIsMenuOpen(false)} className="text-2xl font-black uppercase tracking-widest">Contato</a>
          <Link to="/login" className="bg-blue-600 px-10 py-4 rounded-full text-lg font-black uppercase tracking-wider">Acessar Sistema</Link>
        </motion.div>
      )}

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image with Parallax-like effect */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/polaryon_hero_bg_1774099790662.png" 
            alt="Polaryon Hero" 
            className="w-full h-full object-cover opacity-60 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/50" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#020617]/80 via-transparent to-[#020617]/80" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-blue-400 font-bold tracking-[0.3em] uppercase mb-4 block text-sm">Inovação em Licitações Públicas</span>
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter uppercase mb-8 leading-[0.85]">
              DOMINE O <br /> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">MERCADO</span>
            </h1>
            <p className="max-w-2xl mx-auto text-white/60 text-lg md:text-xl mb-12 font-medium leading-relaxed">
              Equipamos sua equipe com tecnologia de ponta para vencer os maiores desafios no setor de licitações. Inteligência, agilidade e resultados.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              <a href="#servicos" className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 px-10 py-5 rounded-2xl font-black text-lg uppercase tracking-wider transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] active:scale-95">
                Nossos Serviços
              </a>
              <Link to="/login" className="w-full md:w-auto bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 px-10 py-5 rounded-2xl font-black text-lg uppercase tracking-wider transition-all active:scale-95">
                Área Restrita
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Floating Background Elements */}
        <div className="absolute bottom-10 left-10 hidden lg:block animate-bounce opacity-20">
          <div className="w-1 h-32 bg-blue-500 rounded-full" />
        </div>
      </section>

      {/* About Section */}
      <section id="sobre" className="py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter">
                O Futuro das <br />
                <span className="text-blue-500">Licitações</span> já está aqui.
              </h2>
              <p className="text-white/50 text-xl leading-relaxed">
                A Polaryon é uma empresa dedicada a simplificar o complexo mundo das compras públicas. Combinamos expertise técnica com ferramentas digitais avançadas para garantir que sua empresa esteja sempre à frente nos processos licitatórios.
              </p>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="text-3xl font-black text-blue-400 mb-1">+500</div>
                  <div className="text-xs uppercase tracking-widest text-white/40 font-bold">Processos Gerenciados</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-blue-400 mb-1">R$ 50M+</div>
                  <div className="text-xs uppercase tracking-widest text-white/40 font-bold">Contratos Vencidos</div>
                </div>
              </div>
            </motion.div>

            {/* Vitrified Card */}
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-white/10 to-transparent p-1 rounded-[2.5rem] backdrop-blur-sm"
            >
              <div className="bg-[#020617]/80 rounded-[2.4rem] p-12 space-y-10 border border-white/5">
                <div className="flex gap-6 items-start">
                  <div className="p-4 bg-blue-500/20 rounded-2xl text-blue-400">
                    <Shield className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black uppercase mb-2">Conformidade Total</h4>
                    <p className="text-white/40">Garantimos que toda a documentação atenda rigorosamente aos requisitos legais e técnicos.</p>
                  </div>
                </div>
                <div className="flex gap-6 items-start">
                  <div className="p-4 bg-indigo-500/20 rounded-2xl text-indigo-400">
                    <Target className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black uppercase mb-2">Estratégia de Lances</h4>
                    <p className="text-white/40">Análise de concorrência e algoritmos para definição do melhor preço de participação.</p>
                  </div>
                </div>
                <div className="flex gap-6 items-start">
                  <div className="p-4 bg-blue-600/20 rounded-2xl text-blue-300">
                    <Users className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black uppercase mb-2">Equipe Especializada</h4>
                    <p className="text-white/40">Suporte personalizado por profissionais com anos de atuação no mercado público.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="servicos" className="py-32 bg-white/5 backdrop-blur-3xl border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div>
              <span className="text-blue-500 font-bold tracking-[0.2em] uppercase text-xs mb-4 block">Nossa Expertise</span>
              <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter">Serviços <br /> Integrados</h2>
            </div>
            <p className="max-w-md text-white/40 text-sm font-medium leading-relaxed">
              Oferecemos uma solução ponta a ponta para empresas que buscam expandir sua atuação através de contratos com o Poder Público.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <motion.div 
                key={service.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`group p-10 rounded-[2rem] bg-gradient-to-br ${service.color} border border-white/5 hover:border-blue-500/30 transition-all cursor-default`}
              >
                <service.icon className="w-12 h-12 text-blue-400 mb-8 group-hover:scale-110 transition-transform" />
                <h3 className="text-2xl font-black uppercase mb-4">{service.title}</h3>
                <p className="text-white/50 leading-relaxed">{service.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contato" className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-gradient-to-r from-blue-900/40 via-blue-800/20 to-transparent p-12 md:p-20 rounded-[3rem] border border-white/5 flex flex-col lg:flex-row gap-20">
            <div className="lg:w-1/2 space-y-10">
              <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter">Vamos <br /> <span className="text-blue-500 tracking-[-0.05em]">Conversar?</span></h2>
              <div className="space-y-6">
                <div className="flex items-center gap-4 text-white/70">
                  <MapPin className="w-6 h-6 text-blue-400" />
                  <span className="font-medium">Curitiba, PR - Brasil</span>
                </div>
                <div className="flex items-center gap-4 text-white/70">
                  <Phone className="w-6 h-6 text-blue-400" />
                  <span className="font-medium">+55 (41) 99999-9999</span>
                </div>
                <div className="flex items-center gap-4 text-white/70">
                  <Mail className="w-6 h-6 text-blue-400" />
                  <span className="font-medium">contato@polaryon.com.br</span>
                </div>
              </div>
              <div className="flex gap-4">
                <a href="#" className="p-4 bg-white/5 rounded-full hover:bg-blue-600 transition-all text-white/70 hover:text-white">
                  <Instagram className="w-6 h-6" />
                </a>
                <a href="#" className="p-4 bg-white/5 rounded-full hover:bg-blue-600 transition-all text-white/70 hover:text-white">
                  <Linkedin className="w-6 h-6" />
                </a>
                <a href="#" className="p-4 bg-white/5 rounded-full hover:bg-blue-600 transition-all text-white/70 hover:text-white">
                  <Facebook className="w-6 h-6" />
                </a>
              </div>
            </div>

            <div className="lg:w-1/2">
              <div className="grid gap-6">
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40">Seu Nome</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-blue-500 transition-colors" placeholder="Ex: João Silva" />
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40">E-mail</label>
                  <input type="email" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-blue-500 transition-colors" placeholder="joao@empresa.com" />
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40">Mensagem</label>
                  <textarea className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-blue-500 transition-colors min-h-[150px]" placeholder="Como podemos ajudar sua empresa?" />
                </div>
                <button className="bg-blue-600 py-5 rounded-2xl font-black uppercase tracking-wider text-lg hover:bg-blue-500 transition-all active:scale-95">Enviar Mensagem</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 text-center">
        <p className="text-white/20 text-xs font-bold uppercase tracking-widest">
          © 2026 POLARYON SYSTEM. TODOS OS DIREITOS RESERVADOS.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
