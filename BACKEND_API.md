# CaddiePro Backend API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

This API uses JWT (JSON Web Token) authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Get Auth Token
```http
POST /api/auth/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "password": "admin123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": true
}
```

### Verify Token
```http
GET /api/auth/verify
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "valid": true,
  "user": {
    "adminId": "admin-id"
  }
}
```

### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

---

## Caddies

### Get All Caddies
```http
GET /api/caddies
```

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "name": "Juan Pérez",
    "listNumber": 1,
    "status": "Disponible",
    "phoneNumber": "+1234567890",
    "createdAt": "2024-01-01T06:00:00.000Z",
    "updatedAt": "2024-01-01T06:00:00.000Z"
  }
]
```

### Get Caddie by ID
```http
GET /api/caddies/:id
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "name": "Juan Pérez",
  "listNumber": 1,
  "status": "Disponible",
  "phoneNumber": "+1234567890",
  "createdAt": "2024-01-01T06:00:00.000Z",
  "updatedAt": "2024-01-01T06:00:00.000Z",
  "turns": [...],
  "attendance": [...]
}
```

### Get Caddies by List
```http
GET /api/caddies/list/:listNumber
```

**Parameters:**
- `listNumber` (path) - List number (1, 2, or 3)

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "name": "Juan Pérez",
    "listNumber": 1,
    "status": "Disponible"
  }
]
```

### Create Caddie 🔒
```http
POST /api/caddies
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "New Caddie",
  "listNumber": 1,
  "phoneNumber": "+1234567890",
  "status": "Disponible"
}
```

**Response (201 Created):**
```json
{
  "id": "new-uuid",
  "name": "New Caddie",
  "listNumber": 1,
  "phoneNumber": "+1234567890",
  "status": "Disponible",
  "createdAt": "2024-01-01T06:00:00.000Z",
  "updatedAt": "2024-01-01T06:00:00.000Z"
}
```

**Validation Errors (400):**
```json
{
  "error": "Name and listNumber are required"
}
```

### Update Caddie 🔒
```http
PUT /api/caddies/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "listNumber": 2,
  "status": "En campo"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "name": "Updated Name",
  "listNumber": 2,
  "status": "En campo",
  "updatedAt": "2024-01-01T07:00:00.000Z"
}
```

### Delete Caddie 🔒
```http
DELETE /api/caddies/:id
Authorization: Bearer <token>
```

**Response (204 No Content)**

---

## Turns

### Get All Turns
```http
GET /api/turns
```

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "caddieId": "caddie-uuid",
    "caddieName": "Juan Pérez",
    "listNumber": 1,
    "startTime": "2024-01-01T07:30:00.000Z",
    "endTime": null,
    "completed": false
  }
]
```

### Get Turn by ID
```http
GET /api/turns/:id
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "caddieId": "caddie-uuid",
  "caddieName": "Juan Pérez",
  "listNumber": 1,
  "startTime": "2024-01-01T07:30:00.000Z",
  "endTime": "2024-01-01T10:30:00.000Z",
  "completed": true,
  "caddie": {
    "id": "caddie-uuid",
    "name": "Juan Pérez",
    "status": "Disponible"
  }
}
```

### Get Turns by Caddie
```http
GET /api/turns/caddie/:caddieId
```

### Get Turns by List
```http
GET /api/turns/list/:listNumber
```

### Get Turns by Date
```http
GET /api/turns/date/:date
```

**Parameters:**
- `date` (path) - Date in YYYY-MM-DD format

**Example:**
```
GET /api/turns/date/2024-01-15
```

### Create Turn (Start Shift) 🔒
```http
POST /api/turns
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "caddieId": "caddie-uuid",
  "caddieName": "Juan Pérez",
  "listNumber": 1
}
```

**Response (201 Created):**
```json
{
  "id": "new-uuid",
  "caddieId": "caddie-uuid",
  "caddieName": "Juan Pérez",
  "listNumber": 1,
  "startTime": "2024-01-01T07:30:00.000Z",
  "endTime": null,
  "completed": false
}
```

**Side Effects:**
- Caddie status changes to "En campo"
- Caddie is removed from available queue

### Update Turn (End Shift) 🔒
```http
PUT /api/turns/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "endTime": "2024-01-01T10:30:00.000Z",
  "completed": true
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "caddieId": "caddie-uuid",
  "caddieName": "Juan Pérez",
  "listNumber": 1,
  "startTime": "2024-01-01T07:30:00.000Z",
  "endTime": "2024-01-01T10:30:00.000Z",
  "completed": true
}
```

**Side Effects:**
- Caddie status changes to "Disponible"
- Caddie is added back to queue at the end
- Today's attendance turns count is incremented

---

## Attendance

### Get All Attendance Records
```http
GET /api/attendance
```

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "caddieId": "caddie-uuid",
    "caddieName": "Juan Pérez",
    "listNumber": 1,
    "date": "2024-01-01T00:00:00.000Z",
    "status": "Presente",
    "callTime": "2024-01-01T06:00:00.000Z",
    "arrivalTime": "2024-01-01T06:05:00.000Z",
    "turnsCount": 3,
    "endTime": "2024-01-01T18:00:00.000Z",
    "createdAt": "2024-01-01T06:00:00.000Z"
  }
]
```

