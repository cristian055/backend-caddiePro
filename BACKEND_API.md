# CaddiePro Backend API Specification

## Overview

Document that defines the API contract between the CaddiePro frontend and backend.

### Application Context

- **Public Monitor** (`/monitor`): Public access, no authentication, requires WebSocket for real-time updates
- **Admin Dashboard** (`/admin`): Protected with JWT authentication

---

## Base URL

```
Development: http://localhost:3000/api
Production: https://api.caddiepro.com/api
```

---

## Response Format

All API responses follow this structure:

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    timestamp: string
    requestId: string
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid input data |
| DUPLICATE_ENTRY | 409 | Duplicate resource (e.g., caddie number) |
| UNAUTHORIZED | 401 | Invalid or missing authentication |
| FORBIDDEN | 403 | Access denied |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Database Schemas

### users

Authentication and user management.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'operator')),
  location VARCHAR(50) NOT NULL CHECK (location IN ('Llanogrande', 'Medellín')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### caddies

Master caddie data.

```sql
CREATE TABLE caddies (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  number INTEGER NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE', 'IN_PREP', 'IN_FIELD', 'LATE', 'ABSENT', 'ON_LEAVE')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  category VARCHAR(50) CHECK (category IN ('Primera', 'Segunda', 'Tercera')),
  location VARCHAR(50) NOT NULL CHECK (location IN ('Llanogrande', 'Medellín')),
  role VARCHAR(50) NOT NULL CHECK (role IN ('Golf', 'Tennis', 'Hybrid')),
  weekend_priority INTEGER DEFAULT 0,
  is_skipped_next_week BOOLEAN DEFAULT false,
  history_count INTEGER DEFAULT 0,
  absences_count INTEGER DEFAULT 0,
  late_count INTEGER DEFAULT 0,
  leave_count INTEGER DEFAULT 0,
  last_action_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### caddie_availability

Caddie availability by day.

```sql
CREATE TYPE availability_range_type AS ENUM ('full', 'before', 'after', 'between');

CREATE TABLE caddie_availability (
  id UUID PRIMARY KEY,
  caddie_id UUID NOT NULL REFERENCES caddies(id),
  day VARCHAR(20) NOT NULL CHECK (day IN (
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  )),
  is_available BOOLEAN DEFAULT true,
  range_type availability_range_type,
  range_time VARCHAR(10), -- HH:MM format
  range_end_time VARCHAR(10), -- HH:MM format (for 'between' type)
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(caddie_id, day)
);
```

### list_configs

Queue list configurations.

```sql
CREATE TYPE list_order_type AS ENUM ('ASC', 'DESC', 'RANDOM', 'MANUAL');

CREATE TABLE list_configs (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  order_type list_order_type NOT NULL DEFAULT 'ASC',
  range_start INTEGER NOT NULL,
  range_end INTEGER NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('Primera', 'Segunda', 'Tercera')),
  location VARCHAR(50) NOT NULL CHECK (location IN ('Llanogrande', 'Medellín')),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### weekly_shifts

Shift configurations for weekly scheduling.

```sql
CREATE TABLE weekly_shifts (
  id UUID PRIMARY KEY,
  day VARCHAR(20) NOT NULL CHECK (day IN (
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  )),
  time VARCHAR(10) NOT NULL, -- HH:MM format
  location VARCHAR(50) NOT NULL CHECK (location IN ('Llanogrande', 'Medellín')),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### weekly_shift_requirements

Caddie requirements per shift.

```sql
CREATE TABLE weekly_shift_requirements (
  id UUID PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES weekly_shifts(id),
  category VARCHAR(50) NOT NULL CHECK (category IN ('Primera', 'Segunda', 'Tercera')),
  count INTEGER NOT NULL CHECK (count > 0),
  created_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(shift_id, category)
);
```

### weekly_assignments

Caddie assignments to shifts.

```sql
CREATE TABLE weekly_assignments (
  id UUID PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES weekly_shifts(id),
  caddie_id UUID NOT NULL REFERENCES caddies(id),
  caddie_name VARCHAR(100) NOT NULL,
  caddie_number INTEGER NOT NULL,
  category VARCHAR(50) NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(shift_id, caddie_id)
);
```

### dispatch_history

Audit log for dispatch operations.

```sql
CREATE TABLE dispatch_history (
  id UUID PRIMARY KEY,
  caddie_id UUID NOT NULL REFERENCES caddies(id),
  previous_status VARCHAR(50) NOT NULL,
  new_status VARCHAR(50) NOT NULL,
  list_id UUID REFERENCES list_configs(id),
  dispatched_by UUID REFERENCES users(id),
  dispatched_at TIMESTAMP WITH TIME ZONE,
  location VARCHAR(50) NOT NULL
);
```

### service_logs

Daily service statistics for reports.

```sql
CREATE TABLE service_logs (
  id UUID PRIMARY KEY,
  caddie_id UUID NOT NULL REFERENCES caddies(id),
  service_date DATE NOT NULL,
  services_count INTEGER DEFAULT 0,
  absences_count INTEGER DEFAULT 0,
  leaves_count INTEGER DEFAULT 0,
  lates_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(caddie_id, service_date)
);
```

---

## API Endpoints

### Authentication

#### POST /auth/login

Login to receive JWT token.

**Request:**
```json
{
  "email": "admin@campestre.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "admin@campestre.com",
      "role": "admin",
      "location": "Llanogrande"
    }
  }
}
```

---

### Caddies (Protected - Requires JWT)

#### GET /caddies

Get all caddies with optional filtering.

**Query Parameters:**
- `searchTerm` (string, optional): Search by name or number
- `category` ('All' | 'Primera' | 'Segunda' | 'Tercera', optional)
- `activeStatus` ('All' | 'Active' | 'Inactive', optional)
- `location` ('Llanogrande' | 'Medellín', optional)
- `role` ('Golf' | 'Tennis' | 'Hybrid', optional)
- `includeInactive` (boolean, optional): Include inactive caddies

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "caddies": [
      {
        "id": "uuid",
        "name": "Caddie 1",
        "number": 1,
        "status": "AVAILABLE",
        "isActive": true,
        "category": "Primera",
        "location": "Llanogrande",
        "role": "Golf",
        "weekendPriority": 1,
        "isSkippedNextWeek": false,
        "historyCount": 15,
        "absencesCount": 2,
        "lateCount": 1,
        "leaveCount": 0,
        "lastActionTime": "09:00 AM",
        "availability": [
          {
            "day": "Friday",
            "isAvailable": true,
            "range": {
              "type": "after",
              "time": "09:30 AM"
            }
          }
        ]
      }
    ],
    "total": 120,
    "page": 1,
    "pageSize": 20
  }
}
```

