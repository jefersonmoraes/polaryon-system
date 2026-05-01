import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useKanbanStore } from '@/store/kanban-store';
import { Star, ChevronRight, LayoutGrid } from 'lucide-react';
import { motion } from 'framer-motion';

const FavoritesBar: React.FC = () => {
  const { boards } = useKanbanStore();
  const location = useLocation();
  
  const favoriteBoards = boards
    .filter(b => b.isFavorite && !b.archived && !b.trashed)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  if (favoriteBoards.length === 0) return null;

  return (
    <div className="h-9 min-h-[36px] bg-background/40 backdrop-blur-md border-b border-white/5 flex items-center px-4 gap-4 overflow-x-auto scrollbar-hide shrink-0 z-40">
      <div className="flex items-center gap-1.5 shrink-0 border-r border-white/10 pr-4 mr-1">
        <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Favoritos</span>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1">
        {favoriteBoards.map((board) => {
          const isActive = location.pathname === `/board/${board.id}`;
          return (
            <Link
              key={board.id}
              to={`/board/${board.id}`}
              className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all duration-300 group whitespace-nowrap ${
                isActive 
                  ? 'bg-primary/20 border border-primary/30 text-white' 
                  : 'hover:bg-white/5 border border-transparent text-white/60 hover:text-white'
              }`}
            >
              <div 
                className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_5px_rgba(255,255,255,0.2)] group-hover:scale-110 transition-transform" 
                style={{ backgroundColor: board.backgroundColor || '#3b82f6' }} 
              />
              <span className="text-[11px] font-semibold tracking-tight">{board.name}</span>
              {isActive && (
                <motion.div layoutId="activeFav" className="ml-1">
                  <ChevronRight className="h-3 w-3 text-primary" />
                </motion.div>
              )}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-3 pl-4 border-l border-white/10 shrink-0">
        <Link 
          to="/kanban" 
          className="text-[10px] font-bold uppercase tracking-tighter text-white/30 hover:text-primary transition-colors flex items-center gap-1.5"
        >
          <LayoutGrid className="h-3 w-3" />
          Todos os Boards
        </Link>
      </div>
    </div>
  );
};

export default FavoritesBar;
