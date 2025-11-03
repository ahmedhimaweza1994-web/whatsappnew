# WhatsApp Export Viewer

## Overview

WhatsApp Export Viewer is a web application that allows users to upload and view their WhatsApp chat exports in an interface that replicates WhatsApp Web's design with pixel-perfect accuracy. Users can upload .txt or .zip files containing their exported WhatsApp chats, which are then parsed and displayed in a familiar WhatsApp-like interface. The application supports full chat histories, media attachments (images, videos, audio, documents), global search across messages, media galleries, and export capabilities (JSON/PDF).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool. The application follows a component-based architecture with clear separation of concerns.

**UI Framework**: Radix UI primitives with shadcn/ui component library for consistent, accessible components. Tailwind CSS handles styling with custom design tokens that match WhatsApp Web's visual language exactly.

**State Management**: TanStack Query (React Query) for server state management, providing caching, background updates, and optimistic UI updates. No global client state library needed - component state and React Query handle all state requirements.

**Routing**: Wouter for lightweight client-side routing with two main routes: Landing page (unauthenticated) and Home (authenticated chat viewer).

**Design Philosophy**: Reference-based approach matching WhatsApp Web's interface exactly. Custom color scheme includes WhatsApp's signature dark green (#075E54), light green (#25D366), and specific grays. Typography uses system fonts (Segoe UI/Helvetica Neue) with defined type scales. Responsive layout with fixed 420px sidebar on desktop, collapsible on mobile.

### Backend Architecture

**Framework**: Express.js with TypeScript running on Node.js.

**Architecture Pattern**: RESTful API with session-based authentication. Routes are modular and registered through a central routes.ts file.

**File Upload**: Multer middleware handles multipart/form-data uploads with size limits (100MB for chat exports, 50MB for media files). Files are stored in local uploads/ directory.

**Chat Parsing**: Custom WhatsAppParser class extracts messages from .txt exports using regex patterns. Handles various timestamp formats, system messages, media attachments, and both individual/group chats. Supports .zip files containing media by correlating timestamps.

**API Structure**:
- `/api/auth/*` - Authentication endpoints (login, user info)
- `/api/chats` - List chats, create from uploads
- `/api/chats/:id/messages` - Retrieve messages for specific chat
- `/api/chats/:id/media` - Media gallery endpoint
- `/api/chats/:id/export/*` - Export to JSON/PDF
- `/api/search` - Global message search across all chats
- `/api/upload` - Handle chat export file uploads
- `/media/:userId/:filename` - Secure media file serving with path traversal protection

### Data Storage

**Database**: PostgreSQL accessed via Neon serverless driver for connection pooling and edge compatibility.

**ORM**: Drizzle ORM provides type-safe database operations with schema-first approach. Schema is defined in shared/schema.ts and shared between frontend/backend.

**Schema Design**:
- `users` - User accounts (id, email, name, profile image)
- `chats` - Chat metadata (name, isGroup, lastMessageAt, messageCount, pinning/archiving)
- `messages` - Individual messages (content, sender, timestamp, media info, system message flags)
- `uploads` - Track uploaded files (filename, size, processing status)
- `sessions` - Express session storage using connect-pg-simple

**Data Relationships**: One-to-many from users to chats, one-to-many from chats to messages. Cascade deletes ensure data integrity when chats are removed.

### Authentication & Authorization

**Strategy**: Replit Auth via OpenID Connect (OIDC) for deployment on Replit platform.

**Session Management**: Express-session with PostgreSQL-backed store for persistent sessions. Sessions use httpOnly, secure cookies with 1-week TTL.

**Authorization Pattern**: Middleware (`isAuthenticated`) protects all API routes requiring authentication. User identity extracted from session and validated on each request.

**User Lifecycle**: First-time users are automatically created via upsertUser on successful authentication. User data refreshed from OIDC claims on each login.

### External Dependencies

**Database Service**: 
- Neon (PostgreSQL) - Serverless PostgreSQL database with connection pooling
- Accessed via @neondatabase/serverless package with WebSocket support

**Authentication Provider**:
- Replit Auth (OIDC) - Handles user authentication via OpenID Connect
- No external OAuth configuration needed - works automatically on Replit

**Development Tools**:
- Vite - Development server and build tool with HMR
- Replit-specific plugins: cartographer (navigation), dev-banner, runtime-error-modal

**Third-Party Libraries**:
- Radix UI - Unstyled accessible component primitives
- TanStack Query - Server state management and caching
- date-fns - Date formatting and manipulation
- JSZip - Extract media files from zip uploads
- Zod - Runtime schema validation
- Passport - Authentication middleware layer

**Styling Dependencies**:
- Tailwind CSS - Utility-first CSS framework
- class-variance-authority - Component variant management
- tailwind-merge/clsx - Conditional class name handling

**File Processing**:
- Multer - Multipart form data handling for uploads
- Local filesystem - Media storage in uploads/media/:userId/ directory structure

**Media File Handling**:
- Media files from zip uploads are extracted to user-specific directories (uploads/media/:userId/)
- Files are matched to messages using filename-based exact matching (case-insensitive) and timestamp-based fuzzy matching
- Media serving endpoint validates user authentication and prevents path traversal attacks by verifying resolved paths stay within user's media directory
- Supports images (jpg, png, gif, webp), videos (mp4, mov, avi, 3gp), audio (opus, mp3, ogg, m4a), and documents (pdf, doc, docx, txt)