#!/bin/bash

# Sales Order API Integration Test Script
# This script tests all major endpoints of the API

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API base URL
BASE_URL="http://localhost:3300/api"

# Test counters
PASSED=0
FAILED=0

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Function to make API requests and check response
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local test_name=$5

    print_info "Testing: $test_name"

    if [ "$method" = "GET" ] || [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    # Split response and status code
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    # Check status code
    if [ "$status_code" -eq "$expected_status" ]; then
        print_success "$test_name - Status: $status_code"
        echo "$body"
        return 0
    else
        print_error "$test_name - Expected: $expected_status, Got: $status_code"
        echo "$body"
        return 1
    fi
}

# Function to extract JSON field
extract_json_field() {
    local json=$1
    local field=$2
    echo "$json" | grep -o "\"$field\":[0-9]*" | grep -o "[0-9]*" | head -1
}

echo ""
print_info "========================================"
print_info "Sales Order API Integration Tests"
print_info "========================================"
echo ""

# Check if server is running
print_info "Checking if API server is running..."
if ! curl -s "$BASE_URL/../" > /dev/null; then
    print_error "API server is not running at $BASE_URL"
    print_warning "Please start the server with: npm start"
    exit 1
fi
print_success "API server is running"
echo ""

# ========================================
# CUSTOMER TESTS
# ========================================
echo ""
print_info "========================================"
print_info "Testing Customer Endpoints"
print_info "========================================"
echo ""

# Create customer
customer_data='{
  "name": "Integration Test User",
  "email": "test@integration.com",
  "phone": "+1-555-TEST"
}'

response=$(test_endpoint "POST" "/customers" "$customer_data" 201 "Create customer")
customer_id=$(extract_json_field "$response" "id")
echo ""

# List customers
test_endpoint "GET" "/customers?page=1&limit=5" "" 200 "List customers"
echo ""

# Get customer
if [ -n "$customer_id" ]; then
    test_endpoint "GET" "/customers/$customer_id" "" 200 "Get customer by ID"
    echo ""
fi

# Update customer
update_data='{
  "name": "Updated Test User"
}'
if [ -n "$customer_id" ]; then
    test_endpoint "PUT" "/customers/$customer_id" "$update_data" 200 "Update customer"
    echo ""
fi

# ========================================
# GOODS TESTS
# ========================================
echo ""
print_info "========================================"
print_info "Testing Goods Endpoints"
print_info "========================================"
echo ""

# Create goods with inventory
goods_data='{
  "sku": "TEST-LAPTOP-001",
  "goodsName": "Test Laptop",
  "price": 999.99,
  "description": "Integration test laptop",
  "initialStock": 50,
  "minStock": 10
}'

response=$(test_endpoint "POST" "/goods" "$goods_data" 201 "Create goods")
goods_id=$(extract_json_field "$response" "id")
echo ""

# Create second goods with low stock
goods_data_low='{
  "sku": "TEST-MOUSE-001",
  "goodsName": "Test Mouse",
  "price": 29.99,
  "description": "Integration test mouse",
  "initialStock": 3,
  "minStock": 5
}'

response=$(test_endpoint "POST" "/goods" "$goods_data_low" 201 "Create goods (low stock)")
goods_id_low=$(extract_json_field "$response" "id")
echo ""

# Create third goods with zero stock
goods_data_zero='{
  "sku": "TEST-KEYBOARD-001",
  "goodsName": "Test Keyboard",
  "price": 79.99,
  "description": "Integration test keyboard - out of stock",
  "initialStock": 0,
  "minStock": 10
}'

response=$(test_endpoint "POST" "/goods" "$goods_data_zero" 201 "Create goods (zero stock)")
goods_id_zero=$(extract_json_field "$response" "id")
echo ""

# List goods
test_endpoint "GET" "/goods?page=1&limit=10" "" 200 "List goods"
echo ""

# Get goods
if [ -n "$goods_id" ]; then
    test_endpoint "GET" "/goods/$goods_id" "" 200 "Get goods by ID"
    echo ""
fi