#### GET /caddies/statistics

Get caddie statistics.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "total": 120,
    "active": 115,
    "inactive": 5,
    "byStatus": {
      "AVAILABLE": 50,
      "IN_PREP": 20,
      "IN_FIELD": 30,
      "LATE": 5,
      "ABSENT": 5,
      "ON_LEAVE": 5
    },
    "byCategory": {
      "Primera": 40,
      "Segunda": 40,
      "Tercera": 40
    }
  }
}
```

#### GET /caddies/queue

Get caddies for queue (active and available/late).

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "queueCaddies": [
      {
        "id": "uuid",
        "name": "Caddie 1",
        "number": 1,
        "status": "AVAILABLE",
        "category": "Primera",
        "weekendPriority": 1
      }
    ]
  }
}
```

#### GET /caddies/returns

Get caddies that need to return (IN_PREP or IN_FIELD status).

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "returnCaddies": [
      {
        "id": "uuid",
        "name": "Caddie 1",
        "number": 1,
        "status": "IN_PREP",
        "category": "Primera"
      }
    ]
  }
}
```

#### GET /caddies/availability/:day

Get caddies available on a specific day.

**Path Parameters:**
- `day` ('Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday')

**Query Parameters:**
- `includeInactive` (boolean, optional)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "day": "Friday",
    "availableCaddies": [
      {
        "id": "uuid",
        "name": "Caddie 1",
        "number": 1,
        "category": "Primera",
        "weekendPriority": 1,
        "availability": [...]
      }
    ]
  }
}
```

#### POST /caddies

Create a new caddie.

**Request:**
```json
{
  "name": "John Doe",
  "number": 121,
  "category": "Primera",
  "location": "Llanogrande",
  "role": "Golf",
  "availability": [
    {
      "day": "Friday",
      "isAvailable": true,
      "range": {
        "type": "after",
        "time": "09:30 AM"
      }
    }
  ],
  "weekendPriority": 121
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "number": 121,
    "status": "AVAILABLE",
    "isActive": true,
    ...
  }
}
```

#### PUT /caddies/:id

Update a caddie.

