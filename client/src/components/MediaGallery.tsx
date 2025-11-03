import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Image as ImageIcon, Video, Music, FileText, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { Message } from "@shared/schema";

interface MediaGalleryProps {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MediaGallery({ chatId, open, onOpenChange }: MediaGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string>("all");

  const { data: mediaMessages = [] } = useQuery<Message[]>({
    queryKey: ['/api/chats', chatId, 'media', mediaType === "all" ? undefined : mediaType],
    enabled: open && !!chatId,
  });

  const images = mediaMessages.filter(m => m.mediaType === 'image');
  const videos = mediaMessages.filter(m => m.mediaType === 'video');
  const audio = mediaMessages.filter(m => m.mediaType === 'audio');
  const documents = mediaMessages.filter(m => m.mediaType === 'document');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh]" data-testid="dialog-media-gallery">
          <DialogHeader>
            <DialogTitle>Media Gallery</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="all" className="w-full" onValueChange={setMediaType}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all" data-testid="tab-all">
                All ({mediaMessages.length})
              </TabsTrigger>
              <TabsTrigger value="image" data-testid="tab-images">
                <ImageIcon className="h-4 w-4 mr-1" />
                Images ({images.length})
              </TabsTrigger>
              <TabsTrigger value="video" data-testid="tab-videos">
                <Video className="h-4 w-4 mr-1" />
                Videos ({videos.length})
              </TabsTrigger>
              <TabsTrigger value="audio" data-testid="tab-audio">
                <Music className="h-4 w-4 mr-1" />
                Audio ({audio.length})
              </TabsTrigger>
              <TabsTrigger value="document" data-testid="tab-documents">
                <FileText className="h-4 w-4 mr-1" />
                Documents ({documents.length})
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 max-h-[500px] overflow-y-auto">
              <TabsContent value="all" className="grid grid-cols-3 gap-4" data-testid="content-all">
                {mediaMessages.map((msg) => (
                  <MediaItem key={msg.id} message={msg} onImageClick={setSelectedImage} />
                ))}
                {mediaMessages.length === 0 && (
                  <div className="col-span-3 text-center text-gray-500 py-8">
                    No media files found
                  </div>
                )}
              </TabsContent>

              <TabsContent value="image" className="grid grid-cols-3 gap-4" data-testid="content-images">
                {images.map((msg) => (
                  <MediaItem key={msg.id} message={msg} onImageClick={setSelectedImage} />
                ))}
                {images.length === 0 && (
                  <div className="col-span-3 text-center text-gray-500 py-8">
                    No images found
                  </div>
                )}
              </TabsContent>

              <TabsContent value="video" className="grid grid-cols-2 gap-4" data-testid="content-videos">
                {videos.map((msg) => (
                  <MediaItem key={msg.id} message={msg} onImageClick={setSelectedImage} />
                ))}
                {videos.length === 0 && (
                  <div className="col-span-2 text-center text-gray-500 py-8">
                    No videos found
                  </div>
                )}
              </TabsContent>

              <TabsContent value="audio" className="space-y-2" data-testid="content-audio">
                {audio.map((msg) => (
                  <MediaItem key={msg.id} message={msg} onImageClick={setSelectedImage} />
                ))}
                {audio.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No audio files found
                  </div>
                )}
              </TabsContent>

              <TabsContent value="document" className="space-y-2" data-testid="content-documents">
                {documents.map((msg) => (
                  <MediaItem key={msg.id} message={msg} onImageClick={setSelectedImage} />
                ))}
                {documents.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No documents found
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl" data-testid="dialog-image-preview">
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 z-50"
            onClick={() => setSelectedImage(null)}
            data-testid="button-close-preview"
          >
            <X className="h-4 w-4" />
          </Button>
          {selectedImage && (
            <img src={selectedImage} alt="Preview" className="w-full h-auto" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MediaItem({ message, onImageClick }: { message: Message; onImageClick: (url: string) => void }) {
  if (message.mediaType === 'image' && message.mediaUrl) {
    return (
      <div
        className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group"
        onClick={() => onImageClick(message.mediaUrl!)}
        data-testid={`media-item-${message.id}`}
      >
        <img
          src={message.mediaUrl}
          alt={message.mediaName || 'Image'}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity" />
      </div>
    );
  }

  if (message.mediaType === 'video' && message.mediaUrl) {
    return (
      <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden" data-testid={`media-item-${message.id}`}>
        <video src={message.mediaUrl} className="w-full h-full object-cover" controls />
      </div>
    );
  }

  if (message.mediaType === 'audio' && message.mediaUrl) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg" data-testid={`media-item-${message.id}`}>
        <div className="flex items-center gap-3 mb-2">
          <Music className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium truncate">{message.mediaName || 'Audio file'}</span>
        </div>
        <audio src={message.mediaUrl} controls className="w-full" />
      </div>
    );
  }

  if ((message.mediaType === 'document' || message.mediaType === 'file') && message.mediaUrl) {
    return (
      <a
        href={message.mediaUrl}
        download={message.mediaName}
        className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        data-testid={`media-item-${message.id}`}
      >
        <FileText className="h-6 w-6 text-blue-500" />
        <span className="flex-1 text-sm font-medium truncate">{message.mediaName || 'Document'}</span>
        <Download className="h-4 w-4 text-gray-500" />
      </a>
    );
  }

  return null;
}
