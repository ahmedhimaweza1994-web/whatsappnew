import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload as UploadIcon, Moon, Sun } from "lucide-react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { UploadDialog } from "@/components/UploadDialog";
import { SearchDialog } from "@/components/SearchDialog";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import type { Chat, Message } from "@shared/schema";

export default function Home() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const { data: chats = [] } = useQuery<Chat[]>({
    queryKey: ['/api/chats'],
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/chats', selectedChatId, 'messages'],
    enabled: !!selectedChatId,
  });

  const selectedChat = chats.find(c => c.id === selectedChatId);

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className={`relative ${sidebarOpen ? 'block' : 'hidden md:block'} w-full md:w-auto`}>
        <ChatSidebar
          chats={chats}
          selectedChatId={selectedChatId || undefined}
          onSelectChat={handleSelectChat}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <div className="absolute bottom-6 right-6 flex flex-col gap-3">
          <Button
            size="icon"
            variant="outline"
            className="h-12 w-12 rounded-full shadow-lg bg-white dark:bg-gray-800"
            onClick={toggleTheme}
            data-testid="button-toggle-theme"
          >
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={() => setUploadDialogOpen(true)}
            data-testid="button-open-upload"
          >
            <UploadIcon className="h-6 w-6" />
          </Button>
        </div>
      </div>

      <div className={`flex-1 ${sidebarOpen ? 'hidden md:block' : 'block'}`}>
        <ChatWindow
          chat={selectedChat || null}
          messages={messages}
          onSearch={() => setSearchDialogOpen(true)}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>

      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />

      <SearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSelectMessage={(chatId) => setSelectedChatId(chatId)}
      />
    </div>
  );
}
