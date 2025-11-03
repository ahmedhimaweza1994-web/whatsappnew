import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Calendar, Image as ImageIcon, Video, FileText, Mic } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import type { Message } from "@shared/schema";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMessage?: (chatId: string, messageId: string) => void;
}

type MessageWithChat = Message & { chatName: string };

export function SearchDialog({ open, onOpenChange, onSelectMessage }: SearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const { data: results = [], isLoading } = useQuery<MessageWithChat[]>({
    queryKey: [`/api/search?q=${encodeURIComponent(searchQuery)}`],
    enabled: searchQuery.length > 2,
  });

  const filteredResults = results.filter(msg => {
    if (activeFilter === "all") return true;
    if (activeFilter === "media") return !!msg.mediaType;
    if (activeFilter === "links") return msg.content?.includes("http") || false;
    return msg.mediaType === activeFilter;
  });

  const handleSelectMessage = (message: MessageWithChat) => {
    if (onSelectMessage) {
      onSelectMessage(message.chatId, message.id);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] p-0" data-testid="dialog-search">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Search Messages</DialogTitle>
        </DialogHeader>
        
        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <Input
              type="search"
              placeholder="Search in all chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 dark:bg-gray-800 dark:text-gray-100"
              autoFocus
              data-testid="input-global-search"
            />
            {searchQuery && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeFilter} onValueChange={setActiveFilter} className="px-6 pt-4">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="all" className="text-xs" data-testid="filter-all">All</TabsTrigger>
            <TabsTrigger value="media" className="text-xs" data-testid="filter-media">
              <ImageIcon className="h-3 w-3 mr-1" />
              Media
            </TabsTrigger>
            <TabsTrigger value="image" className="text-xs" data-testid="filter-images">
              <ImageIcon className="h-3 w-3 mr-1" />
              Photos
            </TabsTrigger>
            <TabsTrigger value="video" className="text-xs" data-testid="filter-videos">
              <Video className="h-3 w-3 mr-1" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="document" className="text-xs" data-testid="filter-documents">
              <FileText className="h-3 w-3 mr-1" />
              Docs
            </TabsTrigger>
            <TabsTrigger value="links" className="text-xs" data-testid="filter-links">
              Links
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ maxHeight: '500px' }}>
          {searchQuery.length < 3 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Type at least 3 characters to search</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-3"></div>
              <p>Searching...</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No messages found</p>
            </div>
          ) : (
            <div className="space-y-2 mt-4">
              {filteredResults.map((message) => (
                <button
                  key={message.id}
                  onClick={() => handleSelectMessage(message)}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
                  data-testid={`result-message-${message.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          {message.chatName}
                        </span>
                        {message.mediaType && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            {message.mediaType === 'image' && <ImageIcon className="h-3 w-3 inline mr-1" />}
                            {message.mediaType === 'video' && <Video className="h-3 w-3 inline mr-1" />}
                            {message.mediaType === 'audio' && <Mic className="h-3 w-3 inline mr-1" />}
                            {message.mediaType === 'document' && <FileText className="h-3 w-3 inline mr-1" />}
                            {message.mediaType}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        <span className="font-medium">{message.sender}:</span>{' '}
                        {message.content && message.content.length > 100 
                          ? message.content.substring(0, 100) + '...' 
                          : (message.content || '')}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(message.timestamp), 'MMM d, yyyy h:mm a')}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
