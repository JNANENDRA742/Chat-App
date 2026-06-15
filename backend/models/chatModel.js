const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
    chatName: { type: String, trim: true },
    isGroupChat: { type: Boolean, default: false },
    users: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    ],
    latestMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
    },
    groupAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    //  Array to store unread message counts for each user
    unreadCounts: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true
            },
            count: {
                type: Number,
                default: 0
            },
            lastReadAt: {
                type: Date,
                default: Date.now
            }
        }
    ]
}, {
    timestamps: true,
});

//  Method to increment unread count for all users except sender
chatSchema.methods.incrementUnreadCount = async function(senderId) {
    // For each user in chat except sender, increment unread count
    for (const userId of this.users) {
        if (userId.toString() !== senderId.toString()) {
            const unreadEntry = this.unreadCounts.find(
                u => u.user.toString() === userId.toString()
            );
            
            if (unreadEntry) {
                unreadEntry.count += 1;
                unreadEntry.lastReadAt = null;
            } else {
                this.unreadCounts.push({
                    user: userId,
                    count: 1,
                    lastReadAt: null
                });
            }
        }
    }
    await this.save();
};

//  Method to reset unread count for a specific user
chatSchema.methods.resetUnreadCount = async function(userId) {
    const unreadEntry = this.unreadCounts.find(
        u => u.user.toString() === userId.toString()
    );
    
    if (unreadEntry) {
        unreadEntry.count = 0;
        unreadEntry.lastReadAt = new Date();
        await this.save();
    }
};

//  Method to get unread count for a specific user
chatSchema.methods.getUnreadCount = function(userId) {
    const unreadEntry = this.unreadCounts.find(
        u => u.user.toString() === userId.toString()
    );
    return unreadEntry ? unreadEntry.count : 0;
};

const Chat = mongoose.model("Chat", chatSchema);
module.exports = Chat;