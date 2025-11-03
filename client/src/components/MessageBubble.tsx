import { useState } from "react";
import { Check, CheckCheck, Image as ImageIcon, Video, FileText, Music, Download, ExternalLink, ZoomIn } from "lucide-react";
import type { Message } from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  
  const formatTime = (date: Date) => {
    return format(new Date(date), 'h:mm a');
  };

  const detectRTL = (text: string | null) => {
    if (!text) return false;
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return arabicPattern.test(text);
  };

  const isFromMe = message.isFromMe;
  const isRTL = detectRTL(message.content);

  const shouldHideContent = () => {
    if (!message.content || !message.mediaUrl) return false;
    
    let remainingContent = message.content.trim();
    
    const mediaPlaceholders = [
      'تم استبعاد الوسائط',
      'تم استبعاد الصورة',
      'تم استبعاد الفيديو', 
      'تم استبعاد الصوت',
      'تم استبعاد',
      'الملف مرفق',
      'file attached',
      'omitted',
      'image omitted',
      'video omitted',
      'audio omitted',
      '<attached:'
    ];
    
    for (const placeholder of mediaPlaceholders) {
      const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      remainingContent = remainingContent.replace(new RegExp(escapedPlaceholder, 'gi'), '');
    }
    
    if (message.mediaName) {
      remainingContent = remainingContent.replace(message.mediaName, '');
    }
    
    remainingContent = remainingContent.replace(/[<>()،\s\-_]+/g, '').trim();
    
    return remainingContent.length === 0;
  };

  const renderMediaIcon = () => {
    switch (message.mediaType) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'audio':
        return <Music className="h-4 w-4" />;
      case 'document':
      case 'file':
        return <FileText className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const renderMedia = () => {
    if (!message.mediaUrl) return null;

    switch (message.mediaType) {
      case 'image':
        return (
          <div className="mb-2 relative group">
            <img 
              src={message.mediaUrl} 
              alt={message.mediaName || 'Image'}
              className="max-w-full rounded-md cursor-pointer hover:opacity-90 transition-opacity"
              style={{ maxHeight: '300px', objectFit: 'cover' }}
              onClick={() => setImageDialogOpen(true)}
              data-testid={`media-image-${message.id}`}
            />
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setImageDialogOpen(true)}
              data-testid={`button-zoom-${message.id}`}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
              <DialogContent className="max-w-4xl" data-testid={`dialog-image-${message.id}`}>
                <img 
                  src={message.mediaUrl} 
                  alt={message.mediaName || 'Image'}
                  className="w-full h-auto"
                />
              </DialogContent>
            </Dialog>
          </div>
        );
      
      case 'video':
        return (
          <div className="mb-2">
            <video 
              controls 
              className="max-w-full rounded-md"
              style={{ maxHeight: '300px' }}
              data-testid={`media-video-${message.id}`}
            >
              <source src={message.mediaUrl} />
              Your browser does not support the video tag.
            </video>
          </div>
        );
      
      case 'audio':
        return (
          <div className="mb-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
            <audio 
              controls 
              className="w-full"
              data-testid={`media-audio-${message.id}`}
            >
              <source src={message.mediaUrl} />
              Your browser does not support the audio tag.
            </audio>
          </div>
        );
      
      case 'document':
      case 'file':
        return (
          <div className="mb-2">
            <a 
              href={message.mediaUrl} 
              download={message.mediaName}
              className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              data-testid={`media-document-${message.id}`}
            >
              <FileText className="h-5 w-5 text-blue-500" />
              <span className="flex-1 text-sm font-medium truncate">{message.mediaName || 'Document'}</span>
              <Download className="h-4 w-4 text-gray-500" />
            </a>
          </div>
        );
      
      default:
        return null;
    }
  };

  const renderLinkPreview = () => {
    if (message.mediaType !== 'link' || !message.mediaUrl) return null;
    
    return (
      <div className="mt-2 p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800">
        <a 
          href={message.mediaUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          data-testid={`link-preview-${message.id}`}
        >
          <ExternalLink className="h-4 w-4" />
          <span className="truncate">{message.mediaUrl}</span>
        </a>
      </div>
    );
  };

  if (message.isSystemMessage) {
    return (
      <div className="flex justify-center my-2" data-testid={`message-system-${message.id}`}>
        <div className="bg-white/60 backdrop-blur-sm px-3 py-1 rounded-md max-w-md">
          <p className="text-xs text-gray-600 text-center">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "flex mb-1",
        isFromMe ? "justify-end" : "justify-start"
      )}
      data-testid={`message-${message.id}`}
    >
      <div
        className={cn(
          "max-w-[65%] rounded-lg px-3 py-2 relative",
          isFromMe 
            ? "bg-[#DCF8C6]" 
            : "bg-white shadow-sm"
        )}
        style={{
          borderRadius: isFromMe 
            ? "7.5px 7.5px 0px 7.5px"
            : "7.5px 7.5px 7.5px 0px"
        }}
      >
        {!isFromMe && message.sender && (
          <p 
            className="text-sm font-medium mb-1"
            style={{ color: '#075E54' }}
            data-testid={`text-sender-${message.id}`}
            dir={detectRTL(message.sender) ? 'rtl' : 'ltr'}
          >
            {message.sender}
          </p>
        )}
        
        {renderMedia()}

        {message.content && !shouldHideContent() && (
          <div className="break-words whitespace-pre-wrap" data-testid={`text-content-${message.id}`} dir={isRTL ? 'rtl' : 'ltr'}>
            <p className="text-sm" style={{ lineHeight: '1.4' }}>
              {message.content}
            </p>
          </div>
        )}

        {renderLinkPreview()}

        <div className="flex items-center justify-end gap-1 mt-1">
          <span 
            className="text-xs" 
            style={{ color: isFromMe ? '#667781' : '#8696a0' }}
            data-testid={`text-timestamp-${message.id}`}
          >
            {formatTime(message.timestamp)}
          </span>
          {isFromMe && (
            <span className="text-gray-500" data-testid={`icon-status-${message.id}`}>
              <CheckCheck className="h-4 w-4" style={{ color: '#53bdeb' }} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
