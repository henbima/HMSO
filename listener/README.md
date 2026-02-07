# WA Intel Listener (Module 1)

WhatsApp message listener for HollyMart WA Intelligence. Connects to WhatsApp via a backup number, captures all group messages, and stores them in Supabase.

## Prerequisites

- Node.js 18+
- A dedicated/backup WhatsApp number (NOT the primary business number)
- Supabase project with `wa_intel` schema already set up
- PM2 (for production): `npm install -g pm2`

## Setup

1. Clone/copy the `listener/` folder to your office PC.

2. Install dependencies:
   ```bash
   cd listener
   npm install
   ```

3. Create `.env` from the example:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and fill in:
   - `SUPABASE_SERVICE_ROLE_KEY` — get from Supabase Dashboard > Settings > API
   - `HENDRA_JID` — Hendra's WhatsApp number in format `628xxxxxxxxxx@s.whatsapp.net`

5. Build the project:
   ```bash
   npm run build
   ```

6. First run — scan QR code:
   ```bash
   npm start
   ```
   A QR code will appear in the terminal. Open WhatsApp on the backup phone > Settings > Linked Devices > Link a Device > scan the QR code.

   After scanning, the `auth_info/` folder is created. You won't need to scan again unless you delete it.

## Running Multiple Listeners (Redundancy)

You can run multiple listeners simultaneously using different WhatsApp numbers for redundancy. Each listener tracks which data it captured via `listener_id`.

### Setup for Multiple Listeners:

1. **First listener (e.g., personal number):**
   ```bash
   # Create .env.personal
   cp .env.example .env.personal
   # Edit .env.personal and set:
   # LISTENER_ID=personal
   # HENDRA_JID=628xxx...

   # Run first listener
   LISTENER_ID=personal npm start
   ```
   Scan QR with your personal WhatsApp. Auth saves to `auth_info/personal/`

2. **Second listener (e.g., company number):**
   ```bash
   # In a new terminal
   cp .env.example .env.company
   # Edit .env.company and set:
   # LISTENER_ID=company
   # HENDRA_JID=628xxx...

   # Run second listener
   LISTENER_ID=company npm start
   ```
   Scan QR with your company WhatsApp. Auth saves to `auth_info/company/`

Both listeners:
- Write to the same database
- Tag data with their `listener_id`
- Run independently (one can restart without affecting the other)
- If one is banned, the other continues capturing

### With PM2 (Production):

Update `ecosystem.config.cjs` to run multiple instances with different env files.

## Running in Production (PM2)

```bash
# Build first
npm run build

# Start with PM2
pm2 start ecosystem.config.cjs

# Check status
pm2 status

# View logs
pm2 logs wa-intel-listener

# Auto-start on system boot
pm2 startup
pm2 save
```

## Development

```bash
npm run dev
```

## What It Does

- Connects to WhatsApp using @whiskeysockets/baileys
- On startup: syncs all group metadata and member lists to the database
- Listens for every new message in every group
- For each message:
  - Looks up the sender in `wa_intel.contacts` (auto-creates if new)
  - Flags messages from Hendra (`is_from_hendra`)
  - Saves to `wa_intel.messages` with full metadata
- Listens for group participant changes (join/leave/promote/demote)
- Auto-reconnects on disconnection with exponential backoff
- Read-only — never sends messages or replies

## File Structure

```
listener/
├── src/
│   ├── index.ts              # Main entry — Baileys setup, event listeners
│   ├── config.ts             # Environment variable loading
│   ├── supabase.ts           # Supabase client (wa_intel schema)
│   ├── logger.ts             # Pino logger setup
│   ├── message-handler.ts    # Parse & save incoming messages
│   ├── contact-resolver.ts   # Contact lookup & auto-creation
│   └── group-sync.ts         # Group metadata & member sync
├── auth_info/                # Baileys auth state (gitignored)
├── ecosystem.config.cjs      # PM2 configuration
├── package.json
├── tsconfig.json
└── .env                      # Your secrets (gitignored)
```

## Troubleshooting

- **QR code expired**: restart the process and scan again
- **Logged out error**: delete `auth_info/` folder and restart to re-scan QR
- **Connection drops**: the listener auto-reconnects with exponential backoff (up to 20 attempts)
- **Duplicate message errors**: these are silently ignored (unique constraint on `wa_message_id`)