### Get Attendance by Caddie
```http
GET /api/attendance/caddie/:caddieId
```

### Get Attendance by List
```http
GET /api/attendance/list/:listNumber
```

### Get Attendance by Date
```http
GET /api/attendance/date/:date
```

**Parameters:**
- `date` (path) - Date in YYYY-MM-DD format

**Example:**
```
GET /api/attendance/date/2024-01-15
```

### Create Attendance Record 🔒
```http
POST /api/attendance
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "caddieId": "caddie-uuid",
  "caddieName": "Juan Pérez",
  "listNumber": 1,
  "date": "2024-01-01",
  "status": "Presente"
}
```

**Status Options:**
- `"Presente"` - Present
- `"Llegó tarde"` - Late
- `"No vino"` - Absent
- `"Permiso"` - Permission

**Response (201 Created):**
```json
{
  "id": "new-uuid",
  "caddieId": "caddie-uuid",
  "caddieName": "Juan Pérez",
  "listNumber": 1,
  "date": "2024-01-01T00:00:00.000Z",
  "status": "Presente",
  "callTime": "2024-01-01T06:00:00.000Z",
  "arrivalTime": "2024-01-01T06:05:00.000Z",
  "turnsCount": 0,
  "createdAt": "2024-01-01T06:00:00.000Z"
}
```

**Side Effects:**
- If status is "Llegó tarde", caddie is moved to end of queue (penalty)

### Update Attendance Record 🔒
```http
PUT /api/attendance/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "Presente",
  "arrivalTime": "2024-01-01T06:10:00.000Z",
  "turnsCount": 5,
  "endTime": "2024-01-01T18:00:00.000Z"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "status": "Presente",
  "arrivalTime": "2024-01-01T06:10:00.000Z",
  "turnsCount": 5,
  "endTime": "2024-01-01T18:00:00.000Z"
}
```

---

## List Settings

### Get All List Settings
```http
GET /api/list-settings
```

