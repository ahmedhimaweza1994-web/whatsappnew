import express, { type Express, type Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WhatsAppParser } from "./whatsapp-parser";
import { StreamingZipProcessor } from "./streaming-zip-processor";
import { setupAuth, isAuthenticated, type AuthRequest } from "./customAuth";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { insertChatSchema, insertMessageSchema, insertUploadSchema } from "@shared/schema";
import { z } from "zod";

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
});

const mediaUpload = multer({
  dest: "uploads/media/",
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.get("/api/chats", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const chats = await storage.getChats(userId);
      res.json(chats);
    } catch (error) {
      console.error("Error fetching chats:", error);
      res.status(500).json({ error: "Failed to fetch chats" });
    }
  });

  app.get("/api/chats/:id", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const chat = await storage.getChatByIdAndUser(req.params.id, userId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }
      res.json(chat);
    } catch (error) {
      console.error("Error fetching chat:", error);
      res.status(500).json({ error: "Failed to fetch chat" });
    }
  });

  app.get("/api/chats/:id/messages", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const chat = await storage.getChatByIdAndUser(req.params.id, userId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      
      const messages = await storage.getMessages(req.params.id, limit, offset);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.patch("/api/chats/:id", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const updates = z.object({
        isPinned: z.boolean().optional(),
        isArchived: z.boolean().optional(),
      }).parse(req.body);

      const chat = await storage.updateChat(req.params.id, userId, updates);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }
      res.json(chat);
    } catch (error) {
      console.error("Error updating chat:", error);
      res.status(500).json({ error: "Failed to update chat" });
    }
  });

  app.delete("/api/chats/:id", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      await storage.deleteChat(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting chat:", error);
      res.status(500).json({ error: "Failed to delete chat" });
    }
  });

  app.post("/api/chats/:id/swap-sender", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { senderName } = z.object({
        senderName: z.string()
      }).parse(req.body);

      const chat = await storage.getChatByIdAndUser(req.params.id, userId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      await storage.swapMessageSenders(req.params.id, senderName);
      res.json({ success: true });
    } catch (error) {
      console.error("Error swapping senders:", error);
      res.status(500).json({ error: "Failed to swap senders" });
    }
  });

  app.get("/api/search", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Query parameter required" });
      }

      const results = await storage.searchMessages(userId, query);
      res.json(results);
    } catch (error) {
      console.error("Error searching messages:", error);
      res.status(500).json({ error: "Failed to search messages" });
    }
  });

  app.post("/api/upload", isAuthenticated, (req: AuthRequest, res: Response, next) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        console.error("[Upload] Multer error:", err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: `File too large. Maximum size is 500MB` });
        }
        return res.status(400).json({ error: err.message || 'File upload failed' });
      }
      next();
    });
  }, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filePath = req.file.path;
      const originalName = req.file.originalname;
      const fileSize = req.file.size;

      console.log(`[Upload] Received file: ${originalName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

      if (originalName.endsWith('.zip')) {
        const uploadRecord = await storage.createUpload({
          userId,
          fileName: originalName,
          fileSize,
          filePath,
          status: 'pending',
          progress: 0,
          chatCount: 0,
          messageCount: 0,
        });

        console.log(`[Upload] Created upload record ${uploadRecord.id}, starting background processing...`);

        setImmediate(async () => {
          const processor = new StreamingZipProcessor({
            filePath,
            userId,
            uploadId: uploadRecord.id,
            storage,
          });
          await processor.process();
        });

        res.status(202).json({
          uploadId: uploadRecord.id,
          status: 'processing',
          message: 'Upload received and processing started. Poll /api/upload/:uploadId/status for progress.',
        });
      } else if (originalName.endsWith('.txt')) {
        const content = await fs.readFile(filePath, 'utf-8');
        const chatName = originalName.replace('.txt', '').replace(/_/g, ' ');
        const parser = new WhatsAppParser();
        const parsed = parser.parseExport(content, chatName);

        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9', '#A29BFE', '#FD79A8'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        const chat = await storage.createChat({
          userId,
          name: parsed.name,
          isGroup: parsed.isGroup,
          avatarColor: color,
          lastMessageAt: parsed.messages.length > 0
            ? parsed.messages[parsed.messages.length - 1].timestamp
            : new Date(),
          messageCount: parsed.messages.length,
          isPinned: false,
          isArchived: false,
        });

        const messagesToInsert = parsed.messages.map(msg => ({
          ...msg,
          chatId: chat.id,
        }));

        if (messagesToInsert.length > 0) {
          await storage.createMessages(messagesToInsert);
        }

        await storage.createUpload({
          userId,
          fileName: originalName,
          fileSize,
          filePath,
          status: 'completed',
          progress: 100,
          chatCount: 1,
          messageCount: parsed.messages.length,
          processedAt: new Date(),
        });

        await fs.unlink(filePath);

        console.log(`[Upload] ✓ Text file upload complete: 1 chat, ${parsed.messages.length} messages`);
        res.json({
          success: true,
          chatCount: 1,
          messageCount: parsed.messages.length,
        });
      } else {
        await fs.unlink(filePath);
        return res.status(400).json({ error: "Invalid file type. Please upload .txt or .zip files" });
      }
    } catch (error) {
      console.error("Error processing upload:", error);
      res.status(500).json({ error: "Failed to process upload" });
    }
  });

  app.get("/api/uploads", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const uploads = await storage.getUploads(userId);
      res.json(uploads);
    } catch (error) {
      console.error("Error fetching uploads:", error);
      res.status(500).json({ error: "Failed to fetch uploads" });
    }
  });

  app.get("/api/upload/:uploadId/status", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const upload = await storage.getUpload(req.params.uploadId);
      
      if (!upload) {
        return res.status(404).json({ error: "Upload not found" });
      }
      
      if (upload.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      res.json({
        id: upload.id,
        fileName: upload.fileName,
        fileSize: upload.fileSize,
        status: upload.status,
        progress: upload.progress,
        chatCount: upload.chatCount,
        messageCount: upload.messageCount,
        errorMessage: upload.errorMessage,
        uploadedAt: upload.uploadedAt,
        processedAt: upload.processedAt,
      });
    } catch (error) {
      console.error("Error fetching upload status:", error);
      res.status(500).json({ error: "Failed to fetch upload status" });
    }
  });

  app.get("/api/chats/:id/media", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const chat = await storage.getChatByIdAndUser(req.params.id, userId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      const mediaType = req.query.type as string | undefined;
      const messages = await storage.getMessages(req.params.id, 1000, 0);
      
      const mediaMessages = messages.filter(msg => {
        if (!msg.mediaUrl) return false;
        if (mediaType && msg.mediaType !== mediaType) return false;
        return msg.mediaType && ['image', 'video', 'audio', 'document'].includes(msg.mediaType);
      });

      res.json(mediaMessages);
    } catch (error) {
      console.error("Error fetching media:", error);
      res.status(500).json({ error: "Failed to fetch media" });
    }
  });

  app.get("/api/chats/:id/export/json", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const chat = await storage.getChat(req.params.id);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      if (chat.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const messages = await storage.getMessages(req.params.id, 100000, 0);
      
      const exportData = {
        chat: {
          name: chat.name,
          isGroup: chat.isGroup,
          messageCount: chat.messageCount,
          exportedAt: new Date().toISOString(),
        },
        messages: messages.map(msg => ({
          timestamp: msg.timestamp,
          sender: msg.sender,
          isFromMe: msg.isFromMe,
          content: msg.content,
          mediaType: msg.mediaType,
          mediaName: msg.mediaName,
        })),
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${chat.name.replace(/[^a-z0-9]/gi, '_')}_export.json"`);
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting chat:", error);
      res.status(500).json({ error: "Failed to export chat" });
    }
  });

  app.get('/media/:userId/:filename', isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const requestedUserId = req.params.userId;
      const filename = req.params.filename;
      
      if (userId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      const baseDir = path.resolve('uploads', 'media', requestedUserId);
      const requestedPath = path.resolve(baseDir, filename);
      
      if (!requestedPath.startsWith(baseDir + path.sep) && requestedPath !== baseDir) {
        console.warn(`Path traversal attempt blocked: ${filename} for user ${userId}`);
        return res.status(403).json({ error: "Forbidden" });
      }
      
      try {
        await fs.access(requestedPath);
        res.sendFile(requestedPath);
      } catch (error) {
        res.status(404).json({ error: "File not found" });
      }
    } catch (error) {
      console.error("Error serving media:", error);
      res.status(500).json({ error: "Failed to serve media" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
