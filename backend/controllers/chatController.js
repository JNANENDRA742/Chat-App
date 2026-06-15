const asyncHandler = require("express-async-handler");
const Chat = require("../models/chatModel");
const User = require("../models/userModel");

// Create or fetch a one-on-one chat
const accessChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "UserId param not sent with the request" });
  }

  var isChat = await Chat.find({
    isGroupChat: false,
    $and: [
      { users: { $elemMatch: { $eq: req.user._id } } },
      { users: { $elemMatch: { $eq: userId } } }
    ]
  })
    .populate("users", "-password")
    .populate("latestMessage");

  isChat = await User.populate(isChat, {
    path: "latestMessage.sender",
    select: "name profilePicture email"
  });

  if (isChat.length > 0) {
    res.send(isChat[0]);
  } else {
    var chatData = {
      chatName: "sender",
      isGroupChat: false,
      users: [req.user._id, userId]
    };
    
    try {
      const createdChat = await Chat.create(chatData);
      const FullChat = await Chat.findOne({ _id: createdChat._id })
        .populate("users", "-password");
      res.status(200).json(FullChat);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
});

// Fetch all chats for logged-in user
const fetchChats = asyncHandler(async (req, res) => {
  try {
    let chats = await Chat.find({
      users: { $elemMatch: { $eq: req.user._id } },
    })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("latestMessage")
      .sort({ updatedAt: -1 });

    chats = await User.populate(chats, {
      path: "latestMessage.sender",
      select: "name profilePicture email",
    });

    res.status(200).json(chats);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

// Create group chat
const createGroupChat = asyncHandler(async (req, res) => {
  if (!req.body.users || !req.body.name) {
    return res.status(400).json({ message: "Please Fill all the fields" });
  }
  
  let users = req.body.users;
  
  if (typeof users === 'string') {
    users = JSON.parse(users);
  }
  
  if (users.length < 2) {
    return res.status(400).json({ message: "At least 2 users are required to form a group chat" });
  }
  
  users.push(req.user._id);
  
  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users: users,
      isGroupChat: true,
      groupAdmin: req.user._id
    });
    
    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate("users", "-password")
      .populate("groupAdmin", "-password");
    
    res.status(200).json(fullGroupChat);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Rename group
const renameGroup = asyncHandler(async (req, res) => {
  const { chatId, chatName } = req.body;
  
  if (!chatId || !chatName) {
    return res.status(400).json({ message: "Please provide chatId and chatName" });
  }
  
  const chat = await Chat.findById(chatId);
  
  if (!chat) {
    return res.status(404).json({ message: "Chat not found" });
  }
  
  if (chat.groupAdmin.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Only admin can rename group" });
  }
  
  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    { chatName: chatName },
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");
  
  res.status(200).json(updatedChat);
});

// Add users to group
const addToGroup = asyncHandler(async (req, res) => {
  const { chatId, userIds } = req.body;
  
  if (!chatId || !userIds) {
    return res.status(400).json({ message: "Please provide chatId and userIds" });
  }
  
  const chat = await Chat.findById(chatId);
  
  if (!chat) {
    return res.status(404).json({ message: "Chat not found" });
  }
  
  if (chat.groupAdmin.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Only admin can add members" });
  }
  
  const usersToAdd = Array.isArray(userIds) ? userIds : [userIds];
  
  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      $addToSet: { users: { $each: usersToAdd } },
    },
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");
  
  res.status(200).json(updatedChat);
});

// Remove user from group
const removeFromGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;
  
  if (!chatId || !userId) {
    return res.status(400).json({ message: "Please provide chatId and userId" });
  }
  
  const chat = await Chat.findById(chatId);
  
  if (!chat) {
    return res.status(404).json({ message: "Chat not found" });
  }
  
  const isAdmin = chat.groupAdmin.toString() === req.user._id.toString();
  const isSelfRemoval = userId === req.user._id.toString();
  
  if (!isAdmin && !isSelfRemoval) {
    return res.status(403).json({ message: "Only admin can remove members" });
  }
  
  if (isAdmin && isSelfRemoval && chat.users.length === 1) {
    return res.status(400).json({ message: "Admin cannot leave empty group" });
  }
  
  let updateQuery = { $pull: { users: userId } };
  
  if (isAdmin && isSelfRemoval && chat.users.length > 1) {
    const newAdmin = chat.users.find(user => user.toString() !== userId);
    if (newAdmin) {
      updateQuery = {
        $pull: { users: userId },
        $set: { groupAdmin: newAdmin }
      };
    }
  }
  
  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    updateQuery,
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");
  
  res.status(200).json(updatedChat);
});

