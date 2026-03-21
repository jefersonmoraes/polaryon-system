import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";

const NotFound = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
      <div className="text-center p-12 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl">
        <h1 className="mb-4 text-8xl font-black tracking-tighter text-blue-500">404</h1>
        <p className="mb-8 text-xl text-white/50 font-medium">Ops! Esta página não existe no Polaryon.</p>
        <Link to={isAuthenticated ? "/tarefas" : "/"} className="bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-xl font-bold uppercase tracking-wider transition-all inline-block shadow-[0_0_20px_rgba(37,99,235,0.3)]">
          Voltar para o Início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
