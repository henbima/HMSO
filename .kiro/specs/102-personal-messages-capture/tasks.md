# Implementation Plan: Personal Messages Capture

## Overview

Incrementally extend HMWAIntel to capture, classify, and display personal WhatsApp messages. Each task builds on the previous — starting with the database schema, then the listener, then classification, then frontend. Testing sub-tasks are woven in close to their implementation.

## Tasks

- [x] 1. Database migration for personal messages support
  - [x] 1.1 Create migration file `supabase/migrations/YYYYMMDDHHMMSS_add_personal_messages_support.sql`
    - Add `conversation_type TEXT NOT NULL DEFAULT 'group'` column to `wa_intel.messages`
    - Add `wa_contact_jid TEXT` column to `wa_intel.messages`
    - ALTER `wa_group_id` to drop NOT NULL constraint (use `ALTER COLUMN wa_group_id DROP NOT NULL`)
    - Add indexes: `idx_messages_conversation_type`, `idx_messages_contact_jid` (partial, WHERE NOT NULL), `idx_messages_personal_contact_time` (wa_contact_jid, timestamp DESC, WHERE conversation_type = 'personal')
    - Update `wa_intel.today_summary` view to add `WHERE m.conversation_type = 'group'` filter (or `WHERE m.wa_group_id IS NOT NULL`)
    - Register new columns/indexes in `hm_core.object_registry` with `owner_app = 'wa_intel'`
    - Follow migration standards: comment header, IF EXISTS/IF NOT EXISTS, no dollar-quoting, grants
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 5.1, 5.3_

- [x] 2. Update TypeScript types and listener message handler
  - [x] 2.1 Update `Message` interface in `src/lib/types.ts`
    - Add `conversation_type: 'group' | 'personal'` field
    - Add `wa_contact_jid: string | null` field
    - Make `wa_group_id` optional: `wa_group_id: string | null`
    - _Requirements: 1.1, 1.4_

  - [x] 2.2 Refactor `handleMessage()` in `listener/src/message-handler.ts`
    - Add broadcast JID check: discard messages where `remoteJid` includes `@broadcast`
    - Replace the `if (!isGroup) return;` filter with JID type branching
    - Extract existing group logic into `handleGroupMessage(msg, remoteJid)` function
    - Create `handlePersonalMessage(msg, remoteJid)` function that:
      - Determines sender JID (for personal: `msg.key.fromMe` means Hendra sent it, otherwise sender is remoteJid)
      - Sets `conversation_type = 'personal'`, `wa_group_id = null`, `group_id = null`
      - Sets `wa_contact_jid = remoteJid`
      - Resolves contact via existing `resolveContact()`
      - Sets `is_from_hendra` based on `msg.key.fromMe` or sender JID matching `config.hendraJid`
    - Ensure `handleGroupMessage` sets `conversation_type = 'group'` in the insert
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 6.1, 6.2_

  - [ ]* 2.3 Write property tests for message handler JID routing
    - Use fast-check to generate random JIDs of types `@g.us`, `@s.whatsapp.net`, `@broadcast`
    - **Property 1: JID routing produces correct field values**
    - **Property 2: Broadcast messages are discarded**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.7, 2.8**

  - [ ]* 2.4 Write property test for Hendra detection and media messages
    - **Property 3: Hendra detection in personal messages**
    - **Property 14: Media-only messages stored correctly**
    - **Validates: Requirements 2.6, 6.2**

- [x] 3. Checkpoint - Verify listener changes
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: rebuild listener with `npm run build` in `listener/`, confirm no type errors

- [x] 4. Update classifier edge function for personal messages
  - [x] 4.1 Modify `fetchUnclassifiedMessages()` in `supabase/functions/classify-messages/index.ts`
    - Add `conversation_type` and `wa_contact_jid` to the select query
    - Ensure the query does not filter by `wa_group_id` presence (personal messages have NULL)
    - Update `MessageRow` interface to include `conversation_type` and `wa_contact_jid`
    - _Requirements: 3.1_

  - [x] 4.2 Modify `groupMessagesIntoConversations()` to handle personal messages
    - For personal messages: group by `wa_contact_jid` instead of `wa_group_id`
    - Keep existing group message grouping logic unchanged
    - Add `conversationType` field to the `Conversation` interface
    - _Requirements: 3.2_

  - [x] 4.3 Add personal message classification prompt and modify `buildConversationPrompt()`
    - Create `PERSONAL_SYSTEM_PROMPT` constant — adapted from existing `SYSTEM_PROMPT` but framed as a 1-on-1 direct conversation with Hendra
    - Modify `buildConversationPrompt()` to accept conversation type and adjust context text
    - In the main handler loop, select prompt based on `conversation.conversationType`
    - _Requirements: 3.3, 5.4_

  - [x] 4.4 Modify `createTask()` and `createDirection()` for personal messages
    - When `conversation_type = 'personal'`, use contact display name as `group_name` instead of group name
    - Fall back to `wa_contact_jid` if contact display name is unavailable
    - _Requirements: 3.4, 3.5_

  - [ ]* 4.5 Write property tests for classifier changes
    - **Property 6: Personal message thread grouping by contact**
    - **Property 7: Prompt selection matches conversation type**
    - **Validates: Requirements 3.2, 3.3, 5.4**

- [x] 5. Checkpoint - Verify classifier changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Build frontend ConversationsPage
  - [x] 6.1 Create `src/pages/ConversationsPage.tsx`
    - Left panel: query `wa_intel.messages` where `conversation_type = 'personal'`, group by `wa_contact_jid`, join with `contacts` table for display names
    - Show contact name, message count, last message timestamp per contact
    - Order contacts by most recent message descending
    - Right panel: when contact selected, fetch messages for that `wa_contact_jid` ordered by timestamp ascending
    - Join with `classified_items` to show classification badges
    - Show sender name, timestamp, message text, classification badge per message
    - Use same styling patterns as GroupsPage (grid/detail layout, StatusBadge, EmptyState)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

  - [x] 6.2 Add navigation and routing for ConversationsPage
    - Add `{ to: '/conversations', icon: MessageCircle, label: 'DMs' }` to `navItems` in `src/components/Layout.tsx`
    - Import `MessageCircle` from lucide-react
    - Add `<Route path="conversations" element={<ConversationsPage />} />` in `src/App.tsx`
    - _Requirements: 4.5, 6.3_

  - [ ]* 6.3 Write property tests for frontend data queries
    - **Property 10: Contact list ordered by most recent message**
    - **Property 11: Message thread in chronological order**
    - **Validates: Requirements 4.1, 4.2**

- [x] 7. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: `npm run build` succeeds for both listener and frontend
  - Verify: existing GroupsPage, TasksPage, DirectionsPage, BriefingsPage still work
  - Verify: today_summary view excludes personal messages

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The migration must be applied before testing listener or classifier changes
- Property tests use fast-check with minimum 100 iterations
- All database objects must be registered in `hm_core.object_registry`
