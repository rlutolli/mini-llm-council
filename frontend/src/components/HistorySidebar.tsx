import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Trash2, ChevronLeft, ChevronRight, MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { getDebates, deleteDebate, clearAllDebates } from '@/lib/storage';
import type { Debate } from '@/types/council';
import { cn } from '@/lib/utils';

interface HistorySidebarProps {
  onNewChat?: () => void;
  onSelectDebate?: (debate: Debate) => void;
  activeDebateId?: string;
}

export function HistorySidebar({ onNewChat, onSelectDebate, activeDebateId }: HistorySidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [debates, setDebates] = useState<Debate[]>([]);

  useEffect(() => {
    setDebates(getDebates());
  }, []);

  const handleDelete = (id: string) => {
    deleteDebate(id);
    setDebates(getDebates());
  };

  const handleClearAll = () => {
    clearAllDebates();
    setDebates([]);
  };

  return (
    <>
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isCollapsed ? 0 : 280,
          opacity: 1,
          x: isCollapsed ? -280 : 0
        }}
        className={cn(
          'fixed md:sticky md:top-0 z-40 h-[100dvh] border-r border-border bg-sidebar flex flex-col overflow-hidden transition-all duration-300 flex-shrink-0',
          isCollapsed ? 'pointer-events-none' : 'pointer-events-auto'
        )}
      >
        {/* Header */}
        <div className="flex flex-col gap-4 p-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-sidebar-foreground" />
              <h2 className="text-sm font-semibold text-sidebar-foreground">History</h2>
            </div>

            {debates.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground whitespace-nowrap px-2">
                    Clear all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all debates?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all saved debates. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll}>
                      Clear all
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* New Chat Button */}
          <Button
            onClick={onNewChat}
            className="w-full justify-start gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span className="font-semibold">New Deliberation</span>
          </Button>
        </div>

        {/* Debates list */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {debates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No debates yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Your deliberations will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {debates.map((debate) => (
                  <div
                    key={debate.id}
                    onClick={() => onSelectDebate?.(debate)}
                    className={cn(
                      "group flex items-start gap-2 p-2 rounded-lg hover:bg-sidebar-accent cursor-pointer transition-colors",
                      activeDebateId === debate.id && "bg-sidebar-accent"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-sidebar-foreground truncate">
                        {debate.prompt}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(debate.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(debate.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </motion.aside >

      {/* Persistent Toggle Button */}
      < Button
        variant="outline"
        size="icon"
        onClick={() => setIsCollapsed(!isCollapsed)
        }
        className={
          cn(
            'fixed top-4 z-50 h-8 w-8 rounded-full shadow-md transition-all duration-300 bg-background',
            isCollapsed ? 'left-4' : 'left-[264px]'
          )
        }
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button >
    </>
  );
}
