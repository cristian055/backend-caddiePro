# CaddiePro Backend - Setup Complete

## Overview
A complete RESTful API for the CaddiePro golf caddie management system has been created with the following features:

- **Authentication** with JWT tokens
- **Caddie management** (CRUD operations)
- **Turn tracking** with queue management
- **Attendance tracking** with late penalties
- **List settings** configuration
- **Reports** with CSV export
- **Messaging** with WhatsApp integration

## Tech Stack
- Node.js + Express.js
- Prisma ORM
- PostgreSQL
- JWT Authentication
- bcryptjs for password hashing

## Project Structure
```
backend-caddiePro/
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   └── seed.js                # Database seeding script
├── src/
│   ├── config/
│   │   └── database.js        # Prisma client instance
│   ├── controllers/           # Business logic handlers
│   │   ├── authController.js
│   │   ├── caddieController.js
│   │   ├── turnController.js
│   │   ├── attendanceController.js
│   │   ├── listSettingsController.js
│   │   ├── messagesController.js
│   │   └── reportsController.js
│   ├── middleware/
│   │   └── auth.js            # JWT authentication middleware
│   ├── routes/                # Express route definitions
│   │   ├── auth.js
│   │   ├── caddie.js
│   │   ├── turn.js
│   │   ├── attendance.js
│   │   ├── listSettings.js
│   │   ├── reports.js
│   │   └── messages.js
│   ├── utils/                 # Utility functions
│   │   ├── jwt.js
│   │   └── password.js
│   └── server.js              # Main application entry point
├── tmp/                       # Temporary directory for CSV exports
├── .env                       # Environment variables (already exists)
├── .env.example               # Environment variables template
├── package.json
└── README.md                  # Complete documentation
```

## Database Models

1. **Caddie** - Stores caddie profiles (name, list number, status, phone)
2. **Turn** - Tracks shift records (start/end times, completion status)
3. **Attendance** - Daily attendance records with status tracking
4. **ListSettings** - Configuration for each of the 3 lists
5. **Message** - Announcements and notifications
6. **CaddieQueue** - Queue management for turn ordering
7. **Admin** - Admin credentials for authentication

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/verify` - Verify JWT token

### Caddies
- `GET /api/caddies` - Get all caddies (public)
- `GET /api/caddies/:id` - Get single caddie (public)
- `POST /api/caddies` - Create caddie (admin)
- `PUT /api/caddies/:id` - Update caddie (admin)
- `DELETE /api/caddies/:id` - Delete caddie (admin)
- `GET /api/caddies/list/:listNumber` - Get caddies by list (public)

### Turns
- `GET /api/turns` - Get all turns (public)
- `GET /api/turns/:id` - Get single turn (public)
- `POST /api/turns` - Create turn (admin)
- `PUT /api/turns/:id` - Update turn (admin)
- `GET /api/turns/caddie/:caddieId` - Get turns by caddie (public)
- `GET /api/turns/list/:listNumber` - Get turns by list (public)
- `GET /api/turns/date/:date` - Get turns by date (public)

### Attendance
- `GET /api/attendance` - Get all attendance (public)
- `GET /api/attendance/:id` - Get single attendance (public)
- `POST /api/attendance` - Create attendance (admin)
- `PUT /api/attendance/:id` - Update attendance (admin)
- `GET /api/attendance/caddie/:caddieId` - Get attendance by caddie (public)
- `GET /api/attendance/list/:listNumber` - Get attendance by list (public)
- `GET /api/attendance/date/:date` - Get attendance by date (public)

### List Settings
- `GET /api/list-settings` - Get all settings (public)
- `GET /api/list-settings/:listNumber` - Get settings for list (public)
- `GET /api/list-settings/:listNumber/queue` - Get queue (public)
- `PUT /api/list-settings/:listNumber` - Update settings (admin)
- `PUT /api/list-settings/:listNumber/order` - Update order (admin)
- `PUT /api/list-settings/:listNumber/range` - Update range (admin)

### Reports
- `GET /api/reports/daily/:date` - Daily report (public)
- `GET /api/reports/range/:startDate/:endDate` - Range report (public)
- `GET /api/reports/csv/:date` - Download CSV (admin)

### Messages
- `GET /api/messages` - Get all messages (public)
- `POST /api/messages` - Create message (admin)
- `DELETE /api/messages/:id` - Delete message (admin)
- `PUT /api/messages/:id/read` - Mark as read (admin)
- `GET /api/messages/:id/whatsapp` - Get WhatsApp URL (public)

## Quick Start Commands

```bash
# Start development server with hot reload
npm run dev

# Start production server
npm start

# Setup database (run this if first time)
npm run install:all

# Or step by step:
npm run prisma:push    # Push schema to database
npm run prisma:seed    # Seed default data

# View database in Prisma Studio
npm run prisma:studio
```

## Default Credentials

- **Admin Password**: `admin123`

## Database Setup

The .env file already exists with DATABASE_URL configured. To initialize the database:

```bash
npm run prisma:push
npm run prisma:seed
```

This will:
1. Create all database tables
2. Create an admin account
3. Create default list settings
4. Add sample caddies for testing
5. Add a welcome message

## Features Implemented

### Core Business Logic

1. **Queue Management**
   - FIFO queue for turn ordering
   - Automatic position updates
   - Range filtering for active caddies
   - Order reversal (ascending/descending)

2. **Attendance System**
   - Multiple status types (Presente, Llegó tarde, No vino, Permiso)
   - Automatic late penalty (move to end of queue)
   - Daily tracking with time stamps
   - Turn count tracking

3. **Turn Tracking**
   - Start time recording
   - End time recording
   - Status updates (En campo, Disponible)
   - Queue management integration

4. **Reports**
   - Daily summaries with statistics
   - Date range reports
   - CSV export functionality
   - Attendance and turn metrics

5. **Messaging**
   - Broadcast to all lists or specific list
   - WhatsApp integration via URL generation
   - Read status tracking
   - Message management (CRUD)

### Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Public/admin route separation
- Input validation with express-validator

## Next Steps

1. **Initialize Database**
   ```bash
   npm run prisma:push
   npm run prisma:seed
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Test API Endpoints**
   ```bash
   # Login to get token
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"password":"admin123"}'

   # Get all caddies
   curl http://localhost:3000/api/caddies
   ```

4. **View Database**
   ```bash
   npm run prisma:studio
   ```

## Configuration

Environment variables are already set in `.env`. You can modify:

- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - Secret key for JWT tokens
- `JWT_EXPIRES_IN` - Token expiration time

## Notes

- The server will start on `http://localhost:3000`
- Health check available at `GET /health`
- CORS is enabled for all origins (restrict in production)
- API responds with JSON format
- Error responses include descriptive messages

---

**Status**: ✅ Backend implementation complete
**Dependencies**: ✅ Installed
**Prisma Client**: ✅ Generated
**Database**: Ready to push schema (has DATABASE_URL in .env)
