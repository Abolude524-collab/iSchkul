/**
 * Middleware to transform avatar URLs to production-ready URLs
 * 
 * For S3-stored avatars, this ensures the URL is accessible from deployed environments.
 * Local dev URLs are left unchanged.
 */

const getAvatarUrl = (avatar) => {
  if (!avatar) return '';
  
  // Already a proxy URL - good to go
  if (avatar.startsWith('/api/files/')) {
    return avatar;
  }
  
  // S3 URLs or external URLs - already valid
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }
  
  // Relative path or filename - convert to proxy URL
  // This handles legacy data that might just have filename
  const filename = avatar.split('/').pop();
  return `/api/files/content/${filename}`;
};

/**
 * Transform user object to include proper avatar URLs
 */
const transformUserAvatar = (user) => {
  if (!user) return user;
  
  // Handle both plain objects and Mongoose documents
  const userObj = user.toObject ? user.toObject() : { ...user };
  
  if (userObj.avatar) {
    userObj.avatar = getAvatarUrl(userObj.avatar);
  }
  
  if (userObj.chatAvatar) {
    userObj.chatAvatar = getAvatarUrl(userObj.chatAvatar);
  }
  
  return userObj;
};

/**
 * Transform array of users
 */
const transformUsersAvatar = (users) => {
  if (!Array.isArray(users)) return users;
  return users.map(transformUserAvatar);
};

/**
 * Transform group object with populated members
 */
const transformGroupAvatar = (group) => {
  if (!group) return group;
  
  // Handle both plain objects and Mongoose documents
  const groupObj = group.toObject ? group.toObject() : { ...group };
  
  // Transform group avatar
  if (groupObj.avatar) {
    groupObj.avatar = getAvatarUrl(groupObj.avatar);
  }
  
  // Transform member avatars
  if (groupObj.members && Array.isArray(groupObj.members)) {
    groupObj.members = groupObj.members.map(member => {
      if (member.user) {
        const memberObj = { ...member };
        if (typeof member.user === 'object') {
          memberObj.user = transformUserAvatar(member.user);
        }
        return memberObj;
      }
      return member;
    });
  }
  
  // Transform createdBy avatar if populated
  if (groupObj.createdBy && typeof groupObj.createdBy === 'object') {
    groupObj.createdBy = transformUserAvatar(groupObj.createdBy);
  }
  
  return groupObj;
};

/**
 * Transform message with populated sender
 */
const transformMessageAvatar = (message) => {
  if (!message) return message;
  
  const msgObj = message.toObject ? message.toObject() : { ...message };
  
  if (msgObj.sender && typeof msgObj.sender === 'object') {
    msgObj.sender = transformUserAvatar(msgObj.sender);
  }
  
  return msgObj;
};

module.exports = {
  getAvatarUrl,
  transformUserAvatar,
  transformUsersAvatar,
  transformGroupAvatar,
  transformMessageAvatar
};
