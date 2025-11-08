import yauzl from 'yauzl';
import { createWriteStream, promises as fs } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { WhatsAppParser } from './whatsapp-parser';
import type { IStorage } from './storage';

interface ProcessingOptions {
  filePath: string;
  userId: string;
  uploadId: string;
  storage: IStorage;
}

interface MediaFile {
  filename: string;
  timestamp: Date;
  type: string;
}

export class StreamingZipProcessor {
  private storage: IStorage;
  private userId: string;
  private uploadId: string;
  private filePath: string;
  private mediaFolder: string;
  private extractedMediaPaths: string[] = [];
  
  constructor(options: ProcessingOptions) {
    this.storage = options.storage;
    this.userId = options.userId;
    this.uploadId = options.uploadId;
    this.filePath = options.filePath;
    this.mediaFolder = path.join('uploads', 'media', this.userId);
  }

  async process(): Promise<void> {
    try {
      await this.updateProgress(5, 'Starting ZIP extraction...');
      
      const { chatFiles, mediaFiles } = await this.extractZipStreaming();
      
      await this.updateProgress(50, 'Parsing chat files...');
      const parsedChats = await this.parseChats(chatFiles);
      
      await this.updateProgress(70, 'Mapping media to messages...');
      this.mapMediaToChats(parsedChats, mediaFiles);
      
      await this.updateProgress(80, 'Saving to database...');
      const { totalMessages, chatCount } = await this.saveToDatabase(parsedChats);
      
      await this.updateProgress(95, 'Cleaning up...');
      await fs.unlink(this.filePath);
      
      await this.updateProgress(100, 'Complete', totalMessages, chatCount);
      
      console.log(`[StreamingProcessor] ✓ Upload ${this.uploadId} complete: ${chatCount} chats, ${totalMessages} messages`);
    } catch (error) {
      console.error(`[StreamingProcessor] Error processing upload ${this.uploadId}:`, error);
      await this.storage.updateUpload(this.uploadId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      
      await this.cleanupOnFailure();
    }
  }

  private async cleanupOnFailure(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch (unlinkError) {
      console.error(`[StreamingProcessor] Failed to cleanup source file:`, unlinkError);
    }

    for (const mediaPath of this.extractedMediaPaths) {
      try {
        await fs.unlink(mediaPath);
      } catch (unlinkError) {
        console.error(`[StreamingProcessor] Failed to cleanup media file ${mediaPath}:`, unlinkError);
      }
    }

    if (this.extractedMediaPaths.length > 0) {
      console.log(`[StreamingProcessor] Cleaned up ${this.extractedMediaPaths.length} extracted media files`);
    }
  }

  private async extractZipStreaming(): Promise<{
    chatFiles: Array<{ name: string; content: string }>;
    mediaFiles: MediaFile[];
  }> {
    return new Promise((resolve, reject) => {
      const chatFiles: Array<{ name: string; content: string }> = [];
      const mediaFiles: MediaFile[] = [];
      let processedFiles = 0;
      let zipfileInstance: yauzl.ZipFile | null = null;

      yauzl.open(this.filePath, { lazyEntries: true }, async (err, zipfile) => {
        if (err) {
          return reject(err);
        }

        zipfileInstance = zipfile;

        try {
          await fs.mkdir(this.mediaFolder, { recursive: true });
        } catch (mkdirErr) {
          zipfile.close();
          return reject(mkdirErr);
        }

        zipfile.readEntry();

        zipfile.on('entry', async (entry: yauzl.Entry) => {
          const fileName = entry.fileName;

          if (/\/$/.test(fileName) || fileName.startsWith('__MACOSX')) {
            zipfile.readEntry();
            return;
          }

          try {
            if (fileName.endsWith('.txt')) {
              zipfile.openReadStream(entry, async (err, readStream) => {
                if (err) {
                  zipfile.close();
                  reject(err);
                  return;
                }

                const chunks: Buffer[] = [];
                readStream.on('data', (chunk) => chunks.push(chunk));
                readStream.on('end', () => {
                  const content = Buffer.concat(chunks).toString('utf-8');
                  let chatName = path.basename(fileName, '.txt').replace(/_/g, ' ');
                  chatName = chatName.replace(/[\u200E\u200F\u202A\u202B\u202C\u202D\u202E]/g, '').trim();
                  chatFiles.push({ name: chatName, content });
                  
                  processedFiles++;
                  if (processedFiles % 10 === 0) {
                    this.updateProgress(5 + Math.min(40, Math.floor(processedFiles / 5)), 
                      `Extracted ${processedFiles} files...`);
                  }
                  
                  zipfile.readEntry();
                });
                readStream.on('error', (streamErr) => {
                  zipfile.close();
                  reject(streamErr);
                });
              });
            } else {
              zipfile.openReadStream(entry, async (err, readStream) => {
                if (err) {
                  zipfile.close();
                  reject(err);
                  return;
                }

                const basename = path.basename(fileName);
                const destPath = path.join(this.mediaFolder, basename);
                const writeStream = createWriteStream(destPath);

                try {
                  await pipeline(readStream, writeStream);
                  this.extractedMediaPaths.push(destPath);
                  
                  const parser = new WhatsAppParser();
                  const mediaInfo = parser.parseMediaFilename(basename);
                  if (mediaInfo) {
                    mediaFiles.push({
                      filename: basename,
                      timestamp: mediaInfo.timestamp,
                      type: mediaInfo.type
                    });
                  }
                  
                  processedFiles++;
                  if (processedFiles % 10 === 0) {
                    this.updateProgress(5 + Math.min(40, Math.floor(processedFiles / 5)), 
                      `Extracted ${processedFiles} files...`);
                  }
                  
                  zipfile.readEntry();
                } catch (pipelineErr) {
                  zipfile.close();
                  reject(pipelineErr);
                }
              });
            }
          } catch (entryErr) {
            zipfile.close();
            reject(entryErr);
          }
        });

        zipfile.on('end', () => {
          console.log(`[StreamingProcessor] Extracted ${chatFiles.length} chat files, ${mediaFiles.length} media files`);
          zipfile.close();
          resolve({ chatFiles, mediaFiles });
        });

        zipfile.on('error', (zipErr) => {
          if (zipfileInstance) {
            zipfileInstance.close();
          }
          reject(zipErr);
        });
      });
    });
  }

  private async parseChats(chatFiles: Array<{ name: string; content: string }>): Promise<Array<{
    name: string;
    messages: any[];
    isGroup: boolean;
  }>> {
    const parsedChats = [];
    
    for (const { name, content } of chatFiles) {
      const parser = new WhatsAppParser();
      const parsed = parser.parseExport(content, name);
      parsedChats.push(parsed);
      console.log(`[StreamingProcessor] Parsed chat: ${name} (${parsed.messages.length} messages)`);
    }
    
    return parsedChats;
  }

  private mapMediaToChats(
    parsedChats: Array<{ name: string; messages: any[]; isGroup: boolean }>,
    mediaFiles: MediaFile[]
  ): void {
    for (const parsedChat of parsedChats) {
      const parser = new WhatsAppParser();
      parser.mapMediaToMessages(parsedChat.messages, mediaFiles, this.userId);
    }
  }

  private async saveToDatabase(parsedChats: Array<{
    name: string;
    messages: any[];
    isGroup: boolean;
  }>): Promise<{ totalMessages: number; chatCount: number }> {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9', '#A29BFE', '#FD79A8'];
    let totalMessages = 0;

    for (const parsedChat of parsedChats) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const chat = await this.storage.createChat({
        userId: this.userId,
        name: parsedChat.name,
        isGroup: parsedChat.isGroup,
        avatarColor: color,
        lastMessageAt: parsedChat.messages.length > 0 
          ? parsedChat.messages[parsedChat.messages.length - 1].timestamp 
          : new Date(),
        messageCount: parsedChat.messages.length,
        isPinned: false,
        isArchived: false,
      });

      const messagesToInsert = parsedChat.messages.map(msg => ({
        ...msg,
        chatId: chat.id,
      }));

      if (messagesToInsert.length > 0) {
        console.log(`[StreamingProcessor] Inserting ${messagesToInsert.length} messages for chat: ${parsedChat.name}...`);
        await this.storage.createMessages(messagesToInsert);
        totalMessages += messagesToInsert.length;
      }
    }

    return { totalMessages, chatCount: parsedChats.length };
  }

  private async updateProgress(progress: number, status: string, messageCount?: number, chatCount?: number): Promise<void> {
    try {
      const updateData: any = {
        progress,
        status: progress === 100 ? 'completed' : 'processing',
      };
      
      if (progress === 100) {
        updateData.processedAt = new Date();
        if (messageCount !== undefined) updateData.messageCount = messageCount;
        if (chatCount !== undefined) updateData.chatCount = chatCount;
      }
      
      await this.storage.updateUpload(this.uploadId, updateData);
      console.log(`[StreamingProcessor] ${this.uploadId}: ${progress}% - ${status}`);
    } catch (error) {
      console.error(`[StreamingProcessor] Failed to update progress:`, error);
    }
  }
}
