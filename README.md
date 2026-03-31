# Tableloom Backend

Tableloom Backend is the API and realtime service layer for the Tableloom restaurant ordering platform. It powers tenant-aware restaurant operations such as menu management, kitchen workflows, orders, billing, notifications, image uploads, and role-based admin access.

## Tech Stack

- Node.js
- Express
- MongoDB with Mongoose
- Socket.IO
- Cloudinary / MinIO integrations
- Swagger documentation

## Core Features

- Multi-tenant backend structure
- Authentication and permission-based access control
- Menu, category, size, and price history management
- Order lifecycle and kitchen station handling
- Table, customer, cart, feedback, and waiter-call flows
- Billing, notifications, dashboard, and settings APIs
- Swagger API docs for easier testing and onboarding

## Project Structure

```text
config/         App configuration and Swagger setup
controllers/    Route handlers and business logic
docs/           Swagger path and schema definitions
middleware/     Auth, tenant, and error middleware
models/         Mongoose models
plugins/        Plugin and integration helpers
routes/         Express route modules
utils/          Shared managers and utility helpers
server.js       App entry point
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- MongoDB instance

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file in the project root and add the environment variables required by your local setup, such as:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:5173
```

If you use Cloudinary, MinIO, email, or Firebase-related flows, add those credentials as well based on your deployment setup.

## Available Scripts

```bash
npm run dev
npm start
npm run seed:admin
npm run seed:super-admin
```

## Running the Server

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

## API Documentation

Swagger is configured in the project. After starting the server, open the configured Swagger route in your browser to explore available endpoints.

## Deployment Notes

- Make sure production environment variables are configured before deployment.
- Keep secrets out of version control.
- Confirm CORS, file storage, and database settings for each environment.

## Repository

- GitHub: `https://github.com/Priyanshu-704/Tableloom-backend.git`

