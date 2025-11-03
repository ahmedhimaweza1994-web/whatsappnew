import { useState, useMemo } from "react";
import { Search, MoreVertical, Image, Download, FileJson, Pin, Archive, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageBubble } from "@/components/MessageBubble";
import { MediaGallery } from "@/components/MediaGallery";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { Chat, Message } from "@shared/schema";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ChatWindowProps {
  chat: Chat | null;
  messages: Message[];
  onSearch: () => void;
  onToggleSidebar?: () => void;
}

export function ChatWindow({ chat, messages, onSearch, onToggleSidebar }: ChatWindowProps) {
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false);
  const { toast } = useToast();

  const uniqueSenders = useMemo(() => {
    const senders = new Set<string>();
    messages.forEach(msg => {
      if (msg.sender && !msg.isSystemMessage) {
        senders.add(msg.sender);
      }
    });
    return Array.from(senders);
  }, [messages]);

  if (!chat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
        {onToggleSidebar && (
          <div className="md:hidden absolute top-4 left-4">
            <Button
              size="icon"
              variant="outline"
              className="h-10 w-10"
              onClick={onToggleSidebar}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
          </div>
        )}
        <div className="text-center text-gray-400">
          <div className="text-6xl mb-4">💬</div>
          <h2 className="text-2xl font-light mb-2">WhatsApp Export Viewer</h2>
          <p>Select a chat to view messages</p>
        </div>
      </div>
    );
  }

  const handleExportJSON = async () => {
    try {
      const response = await fetch(`/api/chats/${chat.id}/export/json`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${chat.name.replace(/[^a-z0-9]/gi, '_')}_export.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: "Chat exported to JSON",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export chat",
        variant: "destructive",
      });
    }
  };

  const handleTogglePin = async () => {
    try {
      const response = await fetch(`/api/chats/${chat.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPinned: !chat.isPinned }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Update failed');
      
      await queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
      
      toast({
        title: chat.isPinned ? "Chat unpinned" : "Chat pinned",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update chat",
        variant: "destructive",
      });
    }
  };

  const handleToggleArchive = async () => {
    try {
      const response = await fetch(`/api/chats/${chat.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isArchived: !chat.isArchived }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Update failed');
      
      await queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
      
      toast({
        title: chat.isArchived ? "Chat unarchived" : "Chat archived",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update chat",
        variant: "destructive",
      });
    }
  };

  const handleSwapSender = async (senderName: string) => {
    try {
      const response = await fetch(`/api/chats/${chat.id}/swap-sender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderName }),
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Swap failed');
      
      await queryClient.invalidateQueries({ queryKey: [`/api/chats/${chat.id}/messages`] });
      
      toast({
        title: "Sender updated",
        description: `Messages from "${senderName}" are now marked as "me"`,
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to swap sender",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatDateDivider = (date: Date) => {
    if (isToday(date)) {
      return 'TODAY';
    } else if (isYesterday(date)) {
      return 'YESTERDAY';
    } else {
      return format(date, 'MMMM d, yyyy').toUpperCase();
    }
  };

  const groupedMessages = messages.reduce((groups: { date: Date; messages: Message[] }[], message) => {
    const messageDate = new Date(message.timestamp);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && isSameDay(lastGroup.date, messageDate)) {
      lastGroup.messages.push(message);
    } else {
      groups.push({
        date: messageDate,
        messages: [message],
      });
    }

    return groups;
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full">
      <div 
        className="flex items-center justify-between px-4" 
        style={{ backgroundColor: '#075E54', height: '59px' }}
      >
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/10 md:hidden"
              onClick={onToggleSidebar}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
          )}
          <Avatar className="h-10 w-10" data-testid="avatar-chat-header">
            <AvatarFallback 
              className="text-white font-medium"
              style={{ backgroundColor: chat.avatarColor || '#4ECDC4' }}
            >
              {getInitials(chat.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-white font-medium text-sm md:text-base" data-testid="text-chat-header-name">{chat.name}</h2>
            <p className="text-white/80 text-xs" data-testid="text-chat-header-count">
              {chat.messageCount} messages
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="icon" 
            variant="ghost" 
            className="text-white hover:bg-white/10"
            onClick={onSearch}
            data-testid="button-search-messages"
          >
            <Search className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                size="icon" 
                variant="ghost" 
                className="text-white hover:bg-white/10"
                data-testid="button-chat-menu"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" data-testid="menu-chat-options">
              <DropdownMenuItem onClick={() => setMediaGalleryOpen(true)} data-testid="menu-media-gallery">
                <Image className="h-4 w-4 mr-2" />
                Media Gallery
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {uniqueSenders.length > 1 && (
                <>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger data-testid="menu-swap-sender">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Change "Me"
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {uniqueSenders.map((sender) => (
                        <DropdownMenuItem 
                          key={sender} 
                          onClick={() => handleSwapSender(sender)}
                          data-testid={`menu-sender-${sender}`}
                        >
                          {sender}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleExportJSON} data-testid="menu-export-json">
                <FileJson className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleTogglePin} data-testid="menu-toggle-pin">
                <Pin className="h-4 w-4 mr-2" />
                {chat.isPinned ? 'Unpin Chat' : 'Pin Chat'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleArchive} data-testid="menu-toggle-archive">
                <Archive className="h-4 w-4 mr-2" />
                {chat.isArchived ? 'Unarchive Chat' : 'Archive Chat'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <MediaGallery 
        chatId={chat.id} 
        open={mediaGalleryOpen} 
        onOpenChange={setMediaGalleryOpen} 
      />

      <div 
        className="flex-1 overflow-y-auto p-4 space-y-1"
        style={{ 
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h100v100H0z\' fill=\'%23e5ddd5\'/%3E%3Cpath d=\'M20 20l5-5m10 0l5 5m10-5l5 5m-40 20l5-5m10 0l5 5m10-5l5 5m-40 20l5-5m10 0l5 5m10-5l5 5\' stroke=\'%23d1ccc0\' stroke-width=\'.5\' fill=\'none\'/%3E%3C/svg%3E")',
          backgroundColor: '#e5ddd5'
        }}
        data-testid="container-messages"
      >
        {groupedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400">No messages in this chat</p>
          </div>
        ) : (
          groupedMessages.map((group, groupIndex) => (
            <div key={groupIndex}>
              <div className="flex justify-center my-4">
                <div 
                  className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-md shadow-sm"
                  data-testid={`date-divider-${groupIndex}`}
                >
                  <span className="text-xs font-medium text-gray-600">
                    {formatDateDivider(group.date)}
                  </span>
                </div>
              </div>
              {group.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </div>
          ))
        )}
      </div>

      <div className="p-3 bg-gray-100 border-t">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white rounded-full px-4 py-2.5 text-sm text-gray-400">
            Type a message (read-only mode)
          </div>
        </div>
      </div>
    </div>
  );
}