# Update goods
update_goods='{
  "price": 899.99
}'
if [ -n "$goods_id" ]; then
    test_endpoint "PUT" "/goods/$goods_id" "$update_goods" 200 "Update goods"
    echo ""
fi

# ========================================
# INVENTORY TESTS
# ========================================
echo ""
print_info "========================================"
print_info "Testing Inventory Endpoints"
print_info "========================================"
echo ""

# List inventory
test_endpoint "GET" "/inventory?page=1&limit=10" "" 200 "List inventory"
echo ""

# Get inventory by goods ID
if [ -n "$goods_id" ]; then
    test_endpoint "GET" "/inventory/goods/$goods_id" "" 200 "Get inventory by goods ID"
    echo ""
fi

# Check availability
check_availability='{
  "items": [
    { "goodsId": '"$goods_id"', "quantity": 5 },
    { "goodsId": '"$goods_id_low"', "quantity": 2 }
  ]
}'
if [ -n "$goods_id" ] && [ -n "$goods_id_low" ]; then
    test_endpoint "POST" "/inventory/check" "$check_availability" 200 "Check availability"
    echo ""
fi

# Get inventory ID for stock update test
if [ -n "$goods_id" ]; then
    inventory_response=$(curl -s "$BASE_URL/inventory/goods/$goods_id")
    inventory_id=$(extract_json_field "$inventory_response" "id")
fi

# Update stock - add
if [ -n "$inventory_id" ]; then
    update_stock='{
      "action": "add",
      "quantity": 20
    }'
    test_endpoint "PUT" "/inventory/$inventory_id" "$update_stock" 200 "Update stock (add)"
    echo ""
fi

# ========================================
# ORDER TESTS - REGULAR ORDER
# ========================================
echo ""
print_info "========================================"
print_info "Testing Order Endpoints - Regular Order"
print_info "========================================"
echo ""

# Create regular order (all items in stock)
order_data='{
  "customerId": '"$customer_id"',
  "items": [
    { "goodsId": '"$goods_id"', "quantity": 2 },
    { "goodsId": '"$goods_id_low"', "quantity": 1 }
  ],
  "deliveryAddress": "123 Test St, Integration City, IC 12345",
  "notes": "Integration test order"
}'

if [ -n "$customer_id" ] && [ -n "$goods_id" ] && [ -n "$goods_id_low" ]; then
    response=$(test_endpoint "POST" "/orders" "$order_data" 201 "Create regular order")
    order_id=$(extract_json_field "$response" "id")

    # Check if it's NOT a pre-order
    if echo "$response" | grep -q '"isPreorder":false'; then
        print_success "Order correctly marked as regular order (not pre-order)"
        ((PASSED++))
    else
        print_error "Order should be regular order but marked as pre-order"
        ((FAILED++))
    fi
    echo ""
fi

# List orders
test_endpoint "GET" "/orders?page=1&limit=10" "" 200 "List orders"
echo ""

# Get order
if [ -n "$order_id" ]; then
    test_endpoint "GET" "/orders/$order_id" "" 200 "Get order by ID"
    echo ""
fi

# Update order status
if [ -n "$order_id" ]; then
    status_update='{"status": "CONFIRMED"}'
    test_endpoint "PUT" "/orders/$order_id/status" "$status_update" 200 "Update order status"
    echo ""
fi

# ========================================
# ORDER TESTS - PRE-ORDER
# ========================================
echo ""
print_info "========================================"
print_info "Testing Order Endpoints - Pre-order"
print_info "========================================"
echo ""

# Create pre-order (insufficient stock)
preorder_data='{
  "customerId": '"$customer_id"',
  "items": [
    { "goodsId": '"$goods_id_zero"', "quantity": 5 }
  ],
  "deliveryAddress": "456 Pre-order Ave, Future City, FC 67890",
  "notes": "Integration test pre-order"
}'

