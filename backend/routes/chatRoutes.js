const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { 
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
} = require("../controllers/chatController");

// Protect all routes
router.use(protect);

// Chat routes
router.route("/")
  .get(fetchChats)
  .post(accessChat);

// Group chat routes
router.post("/group", createGroupChat);
router.put("/group/rename", renameGroup);
router.put("/group/add", addToGroup);
router.put("/group/remove", removeFromGroup);
router.put("/group/leave", leaveGroup);
router.delete("/group/:chatId", deleteGroup);
router.get("/group/:chatId", getGroupDetails);

// Notifications
router.put("/reset-unread", resetUnreadCount);
router.get("/total-unread", getTotalUnreadCount);  // Changed from PUT to GET
router.get("/unread-counts", getAllUnreadCounts);  // Changed from PUT to GET

module.exports = router;