// Leave group
const leaveGroup = asyncHandler(async (req, res) => {
  const { chatId } = req.body;
  
  if (!chatId) {
    return res.status(400).json({ message: "Please provide chatId" });
  }
  
  const chat = await Chat.findById(chatId);
  
  if (!chat) {
    return res.status(404).json({ message: "Chat not found" });
  }
  
  if (!chat.users.includes(req.user._id)) {
    return res.status(400).json({ message: "User not in group" });
  }
  
  let updateQuery = { $pull: { users: req.user._id } };
  
  if (chat.groupAdmin.toString() === req.user._id.toString() && chat.users.length > 1) {
    const newAdmin = chat.users.find(user => user.toString() !== req.user._id.toString());
    if (newAdmin) {
      updateQuery = {
        $pull: { users: req.user._id },
        $set: { groupAdmin: newAdmin }
      };
    }
  }
  
  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    updateQuery,
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");
  
  res.status(200).json(updatedChat);
});

// Delete group
const deleteGroup = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  
  if (!chatId) {
    return res.status(400).json({ message: "Please provide chatId" });
  }
  
  const chat = await Chat.findById(chatId);
  
  if (!chat) {
    return res.status(404).json({ message: "Chat not found" });
  }
  
  if (chat.groupAdmin.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Only admin can delete group" });
  }
  
  await Chat.findByIdAndDelete(chatId);
  
  res.status(200).json({ message: "Group deleted successfully" });
});

// Get group details
const getGroupDetails = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  
  const chat = await Chat.findById(chatId)
    .populate("users", "-password")
    .populate("groupAdmin", "-password");
  
  if (!chat) {
    return res.status(404).json({ message: "Chat not found" });
  }
  
  res.status(200).json(chat);
});

// Reset unread count for a chat
const resetUnreadCount = asyncHandler(async (req, res) => {
  const { chatId } = req.body;
  const chat = await Chat.findById(chatId);

  if (!chat) {
    return res.status(404).json({ message: "Chat Not Found" });
  }
  
  await chat.resetUnreadCount(req.user._id);
  res.status(200).json({ 
    message: "Unread count reset successfully",
    chatId: chatId 
  });
});

// Get total unread count across all chats
const getTotalUnreadCount = asyncHandler(async (req, res) => {
  const chats = await Chat.find({
    users: { $elemMatch: { $eq: req.user._id } }
  });
  
  let totalUnreadCount = 0;
  chats.forEach(chat => {
    totalUnreadCount += chat.getUnreadCount(req.user._id);
  });

  res.status(200).json({ totalUnreadCount });
});

// Get unread counts for all chats
const getAllUnreadCounts = asyncHandler(async (req, res) => {
  const chats = await Chat.find({
    users: { $elemMatch: { $eq: req.user._id } }
  });
  
  const unreadData = chats.map(chat => ({
    chatId: chat._id,
    chatName: chat.chatName,
    isGroupChat: chat.isGroupChat,
    unreadCount: chat.getUnreadCount(req.user._id),
    latestMessage: chat.latestMessage
  }));
  
  res.status(200).json(unreadData);
});

module.exports = { 
  accessChat, 
  fetchChats, 
  createGroupChat, 
  renameGroup, 
  addToGroup, 
  removeFromGroup, 
  leaveGroup, 
  deleteGroup,
  getGroupDetails,
  resetUnreadCount,
  getTotalUnreadCount,
  getAllUnreadCounts
};