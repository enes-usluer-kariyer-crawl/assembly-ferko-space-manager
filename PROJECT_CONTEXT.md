# PROJECT CONTEXT & REQUIREMENTS
**Project Name:** Assembly Ferko Reservation System
**Description:** A meeting room booking system for Assembly Ferko employees, featuring role-based approvals, automated conflict resolution for large events, and catering management.

---

## 1. TECH STACK & ARCHITECTURE
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **State/Logic:** Server Actions (preferred over API routes where possible)
- **Date Handling:** date-fns or moment.js

---

## 2. USER ROLES & PERMISSIONS

### 2.1. Admin (System Managers)
- **Who:** Oylum Çevik, Merve Varıcı, Doğuş Yön, Vildan Sönmez.
- **Permissions:**
  - Create/Edit/Cancel **ANY** reservation.
  - Approve/Reject "Pending" reservations.
  - View full reporting dashboard.
  - **Auto-Approval:** Reservations created by Admins are automatically status: `APPROVED`.

### 2.2. Standard User (Employees)
- **Who:** All other employees (Coensio, Techcareer, Kariyer.net teams, etc.).
- **Permissions:**
  - View availability.
  - Create reservations (Initial status: `PENDING`).
  - Edit/Cancel **ONLY** their own reservations.

---

## 3. DATABASE SCHEMA (Supabase)

### `profiles` (Public profile table linked to auth.users)
- `id` (uuid, PK)
- `email` (text)
- `full_name` (text)
- `role` (enum: 'admin', 'user')

### `rooms`
- `id` (uuid, PK)
- `name` (text)
- `capacity` (int)
- `features` (text[])
- `is_active` (boolean)

### `reservations`
- `id` (uuid, PK)
- `room_id` (uuid, FK)
- `user_id` (uuid, FK)
- `title` (text)
- `description` (text, nullable)
- `start_time` (timestamptz)
- `end_time` (timestamptz)
- `status` (enum: 'pending', 'approved', 'rejected', 'cancelled')
- `tags` (text[])
- `catering_requested` (boolean)
- `is_recurring` (boolean) - *For future implementation*

---

## 4. CRITICAL BUSINESS LOGIC

### 4.1. "Big Event" Isolation (The Kill Switch)
**Rule:** Some high-priority meetings require absolute silence or privacy, effectively shutting down the entire facility or preventing other bookings.

- **Trigger Tags:** If a reservation includes any of these specific tags:
  1. `ÖM-Success Meetings`
  2. `Exco Toplantısı`
  3. `ÖM- HR Small Talks`

- **Logic:**
  1. When a user attempts to book a room with these tags, the system must check availability for **ALL 5 ROOMS** during that time slot.
  2. If *any* other room is occupied, the booking is blocked (or requires admin override).
  3. If the booking is successful, **no other bookings** can be made in any other room for that duration.

### 4.2. Approval Workflow
- **Input:** User creates a request.
- **Process:**
  - IF User == Admin → Status = `APPROVED`.
  - IF User == Standard → Status = `PENDING`.
- **Action:** A notification (system/email) is sent to the Approver (Oylum Çevik).

### 4.3. Catering Logic
- A simple checkbox "Catering Requested" in the form.
- If checked, it flags the reservation for the Admin (Oylum) to see on the dashboard.
- Does not reserve a separate "Kitchen" room, but implies extra attention.

---

## 5. ROOM DEFINITIONS (Seed Data)

| Room Name      | Capacity | Description |
| :---           | :---     | :--- |
| **Büyük Oda** | 20       | Main event & large meeting area |
| **Eğitim Odası**| 15       | For workshops and training |
| **Demo Odası** | 4        | Small group work & presentations |
| **Koltuklu Oda**| 2       | 1-on-1 meetings, relaxed setting |
| **Masalı Oda** | 2        | Focus work, short meetings |

---

## 6. UI/UX GUIDELINES
- **Calendar View:** A responsive weekly/daily calendar view showing booked slots. Color-coded by Room.
- **Booking Form:** Modal popup. Must validate: "End Time > Start Time" and "Date >= Tomorrow" (Min 1 day notice).
- **Admin Dashboard:** A clear list of "Pending Approvals" with quick Approve/Reject actions.