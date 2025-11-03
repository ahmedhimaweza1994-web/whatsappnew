import type { InsertMessage } from "@shared/schema";

export interface ParsedChat {
  name: string;
  messages: Omit<InsertMessage, "chatId">[];
  isGroup: boolean;
}

export interface MediaFile {
  filename: string;
  timestamp: Date;
  type: string;
}

export class WhatsAppParser {
  private readonly messageRegex = /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}[،,]?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|ص|م)?)\]?\s*-?\s*([^:]+?):\s*(.+)$/;
  private readonly systemMessageRegex = /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}[،,]?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|ص|م)?)\]?\s*-?\s*(.+)$/;
  private readonly mediaRegex = /(.*?)\s*\((?:file attached|الملف مرفق)\)|(.*?)\s*<attached:\s*(.+?)>|<.*?(تم استبعاد|omitted).*?>/i;
  private readonly whatsappMediaRegex = /(?:IMG|VID|AUD|DOC|PTT)-(\d{8})-WA(\d+)/;
  private readonly encryptionNoticeRegex = /^Messages and calls are end-to-end encrypted|الرسائل والمكالمات مشفرة|Les messages et les appels sont chiffrés/i;
  private readonly youIdentifiers = ['You', 'you', 'أنت', 'انت', 'Vous', 'Tu', 'Tú', 'Du', 'Sie', 'Você'];

  private normalizeArabicNumerals(text: string): string {
    const arabicToWestern: { [key: string]: string } = {
      '\u0660': '0', '\u0661': '1', '\u0662': '2', '\u0663': '3', '\u0664': '4',
      '\u0665': '5', '\u0666': '6', '\u0667': '7', '\u0668': '8', '\u0669': '9'
    };
    return text.replace(/[\u0660-\u0669]/g, match => arabicToWestern[match]);
  }

  private normalizeText(text: string): string {
    return text.replace(/[\u200E\u200F\u202A\u202B\u202C\u202D\u202E]/g, '').trim();
  }

  private isYou(sender: string): boolean {
    const normalizedSender = sender.trim().toLowerCase();
    return this.youIdentifiers.some(identifier => 
      normalizedSender === identifier.toLowerCase()
    );
  }

  parseExport(content: string, chatName: string): ParsedChat {
    const lines = content.split('\n');
    const messages: Omit<InsertMessage, "chatId">[] = [];
    let currentMessage: Omit<InsertMessage, "chatId"> | null = null;
    let isGroup = false;
    let skipFirstLine = false;
    const senderCounts = new Map<string, number>();
    let firstNonSystemSender: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (!line.trim()) continue;
      
      if (i === 0 && this.encryptionNoticeRegex.test(line)) {
        skipFirstLine = true;
        continue;
      }
      
      if (skipFirstLine && i === 1) {
        skipFirstLine = false;
      }

      line = this.normalizeText(line);
      line = this.normalizeArabicNumerals(line);

      const messageMatch = line.match(this.messageRegex);
      const systemMatch = !messageMatch ? line.match(this.systemMessageRegex) : null;

      if (messageMatch) {
        if (currentMessage) {
          messages.push(currentMessage);
        }

        const [, timestamp, sender, content] = messageMatch;
        const parsedTimestamp = this.parseTimestamp(timestamp);
        const trimmedSender = sender.trim();
        
        if (!firstNonSystemSender) {
          firstNonSystemSender = trimmedSender;
        }
        
        senderCounts.set(trimmedSender, (senderCounts.get(trimmedSender) || 0) + 1);
        
        const isYouSender = this.isYou(trimmedSender);
        
        if (isYouSender) {
          currentMessage = {
            content: content,
            sender: 'You',
            isFromMe: true,
            timestamp: parsedTimestamp,
            isSystemMessage: false,
          };
        } else {
          if (senderCounts.size > 1) {
            isGroup = true;
          }
          currentMessage = {
            content: content,
            sender: trimmedSender,
            isFromMe: false,
            timestamp: parsedTimestamp,
            isSystemMessage: false,
          };
        }

        this.parseMediaAttachment(currentMessage);
      } else if (systemMatch) {
        if (currentMessage) {
          messages.push(currentMessage);
        }

        const [, timestamp, content] = systemMatch;
        currentMessage = {
          content: content,
          sender: null,
          isFromMe: false,
          timestamp: this.parseTimestamp(timestamp),
          isSystemMessage: true,
        };
      } else if (currentMessage && !currentMessage.isSystemMessage) {
        currentMessage.content += '\n' + line;
        this.parseMediaAttachment(currentMessage);
      }
    }

    if (currentMessage) {
      messages.push(currentMessage);
    }

    const hasYouSender = messages.some(msg => msg.isFromMe);
    
    if (!hasYouSender && senderCounts.size > 0) {
      const senders = Array.from(senderCounts.keys());
      
      let meSender: string | null = null;
      
      if (senderCounts.size === 1) {
        meSender = senders[0];
      } else if (senderCounts.size === 2) {
        const sortedSenders = senders.sort((a, b) => (senderCounts.get(b) || 0) - (senderCounts.get(a) || 0));
        const topSenderCount = senderCounts.get(sortedSenders[0]) || 0;
        const totalMessages = messages.filter(m => !m.isSystemMessage).length;
        const percentage = (topSenderCount / totalMessages) * 100;
        
        if (percentage > 60) {
          meSender = sortedSenders[0];
        }
      }
      
      if (meSender) {
        for (const message of messages) {
          if (message.sender === meSender && !message.isSystemMessage) {
            message.isFromMe = true;
          }
        }
      }
    }

    return {
      name: chatName,
      messages,
      isGroup,
    };
  }

  private parseTimestamp(dateStr: string): Date {
    dateStr = dateStr.replace(/\[|\]/g, '').replace(/[\u060C،]/g, ',').trim();
    
    const formats = [
      /(\d{1,2})[\/،,](\d{1,2})[\/،,](\d{2,4})[،,]?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|ص|م)?/i,
      /(\d{1,2})[\/،,](\d{1,2})[\/،,](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/,
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        let [, month, day, year, hour, minute, second, meridiem] = match;
        
        let yearNum = parseInt(year);
        if (yearNum < 100) {
          yearNum += yearNum < 50 ? 2000 : 1900;
        }

        let hourNum = parseInt(hour);
        if (meridiem) {
          const mer = meridiem.toUpperCase();
          if ((mer === 'PM' || mer === 'م') && hourNum < 12) {
            hourNum += 12;
          } else if ((mer === 'AM' || mer === 'ص') && hourNum === 12) {
            hourNum = 0;
          }
        }

        const date = new Date(
          yearNum,
          parseInt(month) - 1,
          parseInt(day),
          hourNum,
          parseInt(minute),
          second ? parseInt(second) : 0
        );

        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return new Date();
  }

  private parseMediaAttachment(message: Omit<InsertMessage, "chatId">): void {
    if (!message.content) return;

    const lowerContent = message.content.toLowerCase();
    const originalContent = message.content.trim();
    
    const filenamePatterns = [
      /^(?:IMG|VID|AUD|DOC|PTT)-\d{8}-WA\d+\.\w+$/i,
      /^[\w\-]+\.(?:jpg|jpeg|png|gif|webp|mp4|mov|avi|3gp|opus|mp3|ogg|m4a|pdf|doc|docx|txt|xlsx)$/i
    ];
    
    let isBareFilename = false;
    let extractedFilename = null;
    
    for (const pattern of filenamePatterns) {
      if (pattern.test(originalContent)) {
        isBareFilename = true;
        extractedFilename = originalContent;
        break;
      }
    }
    
    if (!isBareFilename) {
      const embeddedPatterns = [
        /(?:IMG|VID|AUD|DOC|PTT)-\d{8}-WA\d+\.\w+/gi,
        /\b[\w\-]+\.(?:jpg|jpeg|png|gif|webp|mp4|mov|avi|3gp|opus|mp3|ogg|m4a|pdf|doc|docx|txt)/gi
      ];
      
      for (const pattern of embeddedPatterns) {
        const match = originalContent.match(pattern);
        if (match) {
          extractedFilename = match[0];
          break;
        }
      }
    }
    
    const hasMediaIndicator = isBareFilename ||
                              lowerContent.includes('(file attached)') || 
                              lowerContent.includes('(الملف مرفق)') ||
                              originalContent.includes('الملف مرفق') ||
                              lowerContent.includes('<attached:') ||
                              originalContent.includes('تم استبعاد') ||
                              lowerContent.includes('omitted');
    
    if (hasMediaIndicator) {
      const mediaMatch = message.content.match(this.mediaRegex);
      
      if (lowerContent.includes('image omitted') || originalContent.includes('تم استبعاد الصورة') || lowerContent.includes('.jpg') || lowerContent.includes('.png') || lowerContent.includes('.jpeg') || lowerContent.includes('.gif') || lowerContent.includes('.webp') || /^IMG-\d{8}-WA\d+/i.test(originalContent)) {
        message.mediaType = 'image';
      } else if (lowerContent.includes('video omitted') || originalContent.includes('تم استبعاد الفيديو') || lowerContent.includes('.mp4') || lowerContent.includes('.mov') || lowerContent.includes('.avi') || lowerContent.includes('.3gp') || /^VID-\d{8}-WA\d+/i.test(originalContent)) {
        message.mediaType = 'video';
      } else if (lowerContent.includes('audio omitted') || lowerContent.includes('voice message') || originalContent.includes('تم استبعاد الصوت') || lowerContent.includes('.opus') || lowerContent.includes('.mp3') || lowerContent.includes('ptt') || lowerContent.includes('.ogg') || lowerContent.includes('.m4a') || /^(?:PTT|AUD)-\d{8}-WA\d+/i.test(originalContent)) {
        message.mediaType = 'audio';
      } else if (lowerContent.includes('.pdf') || lowerContent.includes('.doc') || lowerContent.includes('.txt') || lowerContent.includes('.docx') || lowerContent.includes('.xlsx') || /^DOC-\d{8}-WA\d+/i.test(originalContent)) {
        message.mediaType = 'document';
      } else if (originalContent.includes('الوسائط') || originalContent.includes('تم استبعاد')) {
        message.mediaType = 'image';
      } else {
        message.mediaType = 'file';
      }

      if (extractedFilename) {
        message.mediaName = extractedFilename.trim();
      } else if (mediaMatch) {
        const filename = mediaMatch[3] || mediaMatch[1] || mediaMatch[2];
        if (filename) {
          message.mediaName = filename.trim();
        }
      }
    } else if (lowerContent.match(/\bhttps?:\/\/\S+/)) {
      const urlMatch = message.content.match(/https?:\/\/\S+/);
      if (urlMatch) {
        message.mediaType = 'link';
        message.mediaUrl = urlMatch[0];
      }
    }
  }

  mapMediaToMessages(messages: Omit<InsertMessage, "chatId">[], mediaFiles: MediaFile[], userId: string): void {
    const mediaByDate = new Map<string, MediaFile[]>();
    const mediaByFilename = new Map<string, MediaFile>();
    
    for (const media of mediaFiles) {
      const dateKey = this.getDateKey(media.timestamp);
      if (!mediaByDate.has(dateKey)) {
        mediaByDate.set(dateKey, []);
      }
      mediaByDate.get(dateKey)!.push(media);
      mediaByFilename.set(media.filename.toLowerCase(), media);
    }

    for (const message of messages) {
      if (!message.mediaType || message.mediaType === 'link') continue;
      
      let bestMatch: MediaFile | null = null;
      
      if (message.mediaName) {
        const lookupKey = message.mediaName.toLowerCase();
        const exactMatch = mediaByFilename.get(lookupKey);
        if (exactMatch) {
          bestMatch = exactMatch;
        }
      }
      
      if (!bestMatch) {
        const dateKey = this.getDateKey(message.timestamp);
        const candidateMedia = mediaByDate.get(dateKey) || [];
        
        let bestScore = 0;

        for (const media of candidateMedia) {
          if (mediaByFilename.has(media.filename.toLowerCase()) && 
              mediaByFilename.get(media.filename.toLowerCase()) !== media) {
            continue;
          }
          
          const timeDiff = Math.abs(media.timestamp.getTime() - message.timestamp.getTime());
          const typeMatch = this.mediaTypeMatches(message.mediaType, media.type);
          
          if (typeMatch && timeDiff < 24 * 60 * 60 * 1000) {
            const score = 10000000 - timeDiff;
            if (score > bestScore) {
              bestScore = score;
              bestMatch = media;
            }
          }
        }
      }

      if (bestMatch) {
        message.mediaUrl = `/media/${userId}/${bestMatch.filename}`;
        if (!message.mediaName) {
          message.mediaName = bestMatch.filename;
        }
        mediaByFilename.delete(bestMatch.filename.toLowerCase());
      }
    }
  }

  private getDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private mediaTypeMatches(messageType: string | null, fileExtension: string): boolean {
    if (!messageType) return false;
    
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    const videoExts = ['mp4', 'mov', 'avi', '3gp', 'mkv', 'webm'];
    const audioExts = ['opus', 'mp3', 'ogg', 'm4a', 'aac', 'wav'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'xlsx', 'xls', 'ppt', 'pptx'];

    const ext = fileExtension.toLowerCase();

    if (messageType === 'image') return imageExts.includes(ext);
    if (messageType === 'video') return videoExts.includes(ext);
    if (messageType === 'audio') return audioExts.includes(ext);
    if (messageType === 'document') return docExts.includes(ext);
    
    return true;
  }

  parseMediaFilename(filename: string): { timestamp: Date; type: string } | null {
    const match = filename.match(this.whatsappMediaRegex);
    if (match) {
      const [, dateStr] = match;
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      
      const timestamp = new Date(year, month, day, 12, 0, 0);
      const ext = filename.split('.').pop() || '';
      
      return { timestamp, type: ext };
    }
    
    const ext = filename.split('.').pop() || '';
    return { timestamp: new Date(), type: ext };
  }
}