if [ -n "$customer_id" ] && [ -n "$goods_id_zero" ]; then
    response=$(test_endpoint "POST" "/orders" "$preorder_data" 201 "Create pre-order")
    preorder_id=$(extract_json_field "$response" "id")

    # Check if it's a pre-order
    if echo "$response" | grep -q '"isPreorder":true'; then
        print_success "Order correctly marked as pre-order"
        ((PASSED++))
    else
        print_error "Order should be pre-order but marked as regular"
        ((FAILED++))
    fi

    # Check for expected delivery date
    if echo "$response" | grep -q '"expectedDeliveryDate"'; then
        print_success "Pre-order has expected delivery date"
        ((PASSED++))
    else
        print_error "Pre-order missing expected delivery date"
        ((FAILED++))
    fi
    echo ""
fi

# Filter pre-orders
test_endpoint "GET" "/orders?isPreorder=true" "" 200 "List pre-orders only"
echo ""

# Add stock for pre-order fulfillment
if [ -n "$goods_id_zero" ]; then
    zero_inventory_response=$(curl -s "$BASE_URL/inventory/goods/$goods_id_zero")
    zero_inventory_id=$(extract_json_field "$zero_inventory_response" "id")

    if [ -n "$zero_inventory_id" ]; then
        add_stock='{"action": "add", "quantity": 100}'
        test_endpoint "PUT" "/inventory/$zero_inventory_id" "$add_stock" 200 "Add stock for pre-order"
        echo ""
    fi
fi

# Fulfill pre-order
if [ -n "$preorder_id" ]; then
    response=$(test_endpoint "POST" "/orders/$preorder_id/fulfill" "" 200 "Fulfill pre-order")

    # Check if pre-order was fulfilled
    if echo "$response" | grep -q '"isPreorder":false'; then
        print_success "Pre-order successfully fulfilled and converted to regular order"
        ((PASSED++))
    else
        print_error "Pre-order fulfillment failed"
        ((FAILED++))
    fi
    echo ""
fi

# ========================================
# ORDER CANCELLATION TEST
# ========================================
echo ""
print_info "========================================"
print_info "Testing Order Cancellation"
print_info "========================================"
echo ""

# Create order to cancel
cancel_order_data='{
  "customerId": '"$customer_id"',
  "items": [
    { "goodsId": '"$goods_id"', "quantity": 1 }
  ],
  "deliveryAddress": "789 Cancel Rd, Test City, TC 11111"
}'

if [ -n "$customer_id" ] && [ -n "$goods_id" ]; then
    # Get current stock before order
    inventory_before=$(curl -s "$BASE_URL/inventory/goods/$goods_id")
    stock_before=$(extract_json_field "$inventory_before" "stock")

    response=$(test_endpoint "POST" "/orders" "$cancel_order_data" 201 "Create order for cancellation")
    cancel_order_id=$(extract_json_field "$response" "id")
    echo ""

    # Cancel the order
    if [ -n "$cancel_order_id" ]; then
        test_endpoint "DELETE" "/orders/$cancel_order_id" "" 200 "Cancel order"
        echo ""

        # Verify stock was restored
        inventory_after=$(curl -s "$BASE_URL/inventory/goods/$goods_id")
        stock_after=$(extract_json_field "$inventory_after" "stock")

        if [ "$stock_before" -eq "$stock_after" ]; then
            print_success "Stock correctly restored after order cancellation"
            ((PASSED++))
        else
            print_error "Stock not restored correctly (Before: $stock_before, After: $stock_after)"
            ((FAILED++))
        fi
        echo ""
    fi
fi

# ========================================
# CLEANUP (Optional)
# ========================================
echo ""
print_info "========================================"
print_info "Cleanup (Deleting Test Data)"
print_info "========================================"
echo ""

# Note: We cannot delete customer with orders, so skip customer deletion
print_warning "Skipping customer deletion (has orders)"
echo ""

# Delete goods will fail if they have orders, which is expected
if [ -n "$goods_id" ]; then
    print_warning "Skipping goods deletion (has orders)"
fi

# ========================================
# TEST SUMMARY
# ========================================
echo ""
print_info "========================================"
print_info "Test Summary"
print_info "========================================"
echo ""

TOTAL=$((PASSED + FAILED))
echo -e "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo ""
    print_success "All tests passed!"
    exit 0
else
    echo ""
    print_error "Some tests failed"
    exit 1
fi