**Request:**
```json
{
  "updates": {
    "name": "John Smith",
    "status": "IN_PREP",
    "availability": [...]
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    ...updatedCaddie
  }
}
```

#### DELETE /caddies/:id

Soft delete a caddie (set `isActive = false`).

**Success Response (200):**
```json
{
  "success": true,
  "message": "Caddie deactivated successfully"
}
```

---

### List Management (Protected - Requires JWT)

#### GET /lists

Get all list configurations.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "lists": [
      {
        "id": "uuid",
        "name": "First Category",
        "order": "ASC",
        "rangeStart": 1,
        "rangeEnd": 40,
        "category": "Primera",
        "location": "Llanogrande"
      }
    ]
  }
}
```

#### GET /lists/category/:category

Get list configuration for specific category.

**Path Parameters:**
- `category` ('Primera' | 'Segunda' | 'Tercera')

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "list": {
      "id": "uuid",
      "name": "First Category",
      ...
    }
  }
}
```

#### PUT /lists/:id

Update list configuration.

**Request:**
```json
{
  "updates": {
    "name": "Updated Name",
    "rangeStart": 1,
    "rangeEnd": 50,
    "order": "DESC"
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    ...updatedList
  }
}
```

#### POST /lists/:id/randomize

Randomize caddie order in list (update `weekendPriority` for caddies in range).

**Success Response (200):**
```json
{
  "success": true,
  "message": "List randomized successfully"
}
```

---

### Dispatch Operations (Protected - Requires JWT)

#### POST /dispatch/bulk

Bulk dispatch caddies and trigger WebSocket notification.

**Request:**
```json
{
  "updates": [
    {
      "id": "c-1",
      "status": "IN_PREP",
      "listId": "list-1"
    },
    {
      "id": "c-2",
      "status": "IN_PREP",
      "listId": "list-1"
    }
  ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "dispatched": ["c-1", "c-2"],
    "timestamp": 1704672000000
  }
}
```

---

### Weekly Schedule (Protected - Requires JWT)

#### GET /schedule/shifts

Get all weekly shifts.

**Query Parameters:**
- `day` (string, optional): Filter by day
- `location` (string, optional): Filter by location

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "shifts": [
      {
        "id": "uuid",
        "day": "Friday",
        "time": "08:00",
        "requirements": [
          {
            "category": "Primera",
            "count": 5
          }
        ]
      }
    ]
  }
}
```

#### POST /schedule/shifts

Create a new shift.

**Request:**
```json
{
  "id": "uuid",
  "day": "Friday",
  "time": "08:00",
  "location": "Llanogrande",
  "requirements": [
    {
      "category": "Primera",
      "count": 5
    }
  ]
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    ...
  }
}
```

#### DELETE /schedule/shifts/:id

Delete a shift and its requirements.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Shift deleted successfully"
}
```

#### GET /schedule/assignments

Get all weekly assignments.

**Query Parameters:**
- `shiftId` (string, optional): Filter by shift
- `day` (string, optional): Filter by day

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "assignments": [
      {
        "shiftId": "uuid",
        "caddieId": "uuid",
        "caddieName": "Caddie 1",
        "caddieNumber": 1,
        "category": "Primera",
        "time": "08:00"
      }
    ]
  }
}
```

#### POST /schedule/generate

Generate weekly draw for a specific day using the assignment algorithm.

**Request:**
```json
{
  "day": "Friday",
  "location": "Llanogrande"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "assignedCount": 25,
    "skippedCount": 5,
    "assignments": [...]
  }
}
```

#### POST /schedule/reset

Reset weekly schedule (clear all assignments).

**Success Response (200):**
```json
{
  "success": true,
  "message": "Schedule reset successfully"
}
```

---

### Reports (Protected - Requires JWT)

#### GET /reports/statistics

Get daily statistics.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "date": "2024-01-08",
    "totalServices": 50,
    "totalAbsences": 5,
    "totalLeaves": 2,
    "totalLates": 3
  }
}
```

#### GET /reports/incidents

Get caddies with incidents (absences, leaves, lates).

