import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadDialog({ open, onOpenChange }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{ chatCount: number; messageCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.txt') || droppedFile.name.endsWith('.zip'))) {
      setFile(droppedFile);
      setError(null);
      setUploadResult(null);
    } else {
      setError('Please upload a .txt or .zip file');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setUploadResult(null);
    }
  }, []);

  const pollUploadStatus = (uploadId: string) => {
    stopPolling();

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/upload/${uploadId}/status`, {
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error('Failed to check upload status');
        }

        const status = await res.json();
        setProgress(status.progress);

        if (status.status === 'completed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          
          setUploadResult({
            chatCount: status.chatCount,
            messageCount: status.messageCount,
          });

          await queryClient.invalidateQueries({ queryKey: ['/api/chats'] });

          toast({
            title: "Upload successful!",
            description: `Imported ${status.chatCount} chats with ${status.messageCount} messages`,
          });

          setTimeout(() => {
            onOpenChange(false);
            setFile(null);
            setProgress(0);
            setUploadResult(null);
            setUploading(false);
          }, 2000);
        } else if (status.status === 'failed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          
          setError(status.errorMessage || 'Upload processing failed');
          setUploading(false);
          setProgress(0);

          toast({
            title: "Upload failed",
            description: status.errorMessage || 'Failed to process the file',
            variant: "destructive",
          });
        }
      } catch (err: any) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        setError(err.message || 'Failed to check upload status');
        setUploading(false);
        setProgress(0);
      }
    }, 1500);
  };

  const handleUpload = async () => {
    if (!file) return;

    stopPolling();
    setUploading(true);
    setProgress(0);
    setError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Upload failed');
      }

      const result = await res.json();

      if (result.uploadId) {
        setProgress(5);
        pollUploadStatus(result.uploadId);
      } else {
        setProgress(100);
        setUploadResult({
          chatCount: result.chatCount,
          messageCount: result.messageCount,
        });

        await queryClient.invalidateQueries({ queryKey: ['/api/chats'] });

        toast({
          title: "Upload successful!",
          description: `Imported ${result.chatCount} chats with ${result.messageCount} messages`,
        });

        setTimeout(() => {
          onOpenChange(false);
          setFile(null);
          setProgress(0);
          setUploadResult(null);
          setUploading(false);
        }, 2000);
      }
    } catch (err: any) {
      stopPolling();
      setError(err.message || 'Upload failed');
      setProgress(0);
      setUploading(false);
      toast({
        title: "Upload failed",
        description: err.message || 'Failed to process the file',
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-upload">
        <DialogHeader>
          <DialogTitle>Upload WhatsApp Export</DialogTitle>
          <DialogDescription>
            Upload a WhatsApp chat export (.txt file) or a .zip file containing the chat and media
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!file && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-input')?.click()}
              data-testid="dropzone-upload"
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm text-gray-600 mb-2">
                Drag and drop your file here, or click to select
              </p>
              <p className="text-xs text-gray-400">
                Supported formats: .txt, .zip
              </p>
              <input
                id="file-input"
                type="file"
                accept=".txt,.zip"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file"
              />
            </div>
          )}

          {file && !uploadResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg" data-testid="file-preview">
                <FileText className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" data-testid="text-filename">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                {!uploading && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setFile(null)}
                    data-testid="button-remove-file"
                  >
                    <XCircle className="h-5 w-5" />
                  </Button>
                )}
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Uploading and parsing...</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} data-testid="progress-upload" />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg" data-testid="alert-error">
                  <XCircle className="h-5 w-5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => setFile(null)}
                  variant="outline"
                  className="flex-1"
                  disabled={uploading}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  className="flex-1"
                  disabled={uploading}
                  data-testid="button-upload"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload'
                  )}
                </Button>
              </div>
            </div>
          )}

          {uploadResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 text-green-700 rounded-lg" data-testid="alert-success">
                <CheckCircle className="h-8 w-8" />
                <div>
                  <p className="font-medium">Upload successful!</p>
                  <p className="text-sm">
                    Imported {uploadResult.chatCount} chats with {uploadResult.messageCount} messages
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
