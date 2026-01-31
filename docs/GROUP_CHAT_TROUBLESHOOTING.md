# Group Chat Troubleshooting Guide

**Version:** 1.0  
**Last Updated:** January 14, 2026

## 🚨 Common Issues & Solutions

### Issue 1: "Group not found" after creation

**Symptoms:**
- Group was created successfully (got group ID)
- Cannot retrieve the group
- GET `/api/groups/:id` returns 404

**Causes:**
- Group document not actually saved to MongoDB
- Connection issue to database
- Index not created yet

**Solutions:**
```bash
# 1. Check MongoDB connection
node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ Connected')).catch(e => console.error('❌ Error:', e));"

# 2. Check if groups exist in DB
node -e "const mongoose = require('mongoose'); const Group = require('./models/Group'); require('dotenv').config(); mongoose.connect(process.env.MONGODB_URI).then(async () => { const count = await Group.countDocuments(); console.log('Groups in DB:', count); mongoose.connection.close(); });"

# 3. Rebuild indexes
node -e "const mongoose = require('mongoose'); const Group = require('./models/Group'); require('dotenv').config(); mongoose.connect(process.env.MONGODB_URI).then(async () => { await Group.collection.dropIndexes(); await Group.collection.createIndexes(); console.log('✅ Indexes rebuilt'); mongoose.connection.close(); });"
```

---

### Issue 2: "Not a member of this group" (when you are the creator)

**Symptoms:**
- Group created successfully
- But getting 403 "Not a member of this group" error when trying to view it
- Created user is listed as member but lookup fails

**Root Cause:** ✅ FIXED in this update
- Member lookup methods didn't handle populated objects correctly
- With `.populate('members.user')`, the member.user became an object instead of ObjectId

**Solution:** ✅ Already applied
- The fix has been deployed to `models/Group.js`
- Methods updated: `isMember()`, `getMemberRole()`, `removeMember()`, `updateMemberRole()`

**Verify the fix:**
```bash
# Run the group creation test
node test_group_creation.js

# Should show:
# ✅ Test 4: Checking group membership...
# ✅ User is confirmed as member of group
```

---

### Issue 3: Cannot add members to group

**Symptoms:**
- Creating group works
- Trying to add a member gets error
- POST `/api/groups/:id/add-member` fails

**Causes:**
- Member lookup failing (same as Issue 2)
- User not admin of group
- User already a member

**Solutions:**
```javascript
// Check what error you're getting
// 403: "Only admins can add members" -> Not admin
// 400: "User is already a member" -> Already added
// 500: "Server error" -> Check logs, likely lookup issue

// Test member operations
node test_group_creation.js
```

---

### Issue 4: Group appears in list but details fail to load

**Symptoms:**
- GET `/api/groups` shows the group
- But GET `/api/groups/:id` fails with 403 or 404
- Inconsistent behavior

**Root Cause:** ✅ FIXED
- Population of members causes lookup methods to fail
- The detail endpoint populates members, so it fails

**Solution:** ✅ Already applied
- Same fix as Issue 2 applies here

---

### Issue 5: Invite link not working

**Symptoms:**
- Created invite link successfully
- Can't join group with the code
- GET `/api/groups/join/:inviteCode` fails

**Causes:**
- Group lookup by invite code failing
- Invite link expired or uses exhausted
- Member already joined

**Debug:**
```bash
# Check if invite code exists
node -e "const mongoose = require('mongoose'); const Group = require('./models/Group'); require('dotenv').config(); mongoose.connect(process.env.MONGODB_URI).then(async () => { const g = await Group.findByInviteCode('CODE_HERE'); if(g) { console.log('✅ Group found:', g.name); console.log('Link status:', g.inviteLink); } else { console.log('❌ No group with that code'); } mongoose.connection.close(); });"
```

---

## ✅ Testing Your Fix

### Quick Test
```bash
# Create a new group and verify all operations
node test_group_creation.js

# Expected output:
# ✅ Group creation: WORKING
# ✅ Group retrieval by ID: WORKING
# ✅ User group listing: WORKING
# ✅ Group methods: WORKING
```

### API Test
```bash
# Test via API endpoints (if server is running)
# Requires valid JWT token
bash test_group_api.sh
```

### Manual Test
```bash
# 1. Start server
npm run dev

# 2. In another terminal, create a group
curl -X POST http://localhost:5000/api/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Test Group","description":"Test"}'

# 3. Copy the group ID from response, then retrieve it
curl -X GET http://localhost:5000/api/groups/GROUP_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Should see group details without "Not a member" error
```

---

## 🔍 How to Check Server Logs

### If using `npm run dev` (nodemon):
- Logs print directly to console
- Watch for error messages related to group operations

### Common Log Messages

**Before Fix:**
```
[Group not found] - Member lookup failed even though user was admin
```

**After Fix:**
```
✅ Group retrieved successfully
✅ User verified as member
✅ Permission check passed
```

---

## 🛠️ Debugging Commands

### Find all groups for a user:
```bash
node -e "
const mongoose = require('mongoose');
const Group = require('./models/Group');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = require('./models/User');
  const user = await User.findOne({ email: 'user@example.com' });
  if (!user) return console.log('User not found');
  
  const groups = await Group.findUserGroups(user._id);
  console.log('Groups:', groups.map(g => ({ id: g._id, name: g.name, members: g.memberCount })));
  mongoose.connection.close();
});
"
```

### Check group membership directly:
```bash
node -e "
const mongoose = require('mongoose');
const Group = require('./models/Group');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const user = await User.findOne({ email: 'user@example.com' });
  const group = await Group.findById('GROUP_ID').populate('members.user');
  
  console.log('Group:', group.name);
  console.log('User in group?', group.isMember(user._id));
  console.log('User role:', group.getMemberRole(user._id));
  console.log('Is admin?', group.isAdmin(user._id));
  
  mongoose.connection.close();
});
"
```

---

## 📋 Checklist: Is Everything Working?

- [ ] Can create groups
- [ ] Can see groups in list
- [ ] Can view group details
- [ ] Can verify you are a member of your own group
- [ ] Can add other members
- [ ] Can generate invite links
- [ ] Can join group via invite link
- [ ] Can change member roles (as admin)
- [ ] Can remove members (as admin)
- [ ] Socket.io events work (real-time messages)

---

## 🆘 Still Having Issues?

### Collect Debug Info:
1. Run: `node check_leaderboard.js` (shows system health)
2. Run: `node test_group_creation.js` (tests group functions)
3. Note any error messages
4. Check server logs from `npm run dev`

### Key Files to Check:
- `models/Group.js` - Should have the updated member lookup methods
- `routes/groups.js` - Routes that use the methods
- Server logs - Any error messages

### Restart Required?
Yes, after fixing `models/Group.js`:
```bash
# Stop: Ctrl+C in terminal running "npm run dev"
# Start: npm run dev
```

---

## 📞 Support Info

**This fix was applied to:**
- File: `backend1/models/Group.js`
- Methods: `isMember()`, `getMemberRole()`, `removeMember()`, `updateMemberRole()`
- Issue: Member lookup with populated objects

**Status:** ✅ COMPLETE  
**Verified:** Yes, tested with `test_group_creation.js`  
**Deployment:** Ready for production