**Query Parameters:**
- `limit` (number, optional, default: 10)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "incidents": [
      {
        "id": "uuid",
        "number": 1,
        "name": "Caddie 1",
        "absencesCount": 5,
        "leaveCount": 2,
        "lateCount": 3,
        "total": 10
      }
    ]
  }
}
```

#### GET /reports/csv

Download daily report as CSV.

**Query Parameters:**
- `date` (string, optional): Date in YYYY-MM-DD format (default: today)

**Response:** CSV file download

---

### Public Endpoints (No Authentication Required)

#### GET /public/queue

Get current queue state for public monitor.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "Primera": [
      {
        "id": "uuid",
        "name": "Caddie 1",
        "number": 1,
        "status": "AVAILABLE",
        "category": "Primera",
        "weekendPriority": 1
      }
    ],
    "Segunda": [...],
    "Tercera": [...],
    "lastUpdate": "2024-01-08T10:30:00Z"
  }
}
```

**Queue Calculation:**
- Filter by category number range
- Only caddies with `isActive = true`
- Only caddies with status `AVAILABLE` or `LATE`
- Sort based on list order type:
  - `ASC`: By number ascending
  - `DESC`: By number descending
  - `RANDOM`: By `weekendPriority` (randomized)
  - `MANUAL`: By `weekendPriority` (manually set)
- Return top 5 per category

#### GET /public/weekly

Get weekly schedule (read-only).

**Query Parameters:**
- `day` (string, optional): Filter by day
- `location` (string, optional): Filter by location

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "day": "Friday",
    "shifts": [...],
    "assignments": [...]
  }
}
```

---

## WebSocket Events

### Connection

**Public Monitor URL:** `ws://localhost:3000/api/public/ws`
**Admin URL:** `ws://localhost:3000/api/admin/ws` (requires JWT authentication)

### Client → Server Events

#### `join:monitor`

Subscribe to queue updates (public).

```json
{
  "location": "Llanogrande"
}
```

#### `join:admin`

Subscribe to admin updates (requires authentication).

```json
{
  "location": "Llanogrande"
}
```

### Server → Client Events

#### `caddie:status:changed`

Emitted when a caddie's status changes.

```json
{
  "caddieId": "uuid",
  "previousStatus": "AVAILABLE",
  "newStatus": "IN_PREP",
  "timestamp": 1704672000000
}
```

#### `caddie:dispatched`

Emitted when caddies are dispatched (for popup notification).

```json
{
  "ids": ["c-1", "c-2", "c-3"],
  "caddies": [
    {
      "id": "c-1",
      "name": "Caddie 1",
      "number": 1,
      "category": "Primera"
    },
    {
      "id": "c-2",
      "name": "Caddie 2",
      "number": 2,
      "category": "Primera"
    },
    {
      "id": "c-3",
      "name": "Caddie 3",
      "number": 3,
      "category": "Primera"
    }
  ],
  "timestamp": 1704672000000
}
```

**Note:** Must be emitted to all connected clients (public + admin) when bulk dispatch is called.

#### `queue:updated`

Emitted when queue state changes.

```json
{
  "category": "Primera",
  "queue": [
    {
      "id": "uuid",
      "name": "Caddie 1",
      "number": 1,
      "status": "AVAILABLE",
      "category": "Primera",
      "weekendPriority": 1
    }
  ],
  "timestamp": 1704672000000
}
```

#### `schedule:updated`

Emitted when weekly schedule is updated.

```json
{
  "day": "Friday",
  "shifts": [...],
  "assignments": [...],
  "timestamp": 1704672000000
}
```

#### `list:updated`

Emitted when list configuration changes.

```json
{
  "listId": "uuid",
  "list": {
    "id": "uuid",
    "name": "First Category",
    ...
  },
  "timestamp": 1704672000000
}
```

---

## Business Logic Requirements

### Queue Management

The backend must calculate the queue based on:

1. **Category Range**: Get caddies whose number falls within `rangeStart` and `rangeEnd` of the category's list
2. **Active Status**: Only caddies with `isActive = true`
3. **Queue Status**: Only caddies with status `AVAILABLE` or `LATE`
4. **Sorting**: Based on list's `order` type:
   - `ASC`: Sort by `number` ascending
   - `DESC`: Sort by `number` descending
   - `RANDOM`: Sort by `weekendPriority` (randomized values)
   - `MANUAL`: Sort by `weekendPriority` (manually assigned values)
5. **Return Top 5**: Return first 5 caddies per category for public queue

### Weekly Draw Generation Algorithm

When `POST /schedule/generate` is called:

1. **Get Shifts**: Retrieve all shifts for the specified day and location, sorted by time ascending
2. **Get Available Pool**: Get all active caddies marked as available for the day
3. **Sort Pool**:
   - Caddies with `isSkippedNextWeek = true` first (priority)
   - Then by `weekendPriority` ascending (lowest first)
