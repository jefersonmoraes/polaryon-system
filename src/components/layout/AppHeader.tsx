import { Link, useLocation } from 'react-router-dom';
import { Search, Bell, Moon, Sun, Plus, LayoutDashboard } from 'lucide-react';
import { useKanbanStore } from '@/store/kanban-store';
import logo from '@/assets/logo.png';
import { useState } from 'react';

const AppHeader = () => {
  const { isDark, toggleTheme } = useKanbanStore();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="kanban-header h-12 flex items-center px-4 gap-3 shrink-0 z-50">
      <Link to="/" className="flex items-center gap-2 shrink-0">
        <img src={logo} alt="JJ Corporation" className="h-7 w-7 rounded-full" />
        <span className="font-bold text-sm tracking-tight hidden sm:block">JJ Corporation Kanban</span>
      </Link>

      <nav className="flex items-center gap-1 ml-2">
        <Link
          to="/"
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            location.pathname === '/' ? 'bg-primary/20' : 'hover:bg-primary/10'
          }`}
        >
          <LayoutDashboard className="h-3.5 w-3.5 inline mr-1" />
          Dashboard
        </Link>
      </nav>

      <div className="flex-1" />

      <div className={`flex items-center transition-all ${searchOpen ? 'w-64' : 'w-8'}`}>
        {searchOpen ? (
          <input
            autoFocus
            onBlur={() => setSearchOpen(false)}
            placeholder="Buscar..."
            className="w-full bg-primary/10 border-none rounded px-3 py-1.5 text-xs outline-none placeholder:text-kanban-header-foreground/50"
          />
        ) : (
          <button onClick={() => setSearchOpen(true)} className="p-1.5 rounded hover:bg-primary/10 transition-colors">
            <Search className="h-4 w-4" />
          </button>
        )}
      </div>

      <button className="p-1.5 rounded hover:bg-primary/10 transition-colors relative">
        <Bell className="h-4 w-4" />
      </button>

      <button onClick={toggleTheme} className="p-1.5 rounded hover:bg-primary/10 transition-colors">
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-accent-foreground">
        JJ
      </div>
    </header>
  );
};

export default AppHeader;