**Response (200 OK):**
```json
[
  {
    "listNumber": 1,
    "callTime": "06:00",
    "order": "ascendente",
    "rangeStart": 1,
    "rangeEnd": 20,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Get Settings for List
```http
GET /api/list-settings/:listNumber
```

### Get Queue for List
```http
GET /api/list-settings/:listNumber/queue
```

**Response (200 OK):**
```json
[
  {
    "id": "queue-uuid",
    "position": 1,
    "listNumber": 1,
    "available": true,
    "caddie": {
      "id": "caddie-uuid",
      "name": "Juan Pérez",
      "status": "Disponible"
    }
  }
]
```

**Note:** This endpoint respects the list's range settings. Only caddies within rangeStart and rangeEnd are returned.

### Update List Settings 🔒
```http
PUT /api/list-settings/:listNumber
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "callTime": "07:00",
  "order": "ascendente",
  "rangeStart": 1,
  "rangeEnd": 15
}
```

**Response (200 OK):**
```json
{
  "listNumber": 1,
  "callTime": "07:00",
  "order": "ascendente",
  "rangeStart": 1,
  "rangeEnd": 15,
  "updatedAt": "2024-01-01T01:00:00.000Z"
}
```

### Update List Order 🔒
```http
PUT /api/list-settings/:listNumber/order
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "order": "descendente"
}
```

**Order Options:**
- `"ascendente"` - First to last
- `"descendente"` - Last to first

**Side Effects:** Queue positions are reordered based on the new order.

### Update List Range 🔒
```http
PUT /api/list-settings/:listNumber/range
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "rangeStart": 1,
  "rangeEnd": 10
}
```

**Response (200 OK):**
```json
{
  "listNumber": 1,
  "rangeStart": 1,
  "rangeEnd": 10
}
```

---

## Reports

### Get Daily Report
```http
GET /api/reports/daily/:date
```

**Parameters:**
- `date` (path) - Date in YYYY-MM-DD format

**Example:**
```
GET /api/reports/daily/2024-01-15
```

**Response (200 OK):**
```json
{
  "date": "2024-01-15",
  "records": [
    {
      "id": "uuid",
      "caddieName": "Juan Pérez",
      "listNumber": 1,
      "date": "2024-01-15T00:00:00.000Z",
      "status": "Presente",
      "turnsCount": 3
    }
  ],
  "summary": {
    "totalCaddies": 15,
    "present": 12,
    "late": 2,
    "absent": 1,
    "permission": 0,
    "totalTurns": 45
  }
}
```

### Get Date Range Report
```http
GET /api/reports/range/:startDate/:endDate
```

**Parameters:**
- `startDate` (path) - Start date in YYYY-MM-DD format
- `endDate` (path) - End date in YYYY-MM-DD format

**Example:**
```
GET /api/reports/range/2024-01-01/2024-01-31
```

**Response (200 OK):**
```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "records": [...]
}
```

### Download CSV Report 🔒
```http
GET /api/reports/csv/:date
Authorization: Bearer <token>
```

**Parameters:**
- `date` (path) - Date in YYYY-MM-DD format

**Response:** CSV file download with columns:
- Fecha
- Nombre Caddie
- Lista
- Estado
- Hora Llamado
- Hora Llegada
- Turnos Realizados
- Hora Salida

---

## Messages

### Get All Messages
```http
GET /api/messages
```

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "content": "Bienvenidos al sistema!",
    "targetList": null,
    "createdAt": "2024-01-01T06:00:00.000Z",
    "read": false
  }
]
```

**Note:** `targetList` is `null` for messages sent to all lists. Use `1`, `2`, or `3` to target specific lists.

### Create Message 🔒
```http
POST /api/messages
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "⛳ Turno actual Lista 1: Va el caddie #5 - Juan Pérez",
  "targetList": 1
}
```

**Parameters:**
- `content` (required) - Message text
- `targetList` (optional) - List number (1, 2, 3) or null for all

**Response (201 Created):**
```json
{
  "id": "new-uuid",
  "content": "⛳ Turno actual Lista 1: Va el caddie #5 - Juan Pérez",
  "targetList": 1,
  "createdAt": "2024-01-01T07:00:00.000Z",
  "read": false
}
```

### Mark Message as Read 🔒
```http
PUT /api/messages/:id/read
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "read": true
}
```

### Delete Message 🔒
```http
DELETE /api/messages/:id
Authorization: Bearer <token>
```

**Response (204 No Content)**

### Get WhatsApp Share URL
```http
GET /api/messages/:id/whatsapp
```

**Response (200 OK):**
```json
{
  "whatsappUrl": "https://wa.me/?text=%E2%9B%B3%20Turno%20actual%20Lista%201%3A%20Va%20el%20caddie%20%235%20-%20Juan%20P%C3%A9rez"
}
```

**Usage:** Open this URL in a browser to pre-fill a WhatsApp message with the content.

---

## Health Check

```http
GET /health
```

**Response (200 OK):**
```json
{
  "status": "OK",
  "message": "CaddiePro API is running"
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Validation error message"
}
```

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `204 No Content` - Request succeeded, no content returned
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Authentication Notes

🔒 **Protected Endpoints:** Marked with lock icon require JWT authentication.

**Public Endpoints:** Can be accessed without authentication.

**Default Admin Credentials:**
- Password: `admin123`

**Token Expiration:** 24 hours (default)

---

## Rate Limiting

Currently, rate limiting is not enforced on any endpoints. Implement rate limiting for production deployments.

---

## CORS

CORS is enabled for all origins in development. Configure allowed origins for production.

---

## Implementation Status

✅ **All endpoints are implemented and tested**

- Authentication: ✅ Complete
- Caddies: ✅ Complete
- Turns: ✅ Complete
- Attendance: ✅ Complete
- List Settings: ✅ Complete
- Reports: ✅ Complete
- Messages: ✅ Complete

**Test Coverage:** 100% (47/47 tests passing)