4. **Assign Caddies**:
   - For each shift (in time order):
     - For each requirement category:
       - Find eligible caddies from pool:
         - Match category
         - Have availability for the day
         - Not already assigned to another shift
         - Respect time availability restrictions:
           - `full`: Any time
           - `before`: Only shifts before specified time
           - `after`: Only shifts at or after specified time
           - `between`: Only shifts between start and end times
       - Assign caddie and remove from pool
       - Continue until requirement count met or no eligible caddies left
5. **Update Skip Status**:
   - For all caddies in initial pool:
     - If assigned: `isSkippedNextWeek = false`
     - If not assigned: `isSkippedNextWeek = true` (for next week priority)

### Status Transitions

Backend must support these status transitions:

```
AVAILABLE --dispatch--> IN_PREP --field--> IN_FIELD --return--> AVAILABLE
AVAILABLE --markLate--> LATE --dispatch--> IN_PREP
AVAILABLE --markAbsent--> ABSENT
AVAILABLE --markOnLeave--> ON_LEAVE
```

When status changes:
- Update `lastActionTime` with current timestamp
- Log change in `dispatch_history` table
- Emit `caddie:status:changed` WebSocket event
- Emit `queue:updated` WebSocket event if queue affected

### Availability Time Logic

| Range Type | Time Restriction |
|------------|-----------------|
| `full` | Available for any shift time |
| `before` | Available only for shifts strictly before specified time |
| `after` | Available only for shifts at or after specified time |
| `between` | Available only for shifts between specified start and end times (inclusive) |

**Important:** Times should be stored and compared in 24-hour format (HH:mm) for consistent comparison.

### Statistics Calculation

When requesting daily statistics:

- `totalServices`: Sum of all caddies' `historyCount` for the day
- `totalAbsences`: Sum of all caddies' `absencesCount` for the day
- `totalLeaves`: Sum of all caddies' `leaveCount` for the day
- `totalLates`: Sum of all caddies' `lateCount` for the day

---

## Validation Rules

### Caddie Validation

| Field | Rules |
|-------|-------|
| `number` | Required, integer, min: 1, max: 999, unique |
| `name` | Required, string, min: 2 chars, max: 100 chars |
| `category` | Required, enum: `['Primera', 'Segunda', 'Tercera']` |
| `location` | Required, enum: `['Llanogrande', 'Medellín']` |
| `role` | Required, enum: `['Golf', 'Tennis', 'Hybrid']` |
| `availability` | Required, min: 1 day, max: 7 days |
| `weekendPriority` | Optional, integer, default: `number` |

### List Configuration Validation

| Field | Rules |
|-------|-------|
| `name` | Required, string |
| `rangeStart` | Required, integer, min: 1, max: 999 |
| `rangeEnd` | Required, integer, min: 1, max: 999, must be > `rangeStart` |
| `order` | Required, enum: `['ASC', 'DESC', 'RANDOM', 'MANUAL']` |
| `category` | Required, enum: `['Primera', 'Segunda', 'Tercera']` |

### Shift Validation

| Field | Rules |
|-------|-------|
| `time` | Required, format: HH:mm (24-hour) |
| `day` | Required, enum: days of week |
| `location` | Required, enum: `['Llanogrande', 'Medellín']` |
| `requirements.count` | Required, integer, min: 1, max: 50 |

---

## Authentication

### JWT Token Payload

```typescript
{
  userId: string
  email: string
  role: 'admin' | 'operator'
  location: 'Llanogrande' | 'Medellín'
  iat: number
  exp: number
}
```

### Protected Routes

All admin endpoints require valid JWT token in `Authorization` header:

```
Authorization: Bearer <token>
```

### Token Expiration

- Access tokens: 24 hours

---

## Time Zone Handling

- All timestamps in database: UTC
- All API responses: ISO 8601 format with timezone
- Time fields (shifts, availability): Store in 24-hour format (HH:mm)

---

## CSV Export Format

When downloading reports, CSV should have these columns:

```
Number,Name,Category,Current Status,Today Services,Absences,Leaves,Delays
1,Caddie 1,Primera,AVAILABLE,5,2,0,1
2,Caddie 2,Segunda,IN_FIELD,3,0,1,0
...
```

- Use UTF-8 encoding
- Include headers row
- Use comma as delimiter
- Quote fields containing commas

---

Last Updated: 2024-01-08
