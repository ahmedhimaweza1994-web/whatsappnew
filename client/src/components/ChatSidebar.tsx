import { Search, MoreVertical, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Chat } from "@shared/schema";

interface ChatSidebarProps {
  chats: Chat[];
  selectedChatId?: string;
  onSelectChat: (chatId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ChatSidebar({ chats, selectedChatId, onSelectChat, searchQuery, onSearchChange }: ChatSidebarProps) {
  const getInitials = (name: string) => {
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white border-r w-full md:w-[420px]">
      <div className="flex items-center justify-between p-4" style={{ backgroundColor: '#075E54', height: '59px' }}>
        <Avatar className="h-10 w-10" data-testid="avatar-user">
          <AvatarFallback className="bg-gray-300 text-gray-700 text-sm font-medium">
            ME
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" data-testid="button-menu">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="p-2 bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 rounded-lg bg-gray-100 border-none focus-visible:ring-1 focus-visible:ring-primary"
            data-testid="input-search-chats"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
            <MessageSquare className="h-16 w-16 mb-4" />
            <p className="text-center">No chats found</p>
            <p className="text-sm text-center mt-2">Upload a WhatsApp export to get started</p>
          </div>
        ) : (
          filteredChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors",
                selectedChatId === chat.id && "bg-gray-100"
              )}
              style={{ height: '72px' }}
              data-testid={`chat-item-${chat.id}`}
            >
              <Avatar className="h-12 w-12 flex-shrink-0" data-testid={`avatar-chat-${chat.id}`}>
                <AvatarFallback 
                  className="text-white font-medium"
                  style={{ backgroundColor: chat.avatarColor || '#4ECDC4' }}
                >
                  {getInitials(chat.name)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-gray-900 truncate" data-testid={`text-chat-name-${chat.id}`}>
                    {chat.name}
                  </h3>
                  <span className="text-xs text-gray-500 ml-2 flex-shrink-0" data-testid={`text-chat-time-${chat.id}`}>
                    {formatTime(chat.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 truncate" data-testid={`text-chat-preview-${chat.id}`}>
                    {chat.messageCount} messages
                  </p>
                  {chat.messageCount > 0 && (
                    <span className="text-xs bg-primary text-white rounded-full px-2 py-0.5 ml-2" data-testid={`badge-count-${chat.id}`}>
                      {chat.messageCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
