# WhatsApp Export Viewer - Design Guidelines

## Design Approach
**Reference-Based Approach: WhatsApp Web**

The application replicates WhatsApp Web's interface with pixel-perfect accuracy. Every design decision draws from WhatsApp's established patterns, creating a familiar, intuitive experience for users viewing their chat exports.

## Core Design Principles
1. **Authenticity**: Match WhatsApp Web's visual language exactly
2. **Information Density**: Efficient use of space for maximum content visibility
3. **Familiarity**: Zero learning curve through established patterns
4. **Clarity**: Clear visual hierarchy for messages, contacts, and actions

---

## Typography

**Primary Font Family**: 
- Segoe UI (Windows), Helvetica Neue (Mac), system-ui fallback
- Clean, highly legible sans-serif matching WhatsApp's typography

**Type Scale**:
- **Chat Names/Headers**: 16px, weight-500
- **Message Body**: 14.2px, weight-400
- **Timestamps**: 11px, weight-400
- **Input Text**: 15px, weight-400
- **Sidebar Contact Names**: 16px, weight-400
- **Sidebar Last Message Preview**: 14px, weight-400
- **Date Dividers**: 12.5px, weight-500

**Text Treatment**:
- Message text: natural line-height (1.4)
- Timestamps: opacity-60 for subtle presence
- Sender names in groups: weight-500, text-sm
- Links: underlined with primary green on hover

---

## Layout System

**Spacing Primitives**: Tailwind units of 1, 2, 3, 4, 6, 8, 12, 16
- Micro spacing: 1-2 (gaps between message elements)
- Component spacing: 3-4 (padding within cards, bubbles)
- Section spacing: 6-8 (between major UI areas)
- Large spacing: 12-16 (margins for containers)

**Grid Structure**:

**Desktop Layout** (>1024px):
- Sidebar: fixed 420px width
- Main chat: flex-1 (remaining space)
- Three-column composition: Sidebar | Chat View | (Optional) Media Panel

**Tablet Layout** (768px-1024px):
- Sidebar: 360px width
- Main chat: flex-1
- Collapsible sidebar on narrow tablets

**Mobile Layout** (<768px):
- Full-width views with slide transitions
- Sidebar overlays main view when opened
- Bottom navigation for key actions

**Container Widths**:
- Sidebar width: 420px desktop, 360px tablet, 100vw mobile
- Message bubbles: max-width-2xl (65% of chat area)
- Media in messages: max-width-sm for images/videos

---

## Component Library

### Header Bar
- Height: 59px fixed
- Background: #075E54 (WhatsApp dark green)
- Contains: Profile photo (40px circle), contact name, status text, search/menu icons
- Border-bottom: 1px solid rgba(0,0,0,0.08)

### Sidebar (Contact List)
- Background: white
- Search bar at top: 49px height, #F6F6F6 background, rounded-full input
- Contact items: 72px height each
  - Avatar: 49px circle with initials or image
  - Name: truncate with ellipsis
  - Last message preview: text-gray-500, truncate
  - Timestamp: text-xs, absolute top-right
  - Unread badge: green circle with white count
- Hover state: #F5F5F5 background
- Active chat: #EBEBEB background

### Message Bubbles
**Sent Messages** (right-aligned):
- Background: #DCF8C6 (WhatsApp light green)
- Border-radius: 7.5px with pointed tail on right
- Padding: py-2 px-3
- Max-width: 65% of container
- Tail: small triangle pointing right-bottom

**Received Messages** (left-aligned):
- Background: white
- Border-radius: 7.5px with pointed tail on left
- Padding: py-2 px-3
- Max-width: 65% of container
- Shadow: subtle 0 1px 0.5px rgba(0,0,0,0.13)

**Message Elements**:
- Timestamp: bottom-right corner, 11px, text-gray-500
- Status ticks: 16px icons (single, double, double-blue)
- Reply indicator: left border with original message excerpt
- Forwarded label: italic, text-xs at top

### Date Dividers
- Center-aligned, uppercase text
- Background: #E1F3FB pill/badge
- Padding: py-1 px-3
- Text: 12.5px, weight-500
- Position: sticky during scroll

### Media Components

**Images**:
- Display inline within bubble, rounded corners
- Max-height: 300px, maintain aspect ratio
- Click opens fullscreen lightbox with zoom/pan
- Loading state: skeleton with blur-up effect

**Videos**:
- Inline preview with play button overlay
- Thumbnail with duration badge
- Click opens modal player

**Audio Messages**:
- Waveform visualization (green bars)
- Play/pause button, timestamp, progress slider
- Compact horizontal layout

**Documents**:
- Icon + filename + size display
- Download button on right
- Subtle background card

### Input Area (Bottom)
- Height: 62px
- Background: #F0F0F0
- Contains: emoji button, text input (rounded-full, white bg), attachment clip, send button
- Input padding: py-2.5 px-4
- Send button: circular, #00A884 background when active

### Search Interface
- Full-width overlay on mobile
- Inline top bar on desktop
- Search input with close button
- Results list with message context snippets
- Highlighted matches in yellow

### Export Modal
- Centered overlay with backdrop blur
- Options for PDF/JSON export
- Date range picker
- Include media toggle
- Progress bar for generation

### Media Gallery
- Grid view: 3 columns on desktop, 2 on tablet, 1 on mobile
- Masonry-style layout for varied sizes
- Filter tabs: All, Photos, Videos, Documents
- Click opens lightbox carousel

---

## Responsive Breakpoints
- Mobile: <640px (stacked, full-width)
- Tablet: 640px-1024px (sidebar toggle)
- Desktop: >1024px (split view)

---

## Interaction Patterns

### Navigation
- Click contact in sidebar: slide in chat view (mobile) or load in main area (desktop)
- Back button on mobile: returns to contact list
- Swipe right on mobile: reveal sidebar

### Message Loading
- Infinite scroll: load 50 messages at a time
- Scroll to top triggers older messages
- Smooth scroll to newest message button when not at bottom

### Search Behavior
- Type-ahead with debounce (300ms)
- Highlight matches in message text
- Jump to message in context when clicked

### Media Interactions
- Single click on image: fullscreen lightbox
- Click on video: modal player
- Long-press (mobile) or right-click (desktop): download option

---

## Accessibility
- Keyboard navigation: Tab through contacts, Enter to open
- Arrow keys to navigate messages
- Escape to close modals
- Screen reader labels for all icons
- Focus indicators: 2px solid #00A884 outline
- Alt text for all images

---

## Performance Considerations
- Virtual scrolling for conversations >1000 messages
- Lazy load images with IntersectionObserver
- Thumbnail generation for large images
- Debounced search input
- Memoized message components
- Paginated contact list (100 at a time)

---

## Images
No hero images or promotional photography needed. This is a utility application focused on data viewing. All visual elements are functional:
- Contact avatars: circular, 40-49px, initials on colored backgrounds when no photo
- Media thumbnails: within message bubbles
- Icons: use Heroicons (outline style for inactive, solid for active states)