#!/bin/bash

# Group Chat API Test Script
# Tests group creation, retrieval, and membership operations

API_BASE="http://localhost:5000/api"
TOKEN=""  # Will be set after login

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Group Chat API Test Suite ===${NC}\n"

# Step 1: Login to get token
echo -e "${YELLOW}Step 1: Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testimonyabolude7@gmail.com",
    "password": "your_password"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed!${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Logged in successfully${NC}"
echo "Token: ${TOKEN:0:20}...\n"

# Step 2: Create a group
echo -e "${YELLOW}Step 2: Creating a group...${NC}"
GROUP_RESPONSE=$(curl -s -X POST "$API_BASE/groups/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Study Group",
    "description": "A test group for studying together",
    "category": "study",
    "isPrivate": false
  }')

GROUP_ID=$(echo $GROUP_RESPONSE | grep -o '"_id":"[^"]*' | cut -d'"' -f4 | head -1)

if [ -z "$GROUP_ID" ]; then
  echo -e "${RED}❌ Group creation failed!${NC}"
  echo "Response: $GROUP_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Group created${NC}"
echo "Group ID: $GROUP_ID\n"

# Step 3: Retrieve group details
echo -e "${YELLOW}Step 3: Retrieving group details...${NC}"
GROUP_DETAILS=$(curl -s -X GET "$API_BASE/groups/$GROUP_ID" \
  -H "Authorization: Bearer $TOKEN")

GROUP_NAME=$(echo $GROUP_DETAILS | grep -o '"name":"[^"]*' | cut -d'"' -f4)
MEMBER_COUNT=$(echo $GROUP_DETAILS | grep -o '"memberCount":[0-9]*' | cut -d':' -f2)

if [ -z "$GROUP_NAME" ]; then
  echo -e "${RED}❌ Failed to retrieve group!${NC}"
  echo "Response: $GROUP_DETAILS"
  exit 1
fi

echo -e "${GREEN}✅ Group retrieved${NC}"
echo "Name: $GROUP_NAME"
echo "Members: $MEMBER_COUNT\n"

# Step 4: List user's groups
echo -e "${YELLOW}Step 4: Listing user's groups...${NC}"
GROUPS_LIST=$(curl -s -X GET "$API_BASE/groups" \
  -H "Authorization: Bearer $TOKEN")

GROUP_COUNT=$(echo $GROUPS_LIST | grep -o '"_id":"[^"]*' | wc -l)

if [ "$GROUP_COUNT" -eq 0 ]; then
  echo -e "${RED}❌ No groups found!${NC}"
  exit 1
fi

echo -e "${GREEN}✅ User groups retrieved${NC}"
echo "Total groups: $GROUP_COUNT\n"

# Step 5: Generate invite link
echo -e "${YELLOW}Step 5: Generating invite link...${NC}"
INVITE_RESPONSE=$(curl -s -X POST "$API_BASE/groups/$GROUP_ID/invite-link" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "expiresInDays": 7,
    "maxUses": 10
  }')

INVITE_CODE=$(echo $INVITE_RESPONSE | grep -o '"code":"[^"]*' | cut -d'"' -f4)

if [ -z "$INVITE_CODE" ]; then
  echo -e "${RED}❌ Failed to generate invite link!${NC}"
  echo "Response: $INVITE_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Invite link generated${NC}"
echo "Invite Code: $INVITE_CODE\n"

# Final Summary
echo -e "${BLUE}=== Test Summary ===${NC}"
echo -e "${GREEN}✅ All tests passed!${NC}"
echo ""
echo "API Endpoints Tested:"
echo "  ✅ POST   /api/auth/login"
echo "  ✅ POST   /api/groups/create"
echo "  ✅ GET    /api/groups/:id"
echo "  ✅ GET    /api/groups"
echo "  ✅ POST   /api/groups/:id/invite-link"
echo ""
echo "Group Created:"
echo "  ID:   $GROUP_ID"
echo "  Name: $GROUP_NAME"
echo "  Members: $MEMBER_COUNT"
echo ""
echo "Invite Link:"
echo "  Code: $INVITE_CODE"
echo "  URL:  http://localhost:5173/join-group/$INVITE_CODE"
