# Requirements Document

## Introduction

The HMWAIntel system currently captures only WhatsApp group messages (`@g.us` JIDs) and explicitly filters out personal/direct messages (`@s.whatsapp.net` JIDs). This feature extends the system to also capture personal messages sent to and from Hendra's WhatsApp account. The goal is to gather all data revolving around Hendra — groups and personal — to later build briefings, knowledge base, important notes, and daily task reminders. This is forward-only capture; historical personal messages cannot be retrieved via Baileys.

## Glossary

- **Listener**: The Baileys-based Node.js process that connects to WhatsApp Web and captures incoming messages in real-time
- **Message_Handler**: The module (`message-handler.ts`) that processes incoming WhatsApp messages and stores them in the database
- **Classifier**: The Supabase Edge Function (`classify-messages`) that uses AI to categorize messages into task, direction, report, question, coordination, or noise
- **Personal_Message**: A WhatsApp direct/private message between two individuals, identified by a JID ending in `@s.whatsapp.net`
- **Group_Message**: A WhatsApp message sent within a group chat, identified by a JID ending in `@g.us`
- **Conversation_Type**: A field distinguishing whether a message belongs to a group chat (`group`) or a personal/direct chat (`personal`)
- **Contact_JID**: The WhatsApp identifier for an individual contact, in the format `<phone>@s.whatsapp.net`
- **Messages_Table**: The `wa_intel.messages` table that stores all captured WhatsApp messages
- **Conversations_Page**: A new frontend page that displays personal message threads grouped by contact
- **Contact_Resolver**: The module that resolves sender JIDs to contact records in the database

## Requirements

### Requirement 1: Database Schema Extension for Personal Messages

**User Story:** As a system operator, I want the database schema to support personal messages alongside group messages, so that both message types can be stored in a unified messages table.

#### Acceptance Criteria

1. THE Messages_Table SHALL have a `conversation_type` column with values `group` or `personal` that defaults to `group`
2. WHEN a migration adds the `conversation_type` column, THE Messages_Table SHALL set all existing rows to `group`
3. THE Messages_Table SHALL allow `wa_group_id` to be NULL for personal messages
4. WHEN a personal message is stored, THE Messages_Table SHALL store the Contact_JID of the other party in a `wa_contact_jid` column
5. WHEN new database objects are created, THE migration SHALL register each object in `hm_core.object_registry` with `owner_app = 'wa_intel'`
6. THE migration SHALL create indexes on the `conversation_type` and `wa_contact_jid` columns for query performance

### Requirement 2: Listener Capture of Personal Messages

**User Story:** As a system operator, I want the listener to capture personal messages sent to and from Hendra's WhatsApp, so that no direct messages are lost.

#### Acceptance Criteria

1. WHEN a message arrives with a JID ending in `@s.whatsapp.net`, THE Message_Handler SHALL process and store the message instead of discarding it
2. WHEN a personal message is received, THE Message_Handler SHALL set `conversation_type` to `personal`
3. WHEN a personal message is received, THE Message_Handler SHALL store the remote JID as `wa_contact_jid`
4. WHEN a personal message is received, THE Message_Handler SHALL set `wa_group_id` to NULL and `group_id` to NULL
5. WHEN a personal message is received, THE Message_Handler SHALL resolve the sender contact using the Contact_Resolver
6. WHEN a personal message is from Hendra, THE Message_Handler SHALL set `is_from_hendra` to true and use the remote JID as the contact JID
7. WHEN a status broadcast message arrives (JID containing `@broadcast`), THE Message_Handler SHALL discard the message
8. THE Message_Handler SHALL continue to process group messages with `conversation_type` set to `group` using the existing logic

### Requirement 3: Personal Message Classification

**User Story:** As a system operator, I want personal messages to be classified by AI, so that tasks, directions, and important items from direct conversations are captured.

#### Acceptance Criteria

1. WHEN the Classifier fetches unclassified messages, THE Classifier SHALL include personal messages in the query
2. WHEN building conversation threads for personal messages, THE Classifier SHALL group them by `wa_contact_jid` and reply chains instead of by `wa_group_id`
3. WHEN classifying a personal message thread, THE Classifier SHALL use a context-aware prompt that identifies the thread as a direct conversation rather than a group discussion
4. WHEN a personal message is classified as a task, THE Classifier SHALL create a task record with `group_name` set to the contact display name instead of a group name
5. WHEN a personal message is classified as a direction, THE Classifier SHALL create a direction record with `group_name` set to the contact display name

### Requirement 4: Frontend Personal Messages View

**User Story:** As Hendra, I want to view my personal messages in the dashboard organized by contact, so that I can review direct conversations and their classifications.

#### Acceptance Criteria

1. THE Conversations_Page SHALL display a list of contacts who have personal message threads, ordered by most recent message timestamp
2. WHEN a user selects a contact from the list, THE Conversations_Page SHALL display the message thread for that contact in chronological order
3. THE Conversations_Page SHALL display the contact name, message count, and last message timestamp for each contact in the list
4. WHEN displaying a personal message, THE Conversations_Page SHALL show the sender name, timestamp, message text, and classification status
5. THE Conversations_Page SHALL be accessible from the main navigation sidebar
6. WHEN personal messages have classifications, THE Conversations_Page SHALL display the classification badge (task, direction, report, question, coordination, noise) next to each message

### Requirement 5: Data Integrity and Backward Compatibility

**User Story:** As a system operator, I want the personal messages feature to maintain backward compatibility with existing group message functionality, so that no existing features break.

#### Acceptance Criteria

1. WHEN the migration runs, THE Messages_Table SHALL preserve all existing group message data without modification
2. THE existing GroupsPage, TasksPage, DirectionsPage, and BriefingsPage SHALL continue to function with group messages only
3. WHEN the `today_summary` view is queried, THE view SHALL continue to return group-based summaries without including personal messages
4. WHEN the Classifier processes group messages, THE Classifier SHALL use the existing group-focused classification prompt
5. IF the `conversation_type` column is missing or NULL, THEN THE system SHALL treat the message as a group message

### Requirement 6: Privacy and Filtering

**User Story:** As Hendra, I want control over which personal messages are captured, so that I can manage privacy for sensitive conversations.

#### Acceptance Criteria

1. THE Message_Handler SHALL capture all personal messages by default without filtering by content
2. WHEN a personal message contains only media without text (image, video, sticker with no caption), THE Message_Handler SHALL store the message with `message_text` as NULL and `message_type` reflecting the media type
3. THE Conversations_Page SHALL only be accessible to authenticated users with a valid session
