# CaddiePro Backend API

Backend REST API for CaddiePro golf caddie management system.

## Tech Stack

- **Node.js** - Runtime environment
- **Express** - Web framework
- **Prisma** - ORM for database management
- **PostgreSQL** - Database (configurable)
- **JWT** - Authentication
- **bcryptjs** - Password hashing

## Features

- Admin authentication with JWT
- Caddie management (CRUD operations)
- Turn tracking with queue management
- Attendance tracking with late penalties
- List settings configuration
- Daily and range reports with CSV export
- Messaging system with WhatsApp integration

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend-caddiePro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and JWT secret
   ```

4. **Setup database**
   ```bash
   npm run prisma:generate
   npm run prisma:push
   npm run prisma:seed
   ```

   Or use the all-in-one command:
   ```bash
   npm run install:all
   ```

5. **Start the server**
   ```bash
   npm run dev      # Development mode with hot reload
   npm start        # Production mode
   ```

The server will start at `http://localhost:3000`

## Default Credentials

- **Admin Password**: `admin123`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/verify` - Verify token

### Caddies
- `GET /api/caddies` - Get all caddies
- `GET /api/caddies/:id` - Get single caddie
- `POST /api/caddies` - Create caddie (admin)
- `PUT /api/caddies/:id` - Update caddie (admin)
- `DELETE /api/caddies/:id` - Delete caddie (admin)
- `GET /api/caddies/list/:listNumber` - Get caddies by list

### Turns
- `GET /api/turns` - Get all turns
- `GET /api/turns/:id` - Get single turn
- `POST /api/turns` - Create turn (start shift)
- `PUT /api/turns/:id` - Update turn (end shift)
- `GET /api/turns/caddie/:caddieId` - Get turns by caddie
- `GET /api/turns/list/:listNumber` - Get turns by list
- `GET /api/turns/date/:date` - Get turns by date

### Attendance
- `GET /api/attendance` - Get all attendance
- `GET /api/attendance/:id` - Get single attendance
- `POST /api/attendance` - Create attendance (admin)
- `PUT /api/attendance/:id` - Update attendance (admin)
- `GET /api/attendance/caddie/:caddieId` - Get attendance by caddie
- `GET /api/attendance/list/:listNumber` - Get attendance by list
- `GET /api/attendance/date/:date` - Get attendance by date

### List Settings
- `GET /api/list-settings` - Get all list settings
- `GET /api/list-settings/:listNumber` - Get settings for specific list
- `PUT /api/list-settings/:listNumber` - Update list settings (admin)
- `PUT /api/list-settings/:listNumber/order` - Update list order (admin)
- `PUT /api/list-settings/:listNumber/range` - Update list range (admin)
- `GET /api/list-settings/:listNumber/queue` - Get queue for list

### Reports
- `GET /api/reports/daily/:date` - Get daily report
- `GET /api/reports/range/:startDate/:endDate` - Get date range report
- `GET /api/reports/csv/:date` - Download CSV report (admin)

### Messages
- `GET /api/messages` - Get all messages
- `POST /api/messages` - Create message (admin)
- `DELETE /api/messages/:id` - Delete message (admin)
- `PUT /api/messages/:id/read` - Mark message as read (admin)
- `GET /api/messages/:id/whatsapp` - Get WhatsApp share URL

## Project Structure

```
backend-caddiePro/
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.js             # Database seeding
├── src/
│   ├── config/
│   │   └── database.js     # Prisma client
│   ├── controllers/        # Route handlers
│   │   ├── authController.js
│   │   ├── caddieController.js
│   │   ├── turnController.js
│   │   ├── attendanceController.js
│   │   ├── listSettingsController.js
│   │   ├── messagesController.js
│   │   └── reportsController.js
│   ├── middleware/
│   │   └── auth.js         # JWT authentication
│   ├── routes/             # Express routes
│   │   ├── auth.js
│   │   ├── caddie.js
│   │   ├── turn.js
│   │   ├── attendance.js
│   │   ├── listSettings.js
│   │   ├── reports.js
│   │   └── messages.js
│   ├── utils/
│   │   ├── jwt.js          # JWT utilities
│   │   └── password.js     # Password utilities
│   └── server.js           # Main server file
├── .env                    # Environment variables
├── .env.example            # Environment variables template
├── package.json
└── README.md
```

## Database Schema

- **Caddie** - Caddie profiles
- **Turn** - Shift/turn records
- **Attendance** - Daily attendance records
- **ListSettings** - Configuration for each list
- **Message** - Announcements/messages
- **CaddieQueue** - Queue management for turn order
- **Admin** - Admin credentials

## Development

### Run in development mode
```bash
npm run dev
```

### View database in Prisma Studio
```bash
npm run prisma:studio
```

### Generate Prisma client
```bash
npm run prisma:generate
```

### Push schema changes to database
```bash
npm run prisma:push
```

## Security Notes

- Change the default admin password immediately
- Update JWT_SECRET in production
- Use HTTPS in production
- Implement rate limiting for production
- Add input validation for all endpoints

## License

ISC
