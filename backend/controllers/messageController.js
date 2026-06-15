const Message = require("../models/messageModel");
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");

const allMessages = asyncHandler(async (req, res) => {
    try {
        const messages = await Message.find({
            chat: req.params.chatId,
        })
            .populate("sender", "name email profilePicture")
            .populate("chat");

        res.status(200).json(messages);
    } catch (error) {
        res.status(400);
        throw new Error(error.message);
    }
});

const sendMessage = asyncHandler(async (req, res) => {
    const { content, chatId } = req.body;

    if (!content || !chatId) {
        return res.status(400).json({
            message: "Content and chatId are required",
        });
    }

    try {
        let message = await Message.create({
            sender: req.user._id,
            content: content,
            chat: chatId,
        });

        message = await message.populate(
            "sender",
            "name email profilePicture"
        );

        message = await message.populate("chat");

        message = await User.populate(message, {
            path: "chat.users",
            select: "name email profilePicture",
        });

        const chat = await Chat.findByIdAndUpdate(chatId, {
            latestMessage: message._id,
        });

        // Increment unread counts for all users except sender
        await chat.incrementUnreadCount(req.user._id);
        
        // Get the updated chat with full data
        const updatedChat = await Chat.findById(chatId)
            .populate("users", "-password")
            .populate("groupAdmin", "-password");
        
        // Emit socket event with unread count
        const io = req.app.get("io");
        
        // Send message to all users in chat except sender
        updatedChat.users.forEach(user => {
            if (user._id.toString() !== req.user._id.toString()) {
                io.to(user._id.toString()).emit("new notification", {
                    chatId: chatId,
                    message: message,
                    unreadCount: updatedChat.getUnreadCount(user._id)
                });
                
                // Also emit the message itself
                io.to(user._id.toString()).emit("message received", message);
            }
        });
        
        res.status(201).json(message);
    } catch (error) {
        res.status(400);
        throw new Error(error.message);
    }
});

module.exports = {
    sendMessage,
    allMessages,
};