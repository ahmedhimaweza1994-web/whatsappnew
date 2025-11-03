import { db } from "./db";
import { users, chats, messages, uploads } from "@shared/schema";
import type { User, UpsertUser, Chat, InsertChat, Message, InsertMessage, Upload, InsertUpload } from "@shared/schema";
import { eq, and, desc, asc, like, or, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: Omit<UpsertUser, 'id'>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  getChats(userId: string): Promise<Chat[]>;
  getChat(id: string): Promise<Chat | undefined>;
  getChatByIdAndUser(id: string, userId: string): Promise<Chat | undefined>;
  createChat(chat: InsertChat): Promise<Chat>;
  updateChat(id: string, userId: string, data: Partial<InsertChat>): Promise<Chat | undefined>;
  deleteChat(id: string, userId: string): Promise<void>;
  
  getMessages(chatId: string, limit?: number, offset?: number): Promise<Message[]>;
  getMessage(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  createMessages(messages: InsertMessage[]): Promise<Message[]>;
  swapMessageSenders(chatId: string, senderName: string): Promise<void>;
  searchMessages(userId: string, query: string): Promise<Array<Message & { chatName: string }>>;
  
  getUploads(userId: string): Promise<Upload[]>;
  createUpload(upload: InsertUpload): Promise<Upload>;
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(userData: Omit<UpsertUser, 'id'>): Promise<User> {
    const result = await db.insert(users).values(userData).returning();
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  async getChats(userId: string): Promise<Chat[]> {
    return db.select()
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(desc(chats.lastMessageAt));
  }

  async getChat(id: string): Promise<Chat | undefined> {
    const result = await db.select().from(chats).where(eq(chats.id, id)).limit(1);
    return result[0];
  }

  async getChatByIdAndUser(id: string, userId: string): Promise<Chat | undefined> {
    const result = await db.select()
      .from(chats)
      .where(and(eq(chats.id, id), eq(chats.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createChat(chat: InsertChat): Promise<Chat> {
    const result = await db.insert(chats).values(chat).returning();
    return result[0];
  }

  async updateChat(id: string, userId: string, data: Partial<InsertChat>): Promise<Chat | undefined> {
    const result = await db.update(chats)
      .set(data)
      .where(and(eq(chats.id, id), eq(chats.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteChat(id: string, userId: string): Promise<void> {
    await db.delete(chats).where(and(eq(chats.id, id), eq(chats.userId, userId)));
  }

  async getMessages(chatId: string, limit = 100, offset = 0): Promise<Message[]> {
    return db.select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(asc(messages.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const result = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return result[0];
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(message).returning();
    return result[0];
  }

  async createMessages(messagesToInsert: InsertMessage[]): Promise<Message[]> {
    if (messagesToInsert.length === 0) return [];
    const result = await db.insert(messages).values(messagesToInsert).returning();
    return result;
  }

  async swapMessageSenders(chatId: string, senderName: string): Promise<void> {
    await db.update(messages)
      .set({ isFromMe: false })
      .where(and(
        eq(messages.chatId, chatId),
        eq(messages.isSystemMessage, false)
      ));
    
    await db.update(messages)
      .set({ isFromMe: true })
      .where(and(
        eq(messages.chatId, chatId),
        eq(messages.sender, senderName),
        eq(messages.isSystemMessage, false)
      ));
  }

  async searchMessages(userId: string, query: string): Promise<Array<Message & { chatName: string }>> {
    const results = await db
      .select({
        id: messages.id,
        chatId: messages.chatId,
        content: messages.content,
        sender: messages.sender,
        isFromMe: messages.isFromMe,
        timestamp: messages.timestamp,
        mediaType: messages.mediaType,
        mediaUrl: messages.mediaUrl,
        mediaName: messages.mediaName,
        mediaSize: messages.mediaSize,
        isSystemMessage: messages.isSystemMessage,
        createdAt: messages.createdAt,
        chatName: chats.name,
      })
      .from(messages)
      .innerJoin(chats, eq(messages.chatId, chats.id))
      .where(
        and(
          eq(chats.userId, userId),
          or(
            like(messages.content, `%${query}%`),
            like(messages.sender, `%${query}%`)
          )
        )
      )
      .orderBy(desc(messages.timestamp))
      .limit(100);
    
    return results;
  }

  async getUploads(userId: string): Promise<Upload[]> {
    return db.select()
      .from(uploads)
      .where(eq(uploads.userId, userId))
      .orderBy(desc(uploads.uploadedAt));
  }

  async createUpload(upload: InsertUpload): Promise<Upload> {
    const result = await db.insert(uploads).values(upload).returning();
    return result[0];
  }
}

export const storage = new DbStorage();
