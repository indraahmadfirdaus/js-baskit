# Sales Order API Documentation

A REST API for managing sales orders with pre-order functionality and inventory management. Built with Express.js, Prisma ORM, and PostgreSQL.

## Table of Contents

- [Getting Started](#getting-started)
- [Running the Project](#running-the-project)
- [API Endpoints](#api-endpoints)
  - [Customers](#customers)
  - [Goods](#goods)
  - [Inventory](#inventory)
  - [Orders](#orders)
- [Testing](#testing)
- [Error Handling](#error-handling)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v13 or higher)
- npm or yarn

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Create a `.env` file in the project root:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/js-sandbox?schema=public"
PORT=3300
NODE_ENV=development
```

3. Run database migrations:
```bash
npm run prisma:migrate:dev
```

4. Seed the database with sample data:
```bash
npm run seed
```

## Running the Project

### Development Mode

Start the server:
```bash
npm start
```

The API will be available at `http://localhost:3300`

### Database Management

View database in Prisma Studio:
```bash
npm run prisma:studio
```

Reset database (clears all data):
```bash
npm run prisma:migrate:reset
```

Generate Prisma client after schema changes:
```bash
npm run prisma:generate
```

## API Endpoints

Base URL: `http://localhost:3300/api`

All responses follow this format:
```json
{
  "success": true|false,
  "message": "Description of result",
  "data": {} // Response data (if applicable)
}
```

### Customers

#### Create Customer
```
POST /api/customers
```

Request body:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1-555-0101"
}
```

Response:
```json
{
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1-555-0101",
    "createdAt": "2025-01-16T12:00:00.000Z",
    "updatedAt": "2025-01-16T12:00:00.000Z"
  }
}
```

#### List Customers
```
GET /api/customers?page=1&limit=10&search=john
```

Query parameters:
- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 10
- `search` (optional): Search by name, email, or phone

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1-555-0101",
      "_count": {
        "orders": 3
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

#### Get Customer
```
GET /api/customers/:id
```

Response includes customer details with their last 10 orders.

#### Update Customer
```
PUT /api/customers/:id
```

Request body (all fields optional):
```json
{
  "name": "John Updated",
  "email": "john.new@example.com",
  "phone": "+1-555-9999"
}
```

#### Delete Customer
```
DELETE /api/customers/:id
```

Note: Cannot delete customers with existing orders.

### Goods

#### Create Goods
```
POST /api/goods
```

Request body:
```json
{
  "sku": "LAPTOP-001",
  "goodsName": "Dell XPS 15",
  "price": 1499.99,
  "description": "High-performance laptop",
  "initialStock": 50,
  "minStock": 10
}
```

Response:
```json
{
  "success": true,
  "message": "Goods created successfully",
  "data": {
    "id": 1,
    "sku": "LAPTOP-001",
    "goodsName": "Dell XPS 15",
    "price": "1499.99",
    "description": "High-performance laptop",
    "inventory": {
      "id": 1,
      "goodsId": 1,
      "stock": 50,
      "reservedStock": 0,
      "minStock": 10
    }
  }
}
```

#### List Goods
```
GET /api/goods?page=1&limit=10&search=laptop
```

Query parameters:
- `page` (optional): Page number
- `limit` (optional): Items per page
- `search` (optional): Search by SKU or name

Response includes `availableStock` calculated as `stock - reservedStock`.

#### Get Goods
```
GET /api/goods/:id
```

Returns single goods item with inventory details.

#### Update Goods
```
PUT /api/goods/:id
```

Request body (all fields optional):
```json
{
  "sku": "LAPTOP-002",
  "goodsName": "Dell XPS 15 Updated",
  "price": 1599.99,
  "description": "Updated description"
}
```

#### Delete Goods
```
DELETE /api/goods/:id
```

Note: Cannot delete goods with pending orders.

### Inventory

#### List Inventory
```
GET /api/inventory?page=1&limit=10&lowStock=true
```

Query parameters:
- `page` (optional): Page number
- `limit` (optional): Items per page
- `lowStock` (optional): Filter items with stock below minimum

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "goodsId": 1,
      "stock": 50,
      "reservedStock": 5,
      "minStock": 10,
      "availableStock": 45,
      "isLowStock": false,
      "goods": {
        "id": 1,
        "sku": "LAPTOP-001",
        "goodsName": "Dell XPS 15",
        "price": "1499.99"
      }
    }
  ]
}
```

#### Get Inventory by Goods
```
GET /api/inventory/goods/:goodsId
```

Returns inventory details for specific goods.

#### Update Stock
```
PUT /api/inventory/:id
```

Request body:
```json
{
  "action": "add",
  "quantity": 100,
  "minStock": 15
}
```

Actions:
- `add`: Increase stock
- `reduce`: Decrease stock
- `set`: Set stock to exact value

Note: Cannot reduce stock below reserved stock.

#### Check Availability
```
POST /api/inventory/check
```

Request body:
```json
{
  "items": [
    { "goodsId": 1, "quantity": 5 },
    { "goodsId": 2, "quantity": 10 }
  ]
}
```

Response:
```json
{
  "success": true,
  "allAvailable": true,
  "items": [
    {
      "goodsId": 1,
      "goodsName": "Dell XPS 15",
      "sku": "LAPTOP-001",
      "requestedQuantity": 5,
      "availableStock": 45,
      "available": true
    },
    {
      "goodsId": 2,
      "goodsName": "Mouse",
      "sku": "MOUSE-001",
      "requestedQuantity": 10,
      "availableStock": 8,
      "available": false,
      "reason": "Insufficient stock (only 8 available)"
    }
  ]
}
```

#### Reserve Stock
```
POST /api/inventory/reserve
```

Request body:
```json
{
  "goodsId": 1,
  "quantity": 5
}
```

Used internally by order system for pre-orders.

#### Release Reservation
```
POST /api/inventory/release
```

Request body:
```json
{
  "goodsId": 1,
  "quantity": 5
}
```

Used when cancelling pre-orders.

### Orders

#### Create Order
```
POST /api/orders
```

Request body:
```json
{
  "customerId": 1,
  "items": [
    {
      "goodsId": 1,
      "quantity": 2
    },
    {
      "goodsId": 2,
      "quantity": 1
    }
  ],
  "deliveryAddress": "123 Main St, New York, NY 10001",
  "notes": "Please deliver between 9-5pm"
}
```

Response:
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": 1,
    "notesNumber": "SO-1705410000000-abc123",
    "customerId": 1,
    "isPreorder": false,
    "status": "PENDING",
    "totalAmount": "3099.97",
    "orderDate": "2025-01-16T12:00:00.000Z",
    "expectedDeliveryDate": null,
    "deliveryAddress": "123 Main St, New York, NY 10001",
    "notes": "Please deliver between 9-5pm",
    "customer": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    },
    "items": [
      {
        "id": 1,
        "orderId": 1,
        "goodsId": 1,
        "quantity": 2,
        "unitPrice": "1499.99",
        "totalPrice": "2999.98",
        "goods": {
          "sku": "LAPTOP-001",
          "goodsName": "Dell XPS 15"
        }
      }
    ]
  }
}
```

**Important**:
- If ANY item has insufficient stock, the entire order becomes a pre-order
- Pre-orders have `isPreorder: true` and an `expectedDeliveryDate`
- Regular orders immediately deduct stock
- Pre-orders reserve available stock without deducting

#### List Orders
```
GET /api/orders?page=1&limit=10&status=PENDING&isPreorder=true&customerId=1
```

Query parameters:
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status (PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED)
- `isPreorder` (optional): Filter pre-orders (true/false)
- `customerId` (optional): Filter by customer

#### Get Order
```
GET /api/orders/:id
```

Returns complete order details with customer and items.

#### Update Order Status
```
PUT /api/orders/:id/status
```

Request body:
```json
{
  "status": "CONFIRMED"
}
```

Valid statuses:
- `PENDING`: Order created, awaiting confirmation
- `CONFIRMED`: Order confirmed, ready for processing
- `PROCESSING`: Being prepared for shipment
- `SHIPPED`: Sent to customer
- `DELIVERED`: Received by customer
- `CANCELLED`: Order cancelled

Note: Cancelling an order automatically restores/releases inventory.

#### Cancel Order
```
DELETE /api/orders/:id
```

Cancels the order and restores inventory:
- Regular orders: Stock is returned
- Pre-orders: Reserved stock is released

Note: Cannot cancel delivered orders.

#### Fulfill Pre-order
```
POST /api/orders/:id/fulfill
```

Converts a pre-order to a regular order when stock becomes available.

Process:
1. Checks if all items now have sufficient stock
2. Deducts stock for all items
3. Releases reserved stock
4. Sets `isPreorder: false` and `status: CONFIRMED`

Response:
```json
{
  "success": true,
  "message": "Pre-order fulfilled successfully",
  "data": {
    "id": 2,
    "isPreorder": false,
    "status": "CONFIRMED",
    "expectedDeliveryDate": null
  }
}
```

## Testing

### Manual Testing with cURL

Test the API manually using cURL commands:

```bash
# Create a customer
curl -X POST http://localhost:3300/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","phone":"+1-555-1234"}'

# Create goods
curl -X POST http://localhost:3300/api/goods \
  -H "Content-Type: application/json" \
  -d '{"sku":"TEST-001","goodsName":"Test Product","price":99.99,"initialStock":100}'

# Create order
curl -X POST http://localhost:3300/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":1,"items":[{"goodsId":1,"quantity":2}]}'

# List orders
curl http://localhost:3300/api/orders

# Get order details
curl http://localhost:3300/api/orders/1
```

### Automated Integration Testing

Run the integration test script:

```bash
chmod +x test-api.sh
./test-api.sh
```

The script tests all major endpoints and verifies:
- Customer CRUD operations
- Goods creation with inventory
- Order creation (regular and pre-order)
- Stock management
- Pre-order fulfillment
- Order cancellation

### Testing Pre-order Flow

1. Create goods with low stock:
```bash
curl -X POST http://localhost:3300/api/goods \
  -H "Content-Type: application/json" \
  -d '{"sku":"LOW-001","goodsName":"Low Stock Item","price":50,"initialStock":2}'
```

2. Create order exceeding stock:
```bash
curl -X POST http://localhost:3300/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":1,"items":[{"goodsId":1,"quantity":10}]}'
```

3. Verify order is marked as pre-order:
```bash
curl http://localhost:3300/api/orders/1
# Check: "isPreorder": true
```

4. Add stock:
```bash
curl -X PUT http://localhost:3300/api/inventory/1 \
  -H "Content-Type: application/json" \
  -d '{"action":"add","quantity":20}'
```

5. Fulfill pre-order:
```bash
curl -X POST http://localhost:3300/api/orders/1/fulfill
```

6. Verify stock was deducted:
```bash
curl http://localhost:3300/api/inventory/goods/1
```

### Testing Race Conditions

The API uses pessimistic locking to prevent race conditions. To test:

1. Install `apache2-utils` (for `ab` tool):
```bash
# Ubuntu/Debian
sudo apt-get install apache2-utils

# macOS
brew install apache-bench
```

2. Create test data and run concurrent requests:
```bash
# Create 100 concurrent requests trying to order the same item
ab -n 100 -c 10 -p order.json -T application/json http://localhost:3300/api/orders
```

3. Verify inventory consistency:
```bash
curl http://localhost:3300/api/inventory
```

Stock should never go negative and all orders should either succeed or fail cleanly.

## Error Handling

### Common Error Responses

**400 Bad Request**
```json
{
  "success": false,
  "message": "Customer ID and items array are required"
}
```

**404 Not Found**
```json
{
  "success": false,
  "message": "Order not found"
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "message": "Failed to create order",
  "stack": "Error stack trace (in development mode only)"
}
```

### Business Logic Errors

**Insufficient Stock**
```json
{
  "success": false,
  "message": "Cannot reduce stock below reserved stock (5)"
}
```

**Duplicate SKU**
```json
{
  "success": false,
  "message": "SKU already exists"
}
```

**Cannot Delete with Dependencies**
```json
{
  "success": false,
  "message": "Cannot delete customer with existing orders"
}
```

## Development Tips

### Database Schema Updates

After modifying `prisma/schema.prisma`:

```bash
# Create migration
npm run prisma:migrate:dev -- --name describe_your_changes

# Apply migration
npm run prisma:migrate:deploy

# Regenerate client
npm run prisma:generate
```

### Viewing Logs

The API logs all requests to console:
```
[2025-01-16T12:00:00.000Z] POST /api/orders
```

### Resetting Test Data

To reset the database and reseed:
```bash
npm run prisma:migrate:reset
npm run seed
```

This will:
1. Drop the database
2. Recreate it
3. Run all migrations
4. Seed with sample data

### Common Issues

**Connection Refused**
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify DATABASE_URL in `.env`

**Prisma Client Not Found**
- Run: `npm run prisma:generate`

**Port Already in Use**
- Change PORT in `.env`
- Or kill existing process: `lsof -ti:3300 | xargs kill`

## API Design Principles

### Idempotency

- GET requests are always safe and idempotent
- DELETE requests are idempotent (deleting twice has same effect)
- POST/PUT requests are NOT idempotent (create new resources)

### Consistency

- All monetary values use Decimal type for precision
- All timestamps in ISO 8601 format
- Stock calculations: `availableStock = stock - reservedStock`

### Transaction Safety

- All order creation uses database transactions
- Inventory updates are atomic
- SELECT FOR UPDATE prevents race conditions
- Serializable isolation level ensures consistency

## Performance Considerations

### Current Implementation

- Handles up to ~100 requests/second
- Uses pessimistic locking (SELECT FOR UPDATE)
- Single database connection pool

### Scaling for Higher Traffic

For >500 req/s, implement the queue-based approach:
- Add Redis and BullMQ
- Process orders asynchronously
- Scale workers horizontally

## Support

For issues or questions:
1. Check this documentation
2. Inspect database with `npm run prisma:studio`
3. Check server logs for errors
